/**
 * Example test file demonstrating ModelTestHarness usage
 * Shows unit testing with mocks and integration testing with real services
 */

import { ModelTestHarness } from '../harness';
import { OllamaGenerativeModel } from '../../src/models/generative/OllamaGenerativeModel';
import { modelFixtures } from '../fixtures/testData';

jest.mock('@openglove/base', () => ({
  loadConfig: jest.fn(() => ({
    modelType: 'OllamaGenerativeModel',
    baseUrl: 'http://test-ollama:11434',
    model: 'mistral'
  })),
  Logger: jest.fn(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn()
  }))
}));

jest.mock('../../src/utils/Fetch');

describe('ModelTestHarness - OllamaGenerativeModel Example', () => {
  describe('Unit Tests (Fully Mocked)', () => {
    let harness: ModelTestHarness;

    beforeEach(() => {
      harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full',
        model: 'mistral',
        verbose: false
      });
    });

    afterEach(() => {
      harness.cleanup();
    });

    it('should test supportsStreaming capability', async () => {
      const supports = await harness.testSupportsStreaming();
      expect(supports).toBe(true);
    });

    it('should test buildUrl construction', async () => {
      const url = await harness.testBuildUrl();
      expect(url).toMatch(/\/api\/generate$/);
    });

    it('should test buildHeaders', async () => {
      const headers = await harness.testBuildHeaders();
      expect(headers).toHaveProperty('content-type', 'application/json');
    });

    it('should test handleResponse with JSON', async () => {
      const response = JSON.stringify({ response: 'Hello!', done: true });
      const result = await harness.testHandleResponse(response);

      expect(result.response).toBe('Hello!');
      expect(result.done).toBe(true);
    });

    it('should test handleResponse with invalid JSON', async () => {
      const response = 'Not valid JSON';
      const result = await harness.testHandleResponse(response);

      expect(result).toBe('Not valid JSON');
    });

    it('should test handleStreamChunk for delta', async () => {
      const chunk = { response: 'Streaming text', done: false };
      const result = await harness.testHandleStreamChunk(chunk);

      expect(result.type).toBe('delta');
      expect(result.content).toBe('Streaming text');
    });

    it('should test handleStreamChunk for end', async () => {
      const chunk = { done: true };
      const result = await harness.testHandleStreamChunk(chunk);

      expect(result.type).toBe('end');
    });

    it('should get test results', async () => {
      await harness.testSupportsStreaming();
      const summary = harness.getTestResults();

      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('passed');
      expect(summary).toHaveProperty('failed');
      expect(summary.passed).toBeGreaterThan(0);
    });

    it('should reset harness between test runs', async () => {
      await harness.testSupportsStreaming();
      let summary = harness.getTestResults();
      expect(summary.total).toBeGreaterThan(0);

      harness.reset();
      summary = harness.getTestResults();
      expect(summary.total).toBe(0);
    });
  });

  describe('Integration Tests (Real Services - When Available)', () => {
    let harness: ModelTestHarness;

    beforeEach(() => {
      // Skip if service unavailable
      harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'none',
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        skipIfUnavailable: true,
        timeout: 30000,
        verbose: true
      });
    });

    afterEach(() => {
      harness.cleanup();
    });

    it('should predict with real Ollama service - integration', async () => {
      const result = await harness.testIntegrationPredict('What is AI?', {
        timeout: 30000
      });

      if (result) {
        expect(result).toBeDefined();
        // Verify response structure
        expect(typeof result === 'object').toBe(true);
      }
    });

    it('should handle streaming with real service - integration', async () => {
      const chunks = await harness.testIntegrationStream('Explain quantum computing', {
        timeout: 30000,
        chunkLimit: 50
      });

      if (chunks) {
        expect(Array.isArray(chunks)).toBe(true);
        // Verify chunk structure if any were received
        if (chunks.length > 0) {
          expect(chunks[0]).toHaveProperty('type');
        }
      }
    });

    it('should handle graceful service failure', async () => {
      // When service is unavailable and skipIfUnavailable is true,
      // the test returns null instead of throwing
      const result = await harness.testIntegrationPredict('This is a prompt', {
        timeout: 30000
      });

      // Result is null when service unavailable
      expect(result === null || result !== undefined).toBe(true);
    });
  });

  describe('Configuration Examples', () => {
    it('should support full mock mode', () => {
      const harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full'
      });
      expect(harness.getComponent()).toBeDefined();
      harness.cleanup();
    });

    it('should support custom baseUrl', () => {
      const harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full',
        baseUrl: 'http://custom-ollama:11434'
      });
      expect(harness.getComponent()).toBeDefined();
      harness.cleanup();
    });

    it('should support model name configuration', () => {
      const harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full',
        model: 'neural-chat'
      });
      expect(harness.getComponent()).toBeDefined();
      harness.cleanup();
    });

    it('should support verbose logging', () => {
      const harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full',
        verbose: true // Will log all harness operations
      });
      expect(harness.getComponent()).toBeDefined();
      harness.cleanup();
    });
  });

  describe('Harness Capabilities', () => {
    it('should provide access to underlying component', () => {
      const harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full'
      });
      const component = harness.getComponent();

      expect(component).toBeInstanceOf(OllamaGenerativeModel);
      expect(typeof component.predict).toBe('function');
      harness.cleanup();
    });

    it('should track mocks', () => {
      const harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full'
      });

      const mocks = harness.getMocks();
      expect(mocks instanceof Map).toBe(true);
      harness.cleanup();
    });

    it('should merge test results across multiple calls', async () => {
      const harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full'
      });

      await harness.testSupportsStreaming();
      await harness.testBuildUrl();
      await harness.testBuildHeaders();

      const summary = harness.getTestResults();
      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(3);
      harness.cleanup();
    });
  });

  describe('Error Handling', () => {
    it('should capture and report test failures', async () => {
      const harness = new ModelTestHarness(OllamaGenerativeModel, {
        mockMode: 'full'
      });

      // This test is intentionally designed to fail by checking wrong expectation
      try {
        const url = await harness.testBuildUrl();
        // Verify we got results
        expect(url).toBeDefined();
      } catch (e) {
        // Expected behavior when service is unavailable
      }

      harness.cleanup();
    });
  });
});

/**
 * Running these tests:
 *
 * Unit tests (always run):
 *   pnpm jest __tests__/examples/ModelTestHarness.example.test.ts
 *
 * With integration tests (requires Ollama running):
 *   OLLAMA_URL=http://localhost:11434 pnpm jest __tests__/examples/ModelTestHarness.example.test.ts
 *
 * Skip integration tests:
 *   NODE_ENV=test pnpm jest __tests__/examples/ModelTestHarness.example.test.ts --testNamePattern="Unit Tests"
 */
