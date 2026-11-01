/** The only place our code reads the wall clock (when a sketch was saved, "how long ago", and each play log line's time). */
export const now = (): number => Date.now();
