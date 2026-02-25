import { BaseSkill, SkillContext } from '@openglove/base';

export class TimeSkill extends BaseSkill {
  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({ 
      name: opts.name ?? 'TimeSkill', 
      description: opts.description ?? 'Returns current time info', 
      tags: opts.tags ?? ['time'] 
    });
  }

  async canHandle(input: string): Promise<boolean> {
    const s = (input || '').toLowerCase();
    return /\b(time|what time|current time|now|timezone)\b/.test(s);
  }

  protected async runSkill(_input: any, _ctx?: SkillContext) {
    // Extract string input if provided in object format
    const inputStr = typeof _input === 'object' && _input?.input ? _input.input : _input;
    
    const now = new Date();
    const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
    return {
      type: 'time',
      timeIso: now.toISOString(),
      timeString: now.toString(),
      timezone: tz
    };
  }
}
