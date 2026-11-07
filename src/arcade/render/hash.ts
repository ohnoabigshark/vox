/**
 * A cheap repeatable "random" number between 0 and 1 for piece `i` (a frog,
 * a bubble, a light) and key `k` (which of its numbers), so a look scatters
 * its pieces the same way every time it's drawn. Shared by the field events'
 * looks: frogRain.ts, taffyFlood.ts and wisps.ts.
 */
export const hash = (i: number, k: number): number => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
