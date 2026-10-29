# Source reconciliation and disposition

Inspected source: [EdgeTypE/dsh-better-deepseek](https://github.com/EdgeTypE/dsh-better-deepseek), default branch `main`, commit `b1043860f5f10fd7ed12664ebe32ca4fd6445aca` (14 August 2026).

## Reusable behavior preserved

| Source capability | Port disposition |
|---|---|
| `/api/better-deepseek/ping` handshake | Preserve; report the target DSH package version |
| SSE events endpoint | Preserve live event stream; clean up closed clients |
| Session creation with cwd/model selection/preset | Preserve; add collision-resistant ID suffix |
| Prompt submission | Preserve; validate required session and text fields |
| Session cancellation | Preserve with RPC error envelope |
| Session result polling | Preserve status and latest assistant text |
| Assistant chunks/messages and tool events | Preserve event families |
| CORS option | Preserve; enabled by default |
| Cordis bundle registration | Adapt to the new package identity |

## Source artifact dispositions

- TypeScript source, compiled JavaScript, and declaration output: consolidated into the package-root `index.js`; the new package is not tied to the original monorepo build layout.
- `cordis.patch.yml`: preserved and adapted to package identity `mulqi-better-deepseek`.
- Existing test examples: ported to dependency-free structural tests and local metadata validation. A live DSH runtime smoke test remains a separate gate.
- Original PowerShell installer and patch-reset helper: not copied. They mutate user profile files and are unnecessary for the standard DSH bundle installation path. Standard `dsh plugin` installation is documented instead.
- BOM-cleanup helper: omitted as repository-maintenance functionality, not end-user product behavior.
- Workspace-only dependencies and monorepo path references: replaced with compatibility metadata for the requested DSH release.
- No secret, credential, remote service, or telemetry capability is intentionally included. The HTTP bridge has no authentication; documentation warns not to expose it to untrusted networks.

## Architecture decision

**Native DSH bundle.** The code must execute inside the DSH Cordis host, register routes on the host web server, and interact with DSH agents. No separate MCP server or service process is needed for the bridge.

## Compatibility and verification boundaries

The package declares DSH `>=0.2.1-rc.2 <0.2.2`, Node.js `^22.19.0 || >=24.0.0`, and target-version peer dependencies. Local tests and metadata validation pass in the authoring environment. No successful live DSH `0.2.1-rc.2` integration run is claimed.
