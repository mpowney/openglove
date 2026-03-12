import { BaseTool, loadConfig, Logger, ToolContext } from '@openglove/base';
import * as fs from 'fs';
import * as path from 'path';
import { BaseEmbeddingsModel } from '../models';
import { FilesystemEmbeddingsIndex } from '../utils/embeddings';

const logger = new Logger('MemoriesRetrievalTool');

export class MemoriesRetrievalTool extends BaseTool {
  private memoriesPath: string;

  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({
      name: opts.name ?? 'MemoriesRetrievalTool',
      description: opts.description ?? 'Retrieves all stored memories from markdown files',
      parameterSchema: '{}',
      tags: opts.tags ?? ['memories', 'recall', 'remember']
    });
    
    // Set memoriesPath from config if available, otherwise default to 'memories'
    const configPath = (this.config?.memoriesPath as string) || 'memories';
    this.memoriesPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  }

  async canHandle(input: string): Promise<boolean> {
    const s = (input || '').toLowerCase();
    return /\b(memories|recall|remember|stored memories|my memories|what do you remember)\b/.test(s);
  }

  protected async runTool(_input: any, _ctx?: ToolContext) {
    // Extract string input if provided in object format (not used in this tool but kept for consistency)
    const inputStr = typeof _input === 'object' && _input?.input ? _input.input : _input;
    
    try {
      // Check if memories directory exists
      if (!fs.existsSync(this.memoriesPath)) {
        return {
          type: 'memories',
          success: true,
          memories: [],
          message: 'No memories folder found. Creating one...',
          count: 0
        };
      }

      if (inputStr) {
        logger.log(`Retrieving memories with input: ${inputStr}`);

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
        const files = await fsIndexer.search(inputStr, 10); // Search for relevant memories based on input
        return {
          type: 'memories',
          success: true,
          memories: files.map(file => { 
            const filePath = path.join(this.memoriesPath, file.name);
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              return { filename: file.name, content } 
            } catch (error) {
              logger.error(`Error reading memory file ${file.name}:`, error);
              return { filename: file.name, content: '' };
            }
          }),
          count: files.length,
          message: `Retrieved ${files.length} relevant memory file(s) based on input`
        };        
      }

      logger.log('Retrieving memories with no specific input');

      // Read all files in the memories directory
      const files = fs.readdirSync(this.memoriesPath);
      const markdownFiles = files.filter(file => file.endsWith('.md'));

      // Read content of each markdown file
      const memories: Array<{ filename: string; content: string }> = [];

      for (const file of markdownFiles) {
        const filePath = path.join(this.memoriesPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          memories.push({
            filename: file,
            content: content
          });
        } catch (error) {
          logger.error(`Error reading memory file ${file}:`, error);
        }
      }

      return {
        type: 'memories',
        success: true,
        memories: memories,
        count: memories.length,
        message: `Retrieved ${memories.length} memory file(s)`
      };
    } catch (error) {
      logger.error('Error retrieving memories:', error);
      return {
        type: 'memories',
        success: false,
        memories: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to retrieve memories'
      };
    }
  }
}
