import { partitionConstraints } from './hard-rules.js';

/**
 * What the model may see: the statement, the semantic constraints and the cleaned code.
 * @typedef {{ statement: string, constraints: Array<{ id: string, text: string }>, source: string }} JudgePayload
 * @typedef {{ name?: string, studentId?: string, email?: string }} Identity
 */

const RAW_PREFIXES = new Set(['R', 'u8R', 'uR', 'UR', 'LR']);
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const REDACTED = '[redacted]';

/** @param {string} c */
const isIdentPart = (c) => /[A-Za-z0-9_]/.test(c);

/**
 * Removes C++ comments. Each comment becomes one space plus the newlines it spanned,
 * so every code line stays on its line number. Strings, characters and raw strings are kept.
 * @param {string} source
 * @returns {string}
 */
export function stripComments(source) {
  const n = source.length;
  let out = '';
  let i = 0;

  /** Copies a quoted literal starting on its opening quote. */
  const copyQuoted = () => {
    const quote = source[i];
    let j = i + 1;
    while (j < n && source[j] !== quote && source[j] !== '\n') {
      j += source[j] === '\\' ? 2 : 1;
    }
    if (j < n && source[j] === quote) j++;
    out += source.slice(i, j);
    i = j;
  };

  while (i < n) {
    const c = source[i];

    if (c === '/' && source[i + 1] === '/') {
      let j = i;
      let newlines = '';
      while (j < n && source[j] !== '\n') {
        // a trailing backslash continues the comment on the next line
        if (source[j] === '\\' && source[j + 1] === '\n') {
          newlines += '\n';
          j++;
        }
        j++;
      }
      out += ' ' + newlines;
      i = j;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += ' ' + source.slice(i, stop).replace(/[^\n]/g, '');
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      copyQuoted();
      continue;
    }
    if (isIdentPart(c)) {
      const start = i;
      // digits and identifiers, with C++14 digit separators such as 1'000
      while (
        i < n &&
        (isIdentPart(source[i]) ||
          (source[i] === "'" &&
            /[0-9]/.test(source[start]) &&
            isIdentPart(source[i + 1] ?? '')))
      ) {
        i++;
      }
      const word = source.slice(start, i);
      out += word;
      if (RAW_PREFIXES.has(word) && source[i] === '"') {
        const open = source.indexOf('(', i);
        const delim = open === -1 ? '' : source.slice(i + 1, open);
        const end = source.indexOf(`)${delim}"`, i);
        const stop = end === -1 ? n : end + delim.length + 2;
        out += source.slice(i, stop);
        i = stop;
      }
      continue;
    }
    out += c;
    i++;
  }

  return out
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

/** @param {string} s */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replaces the student's name, id and email, and any email address, with a marker.
 * shortcut: matches the exact name only, not a name folded into an identifier such as
 * `NguyenVanA`; comments are where names usually are, and stripComments removes those.
 * @param {string} source
 * @param {Identity} identity
 * @returns {string}
 */
export function redactIdentity(source, identity) {
  let out = source.replace(EMAIL, REDACTED);
  for (const value of [identity.name, identity.studentId, identity.email]) {
    if (value && value.trim()) {
      out = out.replace(new RegExp(escapeRegExp(value.trim()), 'gi'), REDACTED);
    }
  }
  return out;
}

/**
 * Builds the only data the model receives. Ban-list constraints are left out (hard rules
 * decide them) and no deduction is sent: the TA sets deductions, the model never sees them.
 * @param {{ statement: string, constraints: import('./hard-rules.js').ConstraintLike[], source: string, identity?: Identity }} input
 * @returns {JudgePayload}
 */
export function buildJudgePayload({
  statement,
  constraints,
  source,
  identity = {},
}) {
  const { semantic } = partitionConstraints(constraints);
  return {
    statement,
    constraints: semantic.map(({ id, text }) => ({ id, text })),
    source: redactIdentity(stripComments(source), identity),
  };
}
