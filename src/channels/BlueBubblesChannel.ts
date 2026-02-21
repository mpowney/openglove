import { BaseChannel, ChannelMessage, ChannelResponse, ChannelEvent } from './BaseChannel';
import { Logger } from '../utils/Logger';
import { fetchWithTimeout } from '../utils/Fetch';

export type BlueBubblesOpts = {
  baseUrl: string; // e.g. http://bluebubbles.local:3000
  apiKey?: string;
  threadId?: string; // target conversation/thread id
};

const logger = new Logger('BlueBubblesChannel');

export class BlueBubblesChannel extends BaseChannel {
  private opts: BlueBubblesOpts;
  // handlers are managed by BaseChannel

  constructor(opts: BlueBubblesOpts & { id?: string; name?: string }) {
    super({ id: opts.id, name: opts.name ?? 'bluebubbles' });
    this.opts = opts;
  }

  supportsStreaming(): boolean { return false; }

  /** Convenience method called when an external webhook delivers a message to this channel */
  async handleIncomingMessage(msg: ChannelMessage): Promise<void> {
    await this.emitMessage(msg);
  }

  async sendResponse(resp: ChannelResponse): Promise<void> {
    // BlueBubbles typically sends a full message via a HTTP API. We POST to /send or configured endpoint.
    const url = `${this.opts.baseUrl.replace(/\/$/, '')}/api/sendMessage`;
    const payload: any = {
      threadId: this.opts.threadId,
      message: resp.content ?? ''
    };
    try {
      fetchWithTimeout(url, "POST", { 'content-type': 'application/json', ...(this.opts.apiKey ? { Authorization: `Bearer ${this.opts.apiKey}` } : {}) }, payload, 5000).catch(e => {
        logger.error('Failed to send message to BlueBubbles', e);
      });
    }
    catch (e: unknown) {
      logger.error('Failed to send message to BlueBubbles', e);
    }
    
  }

  async sendEvent(ev: ChannelEvent): Promise<void> {
    // map typing/thinking events to BlueBubbles typing endpoint if available
    const url = `${this.opts.baseUrl.replace(/\/$/, '')}/api/typing`;
    const payload = { threadId: this.opts.threadId, typing: ev.active };
    try {
      // @ts-ignore
      if (typeof fetch === 'function') {
        await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.opts.apiKey ? { Authorization: `Bearer ${this.opts.apiKey}` } : {}) }, body: JSON.stringify(payload) });
        return;
      }
    } catch (e: unknown) {
      logger.verbose('fetch sendEvent failed', { error: e });
    }
    // otherwise ignore silently
  }
}

export default BlueBubblesChannel;
