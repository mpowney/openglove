import { BaseToolRunner } from '../runners/BaseToolRunner';
import { Logger } from '../utils/Logger';
import { containsSecrets, getSecretCount } from '../utils/Secrets';
import { loadConfig } from '../utils/Config';
import * as path from 'path';

export type ToolContext = {
  agentId?: string;
  model?: any;
  metadata?: Record<string, any>;
};

const logger = new Logger('BaseTool');

export abstract class BaseTool {
  readonly id: string;
  name?: string;
  description?: string;
  parameterSchema?: string;
  tags: string[];
  /** Config object loaded from skills.json (by `name`) */
  config: Record<string, any>;
  /** Optional skill runner for executing logic before/after skill execution */
  protected skillRunner: BaseToolRunner | null = null;

  private static get skillsPathCandidates(): string[] {
    const cwd = process.cwd();

    const configPath = process.env.SKILLS_CONFIG_PATH
      ? path.resolve(cwd, process.env.SKILLS_CONFIG_PATH)
      : undefined;
    const configDir = configPath ? path.dirname(configPath) : undefined;

    const mainToolsPath = require.main?.path
      ? path.resolve(require.main.path, 'skills')
      : undefined;

    return BaseTool.uniquePaths([
      process.env.SKILLS_PATH,
      mainToolsPath,
      path.resolve(cwd, 'skills'),
      path.resolve(cwd, 'src', 'skills'),
      path.resolve(cwd, 'dist', 'skills'),
      configDir ? path.resolve(configDir, 'skills') : undefined,
      configDir ? path.resolve(configDir, 'src', 'skills') : undefined,
      configDir ? path.resolve(configDir, 'dist', 'skills') : undefined,
    ]);
  }

  private static uniquePaths(paths: Array<string | undefined>): string[] {
    const cleaned = paths
      .filter((p): p is string => Boolean(p && p.trim().length > 0))
      .map((p) => path.normalize(p));

    return [...new Set(cleaned)];
  }

  private static async importFromCandidates(specifiers: string[]): Promise<any | null> {
    for (const specifier of specifiers) {
      try {
        return await import(/* webpackIgnore: true */ `${specifier}`);
      } catch {
        // Try next candidate.
      }
    }
    return null;
  }

  private static moduleSpecifiers(modulePath: string): string[] {
    return [
      modulePath,
      `${modulePath}.ts`,
      `${modulePath}.js`,
      `${modulePath}.cjs`,
      `${modulePath}.mjs`,
    ];
  }

  static async require(name: string, config?: any): Promise<BaseTool> {

    const basePaths = BaseTool.skillsPathCandidates;

    for (const basePath of basePaths) {
      try {
        // Try to load from skills/index first.
        const index = await BaseTool.importFromCandidates(
          BaseTool.moduleSpecifiers(path.join(basePath, 'index')).concat(
            BaseTool.moduleSpecifiers(basePath)
          )
        );
        let Ctor = index?.[name];

        // If not found in index, try loading from individual skill file.
        if (!Ctor) {
          const mod = await BaseTool.importFromCandidates(
            BaseTool.moduleSpecifiers(path.join(basePath, name))
          );
          Ctor = (mod && (mod.default ?? mod[name])) as any;
        }

        if (typeof Ctor === 'function') {
          try {
            const instance = new Ctor({ ...(config || {}), name });
            return instance;
          } catch (e) {
            logger.error('Failed to register skill from config', e);
          }
        }
      } catch (e) {
        logger.warn(`Failed to load skill module for ${name} from ${basePath}`, e);
      }
    }

    throw new Error(
      `Tool ${name} not found in any configured skills path (${basePaths.join(', ')}) or is not a constructor`
    );
  }

  /** Path used to load the skills config; env SKILLS_CONFIG_PATH or ./skills.json */
  private static get configPath(): string {
    return process.env.SKILLS_CONFIG_PATH ?? './skills.json';
  }

  /** Base path for importing skill runners - can be overridden via env var */
  private static get runnersPath(): string {
    return process.env.SKILL_RUNNERS_PATH ?? '../runners';
  }

  constructor(opts: { id?: string; name?: string; description?: string; parameterSchema?: string; tags?: string[] } = {}) {
    this.id = opts.id ?? `skill-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.parameterSchema = opts.parameterSchema;
    this.tags = opts.tags ?? [];
    // Attach config matching this skill's name (if any)
    // Use shared loader so behaviour is consistent with other components
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const all = loadConfig(BaseTool.configPath) || {};
    const cfg = (this.name && all && all[this.name]) || {};
    this.config = cfg;

    // Load skill runner from config if specified
    this.loadToolRunnerFromConfig();
  }

  /**
   * Dynamically load and instantiate a skill runner from config
   */
  private async loadToolRunnerFromConfig(): Promise<void> {
    try {
      const runnerConfig = this.config?.runner ?? this.config?.skillRunner;
      if (!runnerConfig) return;

      const runnerType = typeof runnerConfig === 'string' 
        ? runnerConfig 
        : runnerConfig.type ?? runnerConfig.name;

      if (!runnerType) {
        logger.warn('Tool runner config found but no type/name specified');
        return;
      }

      const runner = await BaseToolRunner.require(runnerType, runnerConfig.opts);
      this.setToolRunner(runner);
      logger.log(`Attached skill runner ${runnerType} to skill ${this.name}`);
    } catch (err) {
      logger.error(`Failed to load skill runner from config for skill ${this.name}: ${err}`);
    }
  }

  /**
   * Set the skill runner for this skill
   */
  setToolRunner(runner: BaseToolRunner | null): void {
    this.skillRunner = runner;
  }

  /**
   * Get the skill runner instance
   */
  getToolRunner(): BaseToolRunner | null {
    return this.skillRunner;
  }

  /**
   * Execute a function with skill runner before/after hooks
   * Subclasses can use this to wrap their run() implementation
   */
  protected async executeWithRunner<T>(
    fn: (input: any, ctx?: ToolContext) => Promise<T>,
    input: any,
    ctx?: ToolContext
  ): Promise<T> {
    // Execute before hook if runner is configured
    await this.skillRunner?.runBeforeTool(this, input, ctx);

    // Execute the actual function
    const result = await fn(input, ctx);

    // Execute after hook if runner is configured
    await this.skillRunner?.runAfterTool(this, result, input, ctx);

    return result;
  }

  /** Return true if this skill can handle the given input */
  abstract canHandle(input: string, ctx?: ToolContext): boolean | Promise<boolean>;

  /** Execute the skill and return a result object */
  async run(input: any, ctx?: ToolContext): Promise<any> {
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
        async (input: any, ctx?: ToolContext) => {
          return await this.runTool(input, ctx);
        },
        input,
        ctx
      );
    } else {
      logger.verbose('Executing skill without runner', { skillId: this.id, skillName: this.name });
      return await this.runTool(input, ctx);
    }
  }

  protected abstract runTool(input: any, ctx?: ToolContext): Promise<any>;

  async getInfo(): Promise<{ name: string; description?: string; parameterSchema?: string; tags: string[] }> {
    return {
      name: this.name || this.constructor.name,
      description: this.description,
      parameterSchema: this.parameterSchema,
      tags: this.tags
    };
  }
}
