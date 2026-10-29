# vox (our fork)

esrauch's arcade Halloween football game, _Get Jack Back_: Vite, TypeScript
and three.js, no backend. Start with `TECHNICAL.md` §21 ("How to pick this up
again"). Our roadmap is `docs/PLAN.md`, our bugs are `docs/BUGS.md`, and
esrauch's roadmap is `MILESTONES.md`.

- **Never run `npm run dev` bare on this droplet.** Upstream's script is
  `vite --host`, which listens on every interface, and the droplet has a
  public IP and no host firewall, so the dev server would be on the internet.
  `.claude/launch.json` runs the same script. Bind loopback instead:
  `npx vite --host 127.0.0.1 --port 9300`.
- **`upstream` is esrauch's repo, with pushing disabled.** Pull his changes
  from it; our own remote comes with the fork.
- **The user plays with `?hard=1&aim=2`** (hard mode, two-tap throwing). Try
  changes in that mode as well as the default, and keep those flags on any
  link that opens the game.
- **The built game is served at `https://…ts.net:8443/vox/`** straight from
  `dist/`, so a change shows only after `npm run build`.
- `/root/projects/CLAUDE.md` loads here too: it covers the machine, the ports
  and the config repo.
