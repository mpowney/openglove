import { BaseModel } from '../models/BaseModel';
import { BaseSkill, SkillContext } from '../skills/BaseSkill';
import { BaseChannel, ChannelMessage } from '../channels/BaseChannel';

// load config utility
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cfgLoader = require('../config/loadConfig') as typeof import('../config/loadConfig');

export abstract class BaseAgent<M extends BaseModel = BaseModel> {
  readonly id: string;
  name?: string;
  role?: string;
  model: M;
  createdAt: Date;
  /** Optional configuration loaded from agents.json (by `name`) */
  config: Record<string, any> | null = null;

  // Skills that this agent can use
  protected skills: BaseSkill[] = [];

  // Channels attached to this agent
  protected channels: BaseChannel[] = [];

  // map of channel -> handler used for subscription so we can unregister
  private channelHandlers = new Map<BaseChannel, (m: ChannelMessage) => Promise<void> | void>();

  constructor(model: M, opts: { id?: string; name?: string; role?: string } = {}) {
    this.model = model;
    this.id = opts.id ?? `agent-${Date.now()}`;
    this.name = opts.name;
    this.role = opts.role;
    this.createdAt = new Date();

    // load agent config using shared loader; default path is ./agents.json, override via AGENTS_CONFIG_PATH
    const agentConfigPath = process.env.AGENTS_CONFIG_PATH ?? './agents.json';
    try {
      const all = cfgLoader.loadConfig(agentConfigPath) || {};
      this.config = (this.name && all && all[this.name]) || null;
    } catch {
      this.config = null;
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
