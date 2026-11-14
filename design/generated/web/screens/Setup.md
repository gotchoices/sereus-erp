---
provides: ["screen:Setup"]
mocks: []
dependsOn:
  - design/stories/web/settings-02-start-or-join.md
  - design/specs/domain/deployment.md
  - design/specs/project.md
depHashes: {}
---

# Setup: start a new installation, or join one

Story settings-02. Route `/setup`. The layout sends every other page here while the machine
is not set up, is joining, or is waiting for its catalog; it sends `/setup` on to `/product`
once the catalog is ready. The top bar shows no module links until then.

## Files

| Piece | File |
|---|---|
| Screen | `src/routes/setup/+page.svelte`, `+page.server.ts` (actions `start`, `join`) |
| Gate | `src/routes/+layout.server.ts` |

## Layout

- A sentence saying what an installation is, then two large choices side by side:
  **Start a new installation** ("For a company that has none yet…") and **Join an existing
  installation** ("You need an invitation from one of its owners").
- **Start:** company, this machine's name (default "front office"), catalog name (default
  "Catalog"), what the catalog is for (optional), "Start with a common set of units…"
  (checked). Button "Start". A note to make a recovery key afterwards.
- **Join:** invitation (textarea), this machine's name, and "I also have an owner grant"
  (folded). Button "Join", which reads "Joining… (this can take a minute)" while it waits.
  A refusal is shown in words; when retryable, "Nothing was set up. You can try again."
- **Joined, waiting:** "This machine, “name”, is copying the installation's data", each
  catalog copying or ready; the page looks again every 3 seconds and moves on by itself.
- **Removed or failed:** the reason, in words.
