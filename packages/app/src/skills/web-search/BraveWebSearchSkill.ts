import { BaseWebSearchSkill, BaseWebSearchOptions } from './BaseWebSearchSkill';

export class BraveWebSearchSkill extends BaseWebSearchSkill {
  constructor(opts: BaseWebSearchOptions & { id?: string; name?: string; description?: string; tags?: string[] }) {
    super({ ...opts, name: opts.name ?? 'BraveWebSearchSkill' });
  }

  async canHandle(input: string): Promise<boolean> {
    const s = (input || '').toLowerCase();
    return /\b(search|find|brave|look up|lookup|look for|what is|who is|where is)\b/.test(s);
  }

  protected buildSearchUrl(query: string): string {
    const base = this.baseUrl;
    const url = new URL(base);
    const sp = url.searchParams;
    sp.set('q', query);
    for (const [k, v] of Object.entries(this.params)) sp.set(k, v);
    return url.toString();
  }
}
