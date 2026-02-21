import { BaseModel } from './BaseModel';
import { Logger } from '../utils/Logger';
import { Chunk } from './BaseModel';

const logger = new Logger('OllamaModel');

type OllamaConfig = {
  baseUrl?: string; // base URL of Ollama instance, e.g. http://localhost:11434
  apiKey?: string; // optional API key
  model?: string; // model name in Ollama
  contextLength?: number; // approximate context length
  keepAlive?: number; // how long to keep the model in Ollama memory (seconds)
};

export class OllamaModel extends BaseModel {
  private baseUrl: string;
  private apiKey?: string;
  private modelName: string;
  private contextLength?: number;
  private keepAlive?: number;

  constructor(opts: Partial<OllamaConfig> = {}, baseOpts: any = {}) {
    super({...baseOpts, name: baseOpts.name ?? 'OllamaModel'});
    // allow constructor opts to override config file
    const cfg = this.config ?? {};
    this.baseUrl = (opts.baseUrl ?? (cfg as any)?.baseUrl) ?? 'http://localhost:11434';
    this.apiKey = opts.apiKey ?? (cfg as any)?.apiKey ?? undefined;
    this.modelName = (opts.model ?? (cfg as any)?.model) ?? 'ollama';
    this.contextLength = opts.contextLength ?? (cfg as any)?.contextLength;
    this.keepAlive = opts.keepAlive ?? (cfg as any)?.keepAlive;
  }

  async supportsStreaming(): Promise<boolean> {
    return true;
  }

  buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    return Promise.resolve(headers);
  }

  buildPayload(url: string, input: any): any {
    const payload: any = { model: this.modelName, prompt: input };
    if (this.contextLength) payload.context_length = this.contextLength;
    if (this.keepAlive) payload.keep_alive = this.keepAlive;
    return payload;
  }

  async handleResponse(response: string): Promise<any> {
    logger.verbose('handleResponse', response);
    try { 
      return JSON.parse(response); 
    } catch (e) { 
      logger.warn('handleResponse: failed to parse response as JSON', { error: e, response });
      return response; 
    }
  }

  async handleStreamChunk(chunk: any): Promise<Chunk | any> {
    logger.verbose('handleStreamChunk', chunk);
    if (chunk.thinking) {
        const response: Chunk = { 
            type: 'start',
            role: this.role,
        };
        return response;
    }
    else if (chunk.done) {
        const response: Chunk = { 
            type: 'end',
            role: this.role
        };
        return response;
    }
    else if (chunk.response) {
        const response: Chunk = { 
            type: 'delta',
            role: this.role,
            content: chunk.response
        };
        return response;
    }
      
  }

  async buildUrl(): Promise<string> {
    const path = '/api/generate';
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
}
