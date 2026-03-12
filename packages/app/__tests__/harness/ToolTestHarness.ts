/**
 * Specialized test harness for tools
 */

import { ComponentTestHarness, HarnessConfig } from './ComponentTestHarness';
import { BaseTool } from '@openglove/base';

export interface ToolTestConfig extends HarnessConfig {
  toolName?: string;
  description?: string;
  tags?: string[];
}

export class ToolTestHarness extends ComponentTestHarness<BaseTool> {
  protected toolConfig: ToolTestConfig;

  constructor(
    ToolClass: new (opts?: any) => BaseTool,
    config: ToolTestConfig = {}
  ) {
    super(ToolClass, config);
    this.toolConfig = { ...config };
  }

  /**
   * Get component configuration for tool constructor
   */
  protected getComponentConfig(): Record<string, any> {
    return {
      ...super.getComponentConfig(),
      name: this.toolConfig?.toolName,
      description: this.toolConfig?.description,
      tags: this.toolConfig?.tags
    };
  }

  /**
   * Test canHandle method
   */
  public async testCanHandle(input: string): Promise<boolean> {
    return this.executeTest(`canHandle: "${input}"`, async () => {
      const tool = this.component as any;
      if (!tool.canHandle) {
        throw new Error('Tool does not implement canHandle method');
      }
      return await tool.canHandle(input);
    }) as Promise<boolean>;
  }

  /**
   * Test run method
   */
  public async testRun(input: any): Promise<any> {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input).substring(0, 30);
    return this.executeTest(`run: ${inputStr}...`, async () => {
      const tool = this.component as any;
      if (!tool.run) {
        throw new Error('Tool does not implement run method');
      }
      return await tool.run(input);
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
      const tool = this.component as any;

      const canHandle = await tool.canHandle(input);
      if (!canHandle) {
        return { canHandle: false };
      }

      const result = await tool.run(input);
      return {
        canHandle: true,
        result
      };
    });
  }

  /**
   * Test multiple inputs to verify tool handling
   */
  public async testCanHandleMultiple(inputs: string[]): Promise<{
    input: string;
    canHandle: boolean;
  }[] | null> {
    return this.executeTest('canHandleMultiple', async () => {
      const tool = this.component as any;
      const results = [];

      for (const input of inputs) {
        const canHandle = await tool.canHandle(input);
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
      const tool = this.component as any;
      if (!tool.getInfo) {
        throw new Error('Tool does not implement getInfo method');
      }
      return await tool.getInfo();
    });
  }

  /**
   * Test tool with success criteria
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
      const tool = this.component as any;
      if (!tool.run) {
        throw new Error('Tool does not implement run method');
      }
      const result = await tool.run(input);

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
   * Test tool error handling
   */
  public async testErrorHandling(input: any): Promise<{
    error: boolean;
    success: boolean;
    message?: string;
  } | null> {
    return this.executeTest('errorHandling', async () => {
      const tool = this.component as any;

      try {
        const result = await tool.run(input);
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
      const tool = this.component as any;
      const results = [];

      for (const input of inputs) {
        try {
          const result = await tool.run(input);
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
   * Get tool metadata convenience method
   */
  public getToolName(): string | undefined {
    return (this.component as any).name;
  }

  /**
   * Get tool description convenience method
   */
  public getToolDescription(): string | undefined {
    return (this.component as any).description;
  }

  /**
   * Verify tool implements required methods
   */
  public verifyToolInterface(): {
    hasCanHandle: boolean;
    hasRun: boolean;
    hasGetInfo: boolean;
    complete: boolean;
  } {
    const tool = this.component as any;
    return {
      hasCanHandle: typeof tool.canHandle === 'function',
      hasRun: typeof tool.run === 'function',
      hasGetInfo: typeof tool.getInfo === 'function',
      complete: typeof tool.canHandle === 'function' && typeof tool.run === 'function'
    };
  }
}
