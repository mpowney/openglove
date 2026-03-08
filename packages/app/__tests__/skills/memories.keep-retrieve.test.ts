/// <reference types="jest" />

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BaseEmbeddingsModel } from '../../src/models';
import { MemoriesKeepSkill } from '../../src/skills/MemoriesKeepSkill';
import { MemoriesRetrievalSkill } from '../../src/skills/MemoriesRetrievalSkill';
import { FilesystemEmbeddingsIndex } from '../../src/utils/embeddings';

describe('Memories keep and retrieve flow', () => {
  let tmpRoot: string;
  let memoriesDir: string;
  let skillsConfigPath: string;
  let previousSkillsConfigPath: string | undefined;

  beforeEach(async () => {
    tmpRoot = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'memories-keep-retrieve-test-')
    );
    memoriesDir = path.join(tmpRoot, 'memories');
    skillsConfigPath = path.join(tmpRoot, 'skills.test.json');

    await fs.promises.writeFile(
      skillsConfigPath,
      JSON.stringify(
        {
          MemoriesKeepSkill: {
            memoriesPath: memoriesDir
          },
          MemoriesRetrievalSkill: {
            memoriesPath: memoriesDir
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    previousSkillsConfigPath = process.env.SKILLS_CONFIG_PATH;
    process.env.SKILLS_CONFIG_PATH = skillsConfigPath;

    const mockModel = {
      name: 'MockEmbeddingsModel',
      getConfiguredModelName: () => 'mock-embeddings',
      embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
    } as any;

    jest.spyOn(BaseEmbeddingsModel, 'require').mockResolvedValue(mockModel);
    jest
      .spyOn(FilesystemEmbeddingsIndex.prototype, 'index')
      .mockResolvedValue(undefined);
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();

    if (previousSkillsConfigPath === undefined) {
      delete process.env.SKILLS_CONFIG_PATH;
    } else {
      process.env.SKILLS_CONFIG_PATH = previousSkillsConfigPath;
    }

    await fs.promises.rm(tmpRoot, { recursive: true, force: true });
  });

  it('stores a memory with MemoriesKeepSkill and retrieves it with MemoriesRetrievalSkill', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-08T11:22:33Z'));

    const keepSkill = new MemoriesKeepSkill();
    const retrievalSkill = new MemoriesRetrievalSkill();

    const memoryText = 'Remember that alpha project launch is on Friday.';

    const keepResult = await keepSkill.run(memoryText);
    expect(keepResult.success).toBe(true);
    expect(keepResult.type).toBe('memoryKept');

    const memoryFiles = await fs.promises.readdir(memoriesDir);
    const markdownFiles = memoryFiles.filter((f) => f.endsWith('.md'));
    expect(markdownFiles.length).toBe(1);

    const retrievalResult = await retrievalSkill.run('');
    expect(retrievalResult.success).toBe(true);
    expect(retrievalResult.type).toBe('memories');
    expect(retrievalResult.count).toBe(1);
    expect(retrievalResult.memories[0].filename).toBe(markdownFiles[0]);
    expect(retrievalResult.memories[0].content).toContain(memoryText);
  });

  it('supports object input for keep and returns it through retrieval', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-08T12:00:00Z'));

    const keepSkill = new MemoriesKeepSkill();
    const retrievalSkill = new MemoriesRetrievalSkill();

    const memoryText = 'Store this: battery test passed on bench 3.';

    const keepResult = await keepSkill.run({ input: memoryText });
    expect(keepResult.success).toBe(true);

    const retrievalResult = await retrievalSkill.run('');
    expect(retrievalResult.success).toBe(true);
    expect(retrievalResult.count).toBe(1);
    expect(retrievalResult.memories[0].content).toContain(memoryText);
  });
});
