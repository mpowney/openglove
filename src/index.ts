import { LocalModel } from './models/LocalModel';
import { ChatAgent } from './agents/ChatAgent';
import { TimeSkill } from './skills/TimeSkill';
import { SearxngWebSearchSkill } from './skills/web-search/SearxngWebSearchSkill';
import { OllamaModel } from './models/OllamaModel';
import { Logger } from './utils/Logger';

// configure global log level from env or default and enable console output
Logger.subscribe(Logger.ConsoleSubscriber(['verbose', 'info', 'warn', 'error']));
const logger = new Logger('index');

async function main() {
  const model = new LocalModel({}, { name: 'EchoModel', description: 'Simple echo model', version: '0.1' });
  const agent = new ChatAgent(model, { name: 'EchoAgent', role: 'assistant' });
  // Register example skills
  const timeSkill = new TimeSkill();
  (agent as any).registerSkill(timeSkill);
  // Register WebSearchSkill with configurable base URL (SEARXNG_URL env var)
  const searxngBaseUrl = process.env.SEARXNG_URL || 'https://searxng.example.org';
  try {
    // const webSkill = new SearxngWebSearchSkill({ baseUrl: searxngBaseUrl, resultCount: 3 });
    const webSkill = new SearxngWebSearchSkill({ resultCount: 3 });
    (agent as any).registerSkill(webSkill);
  } catch (err: unknown) {
    const emsg = err instanceof Error ? err.message : String(err);
    logger.warn('SearxngWebSearchSkill not registered', { error: emsg });
  }

  logger.log('Sending message: Hello world');
  const r1 = await agent.send('Hello world');
  logger.log('Agent response', { content: r1.content });

  logger.log('Sending message: How are you?');
  const r2 = await agent.send('How are you?');
  logger.log('Agent response', { content: r2.content });

  logger.log('Sending message: What time is it?');
  const r3 = await agent.send('What time is it?');
  logger.log('Agent response', { content: r3.content });

  // Demo sendStream usage (backwards-compatible with previous `send`)
  logger.log('Demo sendStream: streaming response for "Tell me a short story"');
  for await (const chunk of agent.sendStream('Tell me a short story')) {
    logger.log('Stream chunk', { content: chunk.content });
  }

  // Demo web search (gracefully handle network errors)
  logger.log('Demo web search: Searching for "searxng"');
  try {
    const r4 = await agent.send("Search for 'searxng'");
    logger.log('Search response', { content: r4.content });
  } catch (err: unknown) {
    const emsg = err instanceof Error ? err.message : String(err);
    logger.error('Search failed', { error: emsg });
  }

  // Demo OllamaModel usage (non-streaming + streaming). Configure via OLLAMA_URL or models.json (OllamaModel entry).
  logger.log('Demo OllamaModel:');
  const ollamaUrl = process.env.OLLAMA_URL;
  const ollama = new OllamaModel(ollamaUrl ? { baseUrl: ollamaUrl } : {}, { name: 'OllamaModel' });

  // Create an agent backed by the Ollama model to integrate it into the agent flow
  const ollamaAgent = new ChatAgent(ollama, { name: 'OllamaAgent', role: 'assistant' });
  // register same skills on the ollamaAgent so it can use them
  (ollamaAgent as any).registerSkill(timeSkill);
  try {
    (ollamaAgent as any).registerSkill((agent as any).skills.find((s: any) => s.constructor.name === 'SearxngWebSearchSkill'));
  } catch (_) {
    // ignore
  }

  try {
    logger.log('OllamaAgent (stream) generate via agent flow:');
    for await (const chunk of ollamaAgent.sendStream('Please write a friendly greeting in two sentences.')) {
      logger.log('OllamaAgent stream chunk', { content: chunk.content });
    }
  } catch (err: unknown) {
    logger.error('OllamaAgent stream call failed', { error: err instanceof Error ? err.message : String(err) });
  }

  try {
    logger.log('Ollama (non-stream) generate:');
    const out = await ollama.predict('Write a two-line poem about TypeScript.');
    logger.log('Ollama response', { response: typeof out === 'object' ? JSON.stringify(out, null, 2) : String(out) });
  } catch (err: unknown) {
    logger.error('Ollama non-stream call failed', { error: err instanceof Error ? err.message : String(err) });
  }

  try {
    logger.log('Ollama (stream) generate:');
    for await (const chunk of ollama.predictStream('Write a one-line joke about programmers.')) {
      logger.log('Ollama stream chunk', { chunk });
    }
  } catch (err: unknown) {
    logger.error('Ollama stream call failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

main().catch(err => {
  logger.error('Unhandled error in main', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
