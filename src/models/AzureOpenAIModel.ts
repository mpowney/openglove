import { BaseModel, Chunk, Message } from './BaseModel';
import { Logger } from '../utils/Logger';
import { fetchWithTimeout, fetchWithTimeoutAndStream } from '../utils/Fetch';
import { text } from 'stream/consumers';

type AzureConfig = {
  baseUrl?: string; // full endpoint URL, e.g. https://my-azure-endpoint/openai/deployments
  apiKey?: string;
  model?: string; // model/deployment name
  maxTokens?: number;
  temperature?: number;
};

const logger = new Logger('AzureOpenAIModel');

export class AzureOpenAIModel extends BaseModel {
  private baseUrl: string;
  private apiKey?: string;
  private modelName: string;
  private maxTokens?: number;
  private temperature?: number;

  constructor(opts: Partial<AzureConfig> = {}, baseOpts: any = {}) {
    super({ ...baseOpts, name: baseOpts.name ?? 'AzureOpenAIModel' });
    const cfg = this.config ?? {};
    this.baseUrl = (opts.baseUrl ?? (cfg as any)?.baseUrl) ?? 'https://contoso.openai.azure.com';
    this.apiKey = opts.apiKey ?? (cfg as any)?.apiKey ?? undefined;
    this.modelName = (opts.model ?? (cfg as any)?.model) ?? 'gpt-4';
    this.maxTokens = opts.maxTokens ?? (cfg as any)?.maxTokens;
    this.temperature = opts.temperature ?? (cfg as any)?.temperature ?? undefined;
  }

  async supportsStreaming(): Promise<boolean> {
    return true;
  }

  async buildUrl(path?: string): Promise<string> {
    
    const baseUrl = path ? this.baseUrl.replace(/\/responses/gi, path) : this.baseUrl; // remove trailing slash if any
    try {
      // @ts-ignore
      if (typeof URL !== 'undefined' && path) return new URL(path, baseUrl).toString();
    } catch (e: unknown) {
      logger.verbose('global URL construction failed; using node URL fallback', { error: e });
    }
    if (!path) return baseUrl;
    const { URL } = await import('url');
    return new URL(path, baseUrl).toString();
  }

  buildPayload(url: string, input: string | Message[]): any {
    if (url.indexOf('/responses') !== -1 && Array.isArray(input)) {
        logger.warn('AzureOpenAIModel: input is an array of messages but endpoint URL suggests non-chat model; converting to single string prompt');
        input = input.map(m => `${m.role}: ${m.content}`).join('\n');
    }    

    const payload: any = url.indexOf('/chat/completions') !== -1 ?     { 
        model: this.modelName, 
        messages: Array.isArray(input) ? input : [ { role: 'user', content: input } ], 
        max_completion_tokens: this.maxTokens, 
        temperature: this.temperature
    } : {
        model: this.modelName, 
        input: input
    };
    return payload;
  }

  async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) headers['api-key'] = this.apiKey;
    if (this.maxTokens) headers['max_completion_tokens'] = this.maxTokens.toString();
    if (this.temperature !== undefined) headers['temperature'] = this.temperature.toString();

    return headers;
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
      if (chunk.indexOf('event:') == 0) return chunk;

      try {
        const parsed = JSON.parse(String(chunk).replace('data: ', ''));
        if (parsed.type === 'response.output_text.delta' && parsed.delta)
            return { type: 'delta', content: parsed.delta, role: this.role };
        else if (parsed.type === 'response.content_part.added')
            return { type: 'start', content: parsed.part.text, role: this.role };
        else if (parsed.type === 'response.output_text.done')
            return { type: 'end', content: parsed.text, role: this.role };
        else
            return parsed;
      } catch (e) {
        logger.verbose('handleStreamChunk: failed to parse chunk content as JSON, yielding raw content', { error: e, chunk });
        return chunk;
      }
  }
}

export default AzureOpenAIModel;
