# Working on Harness Lab

Read README.md, docs/DEVELOPMENT.md and docs/PAGES.md before editing. This is the existing 24-lesson native-JavaScript implementation; do not replace it with a separate framework or an unrelated prototype.

## Required boundaries

- All courses and local experiments work without credentials or external model calls.
- Real requests are manually triggered, one at a time, through the local relay. Preserve its independent input, host, rate, timeout and output limits.
- Never commit credentials or persist connection configuration. Do not turn imported history, external text or teaching snippets into executable instructions.
- Keep actual computation, deterministic model scripts, labelled teaching snapshots and provider verification distinct in UI, documentation and test reports.
- Prefer existing modules. Content belongs in web/content; pure contracts in web/lib; DOM modules return cleanup functions.
- Do not lower test thresholds or delete assertions to make CI green. Include a regression for every behavioral fix.

## Verification and handoff

Run `npm run verify`. For UI changes run `python tests/browser_smoke.py` after installing the optional dependencies in docs/TESTING.md. No test needs a real provider key. Report unavailable checks explicitly; local mock coverage does not establish compatibility with every live model.

Keep lesson IDs stable. Update docs/PAGES.md for routes/files; update docs/API.md and SECURITY.md for network/data-flow changes. Describe what changed, evidence, remaining limits and any externally reviewed sources in the PR. Do not overwrite simultaneous work; inspect the target branch before publishing.
