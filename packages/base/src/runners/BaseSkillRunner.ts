import * as path from 'path';
import * as fs from 'fs';
import type { BaseSkill } from '../skills/BaseSkill';
import { SkillContext } from '../skills/BaseSkill';
import { Logger } from '../utils/Logger';
import { loadConfig } from '../utils/Config';

const logger = new Logger('BaseSkillRunner');

/**
 * Abstract base class for skill runners.
 * Skill runners are initialized for each skill execution and can run logic before/after the skill.
 */
export abstract class BaseSkillRunner {
  /** Path to the models directory (relative or absolute) - set by subclasses */
  protected modelsPath: string = '../models';
  /** Directory where configuration files are located */
  protected configDir: string = require.main?.path ?? process.cwd();

  static async require(name: string, config?: any): Promise<BaseSkillRunner> {

    const basePath = `${require.main?.path}/runners`;
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

  /**
   * Execute logic before the skill runs.
   * Used to prepare models, set up context, or perform pre-flight checks.
   */
  abstract runBeforeSkill(skill: BaseSkill, input: any, ctx?: SkillContext): Promise<void>;

  /**
   * Optional: Execute logic after the skill runs.
   */
  async runAfterSkill(_skill: BaseSkill, _result: unknown, _input: any, _ctx?: SkillContext): Promise<void> {
    // No-op by default
  }

  /**
   * Dynamically instantiate a model from its class name and configuration.
   * Looks for the model class in the modelsPath directory.
   */
  protected async instantiateModel(modelName: string, config: any): Promise<any> {
    try {
      const modelPath = `${this.modelsPath}/${modelName}`;
      const mod = await import(/* webpackIgnore: true */ modelPath);
      const Ctor = (mod && (mod.default ?? mod[modelName])) as any;
      if (typeof Ctor === 'function') {
        logger.log(`Instantiated model: ${modelName}`);
        return new Ctor(config);
      } else {
        throw new Error(`Model class ${modelName} not found or is not a constructor`);
      }
    } catch (err) {
      logger.error(`Failed to instantiate model ${modelName}: ${err}`);
      throw err;
    }
  }

  /**
   * Load runners.json configuration
   */
  protected loadSkillRunnerConfig(): any {
    return loadConfig('runners.json');
  }
}
