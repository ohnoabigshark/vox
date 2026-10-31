import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { endpoint } from '../../tools/endpoint';

/** Review b1: the hot-reload server's bench endpoints always answer. */

/** A request with this method and body, and a response that records what it was sent. */
function exchange(url: string, method: string, body: string) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    setEncoding: () => undefined,
  }) as unknown as IncomingMessage;
  const sent: { status?: number; type?: string; body?: string } = {};
  const done = new Promise<typeof sent>((resolve) => {
    const res = {
      set statusCode(s: number) {
        sent.status = s;
      },
      setHeader: (_: string, v: string) => void (sent.type = v),
      end: (b: string) => {
        sent.body = b;
        resolve(sent);
      },
    } as unknown as ServerResponse;
    let passed = false;
    endpoint('__x', async (m, b) => {
      if (b === 'throw') throw new Error('could not load the checker');
      return { status: 200, body: JSON.stringify({ m, b }) };
    })(req, res, () => {
      passed = true;
      resolve({ body: 'next' });
    });
    void passed;
  });
  queueMicrotask(() => {
    req.emit('data', body);
    req.emit('end');
  });
  return done;
}

describe('a bench endpoint', () => {
  it('passes its method and body to the handler and sends back its answer', async () => {
    expect(await exchange('/vox-dev/__x?t=1', 'POST', 'hi')).toEqual({
      status: 200,
      type: 'application/json',
      body: '{"m":"POST","b":"hi"}',
    });
  });

  it('answers 500, naming the error, when its handler throws, rather than never answering', async () => {
    expect(await exchange('/vox-dev/__x', 'POST', 'throw')).toEqual({
      status: 500,
      type: 'text/plain',
      body: 'could not load the checker',
    });
  });

  it('leaves any other path to the next handler', async () => {
    expect(await exchange('/vox-dev/other', 'GET', '')).toEqual({ body: 'next' });
  });
});
