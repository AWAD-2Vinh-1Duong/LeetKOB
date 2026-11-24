/**
 * A small C++ tokenizer, enough to tell code from comments and literals.
 * It does not build a full syntax tree; it removes everything that is not code
 * (comments, string and character literals, raw strings) and keeps line numbers.
 *
 * @typedef {{ kind: 'ident' | 'punct' | 'header' | 'number', text: string, line: number }} Token
 */

const STRING_PREFIXES = new Set(['u8', 'u', 'U', 'L']);
const RAW_PREFIXES = new Set(['R', 'u8R', 'uR', 'UR', 'LR']);

/** @param {string} c */
const isIdentStart = (c) => /[A-Za-z_]/.test(c);
/** @param {string} c */
const isIdentPart = (c) => /[A-Za-z0-9_]/.test(c);
/** @param {string} c */
const isDigit = (c) => c >= '0' && c <= '9';

/**
 * @param {string} source
 * @returns {Token[]}
 */
export function tokenize(source) {
  /** @type {Token[]} */
  const tokens = [];
  const n = source.length;
  let i = 0;
  let line = 1;
  let atLineStart = true;

  /** Skips a quoted literal that starts at `i` (on the opening quote). */
  const skipQuoted = () => {
    const quote = source[i];
    i++;
    while (i < n && source[i] !== quote && source[i] !== '\n') {
      if (source[i] === '\\' && i + 1 < n) {
        if (source[i + 1] === '\n') line++;
        i++;
      }
      i++;
    }
    if (i < n && source[i] === quote) i++;
  };

  /** Skips a raw string; `i` is on the opening quote. */
  const skipRaw = () => {
    i++; // opening quote
    let delim = '';
    while (i < n && source[i] !== '(' && source[i] !== '\n')
      delim += source[i++];
    const close = `)${delim}"`;
    const end = source.indexOf(close, i);
    const stop = end === -1 ? n : end + close.length;
    for (let k = i; k < stop; k++) if (source[k] === '\n') line++;
    i = stop;
  };

  while (i < n) {
    const c = source[i];

    if (c === '\n') {
      line++;
      i++;
      atLineStart = true;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
      i++;
      continue;
    }

    if (c === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') {
        // a trailing backslash continues the comment on the next line
        if (source[i] === '\\' && source[i + 1] === '\n') {
          line++;
          i++;
        }
        i++;
      }
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k++) if (source[k] === '\n') line++;
      i = stop;
      continue;
    }

    if (c === '#' && atLineStart) {
      i++;
      while (source[i] === ' ' || source[i] === '\t') i++;
      let directive = '';
      while (i < n && isIdentPart(source[i])) directive += source[i++];
      atLineStart = false;
      if (directive === 'include') {
        while (source[i] === ' ' || source[i] === '\t') i++;
        if (source[i] === '<') {
          const end = source.indexOf('>', i);
          const stop = end === -1 ? n : end;
          const name = source.slice(i, stop + 1).replace(/\s+/g, '');
          tokens.push({ kind: 'header', text: name, line });
          i = stop + 1;
        } else if (source[i] === '"') {
          skipQuoted();
        }
      }
      continue;
    }
    atLineStart = false;

    if (c === '"' || c === "'") {
      skipQuoted();
      continue;
    }

    if (isIdentStart(c)) {
      const start = i;
      while (i < n && isIdentPart(source[i])) i++;
      const word = source.slice(start, i);
      if (RAW_PREFIXES.has(word) && source[i] === '"') {
        skipRaw();
        continue;
      }
      if (
        STRING_PREFIXES.has(word) &&
        (source[i] === '"' || source[i] === "'")
      ) {
        skipQuoted();
        continue;
      }
      tokens.push({ kind: 'ident', text: word, line });
      continue;
    }

    if (isDigit(c) || (c === '.' && isDigit(source[i + 1] ?? ''))) {
      const start = i;
      i++;
      while (i < n) {
        const d = source[i];
        const prev = source[i - 1];
        if (isIdentPart(d) || d === '.') i++;
        else if (d === "'" && isIdentPart(source[i + 1] ?? '')) i++;
        else if ((d === '+' || d === '-') && /[eEpP]/.test(prev)) i++;
        else break;
      }
      tokens.push({ kind: 'number', text: source.slice(start, i), line });
      continue;
    }

    if (c === ':' && source[i + 1] === ':') {
      tokens.push({ kind: 'punct', text: '::', line });
      i += 2;
      continue;
    }
    if (c === '-' && source[i + 1] === '>') {
      tokens.push({ kind: 'punct', text: '->', line });
      i += 2;
      continue;
    }
    tokens.push({ kind: 'punct', text: c, line });
    i++;
  }

  return tokens;
}
