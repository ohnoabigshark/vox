/**
 * Compare this checkout's balance with main's: the six scenarios
 * (`SIX` in balanceCompare.ts) run here and on main, and main's results are
 * kept, so the next comparison against the same main runs only this side.
 *
 *   npm run balance:compare [runs per scenario, default 40]
 *
 * Run it from a branch's checkout or worktree. Reports go to `.balance/` in
 * the main checkout (git ignores it): `main/<key>/` for the kept baselines,
 * `branch/<commit>-<runs>/` for this side. A baseline runs main's game with
 * this checkout's balance tool (TOOL_FILES), in a worktree it removes after.
 * The jobs share the machine's cores.
 */
import { spawn, execFileSync } from 'node:child_process';
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  SIX,
  TOOL_FILES,
  baselineKey,
  keepBaseline,
  keptBaseline,
  partialBaseline,
  type Scenario,
} from './balanceCompare';
import { now } from '../src/clock';

const runs = Number(process.argv[2]) || 40;
const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const tree = git(process.cwd(), 'rev-parse', '--show-toplevel');
const checkout = dirname(resolve(tree, git(tree, 'rev-parse', '--git-common-dir')));
const store = join(checkout, '.balance');
const main = git(tree, 'rev-parse', 'main');
const head = git(tree, 'rev-parse', 'HEAD');
const dirty = git(tree, 'status', '--porcelain', '--untracked-files=no') !== '';
const tools = Object.fromEntries(TOOL_FILES.map((p) => [p, readFileSync(join(tree, p), 'utf8')]));
const key = baselineKey({ main, tools, runs });
const branchOut = join(store, 'branch', `${head.slice(0, 12)}${dirty ? '-dirty' : ''}-${runs}`);

interface Job {
  readonly side: 'main' | 'branch';
  readonly cwd: string;
  readonly out: string;
  readonly s: Scenario;
}

/** Runs one scenario, its report (and any error) into its file; resolves to the exit code. */
function runJob(job: Job): Promise<number> {
  const fd = openSync(join(job.out, job.s.file), 'w');
  const child = spawn(
    join(job.cwd, 'node_modules', '.bin', 'tsx'),
    ['tools/arcade-balance.ts', String(runs)],
    {
      cwd: job.cwd,
      env: {
        ...process.env,
        BALANCE_SCENARIO: JSON.stringify(job.s.scenario),
        BOT: JSON.stringify(job.s.bot),
      },
      stdio: ['ignore', fd, fd],
    },
  );
  children.add(child);
  return new Promise((done) => {
    // A child that can't start (no tsx in the tree) says why in its report, and fails.
    child.on('error', (e) => {
      writeFileSync(join(job.out, job.s.file), `${e.message}\n`);
    });
    child.on('close', (code) => {
      children.delete(child);
      closeSync(fd);
      done(code ?? 1);
    });
  });
}

const children = new Set<ReturnType<typeof spawn>>();
let worktree: string | null = null;

function removeWorktree(): void {
  if (!worktree) return;
  git(tree, 'worktree', 'remove', '--force', worktree);
  worktree = null;
}

process.on('SIGINT', () => {
  for (const c of children) c.kill('SIGINT');
  removeWorktree();
  process.exit(130);
});

/** A worktree of main with this checkout's balance tool, saying which files differ. */
function mainWithOurTools(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vox-balance-main-'));
  rmSync(dir, { recursive: true });
  git(tree, 'worktree', 'add', '--detach', dir, main);
  worktree = dir;
  // Hard links: a second, not a copy (and not a symlink, which tsx resolves out of the tree).
  execFileSync('cp', ['-al', join(checkout, 'node_modules'), join(dir, 'node_modules')]);
  for (const path of TOOL_FILES) {
    const theirs = existsSync(join(dir, path)) ? readFileSync(join(dir, path), 'utf8') : null;
    if (theirs === tools[path]) continue;
    console.log(
      `  main runs with this checkout's ${path} (${theirs === null ? 'new' : 'changed'})`,
    );
    cpSync(join(tree, path), join(dir, path));
  }
  return dir;
}

async function runAll(jobs: Job[]): Promise<Job[]> {
  const failed: Job[] = [];
  const queue = [...jobs];
  const start = now();
  let finished = 0;
  const worker = async (): Promise<void> => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const code = await runJob(job);
      finished++;
      const mins = ((now() - start) / 60000).toFixed(1);
      console.log(
        `  ${finished}/${jobs.length} ${job.side} ${job.s.file}: ${code === 0 ? 'done' : `FAILED (exit ${code})`}, ${mins} min`,
      );
      if (code !== 0) failed.push(job);
    }
  };
  const width = Math.min(availableParallelism(), jobs.length);
  await Promise.all(Array.from({ length: width }, worker));
  return failed;
}

/** A report's headline: the series line, as the tool prints it. */
const headline = (file: string): string =>
  readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.trimStart().startsWith('series won'))
    ?.trim() ?? '(no series line: read the report)';

async function compare(): Promise<number> {
  console.log(
    `Balance: ${runs} runs a scenario. This side: ${head.slice(0, 12)}${dirty ? ' with uncommitted changes' : ''}. Main: ${main.slice(0, 12)}.`,
  );
  mkdirSync(branchOut, { recursive: true });
  const jobs: Job[] = SIX.map((s) => ({ side: 'branch', cwd: tree, out: branchOut, s }));
  let base = keptBaseline(store, key);
  const partial = partialBaseline(store, key);
  if (base) {
    console.log(`  main's results are kept (${key}): running this side only.`);
  } else {
    console.log(`  no kept results for main under ${key}: running both sides.`);
    rmSync(partial, { recursive: true, force: true });
    mkdirSync(partial, { recursive: true });
    const cwd = mainWithOurTools();
    jobs.unshift(...SIX.map((s): Job => ({ side: 'main', cwd, out: partial, s })));
  }
  const failed = await runAll(jobs);
  removeWorktree();
  if (failed.length > 0) {
    for (const job of failed) {
      const report = readFileSync(join(job.out, job.s.file), 'utf8').split('\n');
      console.error(`\n${job.side} ${job.s.file} failed:\n${report.slice(-15).join('\n')}`);
    }
    if (!base) console.error(`\nMain's results weren't kept; the next run tries again.`);
    if (failed.some((j) => j.side === 'main')) {
      console.error(
        `Main runs with this checkout's balance tool: if it needs sim code main doesn't have yet, compare by hand with npm run balance:arcade.`,
      );
    }
    return 1;
  }
  base ??= keepBaseline(store, key, partial);
  writeFileSync(join(branchOut, 'main.txt'), `${base}\n`);
  console.log(`\nmain:      ${base}\nthis side: ${branchOut}\n`);
  for (const s of SIX) {
    console.log(`${s.file.replace('.txt', '')}`);
    console.log(`  main       ${headline(join(base, s.file))}`);
    console.log(`  this side  ${headline(join(branchOut, s.file))}`);
  }
  return 0;
}

compare().then(
  (code) => process.exit(code),
  (e: unknown) => {
    removeWorktree();
    console.error(e);
    process.exit(1);
  },
);
