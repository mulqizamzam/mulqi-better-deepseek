import { Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { installModelSelection } from '@deepseek-ai/dsh-agent'

/**
 * Better DeepSeek extension bridge for DeepSeek Harness.
 * Exposes a local HTTP handshake/session API and a Server-Sent Events stream.
 * No external network calls or telemetry are performed by this bundle.
 */
export const name = 'mulqi-better-deepseek'
export const inject = ['webServer', 'agents']

export const Config = z.object({
  enableCors: z.boolean().default(true),
})

const PREFIX = '/api/better-deepseek'
const MAX_BODY_BYTES = 1024 * 1024

export class BetterDeepSeekBridgeService extends Service {
  static inject = inject
  static Config = Config

  #sseClients = new Set()
  #latestAssistantTextBySession = new Map()

  constructor(ctx, config = {}) {
    super(ctx, 'mulqiBetterDeepSeekBridge')
    this.config = { enableCors: config.enableCors !== false }

    this.ctx.effect(() => this.ctx.webServer.register({
      kind: 'prefix',
      path: PREFIX,
      handler: async (req, res) => {
        if (this.#handleCors(req, res)) return
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
        const pathname = url.pathname

        if (pathname === `${PREFIX}/ping` && req.method === 'GET') {
          return this.#json(res, 200, {
            active: true,
            version: '0.2.1-rc.2',
            capabilities: ['filtered_sse', 'session_control', 'session_result', 'assistant_events', 'tool_events'],
          })
        }

        if (pathname === `${PREFIX}/events` && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          })
          res.write(': connected\n\n')
          this.#sseClients.add(res)
          const dispose = () => this.#sseClients.delete(res)
          req.on('close', dispose)
          res.on('close', dispose)
          return
        }

        if (pathname === `${PREFIX}/session.result` && req.method === 'GET') {
          const sessionId = url.searchParams.get('sessionId') ?? ''
          const finalText = this.#latestAssistantTextBySession.get(sessionId) ?? ''
          const agent = sessionId ? this.ctx.agents.get(sessionId) : undefined
          return this.#json(res, 200, {
            type: 'server-response',
            result: {
              ok: true,
              value: {
                sessionId,
                status: agent?.status ?? 'idle',
                finalText,
              },
            },
          })
        }

        if (req.method === 'POST' && [
          `${PREFIX}/session.create`,
          `${PREFIX}/session.prompt`,
          `${PREFIX}/session.cancel`,
        ].includes(pathname)) {
          let body
          try {
            body = await this.#readJsonBody(req)
          } catch (error) {
            return this.#json(res, 400, {
              type: 'server-response',
              rpcId: undefined,
              result: { ok: false, error: { message: error.message } },
            })
          }
          const rpcId = body.rpcId ?? `bd-rpc-${Date.now()}`

          if (pathname === `${PREFIX}/session.create`) {
            try {
              const cwd = body.payload?.cwd ?? process.cwd()
              const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
              this.#latestAssistantTextBySession.set(sessionId, '')

              const defaultModel = this.ctx.get('agentDefaultModel')
              const selection = defaultModel
                ? defaultModel.currentSelection()
                : { provider: 'deepseek-official', model: 'deepseek-chat' }

              const presets = this.ctx.get('agentPresets')
              let presetId
              if (presets) {
                try {
                  presetId = (await presets.resolve(undefined))?.id
                } catch {
                  // A preset is optional; fall back to the selected model.
                }
              }

              await this.ctx.agents.create({
                sessionId,
                meta: {
                  cwd,
                  ...(presetId !== undefined ? { agentPreset: presetId } : {}),
                },
                agentOptions: {
                  provider: selection.provider,
                  model: selection.model,
                },
                setup: async (agentCtx) => {
                  installModelSelection(agentCtx, {
                    current: selection,
                    assembled: undefined,
                  })
                  if (presets && presetId) await presets.mount(agentCtx, presetId)
                },
              })

              return this.#json(res, 200, {
                type: 'server-response',
                rpcId,
                result: { ok: true, value: { sessionId } },
              })
            } catch (error) {
              return this.#json(res, 500, {
                type: 'server-response',
                rpcId,
                result: {
                  ok: false,
                  error: { message: error?.message ?? 'Failed to create session' },
                },
              })
            }
          }

          const sessionId = body.payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId.trim()) {
            return this.#json(res, 400, {
              type: 'server-response',
              rpcId,
              result: { ok: false, error: { message: 'payload.sessionId is required' } },
            })
          }

          const agent = this.ctx.agents.get(sessionId)
          if (!agent) {
            return this.#json(res, 404, {
              type: 'server-response',
              rpcId,
              result: {
                ok: false,
                error: { message: `Session "${sessionId}" not found` },
              },
            })
          }

          if (pathname === `${PREFIX}/session.prompt`) {
            const text = body.payload?.text
            if (typeof text !== 'string' || !text.trim()) {
              return this.#json(res, 400, {
                type: 'server-response',
                rpcId,
                result: { ok: false, error: { message: 'payload.text is required' } },
              })
            }
            const userMsg = {
              id: crypto.randomUUID(),
              role: 'user',
              source: { kind: 'user' },
              content: [{ type: 'text', text }],
            }
            try {
              await agent.followup(userMsg)
              return this.#json(res, 200, {
                type: 'server-response',
                rpcId,
                result: { ok: true, value: {} },
              })
            } catch (error) {
              return this.#json(res, 500, {
                type: 'server-response',
                rpcId,
                result: {
                  ok: false,
                  error: { message: error?.message ?? 'Failed to submit prompt' },
                },
              })
            }
          }

          if (pathname === `${PREFIX}/session.cancel`) {
            try {
              await agent.cancel('user-request')
              return this.#json(res, 200, {
                type: 'server-response',
                rpcId,
                result: { ok: true, value: { canceled: true } },
              })
            } catch (error) {
              return this.#json(res, 500, {
                type: 'server-response',
                rpcId,
                result: {
                  ok: false,
                  error: { message: error?.message ?? 'Failed to cancel session' },
                },
              })
            }
          }
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('not found')
      },
    }), 'mulqi-better-deepseek: gateway router')

    this.#setupEventListeners()
  }

  #json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  #handleCors(req, res) {
    if (this.config.enableCors) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return true
    }
    return false
  }

  async #readJsonBody(req) {
    const chunks = []
    let totalBytes = 0
    for await (const chunk of req) {
      const data = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      totalBytes += data.length
      if (totalBytes > MAX_BODY_BYTES) throw new Error('Request body exceeds 1 MiB limit')
      chunks.push(data)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    let body
    try {
      body = JSON.parse(raw || '{}')
    } catch {
      throw new Error('Request body must be valid JSON')
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Request body must be a JSON object')
    }
    return body
  }

  #setupEventListeners() {
    this.ctx.effect(() => this.ctx.on('session/event', (session, event) => {
      if (event.type === 'assistant/chunk') {
        const data = event.data ?? {}
        const delta = data.text ?? data.delta ?? data.chunk?.text ?? data.chunk?.delta ?? ''
        if (delta) {
          this.#latestAssistantTextBySession.set(
            session.id,
            (this.#latestAssistantTextBySession.get(session.id) ?? '') + delta,
          )
          this.#broadcast('assistant/chunk', { sessionId: session.id, delta })
        }
      }
      if (event.type === 'assistant/message') {
        const content = event.data?.message?.content
        const text = Array.isArray(content)
          ? content.filter(part => part?.type === 'text').map(part => part.text ?? '').join('')
          : ''
        if (text) {
          this.#latestAssistantTextBySession.set(session.id, text)
          this.#broadcast('assistant/message', { sessionId: session.id, text })
        }
      }
    }), 'mulqi-better-deepseek: session event listener')

    this.ctx.effect(() => this.ctx.on('tools/pre-execute', (exec, next) => {
      const sessionId = exec.agent?.id
      if (sessionId !== undefined) {
        this.#broadcast('tool/call', {
          sessionId,
          tool: exec.name,
          args: exec.arguments,
        })
      }
      return next()
    }), 'mulqi-better-deepseek: tool pre-execute listener')

    this.ctx.effect(() => this.ctx.on('tools/post-execute', (exec, result, next) => {
      const sessionId = exec.agent?.id
      if (sessionId !== undefined) {
        this.#broadcast('tool/result', {
          sessionId,
          tool: exec.name,
          output: result,
        })
      }
      return next()
    }), 'mulqi-better-deepseek: tool post-execute listener')

    this.ctx.effect(() => this.ctx.on('agent/turn-stopping', (payload) => {
      const sessionId = payload.agent.id
      const finalText = this.#latestAssistantTextBySession.get(sessionId) ?? ''
      this.#broadcast('turn/complete', {
        sessionId,
        turn: payload.turn,
        finalText,
      })
      this.#broadcast('turn/stopping', { sessionId, turn: payload.turn })
    }), 'mulqi-better-deepseek: turn stopping listener')
  }

  #broadcast(type, payload) {
    const frame = `data: ${JSON.stringify({ type, timestamp: Date.now(), payload })}\n\n`
    for (const client of this.#sseClients) {
      if (client.destroyed || client.writableEnded) {
        this.#sseClients.delete(client)
        continue
      }
      try {
        client.write(frame)
      } catch {
        this.#sseClients.delete(client)
      }
    }
  }
}

export function apply(ctx, config = {}) {
  return ctx.plugin(BetterDeepSeekBridgeService, config)
}

export default BetterDeepSeekBridgeService
