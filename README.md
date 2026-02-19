# OpenGlove — Agent & Model TypeScript scaffold

This scaffold demonstrates a lightweight design for `Agent` and `Model` definitions using TypeScript class inheritance, plus a small skills system for registering tool-like handlers.

Quick start

1. Install dev deps:

```bash
npm install
```

2. Run in development (requires `ts-node`):

```bash
npm run dev
```

3. Build and run

```bash
npm run build
npm start
```

What this includes

- `src/models/BaseModel.ts` — abstract model surface with typical properties and lifecycle hooks.
- `src/models/LocalModel.ts` — a tiny concrete model that echoes input.
- `src/agents/BaseAgent.ts` — abstract agent with `plan`/`act`, plus skill registration.
- `src/agents/ChatAgent.ts` — simple chat agent that prefers skills, supports streaming via `sendStream()`.
- `src/skills/Skill.ts` — base `Skill` class with config-file loading.
- `src/skills/TimeSkill.ts` — example skill that returns current time.
 - `src/skills/BaseSkill.ts` — base `BaseSkill` class with config-file loading.
 - `src/skills/TimeSkill.ts` — example skill that returns current time.
 - `src/skills/web/SearxngWebSearchSkill.ts` — example skill that queries a SearxNG instance.
- `src/index.ts` — example runner demonstrating skills and streaming.
- `skills.json` — example skill configuration file.

Skills and configuration

This scaffold includes a small skills system. Each skill extends the base `BaseSkill` class and implements `canHandle(input)` and `run(input)`.

- skills config file: The base `BaseSkill` attempts to load a JSON file at `./skills.json` by default. To use a different path, set the `SKILLS_CONFIG_PATH` environment variable before running.
- skill config binding: When a skill instance is constructed its `name` is used to look up an object in the JSON file — e.g. a `SearxngWebSearchSkill` with `name: "SearxngWebSearchSkill"` will receive the object at `skills.json["SearxngWebSearchSkill"]` as `this.config`.
- constructor override: Skills may accept explicit constructor options which take precedence over config values.

Example `skills.json` (included):

```json
{
	"WebSearchSkill": {
		"baseUrl": "https://searxng.example.org",
		"timeout": 8000,
		"resultCount": 3,
		"params": { "engines": "google,bing" }
	},
	"TimeSkill": { "timezoneHint": "local" }
}
```

Web search skill

 - The `SearxngWebSearchSkill` queries a SearxNG instance using its `/search?format=json&q=...` API. It can be configured via:
 	- constructor options passed when creating the skill (e.g. `new SearxngWebSearchSkill({ baseUrl: 'https://...' })`), or
 	- the `skills.json` entry for `SearxngWebSearchSkill` (preferred when constructor options are omitted).
 - The example runner in `src/index.ts` also reads an environment variable `SEARXNG_URL` and will register a `SearxngWebSearchSkill` with that base URL if present.

Using skills programmatically

- Register a skill on an agent:

```ts
const agent = new ChatAgent(model);
agent.registerSkill(new TimeSkill());
agent.registerSkill(new SearxngWebSearchSkill({ baseUrl: 'https://searxng.example.org' }));
```

- The `ChatAgent` prefers skills: when `send()` or `sendStream()` is called, registered skills are checked first (by `canHandle`) and their `run()` result is returned if matched.

Streaming responses

- `ChatAgent.sendStream(input)` returns an `AsyncIterable<Message>` allowing incremental/streamed responses:

```ts
for await (const chunk of agent.sendStream('Tell me a story')) {
	console.log(chunk.content);
}
```

- `ChatAgent.send(input)` remains supported and returns a `Promise<Message>` for compatibility; it collects the first assistant message produced by the stream.

Environment

- `SKILLS_CONFIG_PATH` — path to a JSON file containing skill configs (defaults to `./skills.json`).
- `SEARXNG_URL` — optional base URL used by the example runner to register a `WebSearchSkill` (falls back to the value in `skills.json` if present).

- `MODELS_CONFIG_PATH` — path to a JSON file containing model configs (defaults to `./models.json`).
- `OLLAMA_URL` — optional base URL for an Ollama instance; the example runner reads this to construct an `OllamaModel` (falls back to the `models.json` entry for `OllamaModel`).

Example `models.json` (included):

```json
{
	"OllamaModel": {
		"baseUrl": "http://ollama.example.local:11434",
		"model": "llama3.2:1b",
		"temperature": 0.7,
		"maxTokens": 2048,
		"keepAlive": 600
	},
	"LocalModel": {
		"maxTokens": 2048
	}
}
```

Next steps

- Replace `LocalModel` with an API-backed model (OpenAI or a local LLM) to produce richer chat responses.
- Add more skills (calculator, retrieval, weather) and demonstrate their use in `src/index.ts`.
