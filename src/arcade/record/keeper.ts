/**
 * The game's side of the record (docs/STATS.md, k2): a recorder for each
 * real run, saved after every down and when the page is hidden, and closed
 * at Game Over or a win. A store that fails says so through `notice`.
 */
import type { ArcadeEvent, RunState } from '../sim/types';
import { RunRecorder, recordable } from './recorder';
import type { Saved, StatsStore } from './store';

export interface KeeperDeps {
  readonly store: StatsStore;
  readonly build: string;
  readonly link: string;
  /** A new run's random id. */
  readonly newId: () => string;
  readonly now: () => number;
  /** Shows a problem to the Coach (the HUD's notice). */
  readonly notice: (text: string) => void;
}

export class StatsKeeper {
  /** The run being recorded, or null (a drill, or none since the last one closed). */
  private recorder: RunRecorder | null = null;

  constructor(private readonly deps: KeeperDeps) {}

  /** What's kept, closing a run left open last time; any problem shown, and null if it couldn't be had. */
  async load(): Promise<Saved | null> {
    try {
      const { saved, problem } = await this.deps.store.load();
      if (problem) this.deps.notice(problem);
      return saved;
    } catch (e) {
      this.deps.notice(messageOf(e));
      return null;
    }
  }

  /** A new run: recorded if it's a real one (c1). */
  start(state: RunState): void {
    const { build, link, newId, now } = this.deps;
    this.recorder = recordable(state)
      ? new RunRecorder(state, { id: newId(), build, link, now: now() })
      : null;
  }

  /** One step's (or action's) events: saved after a down, closed when the run ends. */
  step(prev: RunState, next: RunState, events: readonly ArcadeEvent[]): void {
    const rec = this.recorder;
    if (!rec || events.length === 0) return;
    rec.step(prev, next, events);
    if (rec.record.end === 'over' || rec.record.end === 'won') {
      this.recorder = null;
      if (played(rec)) this.settle(this.deps.store.close(rec.record));
      return;
    }
    if (events.some((e) => e.type === 'downEnded')) this.save(rec);
  }

  /** The page was hidden: the last chance to save before a phone freezes or closes it. */
  hidden(): void {
    if (this.recorder) this.save(this.recorder);
  }

  private save(rec: RunRecorder): void {
    if (played(rec)) this.settle(this.deps.store.saveOpen(rec.record));
  }

  /** A store call's failure, shown: never silent. */
  private settle(p: Promise<unknown>): void {
    p.catch((e: unknown) => this.deps.notice(messageOf(e)));
  }
}

/** A run with no down played (the start screen, or ?win=1's shortcut) isn't a run: not saved, not closed. */
const played = (rec: RunRecorder): boolean => rec.record.downs.length > 0;

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
