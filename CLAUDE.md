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
- **The game defaults to hard mode with two-tap throwing,** the way the user
  plays (`readModes` in `src/arcade/content/modeFlags.ts`); `?hard=0` and
  `?aim=1` turn them off. Try changes in the default and in esrauch's
  original game, `?hard=0&aim=1`. Old links with `?hard=1&aim=2` still play
  the default. Practice links (the play editor's Try it) carry `aim=2` or
  `aim=1`, whichever Try with chose, and ignore hard mode (decision map t3).
- **Releases go to `https://ohnoabigshark.github.io/vox/`** only when the user
  asks: the `Deploy` workflow runs by hand on `main` and nothing else
  (`docs/PLAN.md`, release mode). Merging to `main` publishes nothing.
- **The built game is served at `https://…ts.net:8443/vox/`,** rebuilt by git
  hooks after every commit, merge and branch checkout in this checkout, and
  swapped in only if the build passes (`docs/stacks/vox.md` in
  `/root/projects`; log: `/root/.local/share/vox-serve/rebuild.log`).
- `/root/projects/CLAUDE.md` loads here too: it covers the machine, the ports
  and the config repo.
