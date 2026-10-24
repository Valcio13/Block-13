# Floor 13 release candidate checklist

Status: **not ready for public release**. The Hemi Mainnet address is recorded,
but release blockers and manual verification remain.

## Blockers

- [ ] **BLOCKER — artwork rights:** resolve every `UNRESOLVED` entry in
  `docs/visual-asset-provenance.md`; record creator, source/generation process,
  license, attribution, and explicit public redistribution permission. If
  rights cannot be obtained, commission/create and document replacements.
- [ ] **MAJOR — dependencies:** review current `npm audit` output and resolve
  or formally accept the production high/moderate advisories and test-runner
  critical advisories. The previous non-forced lock update did not clear all
  findings; no major wagmi/Vitest upgrade was made without a compatibility
  plan.
- [ ] **MAJOR — pending-chain status:** manual QA must test wallet rejection,
  pending, mined, and reverted TX1/TX2, and verify the user-facing “inspect
  explorer” recovery choice never triggers an automatic resend.
- [ ] **MINOR — bundle warning:** the build warns about a large main chunk.
  Measure load performance at the contest host; defer code splitting unless
  the measured startup cost warrants it.
- [x] Removed tracked legacy `src.zip` and `src.rar`; no source reference to
  either archive was found and neither was copied to the production build.

## Before release

- [ ] Confirm the visual asset rights entry is complete and publish required
  notices with the game.
- [ ] Run `npm ci`, `npm test`, `npm run build`, and `git diff --check` on the
  exact release commit.
- [ ] Serve the production build from the contest host and exercise the Local
  menu path at desktop viewport sizes; check browser console and network
  requests for missing assets.
- [ ] Manually test the injected-wallet Hemi Testnet flow using a funded test
  wallet: network switching, TX1 start, run entry, TX2 completion, failure and
  retry. Do not use a production wallet or submit anything without explicit
  user action.
- [ ] Test refresh/recovery behavior, audio settings and preview cleanup,
  pause/resume, reduced scare intensity, progression, death, and victory.
- [ ] Review the large Vite main-chunk warning. It is not currently a build
  failure; only pursue code splitting if it can be done and revalidated
  without risky refactoring.
- [ ] Review the final tracked and untracked file list before release.
- [x] Version distinction documented: private package metadata stays `0.2.0`;
  protocol game version is `0.6.0` for deterministic procedural puzzle rules.
- [ ] Create and review a release commit, then tag only after all blockers
  clear.

## Verified in this audit

- [x] Root MIT `LICENSE` is present for the software. Bundled media rights are
  separate and are tracked in `ASSET_CREDITS.md` and audio license records.
- [x] Production manifests and asset tests cover loaded image/audio paths and
  native PNG dimensions/modes.
- [x] Main menu and audio settings loaded from a local Vite production preview;
  Escape closed settings and the Local path reached the opening narrative.
- [x] Base-aware runtime asset URL strategy supports root and configured
  nested prefixes; URL tests and a nested-prefix production build pass.
- [x] Active run recovery replays canonical inputs and validates the recovered
  authoritative state, including checkpoint/continuation equivalence at the
  transition into Block 13; see `docs/run-recovery.md` and replay tests.
- [x] New runs bind Floor 13 procedural puzzle progression to game version `0.6.0` and
  its new rules identity; old manifests are retained but unfinished old-rule checkpoints are
  rejected.
- [x] Recovery regressions reject unfinished `0.5.0` and `0.4.2` checkpoints
  under the new puzzle rules; InputLogV2 and FinalStateV1 remain unchanged.
- [x] Latest full automated validation after the procedural puzzle progression:
  `npm test` passed (46 files, 271 tests); `npm run build` passed; `git diff --check`
  passed. The production build reports a 2.014 MB minified main chunk (576.67
  kB gzip), plus third-party annotation and chunk-size warnings.
- [ ] Manual all-floor puzzle playthrough remains outstanding because browser
  access was unavailable during the 2026-10-14 verification attempt.
- [x] Current dependency audit was recorded in
  `docs/dependency-audit-2026-10.md`: 23 production vulnerable package nodes
  (22 moderate, 1 high) and 26 total (23 moderate, 1 high, 2 critical).
  Findings remain release issues; no unsafe major upgrade was applied.
