/// <reference types="jest" />

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import { BaseTool } from '@openglove/base';

describe('BaseTool.require', () => {
  const previousToolsPath = process.env.TOOLS_PATH;

  beforeEach(() => {
    delete process.env.TOOLS_PATH;
  });

  afterEach(() => {
    if (previousToolsPath === undefined) {
      delete process.env.TOOLS_PATH;
      return;
    }
    process.env.TOOLS_PATH = previousToolsPath;
  });

  it('loads TimeTool in Jest via cwd-based fallback paths', async () => {
    const tool = await BaseTool.require('TimeTool', { name: 'TimeTool' });

    const info = await tool.getInfo();
    expect(info.name).toBe('TimeTool');

    const canHandle = await tool.canHandle('what time is it?');
    expect(canHandle).toBe(true);
  });

  it('loads TimeTool when TOOLS_PATH is explicitly provided', async () => {
    process.env.TOOLS_PATH = path.join(process.cwd(), 'src', 'tools');

    const tool = await BaseTool.require('TimeTool', { name: 'TimeTool' });
    const info = await tool.getInfo();

    expect(info.name).toBe('TimeTool');
  });

  it('loads a tool from a direct child folder under TOOLS_PATH', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openglove-tools-'));
    const toolsRoot = path.join(tempDir, 'tools');
    const nestedToolsDir = path.join(toolsRoot, 'nested');
    const toolName = 'NestedLookupTool';
    const modulePath = path.join(nestedToolsDir, `${toolName}.js`);

    fs.mkdirSync(nestedToolsDir, { recursive: true });
    fs.writeFileSync(
      modulePath,
      `module.exports = class ${toolName} {
  constructor(opts = {}) {
    this.name = opts.name;
  }
};`
    );

    process.env.TOOLS_PATH = toolsRoot;

    try {
      const tool = await BaseTool.require(toolName, { name: toolName });
      expect((tool as any).name).toBe(toolName);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});