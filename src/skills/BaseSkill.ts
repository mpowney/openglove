export type SkillContext = {
  agentId?: string;
  model?: any;
  metadata?: Record<string, any>;
};

export abstract class BaseSkill {
  readonly id: string;
  name?: string;
  description?: string;
  tags: string[];
  /** Config object loaded from skills.json (by `name`) */
  config: Record<string, any>;

  /** Path used to load the skills config; env SKILLS_CONFIG_PATH or ./skills.json */
  private static get configPath(): string {
    return process.env.SKILLS_CONFIG_PATH ?? './skills.json';
  }

  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    this.id = opts.id ?? `skill-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.tags = opts.tags ?? [];
    // Attach config matching this skill's name (if any)
    // Use shared loader so behaviour is consistent with other components
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfgLoader = require('../config/loadConfig') as typeof import('../utils/Config');
    const all = cfgLoader.loadConfig(BaseSkill.configPath) || {};
    const cfg = (this.name && all && all[this.name]) || {};
    this.config = cfg;
  }

  /** Return true if this skill can handle the given input */
  abstract canHandle(input: string, ctx?: SkillContext): boolean | Promise<boolean>;

  /** Execute the skill and return a result object */
  abstract run(input: string, ctx?: SkillContext): Promise<any>;

  // config loading now delegated to shared loader in src/config/loadConfig.ts
}
