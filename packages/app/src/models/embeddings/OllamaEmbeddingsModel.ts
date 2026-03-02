import { BaseEmbeddingsModel } from './BaseEmbeddingsModel';
import { Message } from '../BaseModel';
import { Logger } from '@openglove/base';
import { fetchWithTimeout } from '../../utils/Fetch';

const logger = new Logger('OllamaEmbeddingsModel');

type OllamaEmbeddingsConfig = {
  baseUrl?: string; // base URL of Ollama instance, e.g. http://localhost:11434
  apiKey?: string; // optional API key
  model?: string; // model name in Ollama
  contextLength?: number; // approximate context length
  keepAlive?: number; // how long to keep the model in Ollama memory (seconds)
};

export class OllamaEmbeddingsModel extends BaseEmbeddingsModel {
  private baseUrl: string;
  private apiKey?: string;
  private modelName: string;
  private keepAlive?: number;

  constructor(opts: Partial<OllamaEmbeddingsConfig> = {}, baseOpts: any = {}) {
    super({...baseOpts, name: baseOpts.name ?? 'OllamaEmbeddingsModel'});
    // allow constructor opts to override config file
    const cfg = this.config ?? {};
    this.baseUrl = (opts.baseUrl ?? (cfg as any)?.baseUrl) ?? 'http://localhost:11434';
    this.apiKey = opts.apiKey ?? (cfg as any)?.apiKey ?? undefined;
    this.modelName = (opts.model ?? (cfg as any)?.model) ?? 'ollama';
    this.keepAlive = opts.keepAlive ?? (cfg as any)?.keepAlive;
  }

  async supportsStreaming(): Promise<boolean> {
    return false;
  }

  buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    return Promise.resolve(headers);
  }

  buildPayload(url: string, input: any): any {
    const payload: any = { model: this.modelName, input: input };
    if (this.keepAlive) payload.keep_alive = this.keepAlive;
    logger.verbose('Built payload for OllamaEmbeddingsModel', payload);
    return payload;
  }

  async buildUrl(): Promise<string> {
    const path = '/api/embed';
    try {
      // use global URL if available
      // @ts-ignore
      if (typeof URL !== 'undefined') return new URL(path, this.baseUrl).toString();
    } catch (e: unknown) {
    //   logger.verbose(`global URL not available; falling back to runtime import`, { error: e });
    }
    const { URL } = await import('url');
    return new URL(path, this.baseUrl).toString();
  }

  getConfiguredModelName(): string {
    return this.modelName;
  }

}

export default OllamaEmbeddingsModel;
