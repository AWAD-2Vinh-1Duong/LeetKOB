import { tokenize } from './cpp-tokens.js';

/**
 * @typedef {{ line: number, text: string }} EvidenceLine
 * @typedef {{ verdict: 'pass' | 'violation', evidence: EvidenceLine[] }} BanListResult
 * @typedef {{ id: string, text: string, deduction?: number }} ConstraintLike
 * @typedef {{
 *   constraintId: string,
 *   verdict: 'pass' | 'violation',
 *   evidence: EvidenceLine[],
 *   decidedBy: 'hard-rule',
 * }} HardDecision
 * @typedef {import('./cpp-tokens.js').Token} Token
 */

const BAN_START = /^\s*Do not (?:use|call)\b/;

/**
 * A ban-list constraint starts with "Do not use" or "Do not call" and names
 * every banned thing in backticks. Anything else is a semantic constraint.
 * @param {string} text
 * @returns {{ names: string[] } | null}
 */
export function parseBanList(text) {
  if (!BAN_START.test(text)) return null;
  const names = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  return names.length > 0 ? { names } : null;
}

/** @param {Token | undefined} t @param {string} text */
const isPunct = (t, text) => t?.kind === 'punct' && t.text === text;

// Words that can stand right before a call without making it a declaration.
const NOT_A_TYPE = new Set([
  'return',
  'else',
  'do',
  'case',
  'new',
  'delete',
  'throw',
  'co_return',
  'co_await',
  'co_yield',
  'sizeof',
  'alignof',
  'decltype',
  'typeid',
  'not',
  'and',
  'or',
]);

/**
 * Whether the code declares or defines its own function `name` (`void sort(`, `long long gcd(`).
 * Then an unqualified `name(...)` calls the student's function, not the library one.
 * @param {Token[]} tokens
 * @param {string} name
 */
function declaresOwn(tokens, name) {
  return tokens.some(
    (t, k) =>
      t.kind === 'ident' &&
      t.text === name &&
      isPunct(tokens[k + 1], '(') &&
      tokens[k - 1]?.kind === 'ident' &&
      !NOT_A_TYPE.has(tokens[k - 1].text),
  );
}

/**
 * Whether the tokens before `idx` say "using namespace <ns>;" or "using <ns>::<base>;".
 * @param {Token[]} tokens
 * @param {number} idx
 * @param {string[]} quals
 * @param {string} base
 */
function isBroughtIntoScope(tokens, idx, quals, base) {
  for (let k = 0; k < idx; k++) {
    if (tokens[k].kind !== 'ident' || tokens[k].text !== 'using') continue;
    let j = k + 1;
    if (tokens[j]?.text === 'namespace') {
      j++;
      if (isPunct(tokens[j], '::')) j++;
      for (const q of quals) {
        if (tokens[j]?.text !== q) {
          j = -1;
          break;
        }
        j++;
        if (isPunct(tokens[j], '::')) j++;
      }
      if (j !== -1 && isPunct(tokens[j], ';')) return true;
    } else {
      if (isPunct(tokens[j], '::')) j++;
      for (const q of quals) {
        if (tokens[j]?.text !== q || !isPunct(tokens[j + 1], '::')) {
          j = -1;
          break;
        }
        j += 2;
      }
      if (j !== -1 && tokens[j]?.text === base && isPunct(tokens[j + 1], ';')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Lines of `tokens` where `name` is used.
 * @param {Token[]} tokens
 * @param {string} name
 * @returns {Set<number>}
 */
function linesUsing(tokens, name) {
  /** @type {Set<number>} */
  const lines = new Set();

  if (name.startsWith('<')) {
    for (const t of tokens) {
      if (t.kind === 'header' && t.text === name) lines.add(t.line);
    }
    return lines;
  }

  const parts = name.split('::').filter((p) => p !== '');
  const base = parts[parts.length - 1];
  const quals = parts.slice(0, -1);
  const ownFunction = declaresOwn(tokens, base);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'ident' || t.text !== base) continue;
    const prev = tokens[i - 1];
    // obj.sort() and ptr->sort() are members, not the banned function
    if (isPunct(prev, '.') || isPunct(prev, '->')) continue;

    if (isPunct(prev, '::')) {
      // walk back over the qualifier written in front of the name
      /** @type {string[]} */
      const written = [];
      let j = i - 1;
      while (isPunct(tokens[j], '::') && tokens[j - 1]?.kind === 'ident') {
        written.unshift(tokens[j - 1].text);
        j -= 2;
      }
      const matches =
        written.length === quals.length
          ? written.every((q, k) => q === quals[k])
          : quals.length === 0 && written.length === 1 && written[0] === 'std';
      if (matches) lines.add(t.line);
      continue;
    }

    // no qualifier written: a use only if the name was brought into scope,
    // or it is a global (C) name with nothing to bring in, and the student
    // did not write a function of that name themselves
    if (ownFunction) continue;
    if (quals.length === 0 || isBroughtIntoScope(tokens, i, quals, base)) {
      lines.add(t.line);
    }
  }
  return lines;
}

/**
 * Checks student code against banned names. Comments and literals are not code.
 * @param {string} source
 * @param {string[]} names
 * @returns {BanListResult}
 */
export function checkBanList(source, names) {
  const tokens = tokenize(source);
  /** @type {Set<number>} */
  const lines = new Set();
  for (const name of names) {
    for (const l of linesUsing(tokens, name)) lines.add(l);
  }
  const sourceLines = source.split('\n');
  const evidence = [...lines]
    .sort((a, b) => a - b)
    .map((line) => ({ line, text: (sourceLines[line - 1] ?? '').trim() }));
  return { verdict: evidence.length > 0 ? 'violation' : 'pass', evidence };
}

/**
 * Decides a constraint by code when it is a ban-list; null when it is semantic.
 * The decision never carries a deduction: the TA chooses that.
 * @param {string} source
 * @param {ConstraintLike} constraint
 * @returns {HardDecision | null}
 */
export function decideConstraint(source, constraint) {
  const ban = parseBanList(constraint.text);
  if (!ban) return null;
  const { verdict, evidence } = checkBanList(source, ban.names);
  return {
    constraintId: constraint.id,
    verdict,
    evidence,
    decidedBy: 'hard-rule',
  };
}

/**
 * Splits constraints into those code decides and those left for the model.
 * @template {ConstraintLike} C
 * @param {C[]} constraints
 * @returns {{ hard: C[], semantic: C[] }}
 */
export function partitionConstraints(constraints) {
  /** @type {C[]} */
  const hard = [];
  /** @type {C[]} */
  const semantic = [];
  for (const c of constraints) {
    (parseBanList(c.text) ? hard : semantic).push(c);
  }
  return { hard, semantic };
}
