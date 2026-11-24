/**
 * The real model behind ConstraintJudge: any OpenAI-compatible chat endpoint. The team points
 * it at 9router (`LLM_BASE_URL`), which routes to Gemini. The key only travels in the
 * Authorization header; it is never put in a URL, an error message or a call record.
 * @typedef {{ inputUsdPerMTok?: number, outputUsdPerMTok?: number }} Prices
 */

/**
 * @typedef {{
 *   id?: string,
 *   choices?: Array<{ message?: { content?: string | null }, delta?: { content?: string | null } }>,
 *   usage?: { prompt_tokens?: number, completion_tokens?: number },
 * }} Completion
 */

/**
 * Reads a reply that is either one JSON object or server-sent events (9router streams by default).
 * @param {string} body
 * @param {boolean} streamed
 * @returns {{ text: string, id: string | null, usage: Completion['usage'] }}
 */
function readCompletion(body, streamed) {
  if (!streamed) {
    /** @type {Completion} */
    const c = JSON.parse(body);
    return {
      text: c.choices?.[0]?.message?.content ?? '',
      id: c.id ?? null,
      usage: c.usage,
    };
  }
  let text = '';
  /** @type {string | null} */
  let id = null;
  /** @type {Completion['usage']} */
  let usage;
  for (const line of body.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice('data:'.length).trim();
    if (data === '' || data === '[DONE]') continue;
    /** @type {Completion} */
    const chunk = JSON.parse(data);
    id ??= chunk.id ?? null;
    text += chunk.choices?.[0]?.delta?.content ?? '';
    if (chunk.usage) usage = chunk.usage;
  }
  return { text, id, usage };
}

/**
 * @param {{
 *   baseUrl: string,
 *   apiKey: string,
 *   model: string,
 *   fetchImpl?: typeof fetch,
 *   prices?: Prices,
 * }} options
 * @returns {{
 *   name: string,
 *   complete(req: { prompt: string, signal: AbortSignal }): Promise<{
 *     text: string, requestId?: string, inputTokens: number, outputTokens: number, costUsd: number,
 *   }>,
 * }} a JudgeModel whose replies always carry token counts and a cost
 */
export function createOpenAICompatibleModel({
  baseUrl,
  apiKey,
  model,
  fetchImpl = fetch,
  prices = {},
}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  return {
    name: model,
    async complete({ prompt, signal }) {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0,
        }),
        signal,
      });
      const body = await res.text();
      if (!res.ok) {
        throw new Error(`model endpoint answered HTTP ${res.status}`);
      }
      const streamed = (res.headers.get('content-type') ?? '').includes(
        'text/event-stream',
      );
      const { text, id, usage } = readCompletion(body, streamed);
      const inputTokens = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;
      return {
        text,
        requestId: id ?? undefined,
        inputTokens,
        outputTokens,
        costUsd:
          (inputTokens * (prices.inputUsdPerMTok ?? 0) +
            outputTokens * (prices.outputUsdPerMTok ?? 0)) /
          1e6,
      };
    },
  };
}
