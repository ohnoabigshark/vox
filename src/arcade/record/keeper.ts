/**
 * The game's side of the record (docs/STATS.md, k2): a recorder for each
 * real run, saved after every down and when the page is hidden, and closed
 * at Game Over or a win. A store that fails says so through `notice`.
 */
import type { ArcadeEvent, RunState } from '../sim/types';
import { RunRecorder, recordable } from './recorder';
import type { Saved, StatsStore } from './store';
import type { RunRecord } from './types';

export interface KeeperDeps {
  readonly store: StatsStore;
  readonly build: string;
  readonly link: string;
  /** A new run's random id. */
  readonly newId: () => string;
  readonly now: () => number;
  /** Shows a problem to the Coach (the HUD's notice). */
  readonly notice: (text: string) => void;
  /**
   * A run closed, with what was kept before it (null if nothing could be
   * had): the card shows the run, and marks each record it broke.
   */
  readonly onClosed?: (record: RunRecord, before: Saved | null) => void;
}

/** What's kept, for the stats section: still loading, not to be had (the notice said why), or kept. */
export type KeptStats =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'kept'; readonly saved: Saved };

export class StatsKeeper {
  /** The run being recorded, or null (a drill, or none since the last one closed). */
  private recorder: RunRecorder | null = null;
  /**
   * The store's calls, one after another: loading first (it closes last
   * time's run), so nothing this run saves can go in before it.
   */
  private queue: Promise<void> = Promise.resolve();
  private stats: KeptStats = { kind: 'loading' };

  constructor(private readonly deps: KeeperDeps) {}

  /** Whether a played run is being recorded (one with a down played): it will close with a card. */
  get recording(): boolean {
    return this.recorder !== null && played(this.recorder);
  }

  /** What's kept, as last loaded or closed: or still loading, or not to be had. */
  get kept(): KeptStats {
    return this.stats;
  }

  /** What's kept read in, closing a run left open last time; any problem shown. */
  load(): Promise<void> {
    return this.then(async () => {
      try {
        const { saved, problem } = await this.deps.store.load();
        this.stats = saved ? { kind: 'kept', saved } : { kind: 'unreadable' };
        if (problem) this.deps.notice(problem);
      } catch (e) {
        this.stats = { kind: 'unreadable' };
        throw e;
      }
    });
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
      if (played(rec)) void this.then(() => this.close(rec.record));
      return;
    }
    if (events.some((e) => e.type === 'downEnded')) this.save(rec);
  }

  /** The page was hidden: the last chance to save before a phone freezes or closes it. */
  hidden(): void {
    if (this.recorder) this.save(this.recorder);
  }

  /** The run closed and kept; handed on either way, for the card. */
  private async close(record: RunRecord): Promise<void> {
    const before = this.stats.kind === 'kept' ? this.stats.saved : null;
    try {
      const saved = await this.deps.store.close(record);
      // What can't be read stays that way: the store kept nothing new over it.
      if (this.stats.kind === 'kept') this.stats = { kind: 'kept', saved };
    } finally {
      this.deps.onClosed?.(record, before);
    }
  }

  private save(rec: RunRecorder): void {
    if (played(rec)) void this.then(() => this.deps.store.saveOpen(rec.record));
  }

  /** A store call, queued after the others; its failure shown, never silent. */
  private then(op: () => Promise<unknown>): Promise<void> {
    this.queue = this.queue
      .then(op)
      .then(() => undefined)
      .catch((e: unknown) => this.deps.notice(messageOf(e)));
    return this.queue;
  }
}

/** A run with no down played (the start screen, or ?win=1's shortcut) isn't a run: not saved, not closed. */
const played = (rec: RunRecorder): boolean => rec.record.downs.length > 0;

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
