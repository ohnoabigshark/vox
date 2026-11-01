import { describe, expect, it } from 'vitest';
import type { PlayLogLine } from '../../src/arcade/log/playLog';
import {
  BATCH,
  FIRST_RETRY,
  LAST_RETRY,
  QUEUE,
  SEND_EVERY,
  SEND_TIMEOUT,
  PlayLogSender,
  type LogStatus,
  type SenderPorts,
} from '../../src/arcade/log/playLogSender';

/** docs/PLAY_LOG.md, How the game sends: batches, a status for ⚑, retries that back off. */

/** Every way a send can end: an answer, no connection, or no answer at all until it's given up on. */
type Answer = { ok: boolean; status: number } | 'unreachable' | 'hangs';

/**
 * A fake post (answering in turn from `answers`, then 204s) and timers the
 * test runs by hand. Like fetch, a post that hangs rejects when its signal aborts.
 */
function harness(answers: Answer[] = []) {
  const sent: unknown[][] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const statuses: LogStatus[] = [];
  const ports: SenderPorts = {
    post: (body, signal) => {
      sent.push(JSON.parse(body) as unknown[]);
      const a = answers.shift() ?? { ok: true, status: 204 };
      if (a === 'unreachable') return Promise.reject(new TypeError('Failed to fetch'));
      if (a === 'hangs') {
        return new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
        );
      }
      return Promise.resolve(a);
    },
    later: (fn, ms) => {
      const t = { fn, ms };
      timers.push(t);
      return () => {
        const i = timers.indexOf(t);
        if (i >= 0) timers.splice(i, 1);
      };
    },
    onStatus: (s) => statuses.push(s),
  };
  const sender = new PlayLogSender(ports);
  /** Run the next timer, and let its post settle. */
  const tick = async (): Promise<number | undefined> => {
    const t = timers.shift();
    if (!t) return undefined;
    t.fn();
    await new Promise((r) => setTimeout(r, 0));
    return t.ms;
  };
  return { sender, sent, timers, statuses, tick };
}

const line = (n: number): PlayLogLine => ({ n }) as unknown as PlayLogLine;

