import { BaseSkill, Logger, SkillContext } from '@openglove/base';
import * as fs from 'fs';
import * as path from 'path';
import { BaseEmbeddingsModel } from '../models';

const logger = new Logger('MemoriesIndexSkill');

export class MemoriesIndexSkill extends BaseSkill {
  private memoriesPath: string;
  private embeddingsModel?: BaseEmbeddingsModel;

  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({
      name: opts.name ?? 'MemoriesIndexSkill',
      description: opts.description ?? 'Re-indexes all memories files to update the embeddings index',
      paramaterSchema: '{ input: string }',
      tags: opts.tags ?? ['memories', 'store', 'keep', 'save memory']
    });

    // Set memoriesPath from config if available, otherwise default to 'memories'
    const configPath = (this.config?.memoriesPath as string) || 'memories';
    this.memoriesPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);

    (async () => {
      // Set embeddingsModelName from config if available, otherwise default to 'OllamaEmbeddingsModel'
      this.embeddingsModel = await BaseEmbeddingsModel.require(this.config?.embeddingsModelName || 'OllamaEmbeddingsModel');
    })();
  }
  async canHandle(input: string): Promise<boolean> {
    const s = (input || '').toLowerCase();
    return /\b(index memory|reindex memory)\b/.test(s);
  }

  protected async runSkill(input: any, _ctx?: SkillContext) {
    // Extract string input if provided in object format
    const inputStr = typeof input === 'object' && input?.input ? input.input : input;
    
    try {
      // Ensure memories directory exists
      if (!fs.existsSync(this.memoriesPath)) {
        fs.mkdirSync(this.memoriesPath, { recursive: true });
      }

    } catch (e) {
      logger.error('Failed to ensure memories directory exists', e);
      throw new Error('Failed to access memories directory');
    }

  }
}