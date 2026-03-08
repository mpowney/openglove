# Memory Skills Unit Tests

Comprehensive unit tests for the three memory management skills:
- `MemoriesIndexSkill` - Re-indexes memory files with embeddings
- `MemoriesKeepSkill` - Stores and appends memories to daily markdown files  
- `MemoriesRetrievalSkill` - Retrieves stored memories from markdown files

## Test Structure

The test suite is organized into unit tests and integration tests:

```
__tests__/
├── examples/
│   ├── ModelTestHarness.example.test.ts          # Example test harness for models
│   └── SkillTestHarness.example.test.ts          # Example test harness for skills
├── fixtures/
│   └── testData.ts                                # Shared test data and fixtures
├── harness/
│   ├── ComponentTestHarness.ts                    # Base test harness component
│   ├── ModelTestHarness.ts                        # Harness for testing models
│   └── SkillTestHarness.ts                        # Harness for testing skills
├── integration/
│   ├── FilesystemEmbeddingsIndex.integration.test.ts   # Real filesystem indexing + Ollama
│   ├── MemoriesKeepRetrieve.integration.test.ts        # Keep/retrieve flow + Ollama
│   ├── OllamaModels.integration.test.ts                # Real Ollama service tests
│   └── WebBrowserSkill.integration.test.ts             # WebBrowserSkill socket server
├── models/
│   └── OllamaGenerativeModel.test.ts              # Ollama generative model tests
├── skills/
│   ├── memories.test.ts                           # Unit tests for all memory skills
│   └── memories.keep-retrieve.test.ts             # Keep/retrieve flow integration
├── utils/
│   └── FilesystemEmbeddingsIndex.test.ts          # FilesystemEmbeddingsIndex unit tests
└── README.md                                       # This file
```

### Test Categories

**Unit Tests** (`skills/`, `utils/`, `models/`)
- Isolated tests with mocked dependencies
- Fast execution
- High code coverage
- Test individual components

**Integration Tests** (`integration/`)
- Tests with real external services (Ollama, WebBrowserSkill socket)
- Verify multi-component workflows
- May require separate processes (WebBrowserSkill socket server)
- Can be skipped if services unavailable

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

## Integration Tests

Integration tests verify skills work with real external services and other components.

### Available Integration Tests

- **FilesystemEmbeddingsIndex** - Tests real filesystem indexing with Ollama embeddings
- **MemoriesKeepRetrieve** - Tests keep/retrieve workflow with Ollama embeddings
- **WebBrowserSkill** - Tests socket communication with WebBrowserSkill server
- **OllamaModels** - Tests integration with real Ollama service

### Running Integration Tests

Run all integration tests:
```bash
pnpm test:integration
```

Run a specific integration test:
```bash
pnpm test:integration FilesystemEmbeddingsIndex.integration.test
```

### WebBrowserSkill Socket Server

The `WebBrowserSkill.integration.test.ts` test requires the WebBrowserSkill socket server to be running in a separate process.

#### Starting the WebBrowserSkill Socket Server

In a **separate terminal**, navigate to the skill-web-browser package and start the server:

**For development (with hot-reload):**
```bash
cd packages/skill-web-browser
pnpm run dev-socket
```

**After building:**
```bash
cd packages/skill-web-browser
pnpm run socket
```

The server will listen on `/tmp/web_browser_skill.sock` and handle JSON-RPC 2.0 requests from the WebBrowserSkill integration tests.

#### Socket Server Not Running

If the WebBrowserSkill socket server is not running when you execute the integration tests, you will see a warning:

```
⚠️  WebBrowserSkill socket server is not running at /tmp/web_browser_skill.sock

To start the server, run in a separate terminal:
  cd packages/skill-web-browser
  pnpm dev-socket

or after building:
  cd packages/skill-web-browser
  pnpm socket
```

The test will still pass, but the WebBrowserSkill-specific tests will be skipped.

### External Service Requirements

Some integration tests require external services to be running:

- **Ollama Service** - Tests using Ollama embeddings or generative models require Ollama running at `http://localhost:11434` (or `OLLAMA_URL` environment variable: `export OLLAMA_URL=http://ollama-hostname:11434`)
- **WebBrowserSkill Socket** - Tests require the WebBrowserSkill socket server running (see above)

If services are unavailable, tests gracefully skip with informative warnings instead of failing.

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
