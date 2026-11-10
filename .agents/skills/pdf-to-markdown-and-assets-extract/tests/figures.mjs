/**
 * Crop a vector figure out of its rendered page.
 *
 * The figure box comes from `figureBoxes()` in the fixture extractor, in PDF
 * points; the page render is a raster of the same page, so the box scales by
 * `imageWidth / pageWidth` and flips vertically (PDF origin is bottom-left).
 */
import { readFileSync, writeFileSync } from "node:fs";

import { cropPixels, decodePng, encodePng } from "./png.mjs";

/**
 * Convert a PDF-point box to pixel coordinates inside a page render.
 * @param {{ x: number, y: number, width: number, height: number,
 *   pageWidth: number, pageHeight: number }} box
 * @param {{ width: number, height: number }} image
 */
export function boxToPixels(box, image) {
  const scale = image.width / box.pageWidth;
  return {
    left: box.x * scale,
    top: (box.pageHeight - box.y - box.height) * scale,
    width: box.width * scale,
    height: box.height * scale,
  };
}

/**
 * Crop one figure from a page render and write it as a PNG.
 * @returns {{ path: string, width: number, height: number }}
 */
export function cropFigure(pageImagePath, box, outPath) {
  const image = decodePng(readFileSync(pageImagePath));
  const cropped = cropPixels(image, boxToPixels(box, image));
  writeFileSync(outPath, encodePng(cropped));
  return { path: outPath, width: cropped.width, height: cropped.height };
}
