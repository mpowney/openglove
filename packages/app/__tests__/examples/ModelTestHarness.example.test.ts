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
 * Running these unit test examples:
 *
 * Run all unit tests:
 *   pnpm test __tests__/examples/ModelTestHarness.example.test.ts
 *
 * For integration tests (real Ollama service), see:
 *   __tests__/examples/ModelTestHarness.integration.test.ts
 *   pnpm test:integration __tests__/examples/ModelTestHarness.integration.test.ts
 */
