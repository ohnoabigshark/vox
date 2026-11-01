/**
 * Sends the play log's lines to the droplet (docs/PLAY_LOG.md, How the game
 * sends): queued, posted as one JSON array about every 2 s, or at once for a
 * down's end or a ⚑. A failed send keeps its lines, sets the status off (⚑
 * turns red: a gap is never silent), and tries again after a wait that
 * doubles up to a minute.
 */
import type { PlayLogLine } from './playLog';

export type LogStatus = 'unknown' | 'on' | 'off';

/** How it reaches the world: the game passes fetch and setTimeout; tests pass fakes. */
export interface SenderPorts {
  /** POST this body; throws if the log can't be reached at all. */
  post(body: string): Promise<{ readonly ok: boolean; readonly status: number }>;
  /** Run `fn` after `ms`. */
  later(fn: () => void, ms: number): void;
  onStatus(status: LogStatus): void;
}

export const SEND_EVERY = 2000;
export const FIRST_RETRY = 2000;
export const LAST_RETRY = 60000;
/** Lines in one POST, well under the service's limit on a body. */
export const BATCH = 500;
/** Lines the page holds while the log can't be reached; past it, the oldest go. */
export const QUEUE = 5000;

export class PlayLogSender {
  private queue: PlayLogLine[] = [];
  private dropped = 0;
  private pending = false;
  private sending = false;
  private retry = FIRST_RETRY;
  private current: LogStatus = 'unknown';

  constructor(private readonly ports: SenderPorts) {}

  get status(): LogStatus {
    return this.current;
  }

  /** Queue lines; `now` sends them at once (a down's end, a flag). */
  add(lines: readonly PlayLogLine[], opts: { readonly now?: boolean } = {}): void {
    this.queue.push(...lines);
    const over = this.queue.length - QUEUE;
    if (over > 0) {
      this.queue.splice(0, over);
      this.dropped += over;
    }
    if (opts.now && this.current !== 'off') this.schedule(0);
    else this.schedule(SEND_EVERY);
  }

  private schedule(ms: number): void {
    if (this.pending || this.sending) return;
    this.pending = true;
    this.ports.later(() => {
      this.pending = false;
      void this.send();
    }, ms);
  }

  private async send(): Promise<void> {
    if (this.queue.length === 0) return;
    this.sending = true;
    const batch = this.queue.splice(0, BATCH);
    const dropped = this.dropped;
    const body = dropped > 0 && batch[0] ? [{ ...batch[0], dropped }, ...batch.slice(1)] : batch;
    const ok = await this.ports.post(JSON.stringify(body)).then(
      (r) => r.ok,
      () => false,
    );
    this.sending = false;
    if (ok) {
      this.dropped -= dropped;
      this.retry = FIRST_RETRY;
      this.setStatus('on');
      if (this.queue.length > 0) this.schedule(0);
      return;
    }
    this.queue.unshift(...batch);
    this.setStatus('off');
    const wait = this.retry;
    this.retry = Math.min(this.retry * 2, LAST_RETRY);
    this.schedule(wait);
  }

  private setStatus(s: LogStatus): void {
    if (s === this.current) return;
    this.current = s;
    this.ports.onStatus(s);
  }
}
