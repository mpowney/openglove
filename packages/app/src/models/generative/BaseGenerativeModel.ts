import { BaseModel, Message, Chunk } from '../BaseModel';
import { fetchWithTimeout, fetchWithTimeoutAndStream } from '../../utils/Fetch';
import { loadConfig, Logger } from '@openglove/base';

const logger = new Logger('BaseGenerativeModel');

/**
 * Abstract base class for generative models.
 * Handles text generation and streaming responses.
 */
export abstract class BaseGenerativeModel extends BaseModel {

  static async require(name: string, config?: any): Promise<BaseGenerativeModel> {

    const basePath = `${require.main?.path}/models`;
    const loadedConfig = loadConfig("models.json") ?? {};
    const modelConfig = loadedConfig[name] ?? {};

    try {
      // Try to load from models/index.ts first
      const index: any = await import(/* webpackIgnore: true */ `${basePath}`);
      let Ctor = index[name];
      
      // If not found in index, try loading from individual skill file
      if (!Ctor) {
        const mod = await import(/* webpackIgnore: true */ `${basePath}/${name}`);
        Ctor = (mod && (mod.default ?? mod[name])) as any;
      }
      
      if (typeof Ctor === 'function') {
        try {
          const instance = new Ctor({ ...modelConfig, ...(config || {}), name: name });
          return instance;
        } catch (e) {
          logger.error('Failed to register model from config', e);
        }
      }
    } catch (e) {
      logger.warn(`Failed to load model module for ${name}`, e);
    }
    throw new Error(`Model ${name} not found in path ${basePath} or is not a constructor`);
  }

  /**
   * Handle the complete response from the API
   */
  abstract handleResponse?(response: string): any;

  /**
   * Handle individual stream chunks
   */
  abstract handleStreamChunk?(chunk: any): any;

  /**
   * Given an input (prompt, features, etc.), return a model response.
   */
  async predict(input: string | Message[]): Promise<any> {
    
    if (typeof this.buildPayload !== 'function' 
        || typeof this.buildUrl !== 'function'
        || typeof this.buildHeaders !== 'function'
        || typeof this.handleResponse !== 'function') {
            throw new Error('predict not implemented: buildUrl or buildPayload method missing');
    }
    const url = await this.buildUrl();
    const payload = this.buildPayload(url, input);
    payload.stream = false; // ensure streaming is disabled for predict

    const headers = await this.buildHeaders();
    logger.verbose('predict', { url, payload: payload });

    const resp = await fetchWithTimeout(url, 'POST', headers, payload);

    if (!resp) throw new Error('No response received');
    const text = await resp.text();
    return this.handleResponse(text);
  }

  /** Optional streaming API: yields partial outputs as they arrive */
  async *predictStream?(input: any): AsyncIterable<any> {
    if (typeof this.buildPayload !== 'function' 
        || typeof this.buildUrl !== 'function'
        || typeof this.buildHeaders !== 'function'
        || typeof this.handleStreamChunk !== 'function') {
            throw new Error('predictStream not implemented: buildUrl or buildPayload method missing');
    }
    const url = await this.buildUrl();
    const payload = this.buildPayload(url, input);
    const headers: Record<string, string> = await this.buildHeaders();

    payload.stream = true;

    logger.verbose('predictStream payload', payload);

    for await (const chunk of fetchWithTimeoutAndStream(url, 'POST', headers, payload)) {
    //   logger.verbose('predictStream: chunk', chunk);
      yield this.handleStreamChunk(chunk);
    }

  };
}
