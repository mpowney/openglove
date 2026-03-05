import { BaseEmbeddingsModel } from '../../models/embeddings/BaseEmbeddingsModel';
import { loadConfig } from '@openglove/base';
import Database from 'better-sqlite3';

/**
 * Interface representing an item in the embeddings index.
 */
export interface EmbeddingsIndexItem {
  /**
   * Name of the item (e.g., relative filename for filesystem implementation).
   */
  name: string;

  /**
   * Checksum representing a forward and backward hash of the item's content.
   */
  checksum: string;

  /**
   * Type of the embeddings model used.
   */
  modelType: string;

  /**
   * Name of the embeddings model used.
   */
  modelName: string;

}

/**
 * Interface representing a chunk of an indexed item.
 * Extends EmbeddingsIndexItem with chunk-specific information.
 */
export interface EmbeddingsIndexChunk extends EmbeddingsIndexItem {
  /**
   * 0-based index of this chunk within the parent item.
   */
  chunkIndex: number;
  /**
   * The embedding vector for this item.
   */
  embeddings: number[];
}

/**
 * Abstract base class for embeddings indexing implementations.
 * Provides core functionality for indexing content and generating embeddings.
 */
export abstract class BaseEmbeddingsIndex {
  protected model: BaseEmbeddingsModel;
  protected chunks: EmbeddingsIndexChunk[] = [];

  /**
   * Abstract property defining the category name for this index type.
   */
  abstract readonly category: string;

  /**
   * Creates a new embeddings index.
   * @param model - The embeddings model to use for generating embeddings
   */
  constructor(model: BaseEmbeddingsModel) {
    this.model = model;
  }

  /**
   * Index content and generate embeddings.
   * Implementations should define how to process and index their specific content type.
   */
  abstract index(): Promise<void>;

  /**
   * Retrieve all indexed items.
   * @returns Array of indexed items with embeddings
   */
  abstract getItems(): Promise<EmbeddingsIndexItem[]>;

  /**
   * Search for chunks similar to the given query.
   * @param query - The search query
   * @param limit - Maximum number of results to return
   * @returns Array of matching items sorted by similarity
   */
  abstract search(query: string, limit?: number): Promise<EmbeddingsIndexItem[]>;

  /**
   * Chunk text into smaller pieces with optional overlap.
   * @param text - The text to chunk
   * @param chunkSize - Maximum size of each chunk in characters
   * @param overlap - Number of characters to overlap between chunks (default: 0)
   * @returns Array of text chunks
   */
  protected chunkText(text: string, chunkSize: number, overlap: number = 0): string[] {
    if (chunkSize <= 0) {
      throw new Error('Chunk size must be greater than 0');
    }
    
    if (overlap < 0 || overlap >= chunkSize) {
      throw new Error('Overlap must be >= 0 and < chunk size');
    }

    const chunks: string[] = [];
    let position = 0;
    const step = chunkSize - overlap;

    while (position < text.length) {
      const chunk = text.slice(position, position + chunkSize);
      chunks.push(chunk);
      position += step;
      
      // Break if we've consumed all text
      if (position >= text.length) {
        break;
      }
    }

    return chunks;
  }

  /**
   * Calculate cosine similarity between two vectors.
   * @param vecA - First vector
   * @param vecB - Second vector
   * @returns Similarity score between -1 and 1
   */
  protected cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Process an item into chunks and generate embeddings for each chunk.
   * @param item - The embeddings item to chunk
   * @param content - The original text content to chunk
   * @param chunkSize - Size of each chunk in characters
   * @param chunkOverlap - Number of characters to overlap between chunks
   */
  protected async chunkItemAndGenerateEmbeddings(
    item: EmbeddingsIndexItem,
    content: string,
    chunkSize: number,
    chunkOverlap: number
  ): Promise<void> {
    // Chunk the content
    const textChunks = this.chunkText(content, chunkSize, chunkOverlap);

    // Generate embeddings for each chunk
    for (let i = 0; i < textChunks.length; i++) {
      const embeddings = await this.model.embed(textChunks[i]);

      // Handle both single and batch embeddings responses
      const embeddingVector = Array.isArray(embeddings[0])
        ? (embeddings as number[][])[0]
        : embeddings as number[];

      const chunk: EmbeddingsIndexChunk = {
        ...item,
        embeddings: embeddingVector,
        chunkIndex: i
      };
      this.saveToSqlite([chunk]); // Save each chunk to SQLite as it's generated
      this.chunks.push(chunk);
    }
  }

  /**
   * Initialize SQLite database with the required schema.
   * Reads database location from sqlite.json config file.
   * @returns Database instance
   */
  protected initializeSqliteDatabase(): Database.Database {
    const config = loadConfig('sqlite.json');
    if (!config || !config.databasePath) {
      throw new Error('SQLite configuration not found or databasePath not specified in sqlite.json');
    }

    const db = new Database(config.databasePath);

    // Create table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        modelType TEXT NOT NULL,
        modelName TEXT NOT NULL,
        chunkIndex INTEGER NOT NULL,
        embeddings TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, name, checksum, chunkIndex)
      )
    `);

    return db;
  }

  /**
   * Save all indexed items to SQLite database.
   * @returns Promise resolving when all items are saved
   */
  async saveToSqlite(chunks: EmbeddingsIndexChunk[]): Promise<void> {
    const db = this.initializeSqliteDatabase();
    
    try {
      const insert = db.prepare(
        `INSERT OR REPLACE INTO embeddings_index 
         (category, name, checksum, modelType, modelName, chunkIndex, embeddings)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      // Begin transaction
      const transaction = db.transaction(() => {
        for (const chunk of chunks) {
          const embeddingsJson = JSON.stringify(chunk.embeddings);
          insert.run(
            this.category,
            chunk.name,
            chunk.checksum,
            chunk.modelType,
            chunk.modelName,
            chunk.chunkIndex,
            embeddingsJson
          );
        }
      });

      transaction();
    } finally {
      db.close();
    }
  }

  /**
   * Load indexed items from SQLite database by category.
   * @returns Promise resolving to array of indexed chunks
   */
  async loadFromSqlite(): Promise<EmbeddingsIndexChunk[]> {
    const db = this.initializeSqliteDatabase();

    try {
      const stmt = db.prepare(
        `SELECT name, checksum, modelType, modelName, chunkIndex, embeddings
         FROM embeddings_index
         WHERE category = ?
         ORDER BY name, chunkIndex`
      );

      const rows = stmt.all(this.category) as any[];

      if (!rows || rows.length === 0) {
        return [];
      }

      const chunks: EmbeddingsIndexChunk[] = rows.map((row) => ({
        name: row.name,
        checksum: row.checksum,
        modelType: row.modelType,
        modelName: row.modelName,
        chunkIndex: row.chunkIndex,
        embeddings: JSON.parse(row.embeddings)
      }));

      return chunks;
    } finally {
      db.close();
    }
  }

  /**
   * Load indexed items from SQLite and populate the chunks array.
   * @returns Promise resolving when chunks are loaded
   */
  async loadChunksFromSqlite(): Promise<void> {
    this.chunks = await this.loadFromSqlite();
  }

  /**
   * Get all indexed chunks.
   * @returns Array of indexed chunks
   */
  async getChunks(): Promise<EmbeddingsIndexChunk[]> {
    return this.chunks;
  }
}
