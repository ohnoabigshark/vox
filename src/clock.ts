/** The only place our code reads the wall clock (when a sketch was saved, "how long ago", each play log line's time, and when a run's record starts, is saved and ends). */
export const now = (): number => Date.now();
