import { BaseAgent } from './BaseAgent';
import { Message } from '../models/BaseModel';
import { ToolContext, Logger } from '@openglove/base';
import { BaseChannel, ChannelMessage } from '../channels/BaseChannel';
import { DefaultPipeline } from '../pipeline/DefaultPipeline';
import { InputHandlerInput } from '../pipeline/input-handlers';
import { PromptTemplate } from '../utils/prompts';
import { BaseGenerativeModel } from '../models/generative';

const logger = new Logger('ChatAgent');

export class ChatAgent extends BaseAgent {

  history: Message[] = [];
  pipeline: DefaultPipeline = new DefaultPipeline({ emitMessage: this.emitMessage.bind(this) });
  toolsModel?: BaseGenerativeModel; // Optional separate model for determining what tools to use, if not set the main model will be used
  toolsPromptTemplate?: string = "You are a system agent helping to plan the next query to direct the assistant.  Filter the following list of tools to those relevant to the user's input. Be succinct, and don't list irrelevant tools. User Input: {prompt}.\n\nTools: {tools-list}"; // Optional template for the prompt to determine tools, can be set in config

  constructor(model?: BaseGenerativeModel, opts: { id?: string; name?: string; role?: string } = {}) {
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
      const toolsModelConfig = this.config?.toolsModel;
      if (toolsModelConfig && typeof toolsModelConfig === 'object') {
        // If no model is set, try to create one from the config
        const modelType = toolsModelConfig.type;
        if (modelType) {
          (async () => {
            const model = await BaseGenerativeModel.require(modelType, toolsModelConfig).catch(e => {
              logger.warn('Failed to instantiate tools model from config', { error: e instanceof Error ? e.message : String(e) });
              return null;
            });
            if (model) this.toolsModel = model;
          })();
        }
      }
    } catch (e) {
      logger.warn('Failed to instantiate tools model from config', { error: e instanceof Error ? e.message : String(e) });
    }
    this.toolsPromptTemplate = this.config?.toolsPromptTemplate ?? this.toolsPromptTemplate;

  }

  /** Emit a message to history and send it to all subscribed channels */
  private async emitMessage(message: Message): Promise<void> {
    
    const { content, role, ts, type } = message;
    // Don't emit empty messages
    if (!content || content.trim().length === 0) {
      return;
    }

    this.history.push(message);
    for (const ch of this.channels) {
      try {
        ch.sendResponse(message).catch(() => {});
      } catch (err) {
        logger.warn('Failed to send message to channel', { channelId: ch.id, error: err instanceof Error ? err.message : String(err) });
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
    // Route input through the pipeline before further processing
    const receivedAt = new Date();
    const pipelineInput: InputHandlerInput = { text: input, ts: receivedAt.getTime(), type: 'text' };
    const pipelineOutput = await this.pipeline.run(pipelineInput);
    const userMessage: Message = { role: 'user', content: pipelineOutput.originalText, ts: receivedAt.getTime(), type: 'end' }
    this.emitMessage(userMessage).catch(() => {});
    logger.verbose('User input received', { input: pipelineOutput });

    // Use the toolsModel to determine what tools can handle this input
    const toolsModel = this.toolsModel || this.model;
    if (toolsModel) {
      const promptTemplate = new PromptTemplate('find-tools.txt');
      promptTemplate.setPlaceholders({ 'prompt': pipelineOutput.originalText || input });
      promptTemplate.setPlaceholders({ 'tools-list': this.tools.map(s => `* ${s.name} - ${s.description || 'No description'}`).join('\n') });

      const toolsPrompt = await promptTemplate.render();
      // const toolsInfo = await Promise.all(this.tools.map(s => s.getInfo().catch(() => ({ name: s.name || 'Unknown', description: undefined, tags: [] }))));
      // const toolsPrompt = this.toolsPromptTemplate?.replace('{prompt}', pipelineOutput).replace('{tools-list}', toolsInfo.map(s => `* ${s.name} - ${s.description || 'No description'}`).join('\n'));
      if (!toolsPrompt) {
        logger.warn('No tools prompt template defined, skipping tools model step');
      } else {
        const message = { role: 'system' as const, content: toolsPrompt, ts: Date.now(), type: 'end' };
        await this.emitMessage(message).catch(() => {});
        logger.verbose('Running tools model to determine applicable tools with prompt', toolsPrompt);
        try {
          const toolsResp = await toolsModel.predict(toolsPrompt);
          const content = toolsResp.response || String(toolsResp);
          
          await this.emitMessage({ role: 'system' as const, content, ts: Date.now(), type: 'end' });
          logger.verbose('tools model response', content);
          
          // Check for tool type matches in the response
          const responseText = String(content).toLowerCase();
          const toolTypeMatches = this.tools
            .filter(tool => {
              // Match tool name
              if (tool.name && responseText.includes(tool.name.toLowerCase())) return true;
              // Match tool tags
              if (tool.tags && tool.tags.some(tag => responseText.includes(tag.toLowerCase()))) return true;
              return false;
            })
            .map(s => s.name);
          
          if (toolTypeMatches.length > 0) {
            logger.verbose('Matched tools from tools model', toolTypeMatches);

            for (const toolName of toolTypeMatches) {
              const tool = this.tools.find(t => t.name === toolName);
              if (!tool) continue;
              // Run each matched tool and yield its result as a system message before the main model response
              try {
                const toolCtx: ToolContext = { agentId: this.id, model: this.model };
                const toolResult = await tool.run(pipelineOutput, toolCtx);
                if (toolResult !== undefined) {
                  const content = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
                  await this.emitMessage({ role: 'tool' as const, content: String(content), ts: Date.now(), type: 'end' });
                }
              } catch (e) {
                logger.warn(`Failed to run tool ${toolName}`, e);
              }
            }
          } else {
            logger.verbose('No tools matched from tools model response');
          }
        } catch (e) {
          logger.error('Failed to run tools model', { error: e, config: this.config?.toolsModel });
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

    // No tool handled it — build a plan and use the model.
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
      const final = this.history[this.history.length - 1];
      for (const ch of this.channels) {
        try {
          if (!ch.supportsStreaming()) {
            ch.sendResponse(final).catch(() => {});
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
