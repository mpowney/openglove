/**
 * Example test file demonstrating ComponentTestHarness usage
 * This shows how to use the harness for both unit and integration testing
 */

import { ToolTestHarness } from '../harness';
import { MemoriesKeepTool } from '../../src/tools/MemoriesKeepTool';
import { toolFixtures } from '../fixtures/testData';

// Mock for unit tests
jest.mock('fs');
jest.mock('@openglove/base', () => ({
  loadConfig: jest.fn(() => ({
    modelType: 'OllamaEmbeddingsModel',
    memoriesPath: './test-memories'
  })),
  Logger: jest.fn(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn()
  })),
  BaseTool: class {
    name: string;
    description: string;
    config: any;

    constructor(opts: any) {
      this.name = opts.name;
      this.description = opts.description;
      this.config = opts.config;
    }

    async run(input: any, ctx?: any): Promise<any> {
      return (this as any).runTool(input, ctx);
    }

    protected async runTool(_input: any, _ctx?: any): Promise<any> {
      throw new Error('runTool must be implemented by subclass');
    }

    async getInfo(): Promise<any> {
      return {
        name: this.name,
        description: this.description
      };
    }
  }
}));
jest.mock('../../src/utils/embeddings');
jest.mock('../../src/models');

describe('ToolTestHarness - MemoriesKeepTool Example', () => {
  describe('Unit Tests (Mocked)', () => {
    let harness: ToolTestHarness;

    beforeEach(() => {
      harness = new ToolTestHarness(MemoriesKeepTool, {
        mockMode: 'full',
        verbose: false
      });
    });

    afterEach(() => {
      harness.cleanup();
    });

    it('should verify tool interface', () => {
      const verification = harness.verifyToolInterface();
      expect(verification.complete).toBe(true);
      expect(verification.hasCanHandle).toBe(true);
      expect(verification.hasRun).toBe(true);
    });

    it('should test canHandle for multiple inputs using fixture', async () => {
      const results = await harness.testCanHandleMultiple(
        toolFixtures.memoriesKeep.validInputs
      );

      if (results) {
        expect(results).toHaveLength(toolFixtures.memoriesKeep.validInputs.length);
        results.forEach(result => {
          expect(result.canHandle).toBe(true);
        });
      }
    });

    it('should reject invalid inputs using fixture', async () => {
      const results = await harness.testCanHandleMultiple(
        toolFixtures.memoriesKeep.invalidInputs
      );

      if (results) {
        results.forEach(result => {
          if (result.input === "") {
            expect(result.canHandle).toBe(false);
          }
        });
      }
    });

    it('should get tool info', async () => {
      const info = await harness.testGetInfo();
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('description');
    });

    it('should run tool successfully with criteria', async () => {
      const result = await harness.testRunWithCriteria('remember to code', {
        expectSuccess: true,
        expectType: 'memoryKept',
        expectFields: ['type', 'success', 'message']
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should test error handling', async () => {
      const errorResult = await harness.testErrorHandling('invalid input');

      expect(errorResult).toHaveProperty('error');
      expect(errorResult).toHaveProperty('success');
    });

    it('should execute run sequence', async () => {
      const inputs = ['remember A', 'memorize B', 'note C'];
      const results = await harness.testRunSequence(inputs);

      if (results) {
        expect(results).toHaveLength(inputs.length);
        results.forEach((item: any) => {
          expect(item).toHaveProperty('input');
          expect(item).toHaveProperty('result');
        });
      }
    });

    it('should get test results summary', async () => {
      await harness.testCanHandle('remember this');
      const summary = harness.getTestResults();

      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('passed');
      expect(summary).toHaveProperty('failed');
      expect(summary).toHaveProperty('summary');
    });

    it('should reset harness state', async () => {
      await harness.testCanHandle('remember');
      let summary = harness.getTestResults();
      expect(summary.total).toBeGreaterThan(0);

      harness.reset();
      summary = harness.getTestResults();
      expect(summary.total).toBe(0);
    });
  });

  describe('Integration Tests (Real Services - Optional)', () => {
    let harness: ToolTestHarness;

    beforeEach(() => {
      // Note: This configuration would skip tests if service unavailable
      harness = new ToolTestHarness(MemoriesKeepTool, {
        mockMode: 'partial',
        realServices: ['filesystem'],
        skipIfUnavailable: true,
        verbose: false
      });
    });

    afterEach(() => {
      harness.cleanup();
    });

    // These tests are marked to skip if dependencies unavailable
    it('should store memory with real filesystem - integration', async () => {
      const results = await harness.testRunWithCriteria(
        'Test memory with real filesystem',
        {
          expectSuccess: true,
          expectType: 'memoryKept'
        }
      );

      // Results would only be executed if service is available
      if (results) {
        expect(results.success).toBe(true);
      }
    });
  });

  describe('Harness Configuration Examples', () => {
    it('should support full mock mode configuration', () => {
      const harness = new ToolTestHarness(MemoriesKeepTool, {
        mockMode: 'full'
      });
      expect(harness.getComponent()).toBeDefined();
      harness.cleanup();
    });

    it('should support partial mock mode configuration', () => {
      const harness = new ToolTestHarness(MemoriesKeepTool, {
        mockMode: 'partial',
        realServices: ['filesystem'],
        mockedServices: ['embeddings']
      });
      expect(harness.getComponent()).toBeDefined();
      harness.cleanup();
    });

    it('should support verbose logging', () => {
      const harness = new ToolTestHarness(MemoriesKeepTool, {
        mockMode: 'full',
        verbose: true // This will log harness operations
      });
      expect(harness.getComponent()).toBeDefined();
      harness.cleanup();
    });

    it('should support custom timeouts', () => {
      const harness = new ToolTestHarness(MemoriesKeepTool, {
        mockMode: 'full',
        timeout: 60000 // 60 second timeout
      });
      expect(harness.getComponent()).toBeDefined();
      harness.cleanup();
    });
  });
});