describe('the play log: sending', () => {
  it('lines wait for the next send, every 2 s, and go as one array', async () => {
    const h = harness();
    h.sender.add([line(1), line(2)]);
    h.sender.add([line(3)]);
    expect(h.sent).toEqual([]);
    expect(h.timers.map((t) => t.ms)).toEqual([SEND_EVERY]);
    expect(SEND_EVERY).toBe(2000);
    await h.tick();
    expect(h.sent).toEqual([[{ n: 1 }, { n: 2 }, { n: 3 }]]);
  });

  it('a down’s end or a flag goes at once', async () => {
    const h = harness();
    h.sender.add([line(1)], { now: true });
    expect(h.timers.map((t) => t.ms)).toEqual([0]);
    await h.tick();
    expect(h.sent).toEqual([[{ n: 1 }]]);
  });

  it('at once even with a routine send already waiting (review r3)', async () => {
    const h = harness();
    h.sender.add([line(1)]);
    h.sender.add([line(2)], { now: true });
    expect(h.timers.map((t) => t.ms)).toEqual([0]);
    await h.tick();
    expect(h.sent).toEqual([[{ n: 1 }, { n: 2 }]]);
  });

  it('while the log is down, at once waits its turn: the retry’s wait stands', async () => {
    const h = harness([{ ok: false, status: 502 }]);
    h.sender.add([line(1)]);
    await h.tick();
    h.sender.add([line(2)], { now: true });
    expect(h.timers.map((t) => t.ms)).toEqual([FIRST_RETRY]);
  });

  it('a sent batch sets the status on', async () => {
    const h = harness();
    expect(h.sender.status).toBe('unknown');
    h.sender.add([line(1)]);
    await h.tick();
    expect(h.sender.status).toBe('on');
    expect(h.statuses).toEqual(['on']);
  });

  it('a failure (refused or unreachable) sets it off, keeps the lines, and retries after a doubling wait', async () => {
    const h = harness([{ ok: false, status: 502 }, 'unreachable', { ok: false, status: 500 }]);
    h.sender.add([line(1)]);
    await h.tick();
    expect(h.sender.status).toBe('off');
    h.sender.add([line(2)]);
    expect(await h.tick()).toBe(FIRST_RETRY);
    expect(await h.tick()).toBe(FIRST_RETRY * 2);
    expect(h.sender.status).toBe('off');
    await h.tick(); // the fourth try: a 204
    expect(h.sender.status).toBe('on');
    expect(h.sent.at(-1)).toEqual([{ n: 1 }, { n: 2 }]);
    expect(h.statuses).toEqual(['off', 'on']);
  });

  it('a send with no answer is given up on after 10 s, as a failure: ⚑ turns red and it retries (review r2)', async () => {
    const h = harness(['hangs']);
    h.sender.add([line(1)]);
    await h.tick();
    expect(h.sender.status).toBe('unknown');
    expect(h.timers.map((t) => t.ms)).toEqual([SEND_TIMEOUT]);
    expect(SEND_TIMEOUT).toBe(10_000);
    await h.tick(); // no answer in 10 s
    expect(h.sender.status).toBe('off');
    expect(await h.tick()).toBe(FIRST_RETRY); // a 204
    expect(h.sender.status).toBe('on');
    expect(h.sent).toEqual([[{ n: 1 }], [{ n: 1 }]]);
  });

  it('a send that answers in time leaves no timer behind to give up on it', async () => {
    const h = harness();
    h.sender.add([line(1)]);
    await h.tick();
    expect(h.timers).toEqual([]);
  });

  it('the wait stops growing at a minute, and starts again from 2 s once a send gets through', async () => {
    const h = harness(Array<Answer>(12).fill('unreachable'));
    h.sender.add([line(1)]);
    const waits: (number | undefined)[] = [];
    await h.tick();
    for (let i = 0; i < 11; i++) waits.push(await h.tick());
    expect(waits.slice(0, 6)).toEqual([2000, 4000, 8000, 16000, 32000, LAST_RETRY]);
    expect(LAST_RETRY).toBe(60000);
    expect(waits.at(-1)).toBe(LAST_RETRY);
    await h.tick(); // a 204
    h.sender.add([line(2)]);
    expect(h.timers.map((t) => t.ms)).toEqual([SEND_EVERY]);
    expect(FIRST_RETRY).toBe(2000);
  });

  it('one send carries at most a batch; the rest go straight after', async () => {
    const h = harness();
    h.sender.add(Array.from({ length: BATCH + 3 }, (_, i) => line(i)));
    await h.tick();
    expect(h.sent.map((b) => b.length)).toEqual([BATCH]);
    expect(h.timers.map((t) => t.ms)).toEqual([0]);
    await h.tick();
    expect(h.sent.map((b) => b.length)).toEqual([BATCH, 3]);
  });

  it('past the queue’s size the oldest lines go, and the next line sent says how many', async () => {
    const h = harness();
    h.sender.add(Array.from({ length: QUEUE + 5 }, (_, i) => line(i)));
    await h.tick();
    expect(h.sent[0]?.[0]).toEqual({ n: 5, dropped: 5 });
    expect(h.sent[0]?.[1]).toEqual({ n: 6 });
    // Said once: the sends after it don't repeat it.
    while (h.timers.length > 0) await h.tick();
    h.sender.add([line(-1)]);
    await h.tick();
    expect(h.sent.at(-1)?.[0]).toEqual({ n: -1 });
  });

  it('when the page is hidden, everything queued goes at once, in batches, and no routine send is left waiting (review r4)', async () => {
    const h = harness();
    h.sender.add(Array.from({ length: BATCH + 3 }, (_, i) => line(i)));
    void h.sender.sendNow();
    expect(h.sent.map((b) => b.length)).toEqual([BATCH, 3]);
    await new Promise((r) => setTimeout(r, 0));
    expect(h.timers).toEqual([]);
    expect(h.sender.status).toBe('on');
  });

  it('…without waiting for a send already out', () => {
    const h = harness(['hangs']);
    h.sender.add([line(1)]);
    void h.tick();
    h.sender.add([line(2)]);
    void h.sender.sendNow();
    expect(h.sent).toEqual([[{ n: 1 }], [{ n: 2 }]]);
  });
});
