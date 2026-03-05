# SQLite Persistence for Embeddings Index

The `BaseEmbeddingsIndex` class now supports persisting indexed embeddings to SQLite, allowing you to cache embeddings across sessions and quickly reload them without regenerating embeddings.

## Configuration

Create a `sqlite.json` file in your project root (or the current working directory when the application runs). The file should specify the path to your SQLite database:

```json
{
  "databasePath": "./embeddings.db"
}
```

## Usage

### Saving Indexed Items to SQLite

After indexing content using the `index()` method, save the results to the database:

```typescript
const index = new FilesystemEmbeddingsIndex(model, './data', {
  chunkSize: 1000,
  chunkOverlap: 200
});

// Index all files
await index.index();

// Save indexed items to SQLite
await index.saveToSqlite();
```

### Loading Indexed Items from SQLite

Reload previously indexed items from the database:

```typescript
const index = new FilesystemEmbeddingsIndex(model, './data');

// Load items from SQLite into memory
await index.loadItemsFromSqlite();

// Now you can search or get items
const results = await index.search('query text', 10);
```

### Available Methods

- **`saveToSqlite(): Promise<void>`** - Save all indexed items in memory to the SQLite database
- **`loadFromSqlite(): Promise<EmbeddingsIndexChunk[]>`** - Load all indexed items from the SQLite database for this category
- **`loadItemsFromSqlite(): Promise<void>`** - Load items from SQLite and populate the internal items array

## Database Schema

The SQLite database uses the following schema for the `embeddings_index` table:

| Column      | Type    | Description                                    |
|------------|---------|------------------------------------------------|
| id         | INTEGER | Auto-incrementing primary key                  |
| category   | TEXT    | Category of the index (e.g., "Filesystem")     |
| name       | TEXT    | Name of the item (e.g., relative filename)     |
| checksum   | TEXT    | Forward and backward hash of content           |
| modelType  | TEXT    | Type of the embeddings model                   |
| modelName  | TEXT    | Name of the embeddings model                   |
| chunkIndex | INTEGER | 0-based index of the chunk                     |
| embeddings | TEXT    | JSON-encoded embedding vector                  |
| createdAt  | DATETIME| Timestamp of when the record was created       |

A unique constraint is enforced on `(category, name, checksum, chunkIndex)` to prevent duplicate entries.

## Implementation Details

The SQLite implementation uses [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for synchronous database operations, ensuring reliable and performant data persistence. All operations support transactions for data integrity.
