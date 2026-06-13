/**
 * Sentinel block extraction — the LLM-response parsing technique from
 * KeyStone-Lite (github.com/aiassistsecure/keystone-lite,
 * src/renderer/lib/surgical-edit.ts), ported here with permission (Interchained).
 *
 * The technique: teach the model to wrap its payload between unmistakable
 * sentinels — `<<<TAG>>> … <<<END>>>` — then pull the content between them with a
 * regex and take it VERBATIM. Content is never re-parsed as code on the way out,
 * which is exactly why it survives quotes, newlines, and braces that shatter a
 * naive `JSON.parse` on a raw completion. (KeyStone uses
 * `/<<<FILE\s+([^>]+)>>>([\s\S]*?)<<<END>>>/g` and `.trim()`; same shape here.)
 */

/** First block for `tag`, content trimmed; null if absent. */
export function extractBlock(response: string, tag: string): string | null {
  const re = new RegExp(`<<<${tag}\\s*>>>([\\s\\S]*?)<<<END>>>`, "i");
  const m = response.match(re);
  return m ? m[1].trim() : null;
}

/** Every block for `tag` (a completion may contain several). */
export function extractBlocks(response: string, tag: string): string[] {
  const re = new RegExp(`<<<${tag}\\s*>>>([\\s\\S]*?)<<<END>>>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(response)) !== null) out.push(m[1].trim());
  return out;
}
