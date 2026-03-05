# Memory Skills Unit Tests

Comprehensive unit tests for the three memory management skills:
- `MemoriesIndexSkill` - Re-indexes memory files with embeddings
- `MemoriesKeepSkill` - Stores and appends memories to daily markdown files  
- `MemoriesRetrievalSkill` - Retrieves stored memories from markdown files

## Test Structure

```
__tests__/
└── skills/
    └── memories.test.ts    # All memory skills tests
```

## Running Tests

Install Jest and ts-jest dependencies (if not already installed):
```bash
pnpm install -D jest ts-jest @types/jest
```

Run all tests:
```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test --watch
```

Run only memory skills tests:
```bash
pnpm test memories.test.ts
```

Run tests with coverage:
```bash
pnpm test --coverage
```

## Test Coverage

The test suite covers:

### MemoriesIndexSkill
- ✅ `canHandle()` - Pattern matching for index/reindex triggers
- ✅ `runSkill()` - Embedding index generation
- ✅ Directory creation
- ✅ Error handling
- ✅ Input format handling (string and object)

### MemoriesKeepSkill
- ✅ `canHandle()` - Pattern matching for memory storage triggers
- ✅ `runSkill()` - Memory file creation and appending
- ✅ File creation with proper heading
- ✅ File appending with timestamps
- ✅ Error handling
- ✅ Timestamp formatting
- ✅ Input format handling (string and object)

### MemoriesRetrievalSkill
- ✅ `canHandle()` - Pattern matching for retrieval triggers
- ✅ `runSkill()` - Memory file retrieval
- ✅ Empty directory handling
- ✅ Markdown file filtering
- ✅ Search-based retrieval with embeddings
- ✅ Error handling for file reads
- ✅ Input format handling (string and object)

## Mocked Dependencies

All external dependencies are mocked to ensure unit test isolation:
- `fs` - File system operations
- `BaseEmbeddingsModel` - Embeddings model loader
- `FilesystemEmbeddingsIndex` - Filesystem indexing
- `@openglove/base` - Base classes and utilities

## Example Test Output

```
PASS  __tests__/skills/memories.test.ts
  Memory Skills
    MemoriesIndexSkill
      canHandle
        ✓ should handle "index memory" input
        ✓ should handle "reindex memory" input
        ...
      runSkill
        ✓ should successfully index memories
        ✓ should create memories directory if it does not exist
        ...
    MemoriesKeepSkill
      canHandle
        ✓ should handle "remember" input
        ...
      runSkill
        ✓ should create new memory file if it does not exist
        ...
    MemoriesRetrievalSkill
      canHandle
        ✓ should handle "memories" input
        ...
      runSkill
        ✓ should return empty memories if directory does not exist
        ...

Test Suites: 1 passed, 1 total
Tests:       [XX] passed, [XX] total
```

## Integration Notes

These are unit tests with mocked dependencies. For integration testing, you would want to:
1. Use actual file system with temporary directories
2. Use actual embeddings models or mock API responses
3. Test the full skill execution flow with real FilesystemEmbeddingsIndex

## Contributing

When adding new features to memory skills:
1. Add corresponding test cases in this file
2. Ensure all tests pass before committing
3. Maintain > 80% code coverage for memory skills
