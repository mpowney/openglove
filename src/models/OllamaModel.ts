import { BaseModel } from './BaseModel';
import { Logger } from '../utils/Logger';

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

  /**
   * Non-streaming predict: returns the full generated text/result.
   */
  async predict(input: string): Promise<any> {
    const url = await this.buildUrl('/api/generate');
    const payload: any = {
      model: this.modelName,
      prompt: input
    };
    if (this.contextLength) payload.context_length = this.contextLength;
    if (this.keepAlive) payload.keep_alive = this.keepAlive;

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    // prefer global fetch
    try {
      // @ts-ignore
      if (typeof fetch === 'function') {
        const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
        const text = await resp.text();
        try { return JSON.parse(text); } catch { return text; }
      }
    } catch (e: unknown) {
      logger.verbose('fetch POST failed, falling back to node http(s)', { error: e });
    }

    // Node fallback
    const { URL } = await import('url');
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? await import('https') : await import('http');
    return new Promise((resolve, reject) => {
      const req = lib.request(u, { method: 'POST', headers, timeout: 10000 } as any, (res: any) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        });
      });
      req.on('error', reject as any);
      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  /**
   * Streaming predict: returns an AsyncIterable yielding partial chunks as strings or parsed objects.
   */
  async *predictStream(input: string): AsyncIterable<string | any> {
    const url = await this.buildUrl('/api/generate');
    const payload: any = { model: this.modelName, prompt: input, stream: true };
    if (this.contextLength) payload.context_length = this.contextLength;
    if (this.keepAlive) payload.keep_alive = this.keepAlive;

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    // Try fetch streaming
    try {
      // @ts-ignore
      if (typeof fetch === 'function') {
        const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
        if (!resp.body) return;
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // split on newline to yield complete lines
          let idx: number;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line) continue;
            // try JSON parse otherwise yield raw
            try { yield JSON.parse(line).response; } catch { yield line; }
          }
        }
        if (buffer.trim()) {
          try { yield JSON.parse(buffer).response; } catch { yield buffer; }
        }
        return;
      }
    } catch (e: unknown) {
      logger.verbose('fetch streaming failed, falling back to node http(s)', { error: e });
    }

    // Node http fallback: make request and stream 'data' events
    const { URL } = await import('url');
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? await import('https') : await import('http');
    const req = lib.request(u, { method: 'POST', headers, timeout: 10000 } as any);
    req.on('error', () => {});
    req.write(JSON.stringify(payload));
    req.end();

    // create async iterator from response stream
    const iterable = (async function* (reqStream: any) {
      for await (const chunk of reqStream) {
        const s = String(chunk);
        // split by newline
        const parts = s.split(/\r?\n/).filter(Boolean);
        for (const p of parts) {
          try { yield JSON.parse(p); } catch { yield p; }
        }
      }
    })(await new Promise<any>((resolve) => {
      req.on('response', (res: any) => resolve(res));
    }));

    for await (const v of iterable) yield v;
  }

  private async buildUrl(path: string): Promise<string> {
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
