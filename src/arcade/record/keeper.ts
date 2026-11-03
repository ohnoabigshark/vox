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
  /** A run closed, with what's kept after it (null if it couldn't be kept): the card shows it. */
  readonly onClosed?: (record: RunRecord, saved: Saved | null) => void;
}

export class StatsKeeper {
  /** The run being recorded, or null (a drill, or none since the last one closed). */
  private recorder: RunRecorder | null = null;
  /**
   * The store's calls, one after another: loading first (it closes last
   * time's run), so nothing this run saves can go in before it.
   */
  private queue: Promise<void> = Promise.resolve();
  private kept: Saved | null = null;

  constructor(private readonly deps: KeeperDeps) {}

  /** Whether a played run is being recorded (one with a down played): it will close with a card. */
  get recording(): boolean {
    return this.recorder !== null && played(this.recorder);
  }

  /** What's kept, as last loaded or closed; null before it's loaded, or if it can't be. */
  get saved(): Saved | null {
    return this.kept;
  }

  /** What's kept read in, closing a run left open last time; any problem shown. */
  load(): Promise<void> {
    return this.then(async () => {
      const { saved, problem } = await this.deps.store.load();
      this.kept = saved;
      if (problem) this.deps.notice(problem);
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
    try {
      this.kept = await this.deps.store.close(record);
    } catch (e) {
      this.deps.onClosed?.(record, null);
      throw e;
    }
    this.deps.onClosed?.(record, this.kept);
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
