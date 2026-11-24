/**
 * A small XML reader for WordprocessingML: elements, attributes and text, no dependencies.
 * Regex scanning is enough because the parts this extractor reads are machine-written XML.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const TEXT = /^[^<]+/;
const CLOSE = /^<\/([^\s>]+)\s*>/;
const OPEN = /^<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*"[^"]*")*)\s*(\/?)>/;
const ATTRIBUTE = /([^\s=/>]+)\s*=\s*"([^"]*)"/g;

/**
 * Parses an XML document into a tree of elements.
 *
 * @param {string} text The document text.
 * @returns {{name: string, attrs: Record<string, string>, children: Array, text: string}} The root element wrapper.
 * @throws {Error} When a tag is unbalanced.
 */
export function parseXml(text) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  let position = 0;

  while (position < text.length) {
    if (text.startsWith('<!--', position)) {
      position = skipTo(text, position, '-->');
      continue;
    }

    if (text.startsWith('<![CDATA[', position)) {
      const end = text.indexOf(']]>', position);
      const content = text.slice(position + 9, end === -1 ? text.length : end);
      current(stack).text += content;
      position = end === -1 ? text.length : end + 3;
      continue;
    }

    if (text.startsWith('<?', position)) {
      position = skipTo(text, position, '?>');
      continue;
    }

    if (text.startsWith('<!', position)) {
      position = skipTo(text, position, '>');
      continue;
    }

    if (text[position] !== '<') {
      const match = TEXT.exec(text.slice(position));
      if (match) {
        current(stack).text += decode(match[0]);
        position += match[0].length;
        continue;
      }
    }

    const close = CLOSE.exec(text.slice(position));
    if (close) {
      const open = stack.pop();
      if (stack.length === 0 || open.name !== close[1]) {
        throw new Error(`xml: closing </${close[1]}> does not match <${open?.name ?? 'nothing'}>`);
      }

      position += close[0].length;
      continue;
    }

    const open = OPEN.exec(text.slice(position));
    if (open) {
      const element = { name: open[1], attrs: attributes(open[2]), children: [], text: '' };
      current(stack).children.push(element);
      if (open[3] !== '/') {
        stack.push(element);
      }

      position += open[0].length;
      continue;
    }

    throw new Error(`xml: cannot read a tag at offset ${position}`);
  }

  if (stack.length !== 1) {
    throw new Error(`xml: ${stack.length - 1} element(s) left unclosed`);
  }

  return root;
}

/**
 * Reads the first child element with a name, or undefined.
 *
 * @param {object} node The parent element.
 * @param {string} name The child's name.
 * @returns {object|undefined} The child.
 */
export function child(node, name) {
  return node?.children.find((candidate) => candidate.name === name);
}

/**
 * Reads every child element with a name.
 *
 * @param {object} node The parent element.
 * @param {string} name The child's name.
 * @returns {Array<object>} The matching children.
 */
export function childrenOf(node, name) {
  return node ? node.children.filter((candidate) => candidate.name === name) : [];
}

/**
 * Reads every descendant element with a name, depth first.
 *
 * @param {object} node The element to search.
 * @param {string} name The descendant's name.
 * @returns {Array<object>} The matching descendants, in document order.
 */
export function descendants(node, name) {
  const found = [];
  const walk = (element) => {
    for (const candidate of element.children) {
      if (candidate.name === name) {
        found.push(candidate);
      }

      walk(candidate);
    }
  };

  walk(node);
  return found;
}

/**
 * Reads the text of every descendant with a name, concatenated.
 *
 * @param {object} node The element to search.
 * @param {string} name The descendant's name.
 * @returns {string} The concatenated text.
 */
export function textOf(node, name) {
  return descendants(node, name).map((element) => element.text).join('');
}

/**
 * Reads an attribute, trying the given names in order.
 *
 * @param {object} node The element.
 * @param {...string} names The attribute names to try.
 * @returns {string|undefined} The first value found.
 */
export function attribute(node, ...names) {
  for (const name of names) {
    if (node?.attrs[name] !== undefined) {
      return node.attrs[name];
    }
  }

  return undefined;
}

function current(stack) {
  return stack[stack.length - 1];
}

function skipTo(text, position, marker) {
  const end = text.indexOf(marker, position);
  return end === -1 ? text.length : end + marker.length;
}

function attributes(source) {
  const found = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    found[match[1]] = decode(match[2]);
  }

  return found;
}

function decode(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }

    if (body.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }

    return ENTITIES[body] ?? whole;
  });
}
