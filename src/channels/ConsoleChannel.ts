import { BaseChannel, ChannelMessage, ChannelResponse, ChannelEvent } from './BaseChannel';
import { Logger } from '../utils/Logger';

import readline from 'readline';

export type ConsoleChannelOptions = {
  streaming?: boolean; // whether to treat responses as streamable
  prompt?: string; // prompt shown on stdin
};

const logger = new Logger('ConsoleChannel');
let previousContentLength: number = 0;

export class ConsoleChannel extends BaseChannel {
  // handlers managed by BaseChannel
  private rl: readline.Interface;
  private streaming: boolean;
  private prompt: string | undefined;

  constructor(opts: ConsoleChannelOptions & { id?: string; name?: string } = {}) {
    super({ id: opts.id, name: opts.name ?? 'console' });
    this.streaming = opts.streaming ?? false;
    this.prompt = opts.prompt;

    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    if (this.prompt) this.rl.setPrompt(this.prompt);
    // start listening for lines
    this.rl.on('line', async (line: string) => {
      if (line.trim().length > 0) {
        const msg: ChannelMessage = { id: `console-${Date.now()}`, from: 'console', text: line };
        await this.emitMessage(msg);
        if (this.prompt) this.rl.prompt();
      }
    });
    // if prompt configured, show it
    if (this.prompt) this.rl.prompt();
  }

  supportsStreaming(): boolean { return this.streaming; }

  // onMessage/offMessage implemented in BaseChannel

  async sendResponse(resp: ChannelResponse): Promise<void> {
    if (resp.role && this.emitRoles.indexOf(resp.role) === -1) return;
    if (resp.stream && this.streaming) {
      for await (const chunk of resp.stream) {
        try { 
          logger.verbose('Sending streaming response', chunk);
          process.stdout.write(`${chunk.content ?? ''}`); 
        } catch (e) { 
          logger.warn('failed to write stream part', { error: e }); 
        }
      }
      process.stdout.write('\n');
      return;
    }
    const out = resp.content ?? '';
    try { 
      const content = String(out || '');
      if (content.length ===0) return;
      process.stdout.write(`${content}\n`);
    } catch (e) { 
      logger.warn('failed to console.log response', { error: e }); 
    }
  }

  async sendEvent(ev: ChannelEvent): Promise<void> {
    try { console.log(`[${this.name}] event: ${ev.type} ${ev.active ? 'start' : 'stop'}`); } catch (e) { logger.warn('failed to write event', { error: e }); }
  }

  close() {
    try { this.rl.close(); } catch {}
    this.handlers.clear();
  }
}

export default ConsoleChannel;
