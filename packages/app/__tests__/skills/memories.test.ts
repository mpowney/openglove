/// <reference types="jest" />

import * as fs from 'fs';
import * as path from 'path';

import { MemoriesIndexTool } from '../../src/skills/MemoriesIndexTool';
import { MemoriesKeepTool } from '../../src/skills/MemoriesKeepTool';
import { MemoriesRetrievalTool } from '../../src/skills/MemoriesRetrievalTool';
import { BaseEmbeddingsModel } from '../../src/models';
import { FilesystemEmbeddingsIndex } from '../../src/utils/embeddings';

// Mock dependencies
jest.mock('fs');
jest.mock('../../src/models');
jest.mock('../../src/utils/embeddings');
jest.mock('@openglove/base', () => ({
  loadConfig: jest.fn(() => ({
    modelType: 'OllamaEmbeddingsModel',
    memoriesPath: './test-memories'
  })),
  Logger: jest.fn(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn()
  })),
  BaseTool: class {
    name: string;
    description: string;
    config: any;

    constructor(opts: any) {
      this.name = opts.name;
      this.description = opts.description;
      this.config = opts.config;
    }

    async run(input: any, ctx?: any): Promise<any> {
      return (this as any).runTool(input, ctx);
    }

    protected async runTool(_input: any, _ctx?: any): Promise<any> {
      throw new Error('runTool must be implemented by subclass');
    }
  }
}));

// Type definitions for mocked modules
const mockFs = fs as jest.Mocked<typeof fs>;
const mockBaseEmbeddingsModel = BaseEmbeddingsModel as unknown as { require: jest.Mock };
const mockFilesystemEmbeddingsIndex = FilesystemEmbeddingsIndex as jest.MockedClass<
  typeof FilesystemEmbeddingsIndex
>;

