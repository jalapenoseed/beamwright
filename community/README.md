# Community benches

Benches made by players, built into the game under **community benches** in the bench picker.

## Sending one in (players)

1. Build a bench in the **bench maker** (title screen → bench maker).
2. Press **check**. The solver confirms it can be solved with the parts you gave, and sets par.
3. Open **bench settings**, put your name in the credit box, and press **submit**. A GitHub form opens with your code filled in. Send it.
4. A bot replies on the issue within a couple of minutes with what the solver found.

No GitHub account? Copy the share code from bench settings and post it in the comments on the itch.io page.

## Reviewing (maintainers)

- **GitHub submissions:** play the bench (bench picker → Open a code → paste it → test). If you like it, add the `accepted` label to the issue. The workflow checks it again, saves it here as `NNNN-name.json`, commits it, closes the issue and redeploys GitHub Pages and itch.io.
- **Codes from itch comments:** run `npm run community:add -- BW1-… --author "Their name"`, then commit and push.
- Remove a bench by deleting its file. Fix a typo in a name by editing the file. `npm run verify` re-checks every bench (CI runs it on every push), so a broken edit can't ship.

Each file holds the bench (size, sources, cells, walls, fixed parts, inventory), its author, the date it was added, par, and a solution the hint key can show. Codes are validated field by field when they're read, so a code can only ever describe a legal bench.

Set up once: create the labels `bench submission` and `accepted` (Issues → Labels), and in Settings → Actions → General, allow workflows **Read and write permissions**.

## Maintainer notes

- **Review queue:** accepting a bench is a manual step (play it, add the `accepted` label). Try to review submissions within a week so contributors don't go quiet — even a short "not quite, here's why" keeps the queue healthy.
- **If the bot doesn't reply:** check that the issue has the `bench submission` label and that Actions has read/write permission (see setup above). Re-run the `bench-submission` workflow from the Actions tab.
- **If the accept workflow fails:** it re-checks the bench with the solver before committing. A bench that passed `check` in the maker but fails here usually means the code was edited by hand — ask the author to re-export it.
- **Naming:** files are `NNNN-name.json` (next number, slug of the bench name). Keep the author's credit exactly as they wrote it.
