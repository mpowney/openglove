import { BaseModel } from '../models/BaseModel';
import { BaseSkill, SkillContext, loadConfig, Logger } from '@openglove/base';
import { BaseChannel, ChannelMessage } from '../channels/BaseChannel';

// load config utility
// eslint-disable-next-line @typescript-eslint/no-var-requires
const logger = new Logger('BaseAgent');

export abstract class BaseAgent<M extends BaseModel = BaseModel> {
  readonly id: string;
  name?: string;
  role?: string;
  model?: M;
  createdAt: Date;
  /** Optional configuration loaded from agents.json (by `name`) */
  config: Record<string, any> | null = null;

  // Skills that this agent can use
  protected skills: BaseSkill[] = [];

  // Channels attached to this agent
  protected channels: BaseChannel[] = [];

  // map of channel -> handler used for subscription so we can unregister
  private channelHandlers = new Map<BaseChannel, (m: ChannelMessage) => Promise<void> | void>();

  constructor(model?: M, opts: { id?: string; name?: string; role?: string } = {}) {
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
      // If config defines skills, instantiate and register them
      try {
        const skcfg = this.config.skills;
        if (skcfg.local && Array.isArray(skcfg.local)) {
          for (const skill of skcfg.local) {
            try {
              let inst: BaseSkill | null = null;
              // require an exact class/module name match for security/clarity
              if (skill) {
                // perform dynamic import asynchronously and register when ready
                (async () => {
                  try {
                    // Try to load from skills/index.ts first
                    const skillsIndex: any = await import(/* webpackIgnore: true */ `../skills`);
                    let Ctor = skillsIndex[skill];
                    
                    // If not found in index, try loading from individual skill file
                    if (!Ctor) {
                      const mod = await import(/* webpackIgnore: true */ `../skills/${skill}`);
                      Ctor = (mod && (mod.default ?? mod[skill])) as any;
                    }
                    
                    if (typeof Ctor === 'function') {
                      try {
                        const instance = new Ctor({ ...(this.config?.skillsConfig?.[skill] || {}), name: skill });
                        this.registerSkill(instance);
                      } catch (e) {
                        logger.error('Failed to register skill from config', e);
                      }
                    }
                  } catch (e) {
                    logger.warn(`Failed to load skill module for ${skill}`, e);
                  }
                })();
              }
              // if (inst) this.registerSkill(inst);
            } catch (e) {
              logger.warn('Failed to instantiate skill from config', { error: e instanceof Error ? e.message : String(e) });
              // ignore individual skill instantiation errors
            }
          }
        }
        if (skcfg.socket && Array.isArray(skcfg.socket)) {
          for (const skill of skcfg.socket) {
            try {
              (async () => {
                const instance = new (await import(/* webpackIgnore: true */ `../skills/RemoteSkill`)).RemoteSkill(skill, this.config?.socket);
                this.registerSkill(instance);
              })().catch(e => logger.warn('Failed to instantiate remote socket skill from config', { error: e instanceof Error ? e.message : String(e) }));
                // ignore individual skill instantiation errors
            } catch (e) {
              logger.warn('Failed to instantiate remote socket skill from config', { error: e instanceof Error ? e.message : String(e) });
              // ignore individual skill instantiation errors
            }
          }
        }
      } catch (e) {
        logger.warn('Failed to load skills from config', { error: e instanceof Error ? e.message : String(e) });
        // ignore
      }

      if (!this.model) {
        try {
          const modelConfig = this.config.model;
          if (modelConfig && typeof modelConfig === 'object') {
            // If no model is set, try to create one from the config
            const modelType = modelConfig.type;
            if (modelType) {
              (async () => {
                const mod = await import(/* webpackIgnore: true */ `../models/${modelType}`);
                const Ctor = (mod && (mod.default ?? mod[modelType])) as any;
                if (typeof Ctor === 'function') {
                  this.model = new Ctor(modelConfig);
                }
              })();
            }
          }
        } catch (e) {
          logger.warn('Failed to instantiate model from config', { error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
  }

  /** Register a skill with the agent */
  registerSkill(skill: BaseSkill) {
    this.skills.push(skill);
  }
  unregisterSkill(skill: BaseSkill) {
    this.skills = this.skills.filter(s => s.id !== skill.id);
  }

  /** Find a skill that can handle the input (first match) */
  async findSkillFor(input: string, ctx?: SkillContext): Promise<BaseSkill | undefined> {
    for (const s of this.skills) {
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

  /** Run the matching skill if any */
  async runSkill(input: string, ctx: SkillContext = {}): Promise<any | undefined> {
    const skill = await this.findSkillFor(input, ctx);
    if (!skill) return undefined;
    return skill.run(input, { ...ctx, agentId: this.id, model: this.model });
  }

  /** Decide on a plan (e.g., build a prompt or pipeline) */
  abstract buildPrompt(input: any): Promise<any>;

  /** Execute the plan using the underlying model or other tools */
  abstract act(plan: any): Promise<any>;

  /** High-level convenience runner */
  async run(input: any): Promise<any> {
    // Skill-first: if a skill can handle the input, run it
    const skillResult = await this.runSkill(String(input));
    if (skillResult !== undefined) return skillResult;

    const prompt = await this.buildPrompt(input);
    const result = await this.act(prompt  );
    return result;
  }

  /** Handle an incoming message from a channel. Override in subclasses to customize behavior. */
  protected abstract onChannelMessage(msg: ChannelMessage, channel: BaseChannel): Promise<void>;
}
