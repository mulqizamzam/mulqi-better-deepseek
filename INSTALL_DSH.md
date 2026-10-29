# Install and remove in DeepSeek Harness

This guide is for a beginner installing the bundle into the DSH `web` profile.

## Before starting

1. Install a supported Node.js release: `^22.19.0` or `>=24.0.0`.
2. Verify DSH starts: `npx @deepseek-ai/dsh web`.
3. Configure a provider/model in DSH and confirm its web server is available locally.
4. Keep DSH on a trusted local interface. This bridge does not implement authentication.

## Install from GitHub

Use the DSH command with your profile:

```bash
npx @deepseek-ai/dsh plugin --profile web add https://github.com/mulqizamzam/mulqi-better-deepseek
```

If you have a global `dsh` command, this is equivalent:

```bash
dsh plugin --profile web add https://github.com/mulqizamzam/mulqi-better-deepseek
```

Restart the profile after installation:

```bash
dsh web
```

## Verify

Use the port shown in your DSH configuration/logs and open:

```text
http://127.0.0.1:PORT/api/better-deepseek/ping
```

Expected: a JSON object containing `active: true`, bridge version `0.2.1-rc.2`, and the capability list. Replace `PORT` with the configured DSH web-server port.

To inspect the composed profile configuration, run:

```bash
dsh web --dump-config
```

Search the output for `mulqi-better-deepseek`. If the entry is missing, confirm the plugin was installed into the `web` profile and restart DSH.

## Install from a local checkout

```bash
git clone https://github.com/mulqizamzam/mulqi-better-deepseek.git
cd mulqi-better-deepseek
npx @deepseek-ai/dsh plugin --profile web add link:.
```

If `link:.` is not resolved relative to the repository root by your shell invocation, supply the absolute local path after `link:`. Keep that linked directory in place.

## Change profile or CORS setting

Replace `web` with your actual profile name in the commands above. The bundled patch enables `enableCors: true` for browser-origin requests. To disable it, add a later patch layer in your DSH profile:

```yaml
- override:
    - id: mulqi-better-deepseek
      config:
        enableCors: false
```

Only disable CORS if the extension and DSH deployment do not need cross-origin access.

## Upgrade or remove

Upgrade by running the plugin add command again using the Git source and following any DSH package-manager prompts. To remove it:

```bash
dsh plugin --profile web remove mulqi-better-deepseek
```

Restart the profile afterwards. Check the command against your installed DSH version if the CLI syntax has changed.

## Safety note

The bridge has no authentication and must not be exposed to public or shared networks. Do not bind or forward the DSH web server to an untrusted interface. Permissive CORS allows browser JavaScript to make cross-origin requests; it does not authenticate clients or make a network listener private.
