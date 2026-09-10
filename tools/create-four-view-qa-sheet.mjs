import path from "node:path";
import { Jimp } from "jimp";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) throw new Error("Usage: node tools/create-four-view-qa-sheet.mjs <front-side-back.png> <output.png>");

const source = await Jimp.read(path.resolve(inputArg));
const panelWidth = Math.floor(source.bitmap.width / 3);
const panelHeight = source.bitmap.height;
const front = source.clone().crop({ x: 0, y: 0, w: panelWidth, h: panelHeight });
const left = source.clone().crop({ x: panelWidth, y: 0, w: panelWidth, h: panelHeight });
const right = left.clone().flip({ horizontal: true, vertical: false });
const back = source.clone().crop({ x: panelWidth * 2, y: 0, w: source.bitmap.width - panelWidth * 2, h: panelHeight });
const sheet = new Jimp({ width: panelWidth * 4, height: panelHeight, color: 0x000000ff });
sheet.composite(front, 0, 0);
sheet.composite(left, panelWidth, 0);
sheet.composite(right, panelWidth * 2, 0);
sheet.composite(back, panelWidth * 3, 0);
await sheet.write(path.resolve(outputArg));
console.log(`Created four-view QA sheet: ${path.resolve(outputArg)}`);
