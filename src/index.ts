import { LocalModel } from './models/LocalModel';
import { ChatAgent } from './agents/ChatAgent';
import { TimeSkill } from './skills/TimeSkill';
import { SearxngWebSearchSkill } from './skills/web-search/SearxngWebSearchSkill';
import { OllamaModel } from './models/OllamaModel';

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
    console.warn('SearxngWebSearchSkill not registered:', emsg);
  }

  console.log('Sending message: Hello world');
  const r1 = await agent.send('Hello world');
  console.log('Agent response:', r1.content);

  console.log('Sending message: How are you?');
  const r2 = await agent.send('How are you?');
  console.log('Agent response:', r2.content);

  console.log('Sending message: What time is it?');
  const r3 = await agent.send('What time is it?');
  console.log('Agent response:', r3.content);

  // Demo sendStream usage (backwards-compatible with previous `send`)
  console.log('Demo sendStream: streaming response for "Tell me a short story"');
  for await (const chunk of agent.sendStream('Tell me a short story')) {
    console.log('Stream chunk:', chunk.content);
  }

  // Demo web search (gracefully handle network errors)
  console.log('Demo web search: Searching for "searxng"');
  try {
    const r4 = await agent.send("Search for 'searxng'");
    console.log('Search response:', r4.content);
  } catch (err: unknown) {
    const emsg = err instanceof Error ? err.message : String(err);
    console.error('Search failed:', emsg);
  }

  // Demo OllamaModel usage (non-streaming + streaming). Configure via OLLAMA_URL or models.json (OllamaModel entry).
  console.log('Demo OllamaModel:');
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
    console.log('OllamaAgent (stream) generate via agent flow:');
    for await (const chunk of ollamaAgent.sendStream('Please write a friendly greeting in two sentences.')) {
      console.log('OllamaAgent stream chunk:', chunk.content);
    }
  } catch (err: unknown) {
    console.error('OllamaAgent stream call failed:', err instanceof Error ? err.message : String(err));
  }

  try {
    console.log('Ollama (non-stream) generate:');
    const out = await ollama.predict('Write a two-line poem about TypeScript.');
    console.log('Ollama response:', typeof out === 'object' ? JSON.stringify(out, null, 2) : String(out));
  } catch (err: unknown) {
    console.error('Ollama non-stream call failed:', err instanceof Error ? err.message : String(err));
  }

  try {
    console.log('Ollama (stream) generate:');
    for await (const chunk of ollama.predictStream('Write a one-line joke about programmers.')) {
      console.log('Ollama stream chunk:', chunk);
    }
  } catch (err: unknown) {
    console.error('Ollama stream call failed:', err instanceof Error ? err.message : String(err));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
