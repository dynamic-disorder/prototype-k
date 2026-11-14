/**
 * PNG codec tests: every filter type the decoder accepts, plus the crop
 * clamping and error paths.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { cropPixels, decodePng, encodePng } from "../lib/png.mjs";

/** A small RGBA image whose pixels encode their own coordinates. */
function sample(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = (x * 17 + 3) & 0xff;
      data[offset + 1] = (y * 29 + 5) & 0xff;
      data[offset + 2] = (x * y + 11) & 0xff;
      data[offset + 3] = 255;
    }
  }
  return { width, height, channels: 4, data };
}

for (const filter of [0, 1, 2, 3, 4]) {
  test(`decodes filter type ${filter} back to the source pixels`, () => {
    const source = sample(9, 7);
    const decoded = decodePng(
      encodePng({ width: source.width, height: source.height, channels: 4, data: source.data, filter }),
    );

    assert.equal(decoded.width, source.width);
    assert.equal(decoded.height, source.height);
    assert.ok(decoded.data.equals(source.data), `filter ${filter} must round-trip`);
  });
}

test("rejects a file that is not a PNG", () => {
  assert.throws(() => decodePng(Buffer.from("not a png at all")), /not a PNG/);
});

test("rejects a PNG with an unsupported bit depth", () => {
  const source = sample(2, 2);
  const png = encodePng({ width: 2, height: 2, channels: 4, data: source.data });
  png[24] = 16;

  assert.throws(() => decodePng(png), /unsupported PNG/);
});

test("clamps a crop rectangle that starts outside the image", () => {
  const image = sample(10, 8);
  const cropped = cropPixels(image, { left: -20, top: -20, width: 4, height: 4 });

  assert.equal(cropped.width, 4);
  assert.equal(cropped.height, 4);
  assert.equal(cropped.data[0], image.data[0], "crop starts at the top-left pixel");
});

test("clamps a crop rectangle that runs past the image edge", () => {
  const image = sample(10, 8);
  const cropped = cropPixels(image, { left: 8, top: 6, width: 50, height: 50 });

  assert.equal(cropped.width, 2);
  assert.equal(cropped.height, 2);
});

test("keeps at least one pixel for a rectangle fully outside the image", () => {
  const image = sample(10, 8);
  const cropped = cropPixels(image, { left: 500, top: 500, width: 10, height: 10 });

  assert.equal(cropped.width, 1);
  assert.equal(cropped.height, 1);
});
