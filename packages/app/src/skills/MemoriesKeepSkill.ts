import { BaseSkill, loadConfig, Logger, SkillContext } from '@openglove/base';
import * as fs from 'fs';
import * as path from 'path';
import { FilesystemEmbeddingsIndex } from '../utils/embeddings';
import { BaseEmbeddingsModel } from '../models';

const logger = new Logger('MemoriesKeepSkill');

export class MemoriesKeepSkill extends BaseSkill {
  private memoriesPath: string;

  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({
      name: opts.name ?? 'MemoriesKeepSkill',
      description: opts.description ?? 'Stores and appends memories to daily markdown files',
      parameterSchema: '{ input: string }',
      tags: opts.tags ?? ['memories', 'store', 'keep', 'save memory']
    });

    // Set memoriesPath from config if available, otherwise default to 'memories'
    const configPath = (this.config?.memoriesPath as string) || 'memories';
    this.memoriesPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  }

  async canHandle(input: string): Promise<boolean> {
    const s = (input || '').toLowerCase();
    return /\b(remember|memorize|memorise|keep in mind|store this|save this memory|note this)\b/.test(s);
  }

  protected async runSkill(input: any, _ctx?: SkillContext) {
    // Extract string input if provided in object format
    const inputStr = typeof input === 'object' && input?.input ? input.input : input;
    
    try {
      // Ensure memories directory exists
      if (!fs.existsSync(this.memoriesPath)) {
        fs.mkdirSync(this.memoriesPath, { recursive: true });
      }

      // Get current date and time
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // yyyy-mm-dd format
      const timeStr = now.toTimeString().split(' ')[0]; // hh:mm:ss format

      // Format heading with day of week, day, month, year
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
      const day = now.toLocaleDateString('en-US', { day: 'numeric' });
      const month = now.toLocaleDateString('en-US', { month: 'long' });
      const year = now.getFullYear();
      const heading = `Memories for ${dayOfWeek} ${day} ${month} ${year}`;

      // File path for today's memories
      const filePath = path.join(this.memoriesPath, `${dateStr}.md`);

      // Initialize or append to file
      let fileContent: string;
      if (fs.existsSync(filePath)) {
        // File exists, read and append
        fileContent = fs.readFileSync(filePath, 'utf-8');
        fileContent += `\n\n### Memorised at ${timeStr}\n${inputStr}`;
      } else {
        // File doesn't exist, create with heading
        fileContent = `# ${heading}\n\n### Memorised at ${timeStr}\n${inputStr}`;
      }

      // Write to file
      fs.writeFileSync(filePath, fileContent, 'utf-8');

      const config = loadConfig('memoriesSkills.json');
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
        type: 'memoryKept',
        success: true,
        filename: `${dateStr}.md`,
        timestamp: `${dateStr} ${timeStr}`,
        message: `Memory stored successfully in ${dateStr}.md`
      };
    } catch (error) {
      logger.error('Error storing memory:', error);
      return {
        type: 'memoryKept',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to store memory'
      };
    }
  }
}
