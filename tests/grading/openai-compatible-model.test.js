// Tests for the real model behind ConstraintJudge (T13), written before the code. The team
// calls Gemini through 9router, an OpenAI-compatible endpoint. Every test uses a fake fetch:
// no network, no key. The key goes in a header, never in the URL, an error or the call log.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAICompatibleModel } from '../../src/modules/grading/service/openai-compatible-model.js';
import { ConstraintJudge } from '../../src/modules/grading/service/constraint-judge.js';

const KEY = 'sk-test-not-a-real-key-000000000000';
const BASE = 'http://127.0.0.1:20128/v1';

/**
 * A fake fetch that records the request and answers with a fixed body.
 * @param {{ status?: number, contentType?: string, body: string }} reply
 */
function fakeFetch(reply) {
  /** @type {Array<{ url: string, init: RequestInit }>} */
  const calls = [];
  /** @type {typeof fetch} */
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(reply.body, {
      status: reply.status ?? 200,
      headers: { 'content-type': reply.contentType ?? 'application/json' },
    });
  };
  return { fetchImpl, calls };
}

const jsonReply = (/** @type {string} */ content) =>
  JSON.stringify({
    id: 'chatcmpl-json-1',
    object: 'chat.completion',
    model: 'gemini-3.8-flash',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 1200, completion_tokens: 80, total_tokens: 1280 },
  });

/** The same answer as server-sent events, the way 9router streams by default. */
const sseReply = (/** @type {string[]} */ parts) =>
  [
    ...parts.map(
      (content, i) =>
        `data: ${JSON.stringify({
          id: 'chatcmpl-sse-1',
          object: 'chat.completion.chunk',
          choices: [
            {
              index: 0,
              delta: i === 0 ? { role: 'assistant', content } : { content },
            },
          ],
        })}\n\n`,
    ),
    `data: ${JSON.stringify({
      id: 'chatcmpl-sse-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 900, completion_tokens: 40, total_tokens: 940 },
    })}\n\n`,
    'data: [DONE]\n\n',
  ].join('');

/** @param {ReturnType<typeof fakeFetch>['fetchImpl']} fetchImpl @param {Record<string, unknown>} [extra] */
const model = (fetchImpl, extra = {}) =>
  createOpenAICompatibleModel({
    baseUrl: BASE,
    apiKey: KEY,
    model: 'ag/gemini-3.8-flash',
    fetchImpl,
    ...extra,
  });

describe('the request', () => {
  test('posts one user message to /chat/completions with the key in a bearer header', async () => {
    const { fetchImpl, calls } = fakeFetch({ body: jsonReply('{}') });
    const signal = new AbortController().signal;
    await model(fetchImpl).complete({ prompt: 'judge this', signal });
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, `${BASE}/chat/completions`);
    assert.equal(url.includes(KEY), false);
    assert.equal(init.method, 'POST');
    assert.equal(
      new Headers(init.headers).get('authorization'),
      `Bearer ${KEY}`,
    );
    assert.equal(init.signal, signal);
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, 'ag/gemini-3.8-flash');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'judge this' }]);
    assert.equal(body.stream, false);
  });

  test('a trailing slash on the base URL is not doubled', async () => {
    const { fetchImpl, calls } = fakeFetch({ body: jsonReply('{}') });
    await model(fetchImpl, { baseUrl: `${BASE}/` }).complete({
      prompt: 'x',
      signal: new AbortController().signal,
    });
    assert.equal(calls[0].url, `${BASE}/chat/completions`);
  });

  test('the model name is the one configured', () => {
    assert.equal(
      model(fakeFetch({ body: '' }).fetchImpl).name,
      'ag/gemini-3.8-flash',
    );
  });
});

describe('the reply', () => {
  test('a JSON reply gives the text, the request id and the token counts', async () => {
    const { fetchImpl } = fakeFetch({ body: jsonReply('{"verdicts":[]}') });
    const reply = await model(fetchImpl).complete({
      prompt: 'x',
      signal: new AbortController().signal,
    });
    assert.deepEqual(reply, {
      text: '{"verdicts":[]}',
      requestId: 'chatcmpl-json-1',
      inputTokens: 1200,
      outputTokens: 80,
      costUsd: 0,
    });
  });

  test('a streamed reply is joined, with the id and the usage of the last chunk', async () => {
    const { fetchImpl } = fakeFetch({
      contentType: 'text/event-stream',
      body: sseReply(['{"verdicts"', ':[]}']),
    });
    const reply = await model(fetchImpl).complete({
      prompt: 'x',
      signal: new AbortController().signal,
    });
    assert.equal(reply.text, '{"verdicts":[]}');
    assert.equal(reply.requestId, 'chatcmpl-sse-1');
    assert.equal(reply.inputTokens, 900);
    assert.equal(reply.outputTokens, 40);
  });

  test('cost per call comes from the token counts and the configured prices per million tokens', async () => {
    const { fetchImpl } = fakeFetch({ body: jsonReply('{}') });
    const reply = await model(fetchImpl, {
      prices: { inputUsdPerMTok: 0.5, outputUsdPerMTok: 3 },
    }).complete({ prompt: 'x', signal: new AbortController().signal });
    // 1200 * 0.5 / 1e6 + 80 * 3 / 1e6
    assert.ok(Math.abs(reply.costUsd - 0.00084) < 1e-12, String(reply.costUsd));
  });
});

describe('errors', () => {
  test('a non-2xx status throws with the status and never the key', async () => {
    const { fetchImpl } = fakeFetch({ status: 429, body: '{"error":"quota"}' });
    await assert.rejects(
      model(fetchImpl).complete({
        prompt: 'x',
        signal: new AbortController().signal,
      }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /429/);
        assert.equal(err.message.includes(KEY), false);
        return true;
      },
    );
  });

  test('through ConstraintJudge, a 429 makes every constraint unsure and the call is logged', async () => {
    const { fetchImpl } = fakeFetch({ status: 429, body: 'rate limited' });
    const result = await new ConstraintJudge({
      model: model(fetchImpl),
      timeoutMs: 1000,
    }).judge({
      statement: 's',
      constraints: [{ id: 'C1', text: 'Use a loop you wrote yourself.' }],
      source: 'int main() {}',
    });
    assert.equal(result.verdicts[0].verdict, 'unsure');
    assert.equal(result.call?.outcome, 'model-error');
    assert.equal(JSON.stringify(result).includes(KEY), false);
  });

  test('through ConstraintJudge, a good reply becomes verdicts and a call record with the request id', async () => {
    const { fetchImpl } = fakeFetch({
      body: jsonReply(
        JSON.stringify({
          verdicts: [
            {
              constraint: 'C1',
              verdict: 'violation',
              evidence: [{ line: 1, text: 'x' }],
            },
          ],
        }),
      ),
    });
    const result = await new ConstraintJudge({
      model: model(fetchImpl),
      timeoutMs: 1000,
    }).judge({
      statement: 's',
      constraints: [{ id: 'C1', text: 'Use a loop you wrote yourself.' }],
      source: 'int main() { return 0; }',
    });
    assert.deepEqual(result.verdicts[0], {
      constraintId: 'C1',
      verdict: 'violation',
      evidence: [{ line: 1, text: 'int main() { return 0; }' }],
      decidedBy: 'model',
    });
    assert.equal(result.call?.requestId, 'chatcmpl-json-1');
    assert.equal(result.call?.model, 'ag/gemini-3.8-flash');
    assert.equal(result.call?.inputTokens, 1200);
  });
});
