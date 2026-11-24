/**
 * Reads a ZIP archive without a dependency: the central directory, then one entry's bytes.
 * A .docx is a ZIP of XML parts, so this is the whole container layer the extractor needs.
 */

import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT = 0xffff;

/**
 * Reads every entry of a ZIP archive held in memory.
 *
 * @param {Buffer} buffer The archive bytes.
 * @returns {Map<string, Buffer>} Entry name to uncompressed bytes, in central-directory order.
 * @throws {Error} When the archive has no end-of-central-directory record or an entry is unsupported.
 */
export function readZip(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`zip: central directory entry ${index} has no signature at ${offset}`);
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    entries.set(name, readEntry(buffer, localOffset, method, compressedSize, name));
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - EOCD_MIN_SIZE - MAX_COMMENT);
  for (let position = buffer.length - EOCD_MIN_SIZE; position >= start; position -= 1) {
    if (buffer.readUInt32LE(position) === EOCD_SIGNATURE) {
      return position;
    }
  }

  throw new Error('zip: no end-of-central-directory record; the file is not a ZIP archive');
}

function readEntry(buffer, localOffset, method, compressedSize, name) {
  if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
    throw new Error(`zip: ${name} has no local header at ${localOffset}`);
  }

  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + compressedSize);

  if (method === 0) {
    return Buffer.from(data);
  }

  if (method === 8) {
    return inflateRawSync(data);
  }

  throw new Error(`zip: ${name} uses compression method ${method}, which this reader does not support`);
}
