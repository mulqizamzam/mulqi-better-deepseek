# Mulqi Better DeepSeek

**DSH bundle `0.2.1-rc.2` · targets DeepSeek Harness `0.2.1-rc.2`**

A native DeepSeek Harness bridge for the [Better DeepSeek browser extension](https://github.com/EdgeTypE/better-deepseek). It exposes HTTP session controls and live assistant/tool events through Server-Sent Events (SSE).

> **Scope:** this package is a DSH plugin bundle, not the browser extension itself. It connects the extension to a running DSH web profile. It does not provide authentication for the bridge endpoints; use it only in a trusted local environment and do not expose the DSH web server to untrusted networks.

## What it does

- **Connection check:** `GET /api/better-deepseek/ping`
- **Live events:** `GET /api/better-deepseek/events` (SSE)
- **Create a session:** `POST /api/better-deepseek/session.create`
- **Send a prompt:** `POST /api/better-deepseek/session.prompt`
- **Read the latest result:** `GET /api/better-deepseek/session.result?sessionId=...`
- **Cancel a session:** `POST /api/better-deepseek/session.cancel`
- **Event forwarding:** assistant chunks/messages, tool calls/results, and turn completion/stopping.
- **CORS:** enabled by default for browser-extension integration; can be disabled in the plugin config.

## Install in DSH

### Prerequisites

- DeepSeek Harness **`0.2.1-rc.2`** (compatible range: `>=0.2.1-rc.2 <0.2.2`).
- Node.js `^22.19.0` or `>=24.0.0` as required by the target DSH bundle.
- A configured DSH web profile that can start successfully.
- The Better DeepSeek browser extension, if you intend to use the browser integration.

### Install from GitHub

Run in a terminal:

```bash
dsh plugin --profile web add https://github.com/mulqizamzam/mulqi-better-deepseek
```

If `dsh` is not installed as a global command, use the DSH package CLI:

```bash
npx @deepseek-ai/dsh plugin --profile web add https://github.com/mulqizamzam/mulqi-better-deepseek
```

Restart your DSH web profile if required by your setup.

### Verify the installation

Start the web profile using your normal DSH command, then check the health endpoint from the same machine:

```bash
curl http://127.0.0.1:3000/api/better-deepseek/ping
```

Replace port `3000` with the actual port configured for your DSH web server. A working bridge returns JSON with `active: true` and a capability list.

To open the event stream:

```bash
curl -N http://127.0.0.1:3000/api/better-deepseek/events
```

The stream stays open while connected. Stop it with Ctrl+C.

## API quick reference

### Create a session

```bash
curl -X POST http://127.0.0.1:3000/api/better-deepseek/session.create \
  -H 'Content-Type: application/json' \
  -d '{"payload":{"cwd":"/path/to/your/project"}}'
```

The successful response includes a `sessionId`. Use that ID for subsequent requests. If `cwd` is omitted, the DSH process working directory is used.

### Send a prompt

Replace `SESSION_ID` with the ID returned by session creation:

```bash
curl -X POST http://127.0.0.1:3000/api/better-deepseek/session.prompt \
  -H 'Content-Type: application/json' \
  -d '{"payload":{"sessionId":"SESSION_ID","text":"Inspect this project and summarize its structure. Do not edit files."}}'
```

### Retrieve the latest result

```bash
curl 'http://127.0.0.1:3000/api/better-deepseek/session.result?sessionId=SESSION_ID'
```

### Cancel a session

```bash
curl -X POST http://127.0.0.1:3000/api/better-deepseek/session.cancel \
  -H 'Content-Type: application/json' \
  -d '{"payload":{"sessionId":"SESSION_ID"}}'
```

The JSON examples are for local troubleshooting and integration development. The Better DeepSeek extension can use the same bridge API when configured to connect to the DSH web server.

## Configuration

The bundled Cordis patch registers one enabled plugin entry:

```yaml
- insert:
    - id: mulqi-better-deepseek
      name: 'mulqi-better-deepseek'
      disabled: false
      config:
        enableCors: true
```

`enableCors` defaults to `true`. Set it to `false` only if your integration does not need cross-origin requests. CORS is not authentication: it does not prevent arbitrary local clients from calling the endpoints.

## Troubleshooting

- **404 on `/ping`:** confirm the DSH web profile is running, this bundle is installed in that profile, and the URL/port matches your configuration.
- **Connection refused:** the server is not listening at that address/port, or local firewall rules are blocking it.
- **Session not found:** use the exact `sessionId` returned by `session.create`; do not reuse an old ID after restarting DSH.
- **No SSE events:** keep the SSE request open, then create/send a prompt through the bridge. Check that the DSH agent and tools are configured correctly.
- **Browser integration fails:** confirm the extension's bridge URL and the DSH server URL/port agree.

## Develop and validate

Requires Node.js:

```bash
npm test
npm run validate
```

The tests and validator check package metadata, compatibility declarations, bundle configuration, endpoint/event markers, and documentation. They do not replace an integration smoke test against a running DeepSeek Harness `0.2.1-rc.2` instance.

## Credits and license

This is a reconciled DSH-native port of the bridge behavior from [EdgeTypE/dsh-better-deepseek](https://github.com/EdgeTypE/dsh-better-deepseek). See [NOTICE](NOTICE) for attribution and [LICENSE](LICENSE) for the package license. This is an independent port and is not an official release by the upstream maintainers.
