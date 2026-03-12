/**
 * Common test fixtures for tools and models
 */

export const toolFixtures = {
  memoriesKeep: {
    validInputs: [
      'remember to call mom',
      'memorize this fact',
      'keep in mind the deadline',
      'store this information',
      'save this memory for later',
      'note this down'
    ],
    invalidInputs: ['what is the weather', 'tell me a joke', ''],
    expectedCanHandle: {
      'remember to buy milk': true,
      'remember': true,
      'memorize': true,
      'keep in mind': true,
      'store this': true,
      'this is unrelated': false
    },
    expectedRunResult: {
      type: 'memoryKept',
      success: true,
      message: expect.stringContaining('Memory stored successfully')
    }
  },

  memoriesIndex: {
    validInputs: ['index memory', 'reindex memory', 'INDEX MEMORY'],
    invalidInputs: ['retrieve memory', 'what do I remember', ''],
    expectedCanHandle: {
      'index memory': true,
      'reindex memory': true,
      'do something': false
    },
    expectedRunResult: {
      type: 'memoriesIndex',
      success: true,
      message: expect.stringContaining('re-indexed')
    }
  },

  memoriesRetrieval: {
    validInputs: [
      'what memories do I have',
      'can you recall my data',
      'do you remember',
      'my memories',
      'what do you remember about me'
    ],
    invalidInputs: ['what is the capital of France', ''],
    expectedCanHandle: {
      'memories': true,
      'recall': true,
      'remember': true,
      'random input': false
    },
    expectedRunResult: {
      type: 'memories',
      success: true,
      memories: expect.any(Array),
      count: expect.any(Number)
    }
  }
};

export const modelFixtures = {
  ollama: {
    baseConfigs: {
      default: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral'
      },
      custom: {
        baseUrl: 'http://remote-server:11434',
        model: 'neural-chat',
        contextLength: 4096,
        keepAlive: 3600
      },
      azure: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY
      }
    },

    validPrompts: [
      'What is 2 + 2?',
      'Explain quantum computing',
      'Write a haiku about programming',
      'How many planets are in our solar system?'
    ],

    streamPrompts: [
      'Tell me a story',
      'Write a poem',
      'Explain AI in simple terms'
    ],

    expectedResponseStructure: {
      response: expect.any(String),
      done: expect.any(Boolean)
    },

    expectedStreamChunk: {
      type: expect.stringMatching(/^(delta|start|end)$/),
      role: expect.any(String),
      content: expect.any(String)
    },

    malformedResponses: [
      '{ invalid json',
      'plain text response',
      '',
      'null'
    ]
  }
};

export const integrationFixtures = {
  testEnvironments: {
    unit: {
      mockMode: 'full' as const,
      timeout: 5000,
      description: 'Isolated unit tests with all mocks'
    },
    integration: {
      mockMode: 'none' as const,
      timeout: 30000,
      skipIfUnavailable: true,
      description: 'Real external services'
    },
    hybrid: {
      mockMode: 'partial' as const,
      mockedServices: ['embeddings'],
      realServices: ['filesystem'],
      timeout: 15000,
      description: 'Mixed mocks and real services'
    }
  },

  successCriteria: {
    toolRun: {
      expectSuccess: true,
      expectFields: ['type', 'success', 'message']
    },
    modelPredict: {
      expectFields: ['response']
    },
    modelStream: {
      expectFields: ['type', 'role']
    }
  }
};

/**
 * Example usage helper
 */
export const exampleUsage = {
  tool: `
    import { ToolTestHarness } from '__tests__/harness';
    import { MemoriesKeepTool } from 'src/tools/MemoriesKeepTool';
    
    const harness = new ToolTestHarness(MemoriesKeepTool, { 
      mockMode: 'full' 
    });
    
    const canHandle = await harness.testCanHandle('remember this');
    const result = await harness.testRun('remember to call mom');
  `,

  model: `
    import { ModelTestHarness } from '__tests__/harness';
    import { OllamaGenerativeModel } from 'src/models/generative/OllamaGenerativeModel';
    
    // Unit test with mocks
    const unitHarness = new ModelTestHarness(OllamaGenerativeModel, {
      mockMode: 'full'
    });
    const result = await unitHarness.testPredict('What is AI?');
    
    // Integration test with real service
    const integrationHarness = new ModelTestHarness(OllamaGenerativeModel, {
      mockMode: 'none',
      baseUrl: 'http://localhost:11434',
      skipIfUnavailable: true,
      timeout: 30000
    });
    const realResult = await integrationHarness.testIntegrationPredict('Explain quantum computing');
  `,

  stream: `
    import { ModelTestHarness } from '__tests__/harness';
    
    const harness = new ModelTestHarness(OllamaGenerativeModel, {
      mockMode: 'none',
      baseUrl: 'http://localhost:11434'
    });
    
    const chunks = await harness.testIntegrationStream('Tell me a story');
    chunks.forEach(chunk => {
      console.log(chunk.content);
    });
  `
};
