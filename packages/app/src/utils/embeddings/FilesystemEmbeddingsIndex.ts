import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BaseEmbeddingsModel } from '../../models/embeddings/BaseEmbeddingsModel';
import { BaseEmbeddingsIndex, EmbeddingsIndexItem, EmbeddingsIndexChunk } from './BaseEmbeddingsIndex';
import { Logger } from '@openglove/base/dist/utils/Logger';

const logger = new Logger('FilesystemEmbeddingsIndex');

/**
 * Filesystem implementation of embeddings indexing.
 * Indexes files in a directory and all subdirectories.
 */
export class FilesystemEmbeddingsIndex extends BaseEmbeddingsIndex {
  readonly category: string = 'Filesystem';

  private rootPath: string;
  private fileExtensions?: string[];
  private items: EmbeddingsIndexItem[] = [];
  private chunkSize: number;
  private chunkOverlap: number;

  /**
   * Creates a new filesystem embeddings index.
   * @param model - The embeddings model to use
   * @param rootPath - The root directory path to index
   * @param options - Configuration options
   */
  constructor(
    model: BaseEmbeddingsModel, 
    rootPath: string, 
    options?: {
      fileExtensions?: string[];
      chunkSize?: number;
      chunkOverlap?: number;
    }
  ) {
    super(model);
    this.rootPath = path.resolve(rootPath);
    this.fileExtensions = options?.fileExtensions;
    this.chunkSize = options?.chunkSize ?? 1000;
    this.chunkOverlap = options?.chunkOverlap ?? 200;
  }

  /**
   * Calculate a forward and backward hash (checksum) of content.
   * @param content - The content to hash
   * @returns Combined hash string
   */
  private calculateChecksum(content: string): string {
    const forwardHash = crypto.createHash('sha256').update(content).digest('hex');
    const backwardHash = crypto.createHash('sha256').update(content.split('').reverse().join('')).digest('hex');
    return `${forwardHash}-${backwardHash}`;
  }

  /**
   * Filter array to unique items based on a property selector.
   * @param array - The array to filter
   * @param keySelector - Function to extract the unique key from each item
   * @returns Array with unique items (keeps first occurrence)
   */
  private uniqueBy<T, K>(array: T[], keySelector: (item: T) => K): T[] {
    const seen = new Set<K>();
    const result: T[] = [];
    
    for (const item of array) {
      const key = keySelector(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    
    return result;
  }

  /**
   * Recursively get all files in a directory.
   * @param dir - Directory to scan
   * @returns Array of absolute file paths
   */
  private async getFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip common directories that shouldn't be indexed
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }
        files.push(...await this.getFilesRecursively(fullPath));
      } else if (entry.isFile()) {
        // Filter by file extension if specified
        if (this.fileExtensions) {
          const ext = path.extname(entry.name);
          if (this.fileExtensions.includes(ext)) {
            files.push(fullPath);
          }
        } else {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  /**
   * Index all files in the root directory and subdirectories.
   * Content is chunked according to chunkSize and chunkOverlap settings.
   * Skips generating embeddings for files with checksums that already exist in SQLite.
   */
  async index(): Promise<void> {
    this.items = [];
    await this.index();
    
    // Load existing chunks from SQLite to check for existing checksums
    const existingChunks = await this.loadFromSqlite();
    const existingChecksums = new Set(existingChunks.map(chunk => chunk.checksum));
    logger.log(`Loaded ${existingChunks.length} existing chunks with ${existingChecksums.size} unique checksums`);
    
    const files = await this.getFilesRecursively(this.rootPath);
    
    for (const filePath of files) {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const relativePath = path.relative(this.rootPath, filePath);
        const checksum = this.calculateChecksum(content);
        
        // Check if this checksum already exists in the database
        if (existingChecksums.has(checksum)) {
          logger.log(`Skipping ${relativePath} - checksum already exists`);
          // Reuse existing chunks for this checksum
          const reusedChunks = existingChunks.filter(chunk => chunk.checksum === checksum);
          this.chunks.push(...reusedChunks);
          continue;
        }
        
        // Create the EmbeddingsIndexItem for the full file
        const item: EmbeddingsIndexItem = {
          name: relativePath,
          checksum,
          modelType: this.model.name || this.model.constructor.name,
          modelName: this.model.getConfiguredModelName?.() || 'unknown',
        };
        
        logger.log(`Chunking and generating embeddings for ${relativePath}`);
        // Process the item into chunks
        await this.chunkItemAndGenerateEmbeddings(item, content, this.chunkSize, this.chunkOverlap);

      } catch (error) {
        logger.error(`Error indexing file ${filePath}:`, error);
      }
    }
  }

  /**
   * Get all indexed items (without chunk-specific embeddings).
   * @returns Array of unique indexed items
   */
  async getItems(): Promise<EmbeddingsIndexItem[]> {
    return this.items;
  }


  /**
   * Search for file chunks similar to the given query using cosine similarity.
   * @param query - The search query
   * @param limit - Maximum number of results to return (default: 10)
   * @returns Array of matching chunks sorted by similarity score (highest first)
   */
  async search(query: string, limit: number = 10): Promise<EmbeddingsIndexItem[]> {
    // Generate embeddings for the query
    const queryEmbeddings = await this.model.embed(query);
    const queryVector = Array.isArray(queryEmbeddings[0]) 
      ? (queryEmbeddings as number[][])[0] 
      : queryEmbeddings as number[];
    
    // Calculate cosine similarity for each item
    const resultChunks = this.chunks.map(chunk => ({
      ...chunk,
      similarity: this.cosineSimilarity(queryVector, chunk.embeddings)
    }));
    
    // Sort by similarity (highest first) and return top results
    const results = resultChunks.map(chunk => { 
      return { 
        name: chunk.name, 
        checksum: chunk.checksum, 
        modelType: chunk.modelType, 
        modelName: chunk.modelName, 
        similarity: chunk.similarity 
      }; 
    }).sort((a, b) => b.similarity - a.similarity);
    
    // Filter to unique items by checksum
    const uniqueResults = this.uniqueBy(results, item => item.checksum);
    
    return uniqueResults
      .slice(0, limit)
      .map(result => ({ 
        name: result.name, 
        checksum: result.checksum, 
        modelType: result.modelType, 
        modelName: result.modelName 
      }));
  }
}
