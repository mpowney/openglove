import { BaseSkill, SkillContext } from '../BaseSkill';

export type SearchResultItem = {
  title?: string;
  url?: string;
  snippet?: string;
  engine?: string | null;
};

export type SearchResponse = {
  type: 'web_search';
  query: string;
  items: SearchResultItem[];
  raw?: any;
};

export interface BaseWebSearchOptions {
  baseUrl?: string;
  timeout?: number;
  params?: Record<string, string>;
  resultCount?: number;
}

export abstract class BaseWebSearchSkill extends BaseSkill {
  protected baseUrl: string;
  protected timeout: number;
  protected params: Record<string, string>;
  protected resultCount: number;

  constructor(opts: BaseWebSearchOptions & { id?: string; name?: string; description?: string; tags?: string[] }) {
    super({ id: opts.id, name: opts.name, description: opts.description, tags: opts.tags });
    const cfg = (this as any).config as Record<string, any> | undefined;
    const baseUrl = (opts as any).baseUrl ?? cfg?.baseUrl;
    if (!baseUrl) throw new Error('BaseWebSearchSkill requires a baseUrl option or config entry');
    this.baseUrl = baseUrl;
    this.timeout = (opts as any).timeout ?? cfg?.timeout ?? 8000;
    this.params = (opts as any).params ?? cfg?.params ?? {};
    this.resultCount = (opts as any).resultCount ?? cfg?.resultCount ?? 5;
  }

  protected async fetchJson(urlStr: string): Promise<any> {
    try {
      // @ts-ignore
      if (typeof fetch === 'function') {
        const resp = await fetch(urlStr, { method: 'GET', cache: 'no-store' });
        const text = await resp.text();
        try { return JSON.parse(text); } catch { return text; }
      }
    } catch (_) {
      // fall back
    }

    const { URL } = await import('url');
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? await import('https') : await import('http');
    return new Promise((resolve, reject) => {
      const req = lib.get(u, { timeout: this.timeout } as any, (res: any) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        });
      });
      req.on('error', reject as any);
      req.on('timeout', () => req.destroy(new Error('timeout')));
    });
  }

  protected normalize(raw: any, _query: string): SearchResultItem[] {
    const results: any[] = [];
    if (!raw) return [];

    if (Array.isArray(raw.results)) results.push(...raw.results);
    else if (Array.isArray(raw.items)) results.push(...raw.items);
    else if (Array.isArray(raw.hits)) results.push(...raw.hits);
    else if (raw.data && raw.data.web && Array.isArray(raw.data.web.results)) results.push(...raw.data.web.results);
    else if (raw.organic_results && Array.isArray(raw.organic_results)) results.push(...raw.organic_results);
    else if (Array.isArray(raw)) results.push(...raw);

    const mapped: SearchResultItem[] = results.slice(0, this.resultCount).map((r: any) => ({
      title: r.title ?? r.heading ?? r.name ?? r.title_raw ?? undefined,
      url: r.url ?? r.link ?? r.url_raw ?? r.cite ?? undefined,
      snippet: r.content ?? r.snippet ?? r.text ?? r.description ?? undefined,
      engine: r.engine ?? r.provider ?? r.source ?? null
    }));
    if (mapped.length && mapped.length > this.resultCount) return mapped.slice(0, this.resultCount);
    return mapped;
  }

  protected abstract buildSearchUrl(query: string): string;

  async run(input: string, _ctx?: SkillContext): Promise<SearchResponse> {
    const q = input;
    const url = this.buildSearchUrl(q);
    const raw = await this.fetchJson(url);
    const items = this.normalize(raw, q);
    return { type: 'web_search', query: q, items };
  }
}
