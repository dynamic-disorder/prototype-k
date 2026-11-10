/**
 * Minimal PNG read/write, enough for renderer output and figure crops.
 *
 * Supports 8-bit, non-interlaced truecolour (type 2) and truecolour with alpha
 * (type 6) — what `Windows.Data.Pdf`, poppler and ImageMagick emit by default.
 */
import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const cornerDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= cornerDistance) return left;
  return aboveDistance <= cornerDistance ? above : upperLeft;
}

/**
 * Decode a PNG into raw pixel bytes.
 * @returns {{ width: number, height: number, channels: number, data: Buffer }}
 */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");

  let offset = 8;
  let header = null;
  const dataParts = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        compression: body[10],
        filter: body[11],
        interlace: body[12],
      };
    } else if (type === "IDAT") {
      dataParts.push(body);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!header) throw new Error("PNG has no IHDR");
  if (header.depth !== 8 || header.interlace !== 0) {
    throw new Error(`unsupported PNG: depth ${header.depth}, interlace ${header.interlace}`);
  }

  const channels = header.colorType === 6 ? 4 : header.colorType === 2 ? 3 : 0;
  if (channels === 0) throw new Error(`unsupported PNG colour type ${header.colorType}`);

  const raw = inflateSync(Buffer.concat(dataParts));
  const stride = header.width * channels;
  const pixels = Buffer.alloc(stride * header.height);

  for (let row = 0; row < header.height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    const target = pixels.subarray(row * stride, (row + 1) * stride);
    const previous = row > 0 ? pixels.subarray((row - 1) * stride, row * stride) : null;

    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? target[index - channels] : 0;
      const above = previous ? previous[index] : 0;
      const upperLeft = previous && index >= channels ? previous[index - channels] : 0;

      switch (filter) {
        case 0:
          target[index] = source[index];
          break;
        case 1:
          target[index] = (source[index] + left) & 0xff;
          break;
        case 2:
          target[index] = (source[index] + above) & 0xff;
          break;
        case 3:
          target[index] = (source[index] + ((left + above) >> 1)) & 0xff;
          break;
        case 4:
          target[index] = (source[index] + paeth(left, above, upperLeft)) & 0xff;
          break;
        default:
          throw new Error(`unsupported PNG filter ${filter}`);
      }
    }
  }

  return { width: header.width, height: header.height, channels, data: pixels };
}

/** Encode raw pixels as an 8-bit PNG; `channels` is 3 (RGB) or 4 (RGBA). */
export function encodePng({ width, height, channels, data, filter = 0 }) {
  if (filter < 0 || filter > 4) throw new Error(`unsupported PNG filter ${filter}`);

  const stride = width * channels;
  const rows = Buffer.alloc((stride + 1) * height);

  for (let row = 0; row < height; row += 1) {
    const header = row * (stride + 1);
    rows[header] = filter;
    const target = rows.subarray(header + 1, header + 1 + stride);
    const current = data.subarray(row * stride, (row + 1) * stride);
    const previous = row > 0 ? data.subarray((row - 1) * stride, row * stride) : null;

    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? current[index - channels] : 0;
      const above = previous ? previous[index] : 0;
      const upperLeft = previous && index >= channels ? previous[index - channels] : 0;

      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = (left + above) >> 1;
      else if (filter === 4) predictor = paeth(left, above, upperLeft);

      target[index] = (current[index] - predictor) & 0xff;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;

  const chunk = (type, body) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const payload = Buffer.concat([Buffer.from(type, "latin1"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(payload));
    return Buffer.concat([length, payload, crc]);
  };

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Crop a rectangle from decoded pixels.
 * @param {{ width: number, height: number, channels: number, data: Buffer }} image
 * @param {{ left: number, top: number, width: number, height: number }} rect
 */
export function cropPixels(image, rect) {
  const left = Math.max(0, Math.min(image.width - 1, Math.round(rect.left)));
  const top = Math.max(0, Math.min(image.height - 1, Math.round(rect.top)));
  const width = Math.max(1, Math.min(image.width - left, Math.round(rect.width)));
  const height = Math.max(1, Math.min(image.height - top, Math.round(rect.height)));
  const stride = width * image.channels;
  const data = Buffer.alloc(stride * height);

  for (let row = 0; row < height; row += 1) {
    const start = ((top + row) * image.width + left) * image.channels;
    image.data.copy(data, row * stride, start, start + stride);
  }

  return { width, height, channels: image.channels, data };
}
