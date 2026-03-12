import { BaseModel } from '../models/BaseModel';
import { BaseTool, ToolContext, loadConfig, Logger } from '@openglove/base';
import { BaseChannel, ChannelMessage } from '../channels/BaseChannel';
import { BaseGenerativeModel } from '../models/generative';

// load config utility
// eslint-disable-next-line @typescript-eslint/no-var-requires
const logger = new Logger('BaseAgent');

export abstract class BaseAgent {
  readonly id: string;
  name?: string;
  role?: string;
  model?: BaseGenerativeModel;
  createdAt: Date;
  /** Optional configuration loaded from agents.json (by `name`) */
  config: Record<string, any> | null = null;

  // Tools that this agent can use
  protected tools: BaseTool[] = [];

  // Channels attached to this agent
  protected channels: BaseChannel[] = [];

  // map of channel -> handler used for subscription so we can unregister
  private channelHandlers = new Map<BaseChannel, (m: ChannelMessage) => Promise<void> | void>();

  constructor(model?: BaseGenerativeModel, opts: { id?: string; name?: string; role?: string } = {}) {
    this.model = model;
    this.id = opts.id ?? `agent-${Date.now()}`;
    this.name = opts.name;
    this.role = opts.role;
    this.createdAt = new Date();

    // load agent config using shared loader; default path is ./agents.json, override via AGENTS_CONFIG_PATH
    const agentConfigPath = process.env.AGENTS_CONFIG_PATH ?? './agents.json';
    try {
      const all = loadConfig(agentConfigPath) || {};
      this.config = (this.name && all && all[this.name]) || null;
    } catch {
      this.config = null;
    }

    if (this.config) {
      // If config defines tools, instantiate and register them
      try {
        const skcfg = this.config.tools;
        if (skcfg.local && Array.isArray(skcfg.local)) {
          for (const tool of skcfg.local) {
            try {
              let inst: BaseTool | null = null;
              // require an exact class/module name match for security/clarity
              if (tool) {
                (async () => {
                  const instance = await BaseTool.require(tool, { name: tool });
                  if (instance) this.registerTool(instance);
                })();

                // perform dynamic import asynchronously and register when ready
                // (async () => {
                //   try {
                //     // Try to load from tools/index.ts first
                //     const toolsIndex: any = await import(/* webpackIgnore: true */ `../tools`);
                //     let Ctor = toolsIndex[tool];
                    
                //     // If not found in index, try loading from individual tool file
                //     if (!Ctor) {
                //       const mod = await import(/* webpackIgnore: true */ `../tools/${tool}`);
                //       Ctor = (mod && (mod.default ?? mod[tool])) as any;
                //     }
                    
                //     if (typeof Ctor === 'function') {
                //       try {
                //         const instance = new Ctor({ ...(this.config?.toolsConfig?.[tool] || {}), name: tool });
                //         this.registerTool(instance);
                //       } catch (e) {
                //         logger.error('Failed to register tool from config', e);
                //       }
                //     }
                //   } catch (e) {
                //     logger.warn(`Failed to load tool module for ${tool}`, e);
                //   }
                // })();
              }
              // if (inst) this.registerTool(inst);
            } catch (e) {
              logger.warn('Failed to instantiate tool from config', { error: e instanceof Error ? e.message : String(e) });
              // ignore individual tool instantiation errors
            }
          }
        }
        if (skcfg.socket && Array.isArray(skcfg.socket)) {
          for (const tool of skcfg.socket) {
            try {
              (async () => {
                const instance = new (await import(/* webpackIgnore: true */ `../tools/RemoteTool`)).RemoteTool(tool, this.config?.socket);
                this.registerTool(instance);
              })().catch(e => logger.warn('Failed to instantiate remote socket tool from config', { error: e instanceof Error ? e.message : String(e) }));
                // ignore individual tool instantiation errors
            } catch (e) {
              logger.warn('Failed to instantiate remote socket tool from config', { error: e instanceof Error ? e.message : String(e) });
              // ignore individual tool instantiation errors
            }
          }
        }
      } catch (e) {
        logger.warn('Failed to load tools from config', { error: e instanceof Error ? e.message : String(e) });
        // ignore
      }

      if (!this.model) {
        try {
          (async () => {
            const modelConfig = this.config?.model;
            if (modelConfig && typeof modelConfig === 'object') {
              // If no model is set, try to create one from the config
              const modelType = modelConfig.type;
              const model = await BaseGenerativeModel.require(modelType, modelConfig).catch(e => {
                logger.warn('Failed to instantiate model from config', { error: e instanceof Error ? e.message : String(e) });
                return null;
              });
              if (model) this.model = model;
            }
          })();
        } catch (e) {
          logger.warn('Failed to instantiate model from config', { error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
  }

  /** Register a tool with the agent */
  registerTool(tool: BaseTool) {
    this.tools.push(tool);
  }
  unregisterTool(tool: BaseTool) {
    this.tools = this.tools.filter(s => s.id !== tool.id);
  }

  /** Find a tool that can handle the input (first match) */
  async findToolFor(input: string, ctx?: ToolContext): Promise<BaseTool | undefined> {
    for (const s of this.tools) {
      const ok = await s.canHandle(input, ctx);
      if (ok) return s;
    }
    return undefined;
  }

  /** Register a channel and subscribe to incoming messages */
  registerChannel(channel: BaseChannel) {
    if (this.channels.includes(channel)) return;
    this.channels.push(channel);
    const handler = async (msg: ChannelMessage) => {
      try { await this.onChannelMessage(msg, channel); } catch (e) { /* swallow */ }
    };
    this.channelHandlers.set(channel, handler);
    channel.onMessage(handler);
  }

  unregisterChannel(channel: BaseChannel) {
    this.channels = this.channels.filter(c => c !== channel);
    const h = this.channelHandlers.get(channel);
    if (h) channel.offMessage(h);
    this.channelHandlers.delete(channel);
  }

  /** Run the matching tool if any */
  async runTool(input: string, ctx: ToolContext = {}): Promise<any | undefined> {
    const tool = await this.findToolFor(input, ctx);
    if (!tool) return undefined;
    return tool.run(input, { ...ctx, agentId: this.id, model: this.model });
  }

  /** Decide on a plan (e.g., build a prompt or pipeline) */
  abstract buildPrompt(input: any): Promise<any>;

  /** Execute the plan using the underlying model or other tools */
  abstract act(plan: any): Promise<any>;

  /** High-level convenience runner */
  async run(input: any): Promise<any> {
    // Tool-first: if a tool can handle the input, run it
    const toolResult = await this.runTool(String(input));
    if (toolResult !== undefined) return toolResult;

    const prompt = await this.buildPrompt(input);
    const result = await this.act(prompt  );
    return result;
  }

  /** Handle an incoming message from a channel. Override in subclasses to customize behavior. */
  protected abstract onChannelMessage(msg: ChannelMessage, channel: BaseChannel): Promise<void>;
}
