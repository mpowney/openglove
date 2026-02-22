import { BaseSkill, SkillContext } from './BaseSkill';
import * as fs from 'fs';
import * as path from 'path';

export class MemoriesKeepSkill extends BaseSkill {
  private memoriesPath: string;

  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({
      name: opts.name ?? 'MemoriesKeepSkill',
      description: opts.description ?? 'Stores and appends memories to daily markdown files',
      tags: opts.tags ?? ['memories', 'store', 'keep', 'save memory']
    });

    // Set memoriesPath from config if available, otherwise default to 'memories'
    const configPath = (this.config?.memoriesPath as string) || 'memories';
    this.memoriesPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  }

  canHandle(input: string): boolean {
    const s = (input || '').toLowerCase();
    return /\b(remember|memorize|memorise|keep in mind|store this|save this memory|note this)\b/.test(s);
  }

  async run(input: string, _ctx?: SkillContext) {
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
        fileContent += `\n\n### Memorised at ${timeStr}\n${input}`;
      } else {
        // File doesn't exist, create with heading
        fileContent = `# ${heading}\n\n### Memorised at ${timeStr}\n${input}`;
      }

      // Write to file
      fs.writeFileSync(filePath, fileContent, 'utf-8');

      return {
        type: 'memory-stored',
        success: true,
        filename: `${dateStr}.md`,
        timestamp: `${dateStr} ${timeStr}`,
        message: `Memory stored successfully in ${dateStr}.md`
      };
    } catch (error) {
      console.error('Error storing memory:', error);
      return {
        type: 'memory-stored',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to store memory'
      };
    }
  }
}
