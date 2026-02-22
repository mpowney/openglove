import { fetchWithTimeout, fetchWithTimeoutAndStream } from '../utils/Fetch';
import { Logger } from '../utils/Logger';

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
  role: "assistant" | "user" | "system" = "assistant";

  constructor(opts: { id?: string; name?: string; description?: string; version?: string; metadata?: ModelMetadata; role?: "assistant" | "user" | "system" } = {}) {
    this.id = opts.id ?? `model-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.version = opts.version;
    this.metadata = opts.metadata ?? {};


    // load model config using shared loader; default path is ./models.json, override via MODELS_CONFIG_PATH
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfgLoader = require('../Utils/Config') as typeof import('../utils/Config');
    const modelConfigPath = process.env.MODELS_CONFIG_PATH ?? './models.json';
    const all = cfgLoader.loadConfig(modelConfigPath) || {};
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
