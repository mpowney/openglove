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
  /** Directory where configuration files are located */
  protected configDir: string = require.main?.path ?? process.cwd();

  static async require(name: string, config?: any): Promise<BaseSkillRunner> {

    const basePath = `${__dirname}`;
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
   * Load runners.json configuration
   */
  protected loadSkillRunnerConfig(): any {
    return loadConfig('runners.json');
  }
}
