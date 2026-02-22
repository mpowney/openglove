import { BaseSkill, SkillContext } from './BaseSkill';
import * as fs from 'fs';
import * as path from 'path';

export class MemoriesRetrievalSkill extends BaseSkill {
  private memoriesPath: string;

  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({
      name: opts.name ?? 'MemoriesRetrievalSkill',
      description: opts.description ?? 'Retrieves all stored memories from markdown files',
      tags: opts.tags ?? ['memories', 'recall', 'remember']
    });
    
    // Set memoriesPath from config if available, otherwise default to 'memories'
    const configPath = (this.config?.memoriesPath as string) || 'memories';
    this.memoriesPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  }

  canHandle(input: string): boolean {
    const s = (input || '').toLowerCase();
    return /\b(memories|recall|remember|stored memories|my memories|what do you remember)\b/.test(s);
  }

  async run(_input: string, _ctx?: SkillContext) {
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
          console.error(`Error reading memory file ${file}:`, error);
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
      console.error('Error retrieving memories:', error);
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
