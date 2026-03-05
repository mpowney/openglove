/**
 * Specialized test harness for generative models
 */

import { ComponentTestHarness, HarnessConfig } from './ComponentTestHarness';
import { BaseGenerativeModel } from '../../src/models/generative/BaseGenerativeModel';

export interface ModelTestConfig extends HarnessConfig {
  model?: string;
  contextLength?: number;
  keepAlive?: number;
}

export class ModelTestHarness extends ComponentTestHarness<BaseGenerativeModel> {
  protected modelConfig: ModelTestConfig;

  constructor(
    ModelClass: new (opts?: any) => BaseGenerativeModel,
    config: ModelTestConfig = {}
  ) {
    super(ModelClass, config);
    this.modelConfig = { ...config };
  }

  /**
   * Get component configuration for model constructor
   */
  protected getComponentConfig(): Record<string, any> {
    return {
      ...super.getComponentConfig(),
      model: this.modelConfig?.model ?? 'mistral',
      contextLength: this.modelConfig?.contextLength,
      keepAlive: this.modelConfig?.keepAlive
    };
  }

  /**
   * Test predict method
   */
  public async testPredict(input: string | any[]): Promise<any> {
    return this.executeTest('predict', async () => {
      const model = this.component as any;
      if (!model.predict) {
        throw new Error('Model does not implement predict method');
      }
      return await model.predict(input);
    });
  }

  /**
   * Test streaming prediction
   */
  public async *testPredictStream(input: string | any[]): AsyncIterable<any> {
    const model = this.component as any;
    if (!model.predictStream) {
      throw new Error('Model does not implement predictStream method');
    }

    yield* model.predictStream(input);
  }

  /**
   * Test supports streaming capability
   */
  public async testSupportsStreaming(): Promise<boolean> {
    return this.executeTest('supportsStreaming', async () => {
      const model = this.component as any;
      return await model.supportsStreaming();
    }) as Promise<boolean>;
  }

  /**
   * Test URL building
   */
  public async testBuildUrl(): Promise<string> {
    return this.executeTest('buildUrl', async () => {
      const model = this.component as any;
      if (!model.buildUrl) {
        throw new Error('Model does not implement buildUrl method');
      }
      return await model.buildUrl();
    }) as Promise<string>;
  }

  /**
   * Test headers building
   */
  public async testBuildHeaders(): Promise<Record<string, string>> {
    return this.executeTest('buildHeaders', async () => {
      const model = this.component as any;
      if (!model.buildHeaders) {
        throw new Error('Model does not implement buildHeaders method');
      }
      return await model.buildHeaders();
    }) as Promise<Record<string, string>>;
  }

  /**
   * Test payload building
   */
  public testBuildPayload(url: string, input: any): any {
    const model = this.component as any;
    if (!model.buildPayload) {
      throw new Error('Model does not implement buildPayload method');
    }
    return model.buildPayload(url, input);
  }

  /**
   * Test response handling
   */
  public async testHandleResponse(response: string): Promise<any> {
    return this.executeTest('handleResponse', async () => {
      const model = this.component as any;
      if (!model.handleResponse) {
        throw new Error('Model does not implement handleResponse method');
      }
      return await model.handleResponse(response);
    });
  }

  /**
   * Test stream chunk handling
   */
  public async testHandleStreamChunk(chunk: any): Promise<any> {
    return this.executeTest('handleStreamChunk', async () => {
      const model = this.component as any;
      if (!model.handleStreamChunk) {
        throw new Error('Model does not implement handleStreamChunk method');
      }
      return await model.handleStreamChunk(chunk);
    });
  }

  /**
   * Full integration test: predict with real service
   */
  public async testIntegrationPredict(
    input: string,
    options: { timeout?: number } = {}
  ): Promise<any> {
    return this.executeTest(
      `Integration Predict: ${input.substring(0, 30)}...`,
      async () => {
        try {
          const timeoutMs = options.timeout ?? this.config.timeout;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const model = this.component as any;
          const result = await model.predict(input);

          clearTimeout(timeoutId);
          return result;
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            throw new Error(`Prediction timeout after ${options.timeout ?? this.config.timeout}ms`);
          }
          throw e;
        }
      },
      { checkAvailability: true }
    );
  }

  /**
   * Full integration test: streaming with real service
   */
  public async testIntegrationStream(
    input: string,
    options: { timeout?: number; chunkLimit?: number } = {}
  ): Promise<any[] | null> {
    return this.executeTest(
      `Integration Stream: ${input.substring(0, 30)}...`,
      async () => {
        const model = this.component as any;
        const chunks: any[] = [];
        const timeoutMs = options.timeout ?? this.config.timeout;
        const chunkLimit = options.chunkLimit ?? 100;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const stream = model.predictStream?.(input);
          if (!stream) {
            throw new Error('Model does not support streaming');
          }

          let chunkCount = 0;
          for await (const chunk of stream) {
            chunks.push(chunk);
            chunkCount++;

            if (chunkCount > chunkLimit) {
              throw new Error(`Exceeded chunk limit of ${chunkLimit}`);
            }
          }

          return chunks;
        } finally {
          clearTimeout(timeoutId);
        }
      },
      { checkAvailability: true }
    ) as Promise<any[] | null>;
  }
}
