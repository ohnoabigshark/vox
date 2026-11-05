/**
 * TRICK OR TREAT! (GAMEPLAY.md, Building Up): what a new player is worth
 * in each zone, and the names of the players who might join you. The rules for taking a card are in sim/team.ts.
 */
import type { Form, Perk, Position } from '../sim/types';

/**
 * Every offer is two new players (of different kinds). By zone (Forest,
 * Swamp, Farm), for the zone of the series about to be played: what a new
 * player's Hustle + Hands + Heft add up to.
 */
export const ZONE_OFFER: readonly { readonly recruitTotal: number }[] = [
  { recruitTotal: 200 },
  { recruitTotal: 250 },
  { recruitTotal: 300 },
];

/** Your starting seven, in slot order (2 Blockers, 2 Runners, 3 Catchers): plain humans. */
export const STARTING_NAMES: readonly string[] = [
  'Gus Grimsby',
  'Big Bert Barrow',
  'Kid Carver',
  'Lefty Graves',
  'Hollis Hollow',
  'Ned Nightly',
  'Moe Mausoleum',
];

/** Recruits' names, by kind. */
export const RECRUIT_NAMES: Readonly<Record<Form, readonly string[]>> = {
  human: ['Dusty Digger', 'Skip Shovel', 'Ike Inkwell', 'Pip Pumpkinpatch'],
  ghost: ['Boo Radish', 'Wispy Wallace', 'Sheet Happens', 'Casper Cartwheel'],
  golem: ['Rocky Rumble', 'Gravel Gus', 'Boulder Bob', 'Pebbles McStone'],
  werewolf: ['Howlin’ Hal', 'Fang Fennimore', 'Lupe Moonrun', 'Shaggy Shanks'],
};

/** Every position, for recruits' preferences. */
export const POSITIONS: readonly Position[] = ['blocker', 'runner', 'catcher'];

/** The perks TRICK OR TREAT! offers, each once a run (docs/REWARDS.md, k6). */
export const OFFERED_PERKS: readonly Perk[] = [
  { rarity: 'common', kind: 'secondWind' },
  { rarity: 'common', kind: 'magnet' },
];
