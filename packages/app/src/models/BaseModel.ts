import { ChannelRoleType } from '../channels/BaseChannel';
import { fetchWithTimeout, fetchWithTimeoutAndStream } from '../utils/Fetch';
import { loadConfig, Logger } from '@openglove/base';

export type ModelMetadata = Record<string, any>;

export interface Chunk {
    type: 'delta' | 'full' | 'start' | 'end' | string;
    role?: 'system' | 'user' | 'assistant' | 'supplementary';
    content?: string;
    [key: string]: any;
}

export interface Message extends Chunk {
  ts?: number;
}

const logger = new Logger('BaseModel');

export abstract class BaseModel {
  readonly id: string;
  name?: string;
  description?: string;
  version?: string;
  metadata: ModelMetadata;
  /** Optional configuration loaded from models.json (by `name`) */
  config: Record<string, any> | null = null;
  role: ChannelRoleType = "assistant";

  static async require(name: string, config?: any): Promise<BaseModel> {

    const basePath = `${require.main?.path}/models`;
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
          const instance = new Ctor({ ...(config || {}), name: name });
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


  constructor(opts: { id?: string; name?: string; description?: string; version?: string; metadata?: ModelMetadata; role?: ChannelRoleType } = {}) {
    this.id = opts.id ?? `model-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.version = opts.version;
    this.metadata = opts.metadata ?? {};


    // load model config using shared loader; default path is ./models.json, override via MODELS_CONFIG_PATH
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const modelConfigPath = process.env.MODELS_CONFIG_PATH ?? './models.json';
    const all = loadConfig(modelConfigPath) || {};
    this.config = (this.name && all && all[this.name]) || null;
    this.role = opts.role ?? (all as any)?.role ?? 'assistant';
  }

  /**
   * Given an input (prompt, features, etc.), return a model response.
   */
  abstract supportsStreaming(): Promise<boolean>;

  abstract buildUrl?(): Promise<string>;

  abstract buildHeaders?(): Promise<Record<string, string>>;

  abstract buildPayload?(url: string, input: any): any;

  abstract handleResponse?(response: string): any;

  abstract handleStreamChunk?(chunk: any): any;

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

  /** Optional lifecycle hooks */
  async load(source?: string): Promise<void> {
    // override to load model weights or configuration
  }

  async save(target?: string): Promise<void> {
    // override to persist model state
  }
}