describe('Memory Tools', () => {
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = path.join(__dirname, 'test-memories');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('MemoriesIndexTool', () => {
    let skill: MemoriesIndexTool;

    beforeEach(() => {
      skill = new MemoriesIndexTool();
    });

    describe('canHandle', () => {
      it('should handle "index memory" input', async () => {
        const result = await skill.canHandle('index memory');
        expect(result).toBe(true);
      });

      it('should handle "reindex memory" input', async () => {
        const result = await skill.canHandle('reindex memory');
        expect(result).toBe(true);
      });

      it('should handle input with "index memory" in mixed case', async () => {
        const result = await skill.canHandle('Please INDEX MEMORY for me');
        expect(result).toBe(true);
      });

      it('should not handle unrelated input', async () => {
        const result = await skill.canHandle('what is the weather');
        expect(result).toBe(false);
      });

      it('should not handle empty input', async () => {
        const result = await skill.canHandle('');
        expect(result).toBe(false);
      });
    });

    describe('run', () => {
      it('should successfully index memories', async () => {
        // Mock fs operations
        mockFs.existsSync.mockReturnValue(true);
        mockFs.mkdirSync.mockImplementation(() => '');

        // Mock embeddings model and indexer
        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        const result = await skill.run('index memories');

        expect(result.type).toBe('memoriesIndex');
        expect(result.success).toBe(true);
        expect(result.message).toBe('Memories re-indexed successfully');
        expect(mockIndexer.index).toHaveBeenCalled();
      });

      it('should create memories directory if it does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => '');

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        await skill.run('index memories');

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('memories'),
          { recursive: true }
        );
      });

      it('should handle indexing errors gracefully', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const mockIndexer = {
          index: jest.fn().mockRejectedValue(new Error('Index failed'))
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        const result = await skill.run('index memories');

        expect(result.success).toBe(false);
        expect(result.message).toBe('Failed to index memories');
      });

      it('should handle string input directly', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        const result = await skill.run('index memories');

        expect(result.success).toBe(true);
      });

      it('should handle object input with input property', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        const result = await skill.run({ input: 'index memories' });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('MemoriesKeepTool', () => {
    let skill: MemoriesKeepTool;

    beforeEach(() => {
      skill = new MemoriesKeepTool();
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-05T10:30:45'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('canHandle', () => {
      it('should handle "remember" input', async () => {
        const result = await skill.canHandle('remember to buy groceries');
        expect(result).toBe(true);
      });

      it('should handle "memorize" input', async () => {
        const result = await skill.canHandle('memorize this fact');
        expect(result).toBe(true);
      });

      it('should handle "keep in mind" input', async () => {
        const result = await skill.canHandle('keep in mind the deadline');
        expect(result).toBe(true);
      });

      it('should handle "store this" input', async () => {
        const result = await skill.canHandle('store this information');
        expect(result).toBe(true);
      });

      it('should handle "save this memory" input', async () => {
        const result = await skill.canHandle('save this memory for later');
        expect(result).toBe(true);
      });

      it('should handle "note this" input', async () => {
        const result = await skill.canHandle('note this down');
        expect(result).toBe(true);
      });

      it('should not handle unrelated input', async () => {
        const result = await skill.canHandle('what time is it');
        expect(result).toBe(false);
      });
    });

    describe('run', () => {
      it('should create new memory file if it does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => '');
        mockFs.writeFileSync.mockImplementation(() => {});

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        const result = await skill.run('Remember to call mom');

        expect(result.type).toBe('memoryKept');
        expect(result.success).toBe(true);
        expect(result.message).toContain('Memory stored successfully');
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });

      it('should append to existing memory file', async () => {
        const existingContent = '# Memories for Thursday 5 March 2026\n\n### Memorised at 09:00:00\nOld memory';
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(existingContent);
        mockFs.writeFileSync.mockImplementation(() => {});

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        const result = await skill.run('New memory to add');

        expect(result.success).toBe(true);
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringMatching(/\d{4}-\d{2}-\d{2}\.md$/),
          expect.stringContaining('New memory to add'),
          'utf-8'
        );
      });

      it('should include timestamp in memory entry', async () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => '');
        mockFs.writeFileSync.mockImplementation(() => {});

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        await skill.run('Test memory');

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('10:30:45'),
          'utf-8'
        );
      });

      it('should handle object input with input property', async () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => '');
        mockFs.writeFileSync.mockImplementation(() => {});

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        const result = await skill.run({ input: 'Remember this' });

        expect(result.success).toBe(true);
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Remember this'),
          'utf-8'
        );
      });

      it('should handle write errors gracefully', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.writeFileSync.mockImplementation(() => {
          throw new Error('Write failed');
        });

        const result = await skill.run('Test memory');

        expect(result.success).toBe(false);
        expect(result.message).toBe('Failed to store memory');
        expect(result.error).toBeDefined();
      });

      it('should index after storing memory', async () => {
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => '');
        mockFs.writeFileSync.mockImplementation(() => {});

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined)
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        await skill.run('Memory content');

        expect(mockIndexer.index).toHaveBeenCalled();
      });
    });
  });

  describe('MemoriesRetrievalTool', () => {
    let skill: MemoriesRetrievalTool;

    beforeEach(() => {
      skill = new MemoriesRetrievalTool();
    });

    describe('canHandle', () => {
      it('should handle "memories" input', async () => {
        const result = await skill.canHandle('what memories do I have');
        expect(result).toBe(true);
      });

      it('should handle "recall" input', async () => {
        const result = await skill.canHandle('can you recall my data');
        expect(result).toBe(true);
      });

      it('should handle "remember" input', async () => {
        const result = await skill.canHandle('do you remember');
        expect(result).toBe(true);
      });

      it('should handle "stored memories" input', async () => {
        const result = await skill.canHandle('show stored memories');
        expect(result).toBe(true);
      });

      it('should handle "my memories" input', async () => {
        const result = await skill.canHandle('my memories');
        expect(result).toBe(true);
      });

      it('should handle "what do you remember" input', async () => {
        const result = await skill.canHandle('what do you remember about me');
        expect(result).toBe(true);
      });

      it('should not handle unrelated input', async () => {
        const result = await skill.canHandle('what is the capital of France');
        expect(result).toBe(false);
      });
    });

    describe('run', () => {
      it('should return empty memories if directory does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = await skill.run('');

        expect(result.type).toBe('memories');
        expect(result.success).toBe(true);
        expect(result.memories).toEqual([]);
        expect(result.count).toBe(0);
        expect(result.message).toContain('No memories folder found');
      });

      it('should retrieve all memory files if no input', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue(['2026-03-04.md', '2026-03-05.md'] as any);
        mockFs.readFileSync.mockReturnValue('Memory content');

        const result = await skill.run('');

        expect(result.success).toBe(true);
        expect(result.memories.length).toBe(2);
        expect(result.count).toBe(2);
      });

      it('should filter only markdown files', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue(
          ['2026-03-04.md', 'notes.txt', '2026-03-05.md'] as any
        );
        mockFs.readFileSync.mockReturnValue('Memory content');

        const result = await skill.run('');

        expect(result.memories.length).toBe(2);
        expect(result.count).toBe(2);
      });

      it('should handle search with input', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined),
          search: jest.fn().mockResolvedValue([
            { name: '2026-03-05.md', checksum: 'abc123' }
          ])
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        mockFs.readFileSync.mockReturnValue('Searched memory content');

        const result = await skill.run('search query');

        expect(result.success).toBe(true);
        expect(result.memories.length).toBe(1);
        expect(mockIndexer.index).toHaveBeenCalled();
        expect(mockIndexer.search).toHaveBeenCalledWith('search query', 10);
      });

      it('should handle object input with input property', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue(['2026-03-05.md'] as any);
        mockFs.readFileSync.mockReturnValue('Memory content');

        const result = await skill.run({ input: '' });

        expect(result.success).toBe(true);
        expect(result.memories.length).toBe(1);
      });

      it('should include file content in results', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue(['2026-03-05.md'] as any);
        const fileContent = '# Memories for Thursday 5 March 2026\n\nSome memory';
        mockFs.readFileSync.mockReturnValue(fileContent);

        const result = await skill.run('');

        expect(result.memories[0].filename).toBe('2026-03-05.md');
        expect(result.memories[0].content).toBe(fileContent);
      });

      it('should handle errors when reading files', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue(['2026-03-05.md'] as any);
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('Read failed');
        });

        const result = await skill.run('');

        expect(result.success).toBe(true);
        expect(result.memories).toEqual([]);
        expect(result.count).toBe(0);
      });

      it('should handle general retrieval errors', async () => {
        mockFs.existsSync.mockImplementation(() => {
          throw new Error('Fs error');
        });

        const result = await skill.run('');

        expect(result.success).toBe(false);
        expect(result.memories).toEqual([]);
        expect(result.count).toBe(0);
        expect(result.message).toBe('Failed to retrieve memories');
      });

      it('should search up to limit of 10 results', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const mockIndexer = {
          index: jest.fn().mockResolvedValue(undefined),
          search: jest.fn().mockResolvedValue([])
        };

        mockBaseEmbeddingsModel.require.mockResolvedValue({} as any);
        (mockFilesystemEmbeddingsIndex as any).mockImplementation(
          () => mockIndexer
        );

        await skill.run('search term');

        expect(mockIndexer.search).toHaveBeenCalledWith('search term', 10);
      });
    });
  });
});
