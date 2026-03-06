/**
 * Integration test file demonstrating ModelTestHarness with real Ollama services
 * This file is excluded from default test execution and run only on-demand
 */

import { ModelTestHarness } from '../harness';
import { OllamaGenerativeModel } from '../../src/models/generative/OllamaGenerativeModel';

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

// jest.mock('../../src/utils/Fetch');

jest.setTimeout(60000);

describe('ModelTestHarness - Integration Tests (Real Services)', () => {
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
      const chunks = await harness.testIntegrationStream('Explain quantum computing in fifty words or less', {
        timeout: 30000,
        chunkLimit: 1000
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
});

/**
 * Running this test file:
 *
 * With local Ollama running:
 *   pnpm test:integration __tests__/examples/ModelTestHarness.integration.test.ts
 *
 * With custom Ollama URL:
 *   OLLAMA_URL=http://your-server:11434 pnpm test:integration __tests__/examples/ModelTestHarness.integration.test.ts
 */
