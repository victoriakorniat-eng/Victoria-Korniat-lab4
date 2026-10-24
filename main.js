import fs from 'node:fs';
import { Command } from 'commander';
import http from 'node:http';

const program = new Command();
program
  .helpOption('--help', 'показати довідку')
  .requiredOption('-i, --input <path>', 'шлях до файлу даних')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .option('-o, --output <path>', 'файл для запису останньої відповіді');
program.parse(process.argv);
const options = program.opts();

if (!/^\d+$/.test(options.port) || Number(options.port) > 65535) {
  console.error('Порт має бути цілим числом від 0 до 65535');
  process.exit(1);
}
const port = Number(options.port);

function respond(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  if (!options.output) {
    respond(res, status, body);
    return;
  }
  fs.writeFile(options.output, body, 'utf8', (err) => {
    if (err) {
      console.error('Помилка запису:', err.message);
      respond(res, 500,
        JSON.stringify({ error: 'Не вдалося записати файл відповіді' }, null, 2));
      return;
    }
    respond(res, status, body);
  });
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

// Перетворює значення з файлу на число; якщо неможливо — null
function toNumber(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function processData(records, showSymbol, minPrice) {
  const result = [];
  for (const rec of records) {
    if (rec === null || typeof rec !== 'object') continue;
    const price = toNumber(rec.price);
    if (minPrice !== null && !(price !== null && price > minPrice)) continue;

    const item = { coin: rec.coin_name ?? null };
    if (showSymbol) item.symbol = rec.symbol ?? null;
    item.date = rec.date ?? null;
    item.price = price;
    result.push(item);
  }
  return result;
}

function handleRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch (e) {
    sendError(res, 400, 'Некоректна адреса запиту');
    return;
  }

  if (url.pathname !== '/') {
    sendError(res, 404, 'Маршрут не знайдено');
    return;
  }

  const showSymbol = url.searchParams.get('symbol') === 'true';

  let minPrice = null;
  if (url.searchParams.has('min_price')) {
    minPrice = toNumber(url.searchParams.get('min_price'));
    if (minPrice === null) {
      sendError(res, 400, 'Параметр min_price має бути числом');
      return;
    }
  }

  fs.readFile(options.input, 'utf8', (err, text) => {
    if (err) {
      sendError(res, 500, 'Не вдалося прочитати файл даних');
      return;
    }
    let records;
    try {
      records = JSON.parse(text);
    } catch (e) {
      sendError(res, 500, 'Файл даних пошкоджений: некоректний JSON');
      return;
    }
    if (!Array.isArray(records)) {
      sendError(res, 500, 'Файл даних має містити JSON-масив');
      return;
    }
    sendJson(res, 200, processData(records, showSymbol, minPrice));
  });
}

fs.access(options.input, fs.constants.R_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    try {
      handleRequest(req, res);
    } catch (e) {
      console.error('Неочікувана помилка:', e);
      sendError(res, 500, 'Внутрішня помилка сервера');
    }
  });

  server.on('error', (e) => {
    console.error('Помилка сервера:', e.message);
    process.exit(1);
  });

  server.listen(port, options.host, () => {
    console.log(`Сервер запущено: http://${options.host}:${port}/`);
  });
});