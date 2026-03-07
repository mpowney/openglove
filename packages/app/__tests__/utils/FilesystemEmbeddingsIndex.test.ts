/// <reference types="jest" />

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BaseEmbeddingsModel } from '../../src/models';
import { EmbeddingsIndexChunk } from '../../src/utils/embeddings';
import { FilesystemEmbeddingsIndex } from '../../src/utils/embeddings/FilesystemEmbeddingsIndex';

function checksum(content: string): string {
  const forwardHash = crypto.createHash('sha256').update(content).digest('hex');
  const backwardHash = crypto
    .createHash('sha256')
    .update(content.split('').reverse().join(''))
    .digest('hex');
  return `${forwardHash}-${backwardHash}`;
}

describe('FilesystemEmbeddingsIndex', () => {
  let tmpRoot: string;
  let model: BaseEmbeddingsModel;

  beforeEach(async () => {
    tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fs-index-test-'));

    model = {
      name: 'MockEmbeddingsModel',
      getConfiguredModelName: () => 'mock-model',
      embed: jest.fn().mockResolvedValue([1, 0, 0])
    } as unknown as BaseEmbeddingsModel;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.promises.rm(tmpRoot, { recursive: true, force: true });
  });

  it('uses default chunk options and resolves root path', () => {
    const index = new FilesystemEmbeddingsIndex(model, './relative/path');

    expect((index as any).chunkSize).toBe(1000);
    expect((index as any).chunkOverlap).toBe(200);
    expect((index as any).rootPath).toBe(path.resolve('./relative/path'));
  });

  it('indexes matching files recursively and skips ignored directories', async () => {
    await fs.promises.mkdir(path.join(tmpRoot, 'nested'), { recursive: true });
    await fs.promises.mkdir(path.join(tmpRoot, 'node_modules', 'pkg'), {
      recursive: true
    });
    await fs.promises.mkdir(path.join(tmpRoot, '.git'), { recursive: true });
    await fs.promises.mkdir(path.join(tmpRoot, 'dist'), { recursive: true });

    await fs.promises.writeFile(path.join(tmpRoot, 'a.md'), 'alpha', 'utf-8');
    await fs.promises.writeFile(path.join(tmpRoot, 'b.txt'), 'beta', 'utf-8');
    await fs.promises.writeFile(path.join(tmpRoot, 'nested', 'c.md'), 'gamma', 'utf-8');
    await fs.promises.writeFile(
      path.join(tmpRoot, 'node_modules', 'pkg', 'ignored.md'),
      'ignored',
      'utf-8'
    );
    await fs.promises.writeFile(path.join(tmpRoot, '.git', 'ignored.md'), 'ignored', 'utf-8');
    await fs.promises.writeFile(path.join(tmpRoot, 'dist', 'ignored.md'), 'ignored', 'utf-8');

    const index = new FilesystemEmbeddingsIndex(model, tmpRoot, {
      fileExtensions: ['.md']
    });

    jest
      .spyOn(index as any, 'loadFromSqlite')
      .mockResolvedValue([] as EmbeddingsIndexChunk[]);

    const chunkSpy = jest
      .spyOn(index as any, 'chunkItemAndGenerateEmbeddings')
      .mockResolvedValue(undefined);

    await index.index();

    const indexedNames = (chunkSpy.mock.calls as Array<[EmbeddingsIndexChunk]> )
      .map((call) => call[0].name)
      .sort();
    expect(indexedNames).toEqual(['a.md', path.join('nested', 'c.md')]);
  });

  it('reuses existing chunks when checksum already exists', async () => {
    const content = 'already-indexed';
    await fs.promises.writeFile(path.join(tmpRoot, 'note.md'), content, 'utf-8');

    const existingChunk: EmbeddingsIndexChunk = {
      name: 'old-name.md',
      checksum: checksum(content),
      modelType: 'MockEmbeddingsModel',
      modelName: 'mock-model',
      chunkIndex: 0,
      embeddings: [0.5, 0.5, 0]
    };

    const index = new FilesystemEmbeddingsIndex(model, tmpRoot, {
      fileExtensions: ['.md']
    });

    jest.spyOn(index as any, 'loadFromSqlite').mockResolvedValue([existingChunk]);

    const chunkSpy = jest
      .spyOn(index as any, 'chunkItemAndGenerateEmbeddings')
      .mockResolvedValue(undefined);

    await index.index();

    expect(chunkSpy).not.toHaveBeenCalled();
    expect(await index.getChunks()).toEqual([existingChunk]);
  });

  it('continues indexing when one file read fails', async () => {
    await fs.promises.writeFile(path.join(tmpRoot, 'good.md'), 'good-content', 'utf-8');
    await fs.promises.writeFile(path.join(tmpRoot, 'bad.md'), 'bad-content', 'utf-8');

    const index = new FilesystemEmbeddingsIndex(model, tmpRoot, {
      fileExtensions: ['.md']
    });

    jest
      .spyOn(index as any, 'loadFromSqlite')
      .mockResolvedValue([] as EmbeddingsIndexChunk[]);

    const realReadFile = fs.promises.readFile.bind(fs.promises);
    jest.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath: any, encoding: any) => {
      if (String(filePath).endsWith(path.join(tmpRoot, 'bad.md'))) {
        throw new Error('read failed');
      }
      return realReadFile(filePath, encoding) as Promise<any>;
    });

    const chunkSpy = jest
      .spyOn(index as any, 'chunkItemAndGenerateEmbeddings')
      .mockResolvedValue(undefined);

    await index.index();

    expect(chunkSpy).toHaveBeenCalledTimes(1);
    const firstCall = (chunkSpy.mock.calls as Array<[EmbeddingsIndexChunk]>)[0];
    expect(firstCall[0].name).toBe('good.md');
  });

  it('searches by similarity, deduplicates by checksum, and enforces limit', async () => {
    const embedMock = jest.fn().mockResolvedValue([[1, 0, 0]]);
    const searchModel = {
      name: 'MockEmbeddingsModel',
      getConfiguredModelName: () => 'mock-model',
      embed: embedMock
    } as unknown as BaseEmbeddingsModel;

    const index = new FilesystemEmbeddingsIndex(searchModel, tmpRoot);

    (index as any).chunks = [
      {
        name: 'exact.md',
        checksum: 'same-1',
        modelType: 'MockEmbeddingsModel',
        modelName: 'mock-model',
        chunkIndex: 0,
        embeddings: [1, 0, 0]
      },
      {
        name: 'duplicate.md',
        checksum: 'same-1',
        modelType: 'MockEmbeddingsModel',
        modelName: 'mock-model',
        chunkIndex: 1,
        embeddings: [0.9, 0.1, 0]
      },
      {
        name: 'close.md',
        checksum: 'same-2',
        modelType: 'MockEmbeddingsModel',
        modelName: 'mock-model',
        chunkIndex: 0,
        embeddings: [0.8, 0.2, 0]
      },
      {
        name: 'far.md',
        checksum: 'same-3',
        modelType: 'MockEmbeddingsModel',
        modelName: 'mock-model',
        chunkIndex: 0,
        embeddings: [0, 1, 0]
      }
    ];

    const results = await index.search('find best matches', 2);

    expect(embedMock).toHaveBeenCalledWith('find best matches');
    expect(results).toEqual([
      {
        name: 'exact.md',
        checksum: 'same-1',
        modelType: 'MockEmbeddingsModel',
        modelName: 'mock-model'
      },
      {
        name: 'close.md',
        checksum: 'same-2',
        modelType: 'MockEmbeddingsModel',
        modelName: 'mock-model'
      }
    ]);
  });
});
