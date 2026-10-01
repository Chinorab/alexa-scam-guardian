/** Rasterizes public/favicon.svg into favicon.ico (32 px PNG inside an ICO) and a 180 px touch icon. */
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync("public/favicon.svg", "utf8");
const png = (size: number) =>
  new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

function icoFromPng(image: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(22, 12); // offset after header and entry
  return Buffer.concat([header, entry, image]);
}

writeFileSync("public/favicon.ico", icoFromPng(png(32), 32));
writeFileSync("public/apple-touch-icon.png", png(180));
console.log("favicon.ico and apple-touch-icon.png written");
