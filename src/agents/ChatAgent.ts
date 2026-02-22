import { BaseAgent } from './BaseAgent';
import { BaseModel, Message } from '../models/BaseModel';
import { SkillContext } from '../skills/BaseSkill';
import { BaseChannel, ChannelMessage } from '../channels/BaseChannel';
import Logger from '../utils/Logger';

const logger = new Logger('ChatAgent');

export class ChatAgent<M extends BaseModel = BaseModel> extends BaseAgent<M> {

  history: Message[] = [];
  skillsModel?: BaseModel; // Optional separate model for determining what skills to use, if not set the main model will be used
  skillsPromptTemplate?: string = "You are a system agent helping to plan the next query to direct the assistant.  Filter the following list of skills to those relevant to the user's input. Be succinct, and don't list irrelevant skills. User Input: {prompt}.\n\nSkills: {skills-list}"; // Optional template for the prompt to determine skills, can be set in config

  constructor(model?: M, opts: { id?: string; name?: string; role?: string } = {}) {
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
                      const instance = new Ctor({ ...(c.opts || {}), name: c.name, emitRoles: c.emitRoles });
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
      logger.warn('Failed to load channels from config');
      // ignore
    }
    try {
      const skillsModelConfig = this.config?.skillsModel;
      if (skillsModelConfig && typeof skillsModelConfig === 'object') {
        // If no model is set, try to create one from the config
        const modelType = skillsModelConfig.type;
        if (modelType) {
          (async () => {
            const mod = await import(/* webpackIgnore: true */ `../models/${modelType}`);
            const Ctor = (mod && (mod.default ?? mod[modelType])) as any;
            if (typeof Ctor === 'function') {
              this.skillsModel = new Ctor(skillsModelConfig);
            }
          })();
        }
      }
    } catch (e) {
      logger.warn('Failed to instantiate skills model from config', { error: e instanceof Error ? e.message : String(e) });
    }
    this.skillsPromptTemplate = this.config?.skillsPromptTemplate ?? this.skillsPromptTemplate;

  }

  /** Emit a message to history and send it to all subscribed channels */
  private async emitMessage(message: Message): Promise<void> {
    this.history.push(message);
    for (const ch of this.channels) {
      try {
        ch.sendResponse(message).catch(() => {});
      } catch {
        // ignore per-channel errors
      }
    }
  }

  async buildPrompt(): Promise<{ prompt: string }> {
    // Build a prompt from history, assuming the history already has the latest prompt entered
    const promptParts = this.history.filter(m => m.role !== 'system').map(m => `${m.role}: ${m.content}`);
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
   * Processes input and yields messages as they are generated. The final message will 
   * have type 'end', intermediate messages (if supported by the model) will have type 
   * 'delta'. Note that not all channels may support streaming responses, so the agent 
   * should also send the final response to all channels when complete.
   */
  async *sendStream(input: string): AsyncIterable<Message> {
    const userMessage: Message = { role: 'user', content: input, ts: Date.now(), type: 'end' }
    this.emitMessage(userMessage).catch(() => {});
    logger.verbose('User input received', { input });

    // Use the skillsModel to determine what skills can handle this input
    const skillsModel = this.skillsModel || this.model;
    if (skillsModel) {
      const skillsPrompt = this.skillsPromptTemplate?.replace('{prompt}', input).replace('{skills-list}', this.skills.map(s => `* ${s.name} - ${s.description || 'No description'}`).join('\n'));
      if (!skillsPrompt) {
        logger.warn('No skills prompt template defined, skipping skills model step');
      } else {
        const message = { role: 'system' as const, content: skillsPrompt, ts: Date.now(), type: 'end' };
        await this.emitMessage(message).catch(() => {});
        logger.verbose('Running skills model to determine applicable skills with prompt', skillsPrompt);
        try {
          const skillsResp = await skillsModel.predict(skillsPrompt);
          const content = skillsResp.response || String(skillsResp);
          
          await this.emitMessage({ role: 'system' as const, content, ts: Date.now(), type: 'end' });
          logger.verbose('skills model response', content);
          
          // Check for skill type matches in the response
          const responseText = String(content).toLowerCase();
          const skillTypeMatches = this.skills
            .filter(skill => {
              // Match skill name
              if (skill.name && responseText.includes(skill.name.toLowerCase())) return true;
              // Match skill tags
              if (skill.tags && skill.tags.some(tag => responseText.includes(tag.toLowerCase()))) return true;
              return false;
            })
            .map(s => s.name);
          
          if (skillTypeMatches.length > 0) {
            logger.verbose('Matched skills from skills model', skillTypeMatches);

            for (const skillName of skillTypeMatches) {
              const skill = this.skills.find(s => s.name === skillName);
              if (!skill) continue;
              // Run each matched skill and yield its result as a system message before the main model response
              try {
                const skillCtx: SkillContext = { agentId: this.id, model: this.model };
                const skillResult = await (this as unknown as BaseAgent).runSkill(input, skillCtx);
                if (skillResult !== undefined) {
                  const content = typeof skillResult === 'string' ? skillResult : JSON.stringify(skillResult, null, 2);
                  await this.emitMessage({ role: 'supplementary' as const, content: String(content), ts: Date.now(), type: 'end' });
                }
              } catch (e) {
                logger.warn(`Failed to run skill ${skillName}`, e);
              }
            }
          } else {
            logger.verbose('No skills matched from skills model response');
          }
        } catch (e) {
          logger.warn('Failed to run skills model', e);
        }
      }
    }

    if (!this.model) {
      const message = { role: 'system' as const, content: 'Error: No model available to handle the input.', ts: Date.now(), type: 'end' };
      await this.emitMessage(message);
      yield message;
      logger.warn('No model available on agent to handle input');
      return;
    }

    // No skill handled it — build a plan and use the model.
    const plan = await this.buildPrompt();
    // Prefer a model streaming API if available
    const modelAny = this.model as any;
    logger.verbose('Model predictStream type', typeof modelAny.predictStream);
    if (typeof modelAny.predictStream === 'function') {
      // Create pushable streams for each streaming-capable channel before starting model streaming
      type StreamController = { stream: AsyncIterable<string>; push: (s: string) => void; end: () => void };
      const controllers = new Map<BaseChannel, StreamController>();

      const createController = (): StreamController => {
        const queue: string[] = [];
        const waiters: Array<() => void> = [];
        let ended = false;

        const push = (s: string) => {
          queue.push(s);
          const w = waiters.shift();
          if (w) w();
        };
        const end = () => {
          ended = true;
          const w = waiters.shift();
          if (w) w();
        };

        async function* gen() {
          try {
            while (!ended || queue.length > 0) {
              if (queue.length === 0) {
                await new Promise<void>(res => waiters.push(res));
                continue;
              }
              yield queue.shift() as string;
            }
          } finally {
            // nothing
          }
        }

        return { stream: gen(), push, end };
      };

      // Initialize controllers and start streams on channels
      for (const ch of this.channels) {
        try {
          if (ch.supportsStreaming()) {
            const ctrl = createController();
            controllers.set(ch, ctrl);
            // start the channel-side stream before awaiting model output
            ch.sendResponse({ id: ch.id, stream: ctrl.stream }).catch(() => {});
          }
        } catch (e) {
          // ignore per-channel errors
        }
      }

      // Stream via model and broadcast deltas into the controllers
      let accumulated = '';
      this.history.push({ content: '', ts: Date.now(), type: 'start' });
      for await (const chunk of modelAny.predictStream(plan.prompt)) {
        if (chunk.type === 'delta') {
          accumulated += chunk.content ?? '';
          this.history[this.history.length - 1] = { role: chunk.role, content: accumulated, ts: Date.now(), type: 'delta' };
          // push delta to all streaming channels
          for (const [ch, ctrl] of controllers.entries()) {
            try { ctrl.push(chunk); } catch { /* ignore */ }
          }
        }
        else if (chunk.type === 'start') {
          this.history.push({ role: chunk.role, content: '', ts: Date.now(), type: 'start' });
        }
        else if (chunk.type === 'end') {
          if (chunk.content) {
            this.history[this.history.length - 1].content = chunk.content;
          }
          this.history[this.history.length - 1].type = 'end';
          this.history[this.history.length - 1].ts = Date.now();
          // close all streaming controllers
          for (const [, ctrl] of controllers.entries()) {
            try { ctrl.end(); } catch { /* ignore */ }
          }
        }

        // yield updated assistant message so callers can observe progress
        // yield this.history[this.history.length - 1];
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
    await this.emitMessage(message).catch(() => {});
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
