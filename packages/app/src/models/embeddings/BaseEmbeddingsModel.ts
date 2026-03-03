import { loadConfig, Logger } from '@openglove/base';
import { BaseModel, Message } from '../BaseModel';
import { BaseGenerativeModel } from '../generative';
import { fetchWithTimeout } from '../../utils';

const logger = new Logger('BaseEmbeddingsModel');

/**
 * Abstract base class for embeddings models.
 * Embeddings models convert text input into vector representations.
 */
export abstract class BaseEmbeddingsModel extends BaseModel {

  static async require(name: string, config?: any): Promise<BaseEmbeddingsModel> {

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
   * Generate embeddings for input text or messages.
   * @param input - Text string or array of messages to embed
   * @returns Promise resolving to embedding vector(s)
   */
  async embed(input: string | Message[]): Promise<number[] | number[][]> {
    if (typeof this.buildPayload !== 'function' 
        || typeof this.buildUrl !== 'function'
        || typeof this.buildHeaders !== 'function') {
            throw new Error('embed not implemented: buildUrl or buildPayload method missing');
    }

    // Convert messages to string if necessary
    let textInput = input;
    if (Array.isArray(input)) {
      textInput = input.map(m => `${m.role}: ${m.content}`).join('\n');
    }

    const url = await this.buildUrl();
    const payload = this.buildPayload(url, textInput);
    const headers = await this.buildHeaders();
    
    logger.verbose('embed', { url, payload });

    const resp = await fetchWithTimeout(url, 'POST', headers, payload);

    if (!resp) throw new Error('No response received');
    const text = await resp.text();
    
    try {
      const response = JSON.parse(text);
      // Ollama embed API returns { embedding: [...] }
      if (response.embedding) {
        return response.embedding;
      }
      logger.warn('embed: unexpected response format', { response });
      return response;
    } catch (e) {
      logger.warn('embed: failed to parse response as JSON', { error: e, text });
      throw new Error('Failed to parse embedding response');
    }
  }

  abstract getConfiguredModelName(): string;

}
