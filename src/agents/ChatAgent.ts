import { BaseAgent } from './BaseAgent';
import { BaseModel } from '../models/BaseModel';
import { SkillContext } from '../skills/BaseSkill';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  ts?: number;
}

export class ChatAgent<M extends BaseModel = BaseModel> extends BaseAgent<M> {
  history: Message[] = [];

  constructor(model: M, opts: { id?: string; name?: string; role?: string } = {}) {
    super(model, opts);
  }

  async plan(input: string) {
    // Build a simple prompt from history + input
    const promptParts = this.history.map(m => `${m.role}: ${m.content}`);
    promptParts.push(`user: ${input}`);
    const prompt = promptParts.join('\n');
    return { prompt };
  }

  async act(plan: { prompt: string }) {
    // Use the model to generate a response
    const resp = await this.model.predict(plan.prompt);
    const content = typeof resp === 'object' && resp.output ? resp.output : String(resp);
    const message = { role: 'assistant' as const, content: String(content), ts: Date.now() };
    this.history.push(message);
    return message;
  }

  async send(input: string) {
    // Backwards-compatible send: return a Promise that resolves to the final message.
    const stream = this.sendStream(input);
    // Collect the first (and in non-streaming cases the only) assistant message
    for await (const msg of stream) {
      // return the first assistant message produced by the stream
      return msg;
    }
    // If stream produced nothing, return a generic empty assistant message
    const empty = { role: 'assistant' as const, content: '', ts: Date.now() };
    return empty;
  }

  /**
   * Streamed version of `send`. Yields `Message` chunks as they become available.
   * Useful when models or skills can produce incremental output.
   */
  async *sendStream(input: string): AsyncIterable<Message> {
    this.history.push({ role: 'user', content: input, ts: Date.now() });

    // Allow registered skills to handle the input first
    const skillCtx: SkillContext = { agentId: this.id, model: this.model };
    const skillResult = await (this as unknown as BaseAgent).runSkill(input, skillCtx);
    if (skillResult !== undefined) {
      const content = typeof skillResult === 'string' ? skillResult : JSON.stringify(skillResult, null, 2);
      const message = { role: 'assistant' as const, content: String(content), ts: Date.now() };
      this.history.push(message);
      yield message;
      return;
    }

    // No skill handled it — build a plan and use the model.
    const plan = await this.plan(input);
    // Prefer a model streaming API if available
    const modelAny = this.model as any;
    if (typeof modelAny.predictStream === 'function') {
      for await (const chunk of modelAny.predictStream(plan.prompt)) {
        const content = typeof chunk === 'object' && chunk.output ? chunk.output : String(chunk);
        const message = { role: 'assistant' as const, content: String(content), ts: Date.now() };
        this.history.push(message);
        yield message;
      }
      return;
    }

    // Fallback: call non-streaming predict and yield single message
    const resp = await this.model.predict(plan.prompt);
    const content = typeof resp === 'object' && resp.output ? resp.output : String(resp);
    const message = { role: 'assistant' as const, content: String(content), ts: Date.now() };
    this.history.push(message);
    yield message;
  }
}
