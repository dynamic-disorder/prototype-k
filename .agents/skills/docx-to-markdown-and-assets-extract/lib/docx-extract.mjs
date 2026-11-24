/**
 * Turns one .docx into Markdown: headings, paragraphs, lists, tables, images and footnotes, in body
 * order. A DOCX has no pages - pagination belongs to a renderer - so section markers stand where a PDF
 * extractor would write page markers.
 */

import { readZip } from './zip.mjs';
import { attribute, child, childrenOf, descendants, parseXml } from './xml.mjs';

const DOCUMENT_PART = 'word/document.xml';
const STYLES_PART = 'word/styles.xml';
const NUMBERING_PART = 'word/numbering.xml';
const RELATIONSHIPS_PART = 'word/_rels/document.xml.rels';
const FOOTNOTES_PART = 'word/footnotes.xml';
const COMMENTS_PART = 'word/comments.xml';
const IMAGE_RELATIONSHIP = '/image';

/**
 * Extracts one .docx held in memory.
 *
 * @param {Buffer} buffer The .docx bytes.
 * @param {string} name The document id, used in asset references.
 * @returns {{markdown: string, stats: object, images: Array<{name: string, bytes: Buffer}>}} The result.
 * @throws {Error} When the archive holds no document part or no body.
 */
export function extractDocx(buffer, name) {
  const parts = readZip(buffer);
  const documentPart = parts.get(DOCUMENT_PART);
  if (!documentPart) {
    throw new Error(`docx: no ${DOCUMENT_PART}; the file is not a Word document`);
  }

  const document = child(parseXml(documentPart.toString('utf8')), 'w:document');
  const body = child(document, 'w:body');
  if (!body) {
    throw new Error('docx: the document part has no body');
  }

  const footnotes = footnoteTexts(parts.get(FOOTNOTES_PART));
  const state = {
    name,
    parts,
    markdown: [],
    images: [],
    relationships: relationshipsOf(parts.get(RELATIONSHIPS_PART)),
    styles: paragraphStyles(parts.get(STYLES_PART)),
    numbering: numberingFormats(parts.get(NUMBERING_PART)),
    stats: {
      sections: 0,
      paragraphs: 0,
      headings: 0,
      lists: 0,
      tables: 0,
      images: 0,
      footnotes: footnotes.size,
      footnoteReferences: 0,
      comments: commentsCount(parts.get(COMMENTS_PART)),
      pageBreaks: 0,
    },
  };

  appendSection(state);
  for (const block of body.children) {
    if (block.name === 'w:p') {
      appendParagraph(state, block);
    } else if (block.name === 'w:tbl') {
      appendTable(state, block);
    }

    state.stats.pageBreaks += descendants(block, 'w:br')
      .filter((element) => attribute(element, 'w:type') === 'page').length;
  }

  appendFootnoteList(state, footnotes);
  return { markdown: state.markdown.join('\n\n') + '\n', stats: state.stats, images: state.images };
}

function appendSection(state) {
  state.stats.sections += 1;
  state.markdown.push(`<!-- section: ${state.stats.sections} -->`);
}

function appendParagraph(state, paragraph) {
  const properties = child(paragraph, 'w:pPr');
  const styleId = attribute(child(properties, 'w:pStyle'), 'w:val');
  const style = state.styles.get(styleId);
  const heading = style?.heading;
  const numbering = state.numbering.get(numberingId(paragraph)) ?? style?.list;
  const lines = paragraphText(paragraph).split('\n').map(normalize).filter(Boolean);

  state.stats.footnoteReferences += descendants(paragraph, 'w:footnoteReference').length;

  if (heading) {
    appendSection(state);
    state.markdown.push(`${'#'.repeat(heading)} ${lines.join(' ')}`);
    state.stats.headings += 1;
  } else {
    for (const line of lines) {
      if (numbering) {
        state.markdown.push(`${numbering === 'bullet' ? '-' : '1.'} ${line}`);
        state.stats.lists += 1;
      } else {
        state.markdown.push(line);
        state.stats.paragraphs += 1;
      }
    }
  }

  for (const reference of imageReferences(state, paragraph)) {
    state.markdown.push(`![${reference.name}](${reference.path})`);
  }
}

function appendTable(state, table) {
  const rows = childrenOf(table, 'w:tr').map((row) => childrenOf(row, 'w:tc').map(cellText));
  if (rows.length === 0) {
    return;
  }

  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => [...row, ...Array(width - row.length).fill('')]);
  const lines = [
    `| ${padded[0].join(' | ')} |`,
    `| ${Array(width).fill('---').join(' | ')} |`,
    ...padded.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ];

  state.markdown.push(lines.join('\n'));
  state.stats.tables += 1;
}

