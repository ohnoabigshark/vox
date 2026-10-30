/** The only place our code reads the wall clock (when a sketch was saved, and "how long ago"). */
export const now = (): number => Date.now();
