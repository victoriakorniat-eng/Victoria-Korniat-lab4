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
  respond(res, status, JSON.stringify(payload, null, 2));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
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
  sendJson(res, 200, { message: 'Сервер працює' });   // тимчасова заглушка
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