function appendFootnoteList(state, footnotes) {
  if (footnotes.size === 0) {
    return;
  }

  const entries = [...footnotes.entries()].map(([id, text]) => `- **[^${id}]** ${text}`);
  state.markdown.push(`<!-- footnotes -->\n\n${entries.join('\n')}`);
}

function paragraphText(paragraph) {
  const pieces = [];
  const walk = (element) => {
    for (const candidate of element.children) {
      if (candidate.name === 'w:t') {
        pieces.push(candidate.text);
      } else if (candidate.name === 'w:br' || candidate.name === 'w:cr') {
        pieces.push('\n');
      } else if (candidate.name === 'w:tab') {
        pieces.push(' ');
      } else if (candidate.name === 'w:drawing' || candidate.name === 'w:pict') {
        continue;
      } else {
        walk(candidate);
      }
    }
  };

  walk(paragraph);
  return pieces.join('');
}

function normalize(line) {
  return line.replace(/\s+/g, ' ').trim();
}

function cellText(cell) {
  const text = childrenOf(cell, 'w:p').map(paragraphText).filter(Boolean).join(' ');
  return text.replaceAll('|', '\\|');
}

function numberingId(paragraph) {
  const properties = child(paragraph, 'w:pPr');
  const numbering = properties?.children.find((element) => element.name === 'w:numPr');
  return attribute(child(numbering, 'w:numId'), 'w:val');
}

function imageReferences(state, paragraph) {
  const references = [];
  for (const blip of descendants(paragraph, 'a:blip')) {
    const id = attribute(blip, 'r:embed');
    const target = state.relationships.get(id);
    if (!target) {
      continue;
    }

    const part = state.parts.get(`word/${target}`);
    if (!part) {
      continue;
    }

    state.stats.images += 1;
    const extension = target.slice(target.lastIndexOf('.'));
    const name = `image-${state.stats.images}${extension}`;
    state.images.push({ name, bytes: part });
    references.push({ name, path: `${state.name}.assets/${name}` });
  }

  return references;
}

function paragraphStyles(part) {
  const styles = new Map();
  if (!part) {
    return styles;
  }

  for (const style of descendants(parseXml(part.toString('utf8')), 'w:style')) {
    const id = attribute(style, 'w:styleId');
    const name = attribute(child(style, 'w:name'), 'w:val') ?? '';
    const heading = /^heading\s*(\d)$/i.exec(name) ?? /^Heading(\d)$/i.exec(id ?? '');
    if (!id) {
      continue;
    }

    if (heading) {
      styles.set(id, { heading: Number(heading[1]) });
    } else if (/^list number/i.test(name)) {
      styles.set(id, { list: 'ordered' });
    } else if (/^list/i.test(name)) {
      styles.set(id, { list: 'bullet' });
    }
  }

  return styles;
}

function numberingFormats(part) {
  const formats = new Map();
  if (!part) {
    return formats;
  }

  const numbering = parseXml(part.toString('utf8'));
  const abstracts = new Map();
  for (const abstract of descendants(numbering, 'w:abstractNum')) {
    const id = attribute(abstract, 'w:abstractNumId');
    const level = abstract.children.find((element) => element.name === 'w:lvl');
    const format = attribute(child(level, 'w:numFmt'), 'w:val') ?? 'bullet';
    abstracts.set(id, format === 'bullet' || format === 'none' ? 'bullet' : 'ordered');
  }

  for (const number of descendants(numbering, 'w:num')) {
    const id = attribute(number, 'w:numId');
    const abstractId = attribute(child(number, 'w:abstractNumId'), 'w:val');
    if (id && abstracts.has(abstractId)) {
      formats.set(id, abstracts.get(abstractId));
    }
  }

  return formats;
}

function relationshipsOf(part) {
  const relationships = new Map();
  if (!part) {
    return relationships;
  }

  for (const relationship of descendants(parseXml(part.toString('utf8')), 'Relationship')) {
    const type = attribute(relationship, 'Type') ?? '';
    if (type.endsWith(IMAGE_RELATIONSHIP)) {
      relationships.set(attribute(relationship, 'Id'), attribute(relationship, 'Target'));
    }
  }

  return relationships;
}

function footnoteTexts(part) {
  const notes = new Map();
  if (!part) {
    return notes;
  }

  for (const note of descendants(parseXml(part.toString('utf8')), 'w:footnote')) {
    const id = attribute(note, 'w:id');
    const text = childrenOf(note, 'w:p').map(paragraphText).filter(Boolean).join(' ');
    if (id && text) {
      notes.set(id, text);
    }
  }

  return notes;
}

function commentsCount(part) {
  return part ? descendants(parseXml(part.toString('utf8')), 'w:comment').length : 0;
}
