import { BaseToolRunner } from '../runners/BaseToolRunner';
import { Logger } from '../utils/Logger';
import { containsSecrets, getSecretCount } from '../utils/Secrets';
import { loadConfig } from '../utils/Config';
import * as path from 'path';
import * as fs from 'fs';

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
  /** Config object loaded from tools.json (by `name`) */
  config: Record<string, any>;
  /** Optional tool runner for executing logic before/after tool execution */
  protected toolRunner: BaseToolRunner | null = null;

  private static get toolsPathCandidates(): string[] {
    const cwd = process.cwd();

    const configPath = process.env.TOOLS_CONFIG_PATH
      ? path.resolve(cwd, process.env.TOOLS_CONFIG_PATH)
      : undefined;
    const configDir = configPath ? path.dirname(configPath) : undefined;

    const mainToolsPath = require.main?.path
      ? path.resolve(require.main.path, 'tools')
      : undefined;

    const configuredPaths = BaseTool.uniquePaths([
      process.env.TOOLS_PATH,
      mainToolsPath,
      path.resolve(cwd, 'tools'),
      path.resolve(cwd, 'src', 'tools'),
      path.resolve(cwd, 'dist', 'tools'),
      configDir ? path.resolve(configDir, 'tools') : undefined,
      configDir ? path.resolve(configDir, 'src', 'tools') : undefined,
      configDir ? path.resolve(configDir, 'dist', 'tools') : undefined,
    ]);

    return BaseTool.expandWithDirectSubdirectories(configuredPaths);
  }

  private static expandWithDirectSubdirectories(paths: string[]): string[] {
    const expandedPaths: string[] = [];

    for (const candidatePath of paths) {
      expandedPaths.push(candidatePath);
      expandedPaths.push(...BaseTool.getDirectSubdirectories(candidatePath));
    }

    return BaseTool.uniquePaths(expandedPaths);
  }

  private static getDirectSubdirectories(candidatePath: string): string[] {
    try {
      const stats = fs.statSync(candidatePath);
      if (!stats.isDirectory()) return [];

      // Include only one level of nested folders under each configured tools path.
      return fs
        .readdirSync(candidatePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(candidatePath, entry.name));
    } catch {
      return [];
    }
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

    const basePaths = BaseTool.toolsPathCandidates;

    for (const basePath of basePaths) {
      try {
        // Try to load from tools/index first.
        const index = await BaseTool.importFromCandidates(
          BaseTool.moduleSpecifiers(path.join(basePath, 'index')).concat(
            BaseTool.moduleSpecifiers(basePath)
          )
        );
        let Ctor = index?.[name];

        // If not found in index, try loading from individual tool file.
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
            logger.error('Failed to register tool from config', e);
          }
        }
      } catch (e) {
        logger.warn(`Failed to load tool module for ${name} from ${basePath}`, e);
      }
    }

    throw new Error(
      `Tool ${name} not found in any configured tools path (${basePaths.join(', ')}) or is not a constructor`
    );
  }

  /** Path used to load the tools config; env TOOLS_CONFIG_PATH or ./tools.json */
  private static get configPath(): string {
    return process.env.TOOLS_CONFIG_PATH ?? './tools.json';
  }

  /** Base path for importing tool runners - can be overridden via env var */
  private static get runnersPath(): string {
    return process.env.TOOL_RUNNERS_PATH ?? '../runners';
  }

  constructor(opts: { id?: string; name?: string; description?: string; parameterSchema?: string; tags?: string[] } = {}) {
    this.id = opts.id ?? `tool-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.parameterSchema = opts.parameterSchema;
    this.tags = opts.tags ?? [];
    // Attach config matching this tool's name (if any)
    // Use shared loader so behaviour is consistent with other components
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const all = loadConfig(BaseTool.configPath) || {};
    const cfg = (this.name && all && all[this.name]) || {};
    this.config = cfg;

    // Load tool runner from config if specified
    this.loadToolRunnerFromConfig();
  }

  /**
   * Dynamically load and instantiate a tool runner from config
   */
  private async loadToolRunnerFromConfig(): Promise<void> {
    try {
      const runnerConfig = this.config?.runner ?? this.config?.toolRunner;
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
      logger.log(`Attached tool runner ${runnerType} to tool ${this.name}`);
    } catch (err) {
      logger.error(`Failed to load tool runner from config for tool ${this.name}: ${err}`);
    }
  }

  /**
   * Set the tool runner for this tool
   */
  setToolRunner(runner: BaseToolRunner | null): void {
    this.toolRunner = runner;
  }

  /**
   * Get the tool runner instance
   */
  getToolRunner(): BaseToolRunner | null {
    return this.toolRunner;
  }

  /**
   * Execute a function with tool runner before/after hooks
   * Subclasses can use this to wrap their run() implementation
   */
  protected async executeWithRunner<T>(
    fn: (input: any, ctx?: ToolContext) => Promise<T>,
    input: any,
    ctx?: ToolContext
  ): Promise<T> {
    // Execute before hook if runner is configured
    await this.toolRunner?.runBeforeTool(this, input, ctx);

    // Execute the actual function
    const result = await fn(input, ctx);

    // Execute after hook if runner is configured
    await this.toolRunner?.runAfterTool(this, result, input, ctx);

    return result;
  }

  /** Return true if this tool can handle the given input */
  abstract canHandle(input: string, ctx?: ToolContext): boolean | Promise<boolean>;

  /** Execute the tool and return a result object */
  async run(input: any, ctx?: ToolContext): Promise<any> {
    // Check if input contains any registered secrets and warn if it does
    if (getSecretCount() > 0 && containsSecrets(input)) {
      logger.warn('Input contains secret values that should not be passed directly', {
        toolId: this.id,
        toolName: this.name
      });
      throw new Error('Input contains secret values that should not be passed directly');
    }

    if (this.toolRunner) {
      logger.verbose('Executing tool with runner', { toolId: this.id, toolName: this.name });
      return await this.executeWithRunner(
        async (input: any, ctx?: ToolContext) => {
          return await this.runTool(input, ctx);
        },
        input,
        ctx
      );
    } else {
      logger.verbose('Executing tool without runner', { toolId: this.id, toolName: this.name });
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
