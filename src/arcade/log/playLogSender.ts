/**
 * Sends the play log's lines to the droplet (docs/PLAY_LOG.md, How the game
 * sends): queued, posted as one JSON array about every 2 s, or at once for a
 * down's end or a ⚑. A failed send keeps its lines, sets the status off (⚑
 * turns red: a gap is never silent), and tries again after a wait that
 * doubles up to a minute. A send with no answer in 10 s is given up on as a
 * failure (review r2): one stuck connection mustn't hold the log up unseen.
 */
import type { PlayLogLine } from './playLog';

export type LogStatus = 'unknown' | 'on' | 'off';

/** How it reaches the world: the game passes fetch and setTimeout; tests pass fakes. */
export interface SenderPorts {
  /** POST this body; rejects if the log can't be reached at all, or once `signal` aborts. */
  post(
    body: string,
    signal: AbortSignal,
  ): Promise<{ readonly ok: boolean; readonly status: number }>;
  /** Run `fn` after `ms`; the function returned cancels it. */
  later(fn: () => void, ms: number): () => void;
  onStatus(status: LogStatus): void;
}

export const SEND_EVERY = 2000;
export const FIRST_RETRY = 2000;
export const LAST_RETRY = 60000;
/** A send with no answer by then has failed. */
export const SEND_TIMEOUT = 10_000;
/** Lines in one POST, well under the service's limit on a body (`MAX_BODY` in tools/playLog/server.ts, which can't import this). */
export const BATCH = 500;
/** Lines the page holds while the log can't be reached; past it, the oldest go. */
export const QUEUE = 5000;

export class PlayLogSender {
  private queue: PlayLogLine[] = [];
  private dropped = 0;
  /** The send waiting to go, if any, and how long it was set to wait. */
  private timer: { readonly ms: number; readonly cancel: () => void } | null = null;
  /** Sends out and not yet answered. */
  private inFlight = 0;
  private retry = FIRST_RETRY;
  private current: LogStatus = 'unknown';

  constructor(private readonly ports: SenderPorts) {}

  get status(): LogStatus {
    return this.current;
  }

  /** Queue lines; `now` sends them at once (a down's end, a flag). */
  add(lines: readonly PlayLogLine[], opts: { readonly now?: boolean } = {}): void {
    this.queueUp(lines);
    if (opts.now && this.current !== 'off') this.schedule(0);
    else this.schedule(SEND_EVERY);
  }

  /**
   * Queue `lines`, then send everything queued now, in batches, without
   * waiting for a timer, a retry's wait or a send already out. For a ⚑, whose
   * pop says whether it was stored (review r5), and for the page being
   * hidden, after which a phone may freeze or close it (review r4).
   * Resolves whether all of it was stored.
   */
  sendNow(lines: readonly PlayLogLine[] = []): Promise<boolean> {
    this.queueUp(lines);
    this.timer?.cancel();
    this.timer = null;
    const sends: Promise<boolean>[] = [];
    while (this.queue.length > 0) sends.push(this.send());
    return Promise.all(sends).then((oks) => oks.every(Boolean));
  }

  /** Past the queue's size the oldest lines go, counted for the next line sent. */
  private queueUp(lines: readonly PlayLogLine[]): void {
    this.queue.push(...lines);
    const over = this.queue.length - QUEUE;
    if (over > 0) {
      this.queue.splice(0, over);
      this.dropped += over;
    }
  }

  /**
   * Send after `ms`. A send already waiting stands, unless this one is at once
   * and that one isn't (review r3); a send in flight schedules the next itself.
   */
  private schedule(ms: number): void {
    if (this.inFlight > 0) return;
    if (this.timer) {
      if (ms > 0 || this.timer.ms === 0) return;
      this.timer.cancel();
    }
    const cancel = this.ports.later(() => {
      this.timer = null;
      void this.send();
    }, ms);
    this.timer = { ms, cancel };
  }

  /** Send the next batch; once the last send out is answered, schedule the next. */
  private async send(): Promise<boolean> {
    if (this.queue.length === 0) return true;
    this.inFlight++;
    const batch = this.queue.splice(0, BATCH);
    const dropped = this.dropped;
    this.dropped = 0;
    const body = dropped > 0 && batch[0] ? [{ ...batch[0], dropped }, ...batch.slice(1)] : batch;
    const abort = new AbortController();
    const giveUp = this.ports.later(() => abort.abort(), SEND_TIMEOUT);
    const ok = await this.ports.post(JSON.stringify(body), abort.signal).then(
      (r) => r.ok,
      () => false,
    );
    giveUp();
    this.inFlight--;
    if (ok) {
      this.retry = FIRST_RETRY;
      this.setStatus('on');
    } else {
      this.queue.unshift(...batch);
      this.dropped += dropped;
      this.setStatus('off');
    }
    if (this.inFlight > 0 || this.queue.length === 0) return ok;
    if (ok) {
      this.schedule(0);
    } else {
      const wait = this.retry;
      this.retry = Math.min(this.retry * 2, LAST_RETRY);
      this.schedule(wait);
    }
    return ok;
  }

  private setStatus(s: LogStatus): void {
    if (s === this.current) return;
    this.current = s;
    this.ports.onStatus(s);
  }
}
