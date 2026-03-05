/**
 * Specialized test harness for skills
 */

import { ComponentTestHarness, HarnessConfig } from './ComponentTestHarness';
import { BaseSkill } from '@openglove/base';

export interface SkillTestConfig extends HarnessConfig {
  skillName?: string;
  description?: string;
  tags?: string[];
}

export class SkillTestHarness extends ComponentTestHarness<BaseSkill> {
  protected skillConfig: SkillTestConfig;

  constructor(
    SkillClass: new (opts?: any) => BaseSkill,
    config: SkillTestConfig = {}
  ) {
    super(SkillClass, config);
    this.skillConfig = { ...config };
  }

  /**
   * Get component configuration for skill constructor
   */
  protected getComponentConfig(): Record<string, any> {
    return {
      ...super.getComponentConfig(),
      name: this.skillConfig?.skillName,
      description: this.skillConfig?.description,
      tags: this.skillConfig?.tags
    };
  }

  /**
   * Test canHandle method
   */
  public async testCanHandle(input: string): Promise<boolean> {
    return this.executeTest(`canHandle: "${input}"`, async () => {
      const skill = this.component as any;
      if (!skill.canHandle) {
        throw new Error('Skill does not implement canHandle method');
      }
      return await skill.canHandle(input);
    }) as Promise<boolean>;
  }

  /**
   * Test run method
   */
  public async testRun(input: any): Promise<any> {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input).substring(0, 30);
    return this.executeTest(`run: ${inputStr}...`, async () => {
      const skill = this.component as any;
      if (!skill.run) {
        throw new Error('Skill does not implement run method');
      }
      return await skill.run(input);
    });
  }

  /**
   * Test canHandle followed by run
   */
  public async testCanHandleAndRun(input: string): Promise<{
    canHandle: boolean;
    result?: any;
  } | null> {
    return this.executeTest(`canHandleAndRun: "${input}"`, async () => {
      const skill = this.component as any;

      const canHandle = await skill.canHandle(input);
      if (!canHandle) {
        return { canHandle: false };
      }

      const result = await skill.run(input);
      return {
        canHandle: true,
        result
      };
    });
  }

  /**
   * Test multiple inputs to verify skill handling
   */
  public async testCanHandleMultiple(inputs: string[]): Promise<{
    input: string;
    canHandle: boolean;
  }[] | null> {
    return this.executeTest('canHandleMultiple', async () => {
      const skill = this.component as any;
      const results = [];

      for (const input of inputs) {
        const canHandle = await skill.canHandle(input);
        results.push({ input, canHandle });
      }

      return results;
    }) as Promise<{ input: string; canHandle: boolean }[] | null>;
  }

  /**
   * Test getInfo method
   */
  public async testGetInfo(): Promise<any> {
    return this.executeTest('getInfo', async () => {
      const skill = this.component as any;
      if (!skill.getInfo) {
        throw new Error('Skill does not implement getInfo method');
      }
      return await skill.getInfo();
    });
  }

  /**
   * Test skill with success criteria
   */
  public async testRunWithCriteria(
    input: any,
    criteria: {
      expectSuccess?: boolean;
      expectType?: string;
      expectFields?: string[];
    }
  ): Promise<any> {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input).substring(0, 30);
    return this.executeTest(`runWithCriteria: ${inputStr}...`, async () => {
      const skill = this.component as any;
      if (!skill.run) {
        throw new Error('Skill does not implement run method');
      }
      const result = await skill.run(input);

      if (criteria.expectSuccess !== undefined) {
        if (
          result.success !== criteria.expectSuccess ||
          (criteria.expectSuccess && !result)
        ) {
          throw new Error(
            `Expected success: ${criteria.expectSuccess}, got: ${result?.success}`
          );
        }
      }

      if (criteria.expectType && result.type !== criteria.expectType) {
        throw new Error(`Expected type: ${criteria.expectType}, got: ${result?.type}`);
      }

      if (criteria.expectFields) {
        const missing = criteria.expectFields.filter(field => !(field in result));
        if (missing.length > 0) {
          throw new Error(`Missing expected fields: ${missing.join(', ')}`);
        }
      }

      return result;
    });
  }

  /**
   * Test skill error handling
   */
  public async testErrorHandling(input: any): Promise<{
    error: boolean;
    success: boolean;
    message?: string;
  } | null> {
    return this.executeTest('errorHandling', async () => {
      const skill = this.component as any;

      try {
        const result = await skill.run(input);
        return {
          error: result?.success === false,
          success: result?.success === true,
          message: result?.message || result?.error
        };
      } catch (e) {
        return {
          error: true,
          success: false,
          message: e instanceof Error ? e.message : String(e)
        };
      }
    }) as Promise<{ error: boolean; success: boolean; message?: string } | null>;
  }

  /**
   * Test multiple runs with different inputs
   */
  public async testRunSequence(inputs: any[]): Promise<any[] | null> {
    return this.executeTest('runSequence', async () => {
      const skill = this.component as any;
      const results = [];

      for (const input of inputs) {
        try {
          const result = await skill.run(input);
          results.push({ input, result, error: null });
        } catch (error) {
          results.push({
            input,
            result: null,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return results;
    }) as Promise<any[] | null>;
  }

  /**
   * Get skill metadata convenience method
   */
  public getSkillName(): string | undefined {
    return (this.component as any).name;
  }

  /**
   * Get skill description convenience method
   */
  public getSkillDescription(): string | undefined {
    return (this.component as any).description;
  }

  /**
   * Verify skill implements required methods
   */
  public verifySkillInterface(): {
    hasCanHandle: boolean;
    hasRun: boolean;
    hasGetInfo: boolean;
    complete: boolean;
  } {
    const skill = this.component as any;
    return {
      hasCanHandle: typeof skill.canHandle === 'function',
      hasRun: typeof skill.run === 'function',
      hasGetInfo: typeof skill.getInfo === 'function',
      complete: typeof skill.canHandle === 'function' && typeof skill.run === 'function'
    };
  }
}
