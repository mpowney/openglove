import * as path from 'path';
import * as fs from 'fs';
import type { BaseTool } from '../tools/BaseTool';
import { ToolContext } from '../tools/BaseTool';
import { Logger } from '../utils/Logger';
import { loadConfig } from '../utils/Config';

const logger = new Logger('BaseToolRunner');

/**
 * Abstract base class for tool runners.
 * Tool runners are initialized for each tool execution and can run logic before/after the tool.
 */
export abstract class BaseToolRunner {
  /** Directory where configuration files are located */
  protected configDir: string = process.cwd();

  static async require(name: string, config?: any): Promise<BaseToolRunner> {

    const basePath = `${__dirname}`;
    try {
      // Try to load from tools/index.ts first
      const index: any = await import(/* webpackIgnore: true */ `${basePath}`);
      let Ctor = index[name];
      
      // If not found in index, try loading from individual tool file
      if (!Ctor) {
        const mod = await import(/* webpackIgnore: true */ `${basePath}/${name}`);
        Ctor = (mod && (mod.default ?? mod[name])) as any;
      }
      
      if (typeof Ctor === 'function') {
        try {
          const instance = new Ctor({ ...(config || {}), name: name });
          return instance;
        } catch (e) {
          logger.error('Failed to register tool from config', e);
        }
      }
    } catch (e) {
      logger.warn(`Failed to load tool module for ${name}`, e);
    }
    throw new Error(`Tool ${name} not found in path ${basePath} or is not a constructor`);
  }

  /**
   * Execute logic before the tool runs.
   * Used to prepare models, set up context, or perform pre-flight checks.
   */
  abstract runBeforeTool(tool: BaseTool, input: any, ctx?: ToolContext): Promise<void>;

  /**
   * Optional: Execute logic after the tool runs.
   */
  async runAfterTool(_tool: BaseTool, _result: unknown, _input: any, _ctx?: ToolContext): Promise<void> {
    // No-op by default
  }

  /**
   * Load runners.json configuration
   */
  protected loadToolRunnerConfig(): any {
    return loadConfig('runners.json');
  }
}
