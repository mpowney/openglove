import { BaseSkillRunner } from '../runners/BaseSkillRunner';
import { Logger } from '../utils/Logger';
import { containsSecrets, getSecretCount } from '../utils/Secrets';
import { loadConfig } from '../utils/Config';

export type SkillContext = {
  agentId?: string;
  model?: any;
  metadata?: Record<string, any>;
};

const logger = new Logger('BaseSkill');

export abstract class BaseSkill {
  readonly id: string;
  name?: string;
  description?: string;
  paramaterSchema?: string;
  tags: string[];
  /** Config object loaded from skills.json (by `name`) */
  config: Record<string, any>;
  /** Optional skill runner for executing logic before/after skill execution */
  protected skillRunner: BaseSkillRunner | null = null;

  static async require(name: string, config?: any): Promise<BaseSkill> {

    const basePath = `${require.main?.path}/skills`;
    try {
      // Try to load from skills/index.ts first
      const index: any = await import(/* webpackIgnore: true */ `${basePath}`);
      let Ctor = index[name];
      
      // If not found in index, try loading from individual skill file
      if (!Ctor) {
        const mod = await import(/* webpackIgnore: true */ `${basePath}/${name}`);
        Ctor = (mod && (mod.default ?? mod[name])) as any;
      }
      
      if (typeof Ctor === 'function') {
        try {
          const instance = new Ctor({ ...(config || {}), name: name });
          return instance;
        } catch (e) {
          logger.error('Failed to register skill from config', e);
        }
      }
    } catch (e) {
      logger.warn(`Failed to load skill module for ${name}`, e);
    }
    throw new Error(`Skill ${name} not found in path ${basePath} or is not a constructor`);
  }

  /** Path used to load the skills config; env SKILLS_CONFIG_PATH or ./skills.json */
  private static get configPath(): string {
    return process.env.SKILLS_CONFIG_PATH ?? './skills.json';
  }

  /** Base path for importing skill runners - can be overridden via env var */
  private static get runnersPath(): string {
    return process.env.SKILL_RUNNERS_PATH ?? '../runners';
  }

  constructor(opts: { id?: string; name?: string; description?: string; paramaterSchema?: string; tags?: string[] } = {}) {
    this.id = opts.id ?? `skill-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.paramaterSchema = opts.paramaterSchema;
    this.tags = opts.tags ?? [];
    // Attach config matching this skill's name (if any)
    // Use shared loader so behaviour is consistent with other components
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const all = loadConfig(BaseSkill.configPath) || {};
    const cfg = (this.name && all && all[this.name]) || {};
    this.config = cfg;

    // Load skill runner from config if specified
    this.loadSkillRunnerFromConfig();
  }

  /**
   * Dynamically load and instantiate a skill runner from config
   */
  private async loadSkillRunnerFromConfig(): Promise<void> {
    try {
      const runnerConfig = this.config?.runner ?? this.config?.skillRunner;
      if (!runnerConfig) return;

      const runnerType = typeof runnerConfig === 'string' 
        ? runnerConfig 
        : runnerConfig.type ?? runnerConfig.name;

      if (!runnerType) {
        logger.warn('Skill runner config found but no type/name specified');
        return;
      }

      const runner = await BaseSkillRunner.require(runnerType, runnerConfig.opts);
      this.setSkillRunner(runner);
      logger.log(`Attached skill runner ${runnerType} to skill ${this.name}`);
    } catch (err) {
      logger.error(`Failed to load skill runner from config for skill ${this.name}: ${err}`);
    }
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
    await this.skillRunner?.runBeforeSkill(this, input, ctx);

    // Execute the actual function
    const result = await fn(input, ctx);

    // Execute after hook if runner is configured
    await this.skillRunner?.runAfterSkill(this, result, input, ctx);

    return result;
  }

  /** Return true if this skill can handle the given input */
  abstract canHandle(input: string, ctx?: SkillContext): boolean | Promise<boolean>;

  /** Execute the skill and return a result object */
  async run(input: any, ctx?: SkillContext): Promise<any> {
    // Check if input contains any registered secrets and warn if it does
    if (getSecretCount() > 0 && containsSecrets(input)) {
      logger.warn('Input contains secret values that should not be passed directly', {
        skillId: this.id,
        skillName: this.name
      });
      throw new Error('Input contains secret values that should not be passed directly');
    }

    if (this.skillRunner) {
      logger.verbose('Executing skill with runner', { skillId: this.id, skillName: this.name });
      return await this.executeWithRunner(
        async (input: any, ctx?: SkillContext) => {
          return await this.runSkill(input, ctx);
        },
        input,
        ctx
      );
    } else {
      logger.verbose('Executing skill without runner', { skillId: this.id, skillName: this.name });
      return await this.runSkill(input, ctx);
    }
  }

  protected abstract runSkill(input: any, ctx?: SkillContext): Promise<any>;

  async getInfo(): Promise<{ name: string; description?: string; paramaterSchema?: string; tags: string[] }> {
    return {
      name: this.name || this.constructor.name,
      description: this.description,
      paramaterSchema: this.paramaterSchema,
      tags: this.tags
    };
  }
}
