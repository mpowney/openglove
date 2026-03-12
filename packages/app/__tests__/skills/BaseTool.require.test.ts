/// <reference types="jest" />

import * as path from 'path';

import { BaseTool } from '@openglove/base';

describe('BaseTool.require', () => {
  const previousToolsPath = process.env.SKILLS_PATH;

  beforeEach(() => {
    delete process.env.SKILLS_PATH;
  });

  afterEach(() => {
    if (previousToolsPath === undefined) {
      delete process.env.SKILLS_PATH;
      return;
    }
    process.env.SKILLS_PATH = previousToolsPath;
  });

  it('loads TimeTool in Jest via cwd-based fallback paths', async () => {
    const skill = await BaseTool.require('TimeTool', { name: 'TimeTool' });

    const info = await skill.getInfo();
    expect(info.name).toBe('TimeTool');

    const canHandle = await skill.canHandle('what time is it?');
    expect(canHandle).toBe(true);
  });

  it('loads TimeTool when SKILLS_PATH is explicitly provided', async () => {
    process.env.SKILLS_PATH = path.join(process.cwd(), 'src', 'skills');

    const skill = await BaseTool.require('TimeTool', { name: 'TimeTool' });
    const info = await skill.getInfo();

    expect(info.name).toBe('TimeTool');
  });
});