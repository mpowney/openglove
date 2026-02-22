import { BaseSkill, SkillContext } from '@openglove/base';

export class WebBrowserSkill extends BaseSkill {
  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({ 
      name: opts.name ?? 'WebBrowserSkill', 
      description: opts.description ?? 'Handles web browser related tasks', 
      tags: opts.tags ?? ['web-browser'] 
    });
  }

  canHandle(input: string): boolean {
    const s = (input || '').toLowerCase();
    return /\b(browse to|open site|open a web page)\b/.test(s);
  }

  async run(_input: string, _ctx?: SkillContext) {
    return {}
  }
}
