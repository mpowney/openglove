/// <reference types="jest" />

import * as path from 'path';

import { BaseSkill } from '@openglove/base';

describe('BaseSkill.require', () => {
  const previousSkillsPath = process.env.SKILLS_PATH;

  beforeEach(() => {
    delete process.env.SKILLS_PATH;
  });

  afterEach(() => {
    if (previousSkillsPath === undefined) {
      delete process.env.SKILLS_PATH;
      return;
    }
    process.env.SKILLS_PATH = previousSkillsPath;
  });

  it('loads TimeSkill in Jest via cwd-based fallback paths', async () => {
    const skill = await BaseSkill.require('TimeSkill', { name: 'TimeSkill' });

    const info = await skill.getInfo();
    expect(info.name).toBe('TimeSkill');

    const canHandle = await skill.canHandle('what time is it?');
    expect(canHandle).toBe(true);
  });

  it('loads TimeSkill when SKILLS_PATH is explicitly provided', async () => {
    process.env.SKILLS_PATH = path.join(process.cwd(), 'src', 'skills');

    const skill = await BaseSkill.require('TimeSkill', { name: 'TimeSkill' });
    const info = await skill.getInfo();

    expect(info.name).toBe('TimeSkill');
  });
});