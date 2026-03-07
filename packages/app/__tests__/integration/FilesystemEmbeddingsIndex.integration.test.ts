/// <reference types="jest" />

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { OllamaEmbeddingsModel } from '../../src/models/embeddings/OllamaEmbeddingsModel';
import { FilesystemEmbeddingsIndex } from '../../src/utils/embeddings/FilesystemEmbeddingsIndex';
import { fetchWithTimeout } from '../../src/utils/Fetch';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_EMBEDDINGS_MODEL =
  process.env.OLLAMA_EMBEDDINGS_MODEL || 'nomic-embed-text';

jest.setTimeout(120000);

describe('FilesystemEmbeddingsIndex real Ollama integration', () => {
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

  it('indexes local files and returns semantic search results using Ollama embeddings', async () => {
    if (!serviceAvailable || !modelAvailable) {
      console.warn(
        `Skipping integration test: Ollama not ready at ${OLLAMA_URL} with model ${OLLAMA_EMBEDDINGS_MODEL}.`
      );
      return;
    }

    const tmpRoot = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'fs-index-ollama-integration-')
    );

    const uniqueToken = `token-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    const matchingFile = `match-${uniqueToken}.md`;
    const otherFile = `other-${uniqueToken}.md`;

    try {
      await fs.promises.writeFile(
        path.join(tmpRoot, matchingFile),
        `This note is about ${uniqueToken} and filesystem embeddings integration.`,
        'utf-8'
      );
      await fs.promises.writeFile(
        path.join(tmpRoot, otherFile),
        'This file discusses gardening and weather patterns only.',
        'utf-8'
      );

      const model = new OllamaEmbeddingsModel({
        baseUrl: OLLAMA_URL,
        model: OLLAMA_EMBEDDINGS_MODEL
      });

      const index = new FilesystemEmbeddingsIndex(model, tmpRoot, {
        fileExtensions: ['.md'],
        chunkSize: 300,
        chunkOverlap: 30
      });

      await index.index();

      const chunks = await index.getChunks();
      expect(chunks.length).toBeGreaterThan(0);

      const results = await index.search(uniqueToken, 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results.map((r) => r.name)).toContain(matchingFile);
    } finally {
      await fs.promises.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
