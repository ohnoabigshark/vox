/** The end of an exhaustive switch over a union of ours: a new variant left unhandled is a compile error here. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
