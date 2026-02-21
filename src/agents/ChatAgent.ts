import { BaseAgent } from './BaseAgent';
import { BaseModel, Message } from '../models/BaseModel';
import { SkillContext } from '../skills/BaseSkill';
import { BaseChannel, ChannelMessage, ChannelResponse } from '../channels/BaseChannel';
import Logger from '../utils/Logger';

const logger = new Logger('ChatAgent');

export class ChatAgent<M extends BaseModel = BaseModel> extends BaseAgent<M> {
  history: Message[] = [];

  constructor(model: M, opts: { id?: string; name?: string; role?: string } = {}) {
    super(model, opts);
    // If config defines channels, instantiate and register them
    try {
      // obtain channels from this agent's config entry
      const cfg = this.config as any;
      const chcfg = cfg?.channels;
      if (Array.isArray(chcfg)) {
        for (const c of chcfg) {
          try {
            let inst: BaseChannel | null = null;
            const kind = String(c.type ?? c.impl ?? c.channel ?? c.name ?? '').trim();
            // require an exact class/module name match for security/clarity
            if (kind) {
              // perform dynamic import asynchronously and register when ready
              (async () => {
                try {
                  const mod = await import(/* webpackIgnore: true */ `../channels/${kind}`);
                  const Ctor = (mod && (mod.default ?? mod[kind])) as any;
                  if (typeof Ctor === 'function') {
                    try {
                      const instance = new Ctor({ ...(c.opts || {}), name: c.name });
                      this.registerChannel(instance);
                    } catch (_) {
                      // construction failed
                    }
                  }
                } catch (e) {
                  // couldn't import the named channel module; skip
                }
              })();
            }
            if (inst) this.registerChannel(inst);
          } catch (e) {
            // ignore channel instantiation errors
          }
        }
      }
    } catch {
      // ignore
    }
  }

  async plan(input: string) {
    // Build a simple prompt from history + input
    const promptParts = this.history.map(m => `${m.role}: ${m.content}`);
    promptParts.push(`user: ${input}`);
    const prompt = promptParts.join('\n');
    return { prompt };
  }

  async act(plan: { prompt: string }) {
    // Use the model to generate a response
    // const resp = await this.model.predict(plan.prompt);
    // const content = typeof resp === 'object' && resp.output ? resp.output : String(resp);
    // const message = { role: 'assistant' as const, content: String(content), ts: Date.now() };
    // this.history.push(message);
    // return message;
    return this.send(plan.prompt);
  }

  async send(input: string) {
    // Backwards-compatible send: return a Promise that resolves to the final message.
    const stream = this.sendStream(input);
    // Collect the first (and in non-streaming cases the only) assistant message
    for await (const msg of stream) {
      // return the first assistant message produced by the stream
      return msg;
    }
    // If stream produced nothing, return a generic empty assistant message
    const empty = { role: 'assistant' as const, content: '', ts: Date.now() };
    return empty;
  }

  /**
   * Streamed version of `send`. Yields `Message` chunks as they become available.
   * Useful when models or skills can produce incremental output.
   */
  async *sendStream(input: string): AsyncIterable<Message> {
    this.history.push({ role: 'user', content: input, ts: Date.now(), type: 'end' });

    // Allow registered skills to handle the input first
    const skillCtx: SkillContext = { agentId: this.id, model: this.model };
    const skillResult = await (this as unknown as BaseAgent).runSkill(input, skillCtx);
    if (skillResult !== undefined) {
      const content = typeof skillResult === 'string' ? skillResult : JSON.stringify(skillResult, null, 2);
      const message = { role: 'assistant' as const, content: String(content), ts: Date.now(), type: 'end' };
      this.history.push(message);
      yield message;
      return;
    }

    // No skill handled it — build a plan and use the model.
    const plan = await this.plan(input);
    // Prefer a model streaming API if available
    const modelAny = this.model as any;
    logger.verbose('Model predictStream type', typeof modelAny.predictStream);
    if (typeof modelAny.predictStream === 'function') {
      // Stream via model and broadcast to channels that support streaming
      let accumulated = '';
      for await (const chunk of modelAny.predictStream(plan.prompt)) {
        if (chunk.type === 'delta') {
          accumulated += chunk.content ?? '';
          this.history[this.history.length - 1] = { role: chunk.role, content: accumulated, ts: Date.now(), type: 'delta' };
        }
        else if (chunk.type === 'start') {
          this.history.push({ role: chunk.role, content: '', ts: Date.now(), type: 'start' });
        }
        else if (chunk.type === 'end') {
          if (chunk.content) {
            this.history[this.history.length - 1].content = chunk.content;
          }
          this.history[this.history.length - 1].type = 'end';
          this.history[this.history.length - 1].ts = Date.now()
        }

        for (const ch of this.channels) {
          try {
            if (ch.supportsStreaming() && chunk.type === 'delta') {
              const stream = (async function* () { yield String(chunk.content); })();
              const resp: ChannelResponse = { id: undefined, stream };
              ch.sendResponse(resp).catch(() => {});
            }
            if (chunk.type === 'end') {
              const messageContent = this.history[this.history.length - 1].content;
              const stream = (async function* () { yield String(messageContent); })();
              const resp: ChannelResponse = { id: undefined, stream };
            }
          } catch (e) {
            // ignore
          }
        }
        yield this.history[this.history.length - 1];
      }
      // After streaming completes, also send final concatenated message to non-streaming channels
      const final = this.history.filter(h => h.role === 'assistant').map(h => h.content).join('');
      for (const ch of this.channels) {
        try {
          if (!ch.supportsStreaming()) {
            ch.sendResponse({ content: final }).catch(() => {});
          }
        } catch {}
      }
      return;
    }

    // Fallback: call non-streaming predict and yield single message
    const resp = await this.model.predict(plan.prompt);
    const content = typeof resp === 'object' && resp.output ? resp.output : String(resp);
    const message = { role: 'assistant' as const, content: String(content), ts: Date.now(), type: 'end' };
    this.history.push(message);
    // send to all channels
    for (const ch of this.channels) {
      try {
        if (ch.supportsStreaming()) {
          // wrap single message as a one-item stream
          const stream = (async function* () { yield String(content); })();
          ch.sendResponse({ stream }).catch(() => {});
        } else {
          ch.sendResponse({ content: String(content) }).catch(() => {});
        }
      } catch {
        // ignore
      }
    }
    yield message;
  }

  protected async onChannelMessage(msg: ChannelMessage, channel: BaseChannel): Promise<void> {
    // When a channel message arrives, act like a user input and stream/send response back to that channel
    // Use sendStream so we can stream where supported
    try {
      if (channel.supportsStreaming()) {
        // build stream from agent and forward only to originating channel
        const gen = this.sendStream(msg.text);
        // forward each message chunk as a part
        for await (const m of gen) {
          // send partial as one-part stream
          const stream = (async function* () { yield m.content || ''; })();
          await channel.sendResponse({ stream });
        }
      } else {
        // non-streaming: collect final message
        const out = await this.send(msg.text);
        await channel.sendResponse({ content: out.content });
      }
    } catch (e) {
      // ignore
    }
  }
}
