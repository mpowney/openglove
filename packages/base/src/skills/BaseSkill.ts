import { BaseSkillRunner } from '../runner/BaseSkillRunner';
import { Logger } from '../utils/Logger';
import { containsSecrets, getSecretCount } from '../utils/Secrets';

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
  /** Optional skill runner for executing logic before/after skill execution */
  protected skillRunner: BaseSkillRunner | null = null;
  private logger: Logger;

  /** Path used to load the skills config; env SKILLS_CONFIG_PATH or ./skills.json */
  private static get configPath(): string {
    return process.env.SKILLS_CONFIG_PATH ?? './skills.json';
  }

  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    this.id = opts.id ?? `skill-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.tags = opts.tags ?? [];
    this.logger = new Logger(this.name || this.constructor.name);
    // Attach config matching this skill's name (if any)
    // Use shared loader so behaviour is consistent with other components
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfgLoader = require('../Utils/Config') as typeof import('../utils/Config');
    const all = cfgLoader.loadConfig(BaseSkill.configPath) || {};
    const cfg = (this.name && all && all[this.name]) || {};
    this.config = cfg;
  }

  /**
   * Set the skill runner for this skill
   */
  setSkillRunner(runner: BaseSkillRunner | null): void {
    this.skillRunner = runner;
  }

  /**
   * Get the skill runner instance
   */
  getSkillRunner(): BaseSkillRunner | null {
    return this.skillRunner;
  }

  /**
   * Execute a function with skill runner before/after hooks
   * Subclasses can use this to wrap their run() implementation
   */
  protected async executeWithRunner<T>(
    fn: (input: any, ctx?: SkillContext) => Promise<T>,
    input: any,
    ctx?: SkillContext
  ): Promise<T> {
    // Execute before hook if runner is configured
    if (this.skillRunner) {
      await this.skillRunner.runBeforeSkill(this, input, ctx);
    }

    // Execute the actual function
    const result = await fn(input, ctx);

    // Execute after hook if runner is configured
    if (this.skillRunner) {
      await this.skillRunner.runAfterSkill(this, result, input, ctx);
    }

    return result;
  }

  /** Return true if this skill can handle the given input */
  abstract canHandle(input: string, ctx?: SkillContext): boolean | Promise<boolean>;

  /** Execute the skill and return a result object */
  async run(input: any, ctx?: SkillContext): Promise<any> {
    // Check if input contains any registered secrets and warn if it does
    if (getSecretCount() > 0 && containsSecrets(input)) {
      this.logger.warn('Input contains secret values that should not be passed directly', {
        skillId: this.id,
        skillName: this.name
      });
      throw new Error('Input contains secret values that should not be passed directly');
    }

    return await this.executeWithRunner(
      async (input: any, ctx?: SkillContext) => {
        return await this.runSkill(input, ctx);
      },
      input,
      ctx
    );
  }

  protected abstract runSkill(input: any, ctx?: SkillContext): Promise<any>;

  async getInfo(): Promise<{ name: string; description?: string; tags: string[] }> {
    return {
      name: this.name || this.constructor.name,
      description: this.description,
      tags: this.tags
    };
  }
}
