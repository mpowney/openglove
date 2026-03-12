/// <reference types="jest" />

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { MemoriesKeepTool } from '../../src/skills/MemoriesKeepTool';
import { MemoriesRetrievalTool } from '../../src/skills/MemoriesRetrievalTool';
import { fetchWithTimeout } from '../../src/utils/Fetch';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_EMBEDDINGS_MODEL =
  process.env.OLLAMA_EMBEDDINGS_MODEL || 'nomic-embed-text';

jest.setTimeout(120000);

describe('Memories keep/retrieve integration with Ollama embeddings', () => {
  let serviceAvailable = false;
  let modelAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetchWithTimeout(
        `${OLLAMA_URL}/api/tags`,
        'GET',
        {},
        undefined,
        5000
      );

      if (!response || !response.ok) {
        serviceAvailable = false;
        modelAvailable = false;
        return;
      }

      serviceAvailable = true;

      const body = await response.text();
      let tags: any = null;
      try {
        tags = JSON.parse(body);
      } catch (_e) {
        tags = null;
      }

      const models = Array.isArray(tags?.models) ? tags.models : [];
      modelAvailable = models.some((m: any) => {
        const name = String(m?.name || '');
        const model = String(m?.model || '');
        return (
          name === OLLAMA_EMBEDDINGS_MODEL ||
          model === OLLAMA_EMBEDDINGS_MODEL ||
          name.startsWith(`${OLLAMA_EMBEDDINGS_MODEL}:`) ||
          model.startsWith(`${OLLAMA_EMBEDDINGS_MODEL}:`)
        );
      });
    } catch (_e) {
      serviceAvailable = false;
      modelAvailable = false;
    }
  });

  it('should confirm Ollama service and model availability', () => {
    if (!serviceAvailable) {
      console.warn(`Ollama service is not available at ${OLLAMA_URL}. Skipping memories keep/retrieve integration test.`);
    } else if (!modelAvailable) {
      console.warn(`Ollama embeddings model "${OLLAMA_EMBEDDINGS_MODEL}" is not available. Skipping memories keep/retrieve integration test.`);
    }
    expect(serviceAvailable).toBe(true);
    expect(modelAvailable).toBe(true);
  });

  it('keeps a memory and retrieves it by search query', async () => {
    const previousCwd = process.cwd();
    const previousToolsConfigPath = process.env.SKILLS_CONFIG_PATH;
    const tmpRoot = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'memories-keep-retrieve-integration-')
    );

    try {
      process.chdir(tmpRoot);

      const memoriesPath = path.join(tmpRoot, 'memories');
      const sqlitePath = path.join(tmpRoot, 'data', 'embeddings.db');
      const skillsConfigPath = path.join(tmpRoot, 'skills.integration.json');

      await fs.promises.writeFile(
        skillsConfigPath,
        JSON.stringify(
          {
            MemoriesKeepTool: { memoriesPath },
            MemoriesRetrievalTool: { memoriesPath }
          },
          null,
          2
        ),
        'utf-8'
      );

      await fs.promises.writeFile(
        path.join(tmpRoot, 'memoriesTools.json'),
        JSON.stringify(
          {
            modelType: 'OllamaEmbeddingsModel',
            modelConfig: {
              baseUrl: OLLAMA_URL,
              model: OLLAMA_EMBEDDINGS_MODEL
            }
          },
          null,
          2
        ),
        'utf-8'
      );

      await fs.promises.writeFile(
        path.join(tmpRoot, 'sqlite.json'),
        JSON.stringify({ databasePath: sqlitePath }, null, 2),
        'utf-8'
      );

      process.env.SKILLS_CONFIG_PATH = skillsConfigPath;

      const keepTool = new MemoriesKeepTool();
      const retrievalTool = new MemoriesRetrievalTool();

      const uniqueToken = `memory-token-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      const memoryText = `Remember this integration memory: ${uniqueToken}`;

      const keepResult = await keepTool.run(memoryText);
      expect(keepResult.success).toBe(true);
      expect(keepResult.type).toBe('memoryKept');

      const retrievalResult = await retrievalTool.run(uniqueToken);
      expect(retrievalResult.success).toBe(true);
      expect(retrievalResult.type).toBe('memories');
      expect(retrievalResult.count).toBeGreaterThan(0);

      const retrievedContents = retrievalResult.memories.map(
        (m: { filename: string; content: string }) => m.content
      );
      const found = retrievedContents.some((content: string) =>
        content.includes(uniqueToken)
      );
      expect(found).toBe(true);
    } finally {
      if (previousToolsConfigPath === undefined) {
        delete process.env.SKILLS_CONFIG_PATH;
      } else {
        process.env.SKILLS_CONFIG_PATH = previousToolsConfigPath;
      }

      process.chdir(previousCwd);
      await fs.promises.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
