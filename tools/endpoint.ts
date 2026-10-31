/**
 * A test bench endpoint on the hot-reload server (tools/benchLog.ts,
 * tools/benchSave.ts): a path under the page's base URL, its body read in
 * full, and an answer always sent. A handler that throws becomes a 500
 * naming the error, so the page never waits on a request nobody answers.
 */
import type { Connect } from 'vite';

export type Answer = { readonly status: number; readonly body: string };

export function endpoint(
  path: string,
  handle: (method: string, body: string) => Promise<Answer>,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!(req.url ?? '').split('?')[0]?.endsWith(`/${path}`)) return next();
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => (body += chunk));
    req.on('end', () => {
      void handle(req.method ?? '', body)
        .catch((e: unknown): Answer => ({
          status: 500,
          body: e instanceof Error ? e.message : String(e),
        }))
        .then((r) => {
          res.statusCode = r.status;
          res.setHeader('content-type', r.status === 200 ? 'application/json' : 'text/plain');
          res.end(r.body);
        });
    });
  };
}
