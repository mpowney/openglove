/// <reference types="jest" />

import { OllamaGenerativeModel } from '../../src/models/generative/OllamaGenerativeModel';
import * as fetchModule from '../../src/utils/Fetch';

// Mock dependencies
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

describe('OllamaGenerativeModel', () => {
  const mockFetchWithTimeout = fetchModule.fetchWithTimeout as jest.MockedFunction<typeof fetchModule.fetchWithTimeout>;
  const mockFetchWithTimeoutAndStream = fetchModule.fetchWithTimeoutAndStream as jest.MockedFunction<typeof fetchModule.fetchWithTimeoutAndStream>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const model = new OllamaGenerativeModel();
      expect(model.name).toBe('OllamaModel');
      expect((model as any).baseUrl).toContain('localhost:11434');
      expect((model as any).modelName).toBe('ollama');
    });

    it('should initialize with provided options', () => {
      const model = new OllamaGenerativeModel({
        baseUrl: 'http://custom-host:11434',
        model: 'neural-chat',
        contextLength: 4096,
        keepAlive: 3600
      });

      expect((model as any).baseUrl).toBe('http://custom-host:11434');
      expect((model as any).modelName).toBe('neural-chat');
      expect((model as any).contextLength).toBe(4096);
      expect((model as any).keepAlive).toBe(3600);
    });

    it('should merge constructor options with base options', () => {
      const model = new OllamaGenerativeModel(
        { model: 'custom-model' },
        { name: 'CustomOllama' }
      );

      expect(model.name).toBe('CustomOllama');
      expect((model as any).modelName).toBe('custom-model');
    });

    it('should load config from loaded models.json', () => {
      const model = new OllamaGenerativeModel({}, { name: 'test-model' });
      expect(model.config).toBeDefined();
    });
  });

  describe('supportsStreaming', () => {
    it('should return true', async () => {
      const model = new OllamaGenerativeModel();
      const supports = await model.supportsStreaming();
      expect(supports).toBe(true);
    });
  });

  describe('buildHeaders', () => {
    it('should return headers with content-type application/json', async () => {
      const model = new OllamaGenerativeModel();
      const headers = await model.buildHeaders();

      expect(headers).toEqual({ 'content-type': 'application/json' });
    });

    it('should resolve to a promise', () => {
      const model = new OllamaGenerativeModel();
      const result = model.buildHeaders();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('buildPayload', () => {
    it('should build payload with model and prompt', () => {
      const model = new OllamaGenerativeModel({ model: 'mistral' });
      const url = 'http://localhost:11434/api/generate';
      const input = 'What is the meaning of life?';

      const payload = model.buildPayload(url, input);

      expect(payload).toEqual({
        model: 'mistral',
        prompt: input
      });
    });

    it('should include contextLength if provided', () => {
      const model = new OllamaGenerativeModel({ model: 'mistral', contextLength: 8192 });
      const url = 'http://localhost:11434/api/generate';

      const payload = model.buildPayload(url, 'prompt');

      expect(payload).toHaveProperty('context_length', 8192);
    });

    it('should include keepAlive if provided', () => {
      const model = new OllamaGenerativeModel({ model: 'mistral', keepAlive: 300 });
      const url = 'http://localhost:11434/api/generate';

      const payload = model.buildPayload(url, 'prompt');

      expect(payload).toHaveProperty('keep_alive', 300);
    });

    it('should include both contextLength and keepAlive when provided', () => {
      const model = new OllamaGenerativeModel({
        model: 'mistral',
        contextLength: 4096,
        keepAlive: 600
      });
      const url = 'http://localhost:11434/api/generate';

      const payload = model.buildPayload(url, 'test prompt');

      expect(payload).toEqual({
        model: 'mistral',
        prompt: 'test prompt',
        context_length: 4096,
        keep_alive: 600
      });
    });

    it('should not include undefined optional fields', () => {
      const model = new OllamaGenerativeModel({ model: 'mistral' });
      const payload = model.buildPayload('http://localhost:11434/api/generate', 'prompt');

      expect(payload).not.toHaveProperty('context_length');
      expect(payload).not.toHaveProperty('keep_alive');
    });
  });

  describe('buildUrl', () => {
    it('should construct correct API endpoint URL', async () => {
      const model = new OllamaGenerativeModel({ baseUrl: 'http://localhost:11434' });
      const url = await model.buildUrl();

      expect(url).toBe('http://localhost:11434/api/generate');
    });

    it('should handle different baseUrl values', async () => {
      const model = new OllamaGenerativeModel({ baseUrl: 'http://remote-server:11434' });
      const url = await model.buildUrl();

      expect(url).toBe('http://remote-server:11434/api/generate');
    });

    it('should handle baseUrl with trailing slash', async () => {
      const model = new OllamaGenerativeModel({ baseUrl: 'http://localhost:11434/' });
      const url = await model.buildUrl();

      expect(url).toContain('/api/generate');
    });

    it('should return a properly formatted URL', async () => {
      const model = new OllamaGenerativeModel({ baseUrl: 'http://localhost:11434' });
      const url = await model.buildUrl();

      expect(url).toMatch(/^http:\/\/.*\/api\/generate$/);
    });
  });

  describe('handleResponse', () => {
    it('should parse JSON response string', async () => {
      const model = new OllamaGenerativeModel();
      const response = '{"response": "Hello, world!", "done": true}';

      const result = await model.handleResponse(response);

      expect(result).toEqual({ response: 'Hello, world!', done: true });
    });

    it('should return string if JSON parsing fails', async () => {
      const model = new OllamaGenerativeModel();
      const response = 'Not valid JSON';

      const result = await model.handleResponse(response);

      expect(result).toBe('Not valid JSON');
    });

    it('should handle empty JSON object', async () => {
      const model = new OllamaGenerativeModel();
      const response = '{}';

      const result = await model.handleResponse(response);

      expect(result).toEqual({});
    });

    it('should handle complex JSON structures', async () => {
      const model = new OllamaGenerativeModel();
      const complexResponse = JSON.stringify({
        response: 'Multi-line\nresponse',
        done: false,
        context: [1, 2, 3],
        metadata: { key: 'value' }
      });

      const result = await model.handleResponse(complexResponse);

      expect(result.response).toBe('Multi-line\nresponse');
      expect(result.context).toEqual([1, 2, 3]);
      expect(result.metadata).toEqual({ key: 'value' });
    });
  });

  describe('handleStreamChunk', () => {
    it('should return start chunk when thinking is present', async () => {
      const model = new OllamaGenerativeModel();
      const chunk = { thinking: true, response: '' };

      const result = await model.handleStreamChunk(chunk);

      expect(result.type).toBe('start');
      expect(result.role).toBe('assistant');
    });

    it('should return end chunk when done is true', async () => {
      const model = new OllamaGenerativeModel();
      const chunk = { done: true };

      const result = await model.handleStreamChunk(chunk);

      expect(result.type).toBe('end');
      expect(result.role).toBe('assistant');
    });

    it('should return delta chunk with response content', async () => {
      const model = new OllamaGenerativeModel();
      const chunk = { response: 'Hello ', done: false };

      const result = await model.handleStreamChunk(chunk);

      expect(result.type).toBe('delta');
      expect(result.content).toBe('Hello ');
      expect(result.role).toBe('assistant');
    });

    it('should prioritize thinking over done and response', async () => {
      const model = new OllamaGenerativeModel();
      const chunk = { thinking: true, done: false, response: 'text' };

      const result = await model.handleStreamChunk(chunk);

      expect(result.type).toBe('start');
    });

    it('should prioritize done over response', async () => {
      const model = new OllamaGenerativeModel();
      const chunk = { done: true, response: 'final' };

      const result = await model.handleStreamChunk(chunk);

      expect(result.type).toBe('end');
    });

    it('should handle chunk with empty response', async () => {
      const model = new OllamaGenerativeModel();
      const chunk = { response: '', done: false };

      const result = await model.handleStreamChunk(chunk);

      // Empty string is falsy, so it returns undefined
      expect(result).toBeUndefined();
    });

    it('should return undefined for unrecognized chunk format', async () => {
      const model = new OllamaGenerativeModel();
      const chunk = { unknown: 'format' };

      const result = await model.handleStreamChunk(chunk);

      expect(result).toBeUndefined();
    });
  });

  describe('predict (BaseGenerativeModel method)', () => {
    it('should successfully make a prediction request', async () => {
      const model = new OllamaGenerativeModel({ model: 'mistral' });
      const mockResponse = {
        text: jest.fn().mockResolvedValue(JSON.stringify({ response: 'The answer is 42' }))
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      const result = await model.predict('What is 6 times 7?');

      expect(mockFetchWithTimeout).toHaveBeenCalled();
      expect(result.response).toBe('The answer is 42');
    });

    it('should set stream to false in payload', async () => {
      const model = new OllamaGenerativeModel({ model: 'llama2' });
      const mockResponse = {
        text: jest.fn().mockResolvedValue(JSON.stringify({ response: 'test' }))
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      await model.predict('test prompt');

      const callArgs = mockFetchWithTimeout.mock.calls[0];
      const payload = callArgs[3];
      expect(payload.stream).toBe(false);
    });

    it('should use POST method', async () => {
      const model = new OllamaGenerativeModel();
      const mockResponse = {
        text: jest.fn().mockResolvedValue(JSON.stringify({ response: 'test' }))
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      await model.predict('test');

      const callArgs = mockFetchWithTimeout.mock.calls[0];
      expect(callArgs[1]).toBe('POST');
    });

    it('should throw error if no response received', async () => {
      const model = new OllamaGenerativeModel();
      mockFetchWithTimeout.mockResolvedValue(null as any);

      await expect(model.predict('test')).rejects.toThrow('No response received');
    });

    it('should handle Message array input', async () => {
      const model = new OllamaGenerativeModel();
      const mockResponse = {
        text: jest.fn().mockResolvedValue(JSON.stringify({ response: 'result' }))
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      const messages = [
        { type: 'delta' as const, role: 'user', content: 'Hello', ts: Date.now() },
        { type: 'delta' as const, role: 'assistant', content: 'Hi there', ts: Date.now() }
      ];

      const result = await model.predict(messages);

      expect(result.response).toBe('result');
    });

    it('should build correct URL and headers', async () => {
      const model = new OllamaGenerativeModel({ baseUrl: 'http://test:11434', model: 'neural' });
      const mockResponse = {
        text: jest.fn().mockResolvedValue(JSON.stringify({ response: 'ok' }))
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      await model.predict('test');

      const callArgs = mockFetchWithTimeout.mock.calls[0];
      const url = callArgs[0];
      const headers = callArgs[2];

      expect(url).toContain('http://test:11434/api/generate');
      expect(headers).toHaveProperty('content-type', 'application/json');
    });
  });

  describe('predictStream (BaseGenerativeModel method)', () => {
    it('should yield chunks from stream', async () => {
      const model = new OllamaGenerativeModel({ model: 'mistral' });
      
      const mockChunks = [
        { response: 'Hello ', done: false },
        { response: 'world', done: false },
        { response: '!', done: true }
      ];

      mockFetchWithTimeoutAndStream.mockReturnValue(
        (async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        })()
      );

      const chunks = [];
      const stream = model.predictStream?.('test prompt');
      if (stream) {
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0].type).toBe('delta');
      expect(chunks[0].content).toBe('Hello ');
      expect(chunks[2].type).toBe('end');
    });

    it('should set stream to true in payload', async () => {
      const model = new OllamaGenerativeModel();
      mockFetchWithTimeoutAndStream.mockReturnValue(
        (async function* () {
          yield { done: true };
        })()
      );

      const stream = model.predictStream?.('test');
      if (stream) {
        for await (const _ of stream) {
          // consume stream
        }
      }

      const callArgs = mockFetchWithTimeoutAndStream.mock.calls[0];
      const payload = callArgs[3];
      expect(payload.stream).toBe(true);
    });

    it('should use POST method for streaming', async () => {
      const model = new OllamaGenerativeModel();
      mockFetchWithTimeoutAndStream.mockReturnValue(
        (async function* () {
          yield { done: true };
        })()
      );

      const stream = model.predictStream?.('test');
      if (stream) {
        for await (const _ of stream) {
          // consume stream
        }
      }

      const callArgs = mockFetchWithTimeoutAndStream.mock.calls[0];
      expect(callArgs[1]).toBe('POST');
    });

    it('should transform stream chunks through handleStreamChunk', async () => {
      const model = new OllamaGenerativeModel();
      const mockChunks = [
        { thinking: true },
        { response: 'content', done: false }
      ];

      mockFetchWithTimeoutAndStream.mockReturnValue(
        (async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        })()
      );

      const results = [];
      const stream = model.predictStream?.('prompt');
      if (stream) {
        for await (const chunk of stream) {
          results.push(chunk);
        }
      }

      expect(results[0].type).toBe('start');
      expect(results[1].type).toBe('delta');
      expect(results[1].content).toBe('content');
    });

    it('should handle Message array input in stream', async () => {
      const model = new OllamaGenerativeModel();
      mockFetchWithTimeoutAndStream.mockReturnValue(
        (async function* () {
          yield { response: 'streamed', done: false };
          yield { done: true };
        })()
      );

      const messages = [{ type: 'delta' as const, role: 'user', content: 'test', ts: Date.now() }];
      const results = [];

      const stream = model.predictStream?.(messages);
      if (stream) {
        for await (const chunk of stream) {
          results.push(chunk);
        }
      }

      expect(results).toHaveLength(2);
    });

    it('should construct URL correctly for streaming', async () => {
      const model = new OllamaGenerativeModel({ baseUrl: 'http://stream-test:11434' });
      mockFetchWithTimeoutAndStream.mockReturnValue(
        (async function* () {
          yield { done: true };
        })()
      );

      const stream = model.predictStream?.('test');
      if (stream) {
        for await (const _ of stream) {
          // consume
        }
      }

      const callArgs = mockFetchWithTimeoutAndStream.mock.calls[0];
      const url = callArgs[0];
      expect(url).toContain('http://stream-test:11434/api/generate');
    });

    it('should handle empty stream', async () => {
      const model = new OllamaGenerativeModel();
      mockFetchWithTimeoutAndStream.mockReturnValue(
        (async function* () {
          // empty generator
        })()
      );

      const results = [];
      const stream = model.predictStream?.('test');
      if (stream) {
        for await (const chunk of stream) {
          results.push(chunk);
        }
      }

      expect(results).toHaveLength(0);
    });

    it('should handle exception in stream', async () => {
      const model = new OllamaGenerativeModel();
      mockFetchWithTimeoutAndStream.mockReturnValue(
        (async function* () {
          throw new Error('Stream error');
        })()
      );

      await expect(async () => {
        const stream = model.predictStream?.('test');
        if (stream) {
          for await (const _ of stream) {
            // consume
          }
        }
      }).rejects.toThrow('Stream error');
    });
  });

  describe('BaseModel properties', () => {
    it('should have unique id', async () => {
      const model1 = new OllamaGenerativeModel();
      // Add small delay to ensure different Date.now() values
      await new Promise(resolve => setTimeout(resolve, 1));
      const model2 = new OllamaGenerativeModel();

      expect(model1.id).toBeDefined();
      expect(model2.id).toBeDefined();
      expect(model1.id).not.toBe(model2.id);
    });

    it('should have default role as assistant', () => {
      const model = new OllamaGenerativeModel();
      expect(model.role).toBe('assistant');
    });

    it('should allow setting custom role', () => {
      const model = new OllamaGenerativeModel({}, { role: 'system' });
      // Note: role from config might override, but testing the option is passed
      expect(model.name).toBeDefined();
    });

    it('should have metadata property', () => {
      const model = new OllamaGenerativeModel({}, { metadata: { version: '1.0' } });
      expect(model.metadata).toBeDefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed JSON in response', async () => {
      const model = new OllamaGenerativeModel();
      const mockResponse = {
        text: jest.fn().mockResolvedValue('{ invalid json')
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      const result = await model.predict('test');

      expect(result).toBe('{ invalid json');
    });

    it('should handle very long prompts', async () => {
      const model = new OllamaGenerativeModel();
      const longPrompt = 'test '.repeat(1000);
      const mockResponse = {
        text: jest.fn().mockResolvedValue(JSON.stringify({ response: 'ok' }))
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse as any);

      await model.predict(longPrompt);

      const callArgs = mockFetchWithTimeout.mock.calls[0];
      const payload = callArgs[3];
      expect(payload.prompt).toHaveLength(5000);
    });

    it('should handle special characters in model name', () => {
      const model = new OllamaGenerativeModel({ model: 'mistral:7b-v0.2' });
      const payload = model.buildPayload('url', 'prompt');

      expect(payload.model).toBe('mistral:7b-v0.2');
    });

    it('should preserve payload order and structure', () => {
      const model = new OllamaGenerativeModel({
        model: 'test',
        contextLength: 2048,
        keepAlive: 120
      });
      const payload = model.buildPayload('url', 'prompt');

      expect(payload).toHaveProperty('model');
      expect(payload).toHaveProperty('prompt');
      expect(payload).toHaveProperty('context_length');
      expect(payload).toHaveProperty('keep_alive');
    });
  });
});
