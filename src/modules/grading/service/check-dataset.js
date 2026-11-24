import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decideConstraint } from './hard-rules.js';

/**
 * One line of the prediction file that eval.mjs reads.
 * @typedef {{
 *   solution: string,
 *   constraint: string,
 *   verdict: 'pass' | 'violation' | 'unsure',
 *   evidence: Array<{ line: number, text: string }>,
 * }} Prediction
 * @typedef {import('./constraint-judge.js').CallRecord & { solution: string }} LoggedCall
 * @typedef {{ judge(input: { statement: string, constraints: Array<{ id: string, text: string }>, source: string }):
 *   Promise<{ verdicts: import('./constraint-judge.js').JudgeVerdict[], call: import('./constraint-judge.js').CallRecord | null }> }} Judge
 */

/** @param {string} dir */
const sortedEntries = async (dir) => (await readdir(dir)).sort();

/**
 * Runs the checker over a dataset folder in the dev-set layout. Ban-list constraints are
 * decided by the hard rules; semantic ones go to the judge, or are `unsure` when there is
 * none (MODEL_OFF=1). Works from statement.md and constraints.json alone, with no setting
 * per problem.
 * @param {string} dataDir
 * @param {{ judge: Judge | null }} options
 * @returns {Promise<{ predictions: Prediction[], calls: LoggedCall[] }>}
 */
export async function checkDataset(dataDir, { judge }) {
  /** @type {Prediction[]} */
  const predictions = [];
  /** @type {LoggedCall[]} */
  const calls = [];

  for (const problem of await sortedEntries(join(dataDir, 'problems'))) {
    const problemDir = join(dataDir, 'problems', problem);
    const statement = await readFile(join(problemDir, 'statement.md'), 'utf8');
    /** @type {Array<{ id: string, text: string }>} */
    const constraints = JSON.parse(
      await readFile(join(problemDir, 'constraints.json'), 'utf8'),
    );

    const solutionDir = join(dataDir, 'solutions', problem);
    const files = (await sortedEntries(solutionDir)).filter((f) =>
      f.endsWith('.cpp'),
    );
    for (const file of files) {
      const solution = `${problem}/${file.slice(0, -'.cpp'.length)}`;
      const source = await readFile(join(solutionDir, file), 'utf8');

      /** @type {Map<string, Omit<Prediction, 'solution' | 'constraint'>>} */
      const decided = new Map();
      const semantic = [];
      for (const c of constraints) {
        const hard = decideConstraint(source, c);
        if (hard) {
          decided.set(c.id, { verdict: hard.verdict, evidence: hard.evidence });
        } else {
          semantic.push({ id: c.id, text: c.text });
        }
      }

      if (semantic.length > 0 && judge) {
        const { verdicts, call } = await judge.judge({
          statement,
          constraints: semantic,
          source,
        });
        for (const v of verdicts) {
          decided.set(v.constraintId, {
            verdict: v.verdict,
            evidence: v.evidence,
          });
        }
        if (call) calls.push({ solution, ...call });
      }

      for (const c of constraints) {
        const d = decided.get(c.id) ?? { verdict: 'unsure', evidence: [] };
        predictions.push({
          solution,
          constraint: c.id,
          verdict: d.verdict,
          evidence: d.evidence,
        });
      }
    }
  }

  return { predictions, calls };
}
