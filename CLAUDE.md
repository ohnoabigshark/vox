# vox (our fork)

esrauch's arcade Halloween football game, _Get Jack Back_: Vite, TypeScript
and three.js, no backend. Start with `TECHNICAL.md` §21 ("How to pick this up
again"). Our roadmap is `docs/PLAN.md`, our bugs are `docs/BUGS.md`, and
esrauch's roadmap is `MILESTONES.md`.

- **The dev server listens on loopback** (`127.0.0.1`) unless `DEV_BIND` names
  another address (`vite.config.ts`). Upstream's `vite --host` listened on
  every interface; on this droplet that would be the open internet. Never set
  `DEV_BIND=0.0.0.0` here. The hot-reload server is reached through Tailscale
  (`docs/stacks/vox.md` in `/root/projects`).
- **`upstream` is esrauch's repo, with pushing disabled.** Pull his changes
  from it; our own remote comes with the fork.
- **The user plays with `?hard=1&aim=2`** (hard mode, two-tap throwing). Try
  changes in that mode as well as the default, and keep those flags on any
  link that opens the game.
- **The built game is served at `https://…ts.net:8443/vox/`** straight from
  `dist/`, so a change shows only after `npm run build`.
- `/root/projects/CLAUDE.md` loads here too: it covers the machine, the ports
  and the config repo.
