# Dependency Security Audit — 2026-10-09

Commands run against the current lockfile: `npm audit --json`,
`npm audit --omit=dev --json`, `npm ls --depth=0`, and targeted `npm ls` /
`npm explain` for the affected wallet and worker packages. `npm audit` exits 1
because findings remain. A previous non-forced `npm audit fix` updated the
lockfile within declared semver ranges; it did not resolve the remaining
findings. The current top-level install is internally consistent.

## Counts

| Scope | Audit result | Interpretation |
|---|---:|---|
| Production dependency graph | 23 vulnerable package nodes: 22 moderate, 1 high | Mostly connector families not configured by the app, plus a nested `ws` package |
| Full install graph | 26 vulnerable package nodes: 23 moderate, 1 high, 2 critical | Includes the production graph and development test runner |
| Direct packages named by audit | `wagmi` moderate; `vitest` critical | npm's available graph-wide fixes require major versions |

These are vulnerable dependency **nodes**, not 26 distinct advisories. Current
critical advisories are Tinypool RCE findings `GHSA-5gmw-xhrv-c9v3` and
`GHSA-85c8-ppgw-ccpr`. The Vitest mocker also has the moderate path traversal
finding `GHSA-82fw-gwwq-j7x9`. Production findings include `ws`
`GHSA-58qx-3vcg-4xpx` and `GHSA-96hv-2xvq-fx4p`, `decode-uri-component`
`GHSA-vcc3-ghjq-m6fr`, and `uuid` `GHSA-w5hq-g745-h8pq`.

## Triage

| Package/family | Scope and path | Severity / condition | Current app reachability | Fix and risk |
|---|---|---|---|---|
| `wagmi` 2.19.5, `@wagmi/connectors` 6.2.0 | Production direct root and connector graph | Moderate npm advisory | Wagmi is used for wallet state and contract calls; app config selects only `injected()` | npm proposes `wagmi@3.7.7`, a major upgrade. Defer until a Wagmi 3 compatibility and wallet-flow test plan exists. |
| `@walletconnect/*`, `@reown/*`, `@gemini-wallet/core`, `@metamask/sdk`, `@metamask/*` | Production transitive optional connector tree under `@wagmi/connectors` | Moderate advisories for package families and their transitive parsing/UUID dependencies | No WalletConnect, Gemini, or MetaMask SDK connector is configured or offered by the UI; only injected EIP-1193 is configured. The lock graph exists and connector-barrel tree-shaking was not proven complete. | Mostly disappears only with a connector dependency graph change / Wagmi major. Avoid asserting unreachable solely from audit metadata. |
| `query-string` 9.4.1 and `decode-uri-component` 0.4.2 | Production under WalletConnect utility packages | Moderate denial of service with malformed percent-encoded input (decode amplification) | Only relevant if the WalletConnect utility parsing path is invoked; no WalletConnect connector is selected. | npm's graph fix requires Wagmi 3. Defer with the unused-connector limitation documented. |
| `uuid` <11.1.1 | Production under MetaMask SDK / MetaMask utilities | Moderate bounds-check issue when caller supplies a buffer to UUID v3/v5/v6 | MetaMask SDK connector not selected; no direct app call to UUID buffer APIs was found. | Same major connector graph fix. Do not describe as a direct game-code vulnerability. |
| nested `viem` 2.23.2 → `ws` 8.18.0 | Production under WalletConnect utilities; root `viem` is 2.57.4 and root `ws` is 8.21.0 | High `ws` memory disclosure / resource-exhaustion advisories apply to vulnerable WebSocket server/client paths | App RPC transport is `http()`. It does not construct a WebSocket transport; vulnerable nested copy is under the unselected WalletConnect tree. Root `ws` is already fixed. | npm presents the Wagmi 3 graph as the fix. Do not force a root override without checking walletconnect's supported peer/dependency range. |
| `vitest` 3.2.7, `tinypool` 1.1.1, `@vitest/mocker` | Development-only test tooling | Two critical Tinypool RCE advisories affect polluted worker options; separate moderate redirect-mock path traversal affects mock setup | Not part of the production browser build. Relevant when running tests/CI with untrusted test code, malicious worker options, or compromised development dependencies. | npm proposes `vitest@5.0.3`, a major upgrade. Keep tests offline from wallet secrets and review a major-upgrade plan before changing the runner. |

No current production critical advisory was returned. The full audit's critical
findings are in development tooling, not the shipped browser runtime. Their
presence still matters for developer/CI supply-chain safety and is not called
“secure” or silently waived here.

## Decision

No `--force` fix or major Wagmi/Vitest upgrade was applied. The tree passed
`npm ls --depth=0`, and the production application is configured with the
injected connector and HTTP RPC only. The optional connector packages remain
installed in the production graph, so moderate findings remain a documented
release risk; the nested high `ws` finding is not on the configured game RPC
path but is still reported by npm. Re-run the audit against the exact release
lockfile and obtain a release-owner risk decision or complete a separately
validated connector/dependency upgrade before public release.
