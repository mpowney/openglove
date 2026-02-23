import { BaseWebSearchSkill, BaseWebSearchOptions } from './BaseWebSearchSkill';

export class SearxngWebSearchSkill extends BaseWebSearchSkill {
  constructor(opts: BaseWebSearchOptions & { id?: string; name?: string; description?: string; tags?: string[] }) {
    super({ ...opts, name: opts.name ?? 'SearxngWebSearchSkill' });
  }

  async canHandle(input: string): Promise<boolean> {
    const s = (input || '').toLowerCase();
    return /\b(search|find|look up|lookup|look for|what is|who is|where is|google|bing|duckduckgo|searx|searxng)\b/.test(s);
  }

  protected buildSearchUrl(query: string): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/';
    const url = new URL('search', base);
    const sp = url.searchParams;
    sp.set('q', query);
    sp.set('format', 'json');
    if (this.resultCount) sp.set('count', this.resultCount.toString());
    for (const [k, v] of Object.entries(this.params)) sp.set(k, v);
    return url.toString();
  }
}
