import fs from 'node:fs';
import { Command } from 'commander';

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

fs.access(options.input, fs.constants.R_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  console.log('Файл знайдено; порт:', port);
});