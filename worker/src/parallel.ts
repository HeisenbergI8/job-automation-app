/**
 * How many Claude Code calls run at once. Each one is a separate `claude -p` on the owner's
 * subscription; more at once risks its rate limit.
 */
export const CLAUDE_AT_ONCE = 4;

/** Runs `task` on every item, at most `limit` at a time. Results keep the items' order. */
export async function inParallel<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
