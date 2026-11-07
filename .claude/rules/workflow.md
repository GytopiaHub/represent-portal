# Workflow: plan, get approval, then build

Gene approves every change before it happens. Sessions start in plan mode (`.claude/settings.json`), which blocks edits until a plan is approved. Follow the same process if a session is ever outside plan mode.

## 1. Understand before proposing

- Read the relevant code, the matching SRS sections and the README before suggesting anything.
- Research when unsure:
  - Next.js: the bundled docs in `node_modules/next/dist/docs/`.
  - Auth.js, Drizzle, Neon, Zod, shadcn, Google APIs: their official docs online.
  - Prefer official sources over blog posts, and cite links in the plan.
- If the request is ambiguous and the answer changes the plan, ask Gene. Otherwise pick a sensible default and say which one you chose.

## 2. Present a plan

Keep it short and concrete:

- **Goal:** one line on what Gene asked for, in your own words.
- **Suggestions:** options worth considering, with trade-offs and a clear recommendation. Mention improvements you noticed along the way, but keep them out of the change unless Gene opts in.
- **Changes:** the files you'll touch and what changes in each.
- **Docs:** which SRS sections and README sections you'll update, and the SRS changelog entry. If no docs change is needed, say why.
- **Verification:** how you'll prove it works (typecheck, build, a specific flow, schema diff).
- **Risks and open questions:** anything Gene should decide.

## 3. Wait for explicit approval

- Don't edit, create, move or delete project files until Gene approves. Read-only investigation is fine.
- An approval covers only the plan as written. If the scope changes partway through (a new file, a different approach, an unexpected migration), stop and check with Gene again.
- Answering a question is not a request for changes. Answer it, then offer a plan if a change would help.

## 4. Build and report

- Implement only what was approved, then run the verification steps.
- Report what changed, what you verified, and anything you couldn't verify or that failed. Say so plainly.
- Don't commit or push unless Gene asks.
