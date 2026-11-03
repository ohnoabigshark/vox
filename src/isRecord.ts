/** Whether `x` is a plain object (not null, not an array): what read-in JSON is checked with before use. */
export const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
