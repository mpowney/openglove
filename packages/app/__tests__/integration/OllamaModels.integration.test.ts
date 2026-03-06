import { OllamaGenerativeModel } from '../../src/models/generative/OllamaGenerativeModel';
import { OllamaEmbeddingsModel } from '../../src/models/embeddings/OllamaEmbeddingsModel';
import { fetchWithTimeout } from '../../src/utils/Fetch';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_GENERATIVE_MODEL = process.env.OLLAMA_GENERATIVE_MODEL || 'mistral';
const OLLAMA_EMBEDDINGS_MODEL = process.env.OLLAMA_EMBEDDINGS_MODEL || 'nomic-embed-text';

jest.setTimeout(60000);

describe('Ollama real-service integration', () => {
  let serviceAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetchWithTimeout(`${OLLAMA_URL}/api/tags`, 'GET', {}, undefined, 3000);
      serviceAvailable = Boolean(response && response.ok);
    } catch (_e) {
      serviceAvailable = false;
    }
  });

  it('generative model should return a prediction from real Ollama', async () => {
    if (!serviceAvailable) return;

    const model = new OllamaGenerativeModel({
      baseUrl: OLLAMA_URL,
      model: OLLAMA_GENERATIVE_MODEL
    });

    const result = await model.predict('Respond with one short sentence about artificial intelligence.');

    expect(result).toBeDefined();
    if (typeof result === 'string') {
      expect(result.length).toBeGreaterThan(0);
      return;
    }

    expect(typeof result).toBe('object');
  });

  it('generative model should stream chunks from real Ollama', async () => {
    if (!serviceAvailable) return;

    const model = new OllamaGenerativeModel({
      baseUrl: OLLAMA_URL,
      model: OLLAMA_GENERATIVE_MODEL
    });

    const stream = model.predictStream?.('Explain machine learning in two short lines.');
    expect(stream).toBeDefined();

    const chunks: any[] = [];
    for await (const chunk of stream!) {
      chunks.push(chunk);

      if (chunk?.type === 'end' || chunks.length >= 30) {
        break;
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('embeddings model should return numeric embedding vector from real Ollama', async () => {
    if (!serviceAvailable) return;

    const model = new OllamaEmbeddingsModel({
      baseUrl: OLLAMA_URL,
      model: OLLAMA_EMBEDDINGS_MODEL
    });

    const embedding: any = await model.embed('Create an embedding for this sentence.');

    expect(Array.isArray(embedding.embeddings)).toBe(true);
    const firstValue = Array.isArray(embedding.embeddings[0]) ? embedding.embeddings[0][0] : embedding.embeddings[0];
    expect(typeof firstValue).toBe('number');
  });
});
