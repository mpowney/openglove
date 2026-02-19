import { BaseSkill, SkillContext } from './BaseSkill';

export class TimeSkill extends BaseSkill {
  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({ name: opts.name ?? 'TimeSkill', description: opts.description ?? 'Returns current time info', tags: opts.tags ?? ['time'] });
  }

  canHandle(input: string): boolean {
    const s = (input || '').toLowerCase();
    return /\b(time|what time|current time|now|timezone)\b/.test(s);
  }

  async run(_input: string, _ctx?: SkillContext) {
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
