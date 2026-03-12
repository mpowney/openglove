import { BaseTool, loadConfig, Logger, ToolContext } from '@openglove/base';
import * as fs from 'fs';
import * as path from 'path';
import { BaseEmbeddingsModel } from '../models';
import { FilesystemEmbeddingsIndex } from '../utils/embeddings';

const logger = new Logger('MemoriesIndexTool');

export class MemoriesIndexTool extends BaseTool {
  private memoriesPath: string;

  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({
      name: opts.name ?? 'MemoriesIndexTool',
      description: opts.description ?? 'Re-indexes all memories files to update the embeddings index',
      parameterSchema: '{ input: string }',
      tags: opts.tags ?? ['memories', 'store', 'keep', 'save memory']
    });

    // Set memoriesPath from config if available, otherwise default to 'memories'
    const configPath = (this.config?.memoriesPath as string) || 'memories';
    this.memoriesPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  }
  async canHandle(input: string): Promise<boolean> {
    const s = (input || '').toLowerCase();
    return /\b(index memory|reindex memory)\b/.test(s);
  }

  protected async runTool(input: any, _ctx?: ToolContext) {
    // Extract string input if provided in object format
    const inputStr = typeof input === 'object' && input?.input ? input.input : input;
    
    try {
      // Ensure memories directory exists
      if (!fs.existsSync(this.memoriesPath)) {
        fs.mkdirSync(this.memoriesPath, { recursive: true });
      }

      const config = loadConfig('memoriesTools.json');
      const modelType = config?.modelType || 'OllamaEmbeddingsModel';
      const modelConfig = config?.modelConfig || {};

      const model = await BaseEmbeddingsModel.require(modelType, modelConfig)
      const fsIndexer = new FilesystemEmbeddingsIndex(
        model, 
        this.memoriesPath,
        {
            fileExtensions:['.md'],
            chunkSize: 500,
            chunkOverlap: 50
        }
      );
      await fsIndexer.index(); // Index the memories directory after writing the new memory

      return {
        type: 'memoriesIndex',
        success: true,
        message: 'Memories re-indexed successfully'
      };
    } catch (e) {
      logger.error('Failed to index memories', e);
      return {
        type: 'memoriesIndex',
        success: false,
        message: 'Failed to index memories'
      };
    }

  }
}