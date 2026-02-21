import { Logger } from '../utils/Logger';

export type ChannelMessage = {
  id?: string;
  from?: string;
  text: string;
  metadata?: Record<string, any>;
};

export type ChannelEventType = 'typing' | 'thinking' | 'progress';

export type ChannelEvent = {
  type: ChannelEventType;
  active: boolean;
  metadata?: Record<string, any>;
};

export type ChannelResponse = {
  id?: string;
  content?: string;
  // streaming generator of partial pieces
  stream?: AsyncIterable<string>;
  meta?: Record<string, any>;
};

const logger = new Logger('BaseChannel');

export abstract class BaseChannel {
  readonly id: string;
  readonly name: string;
  public handlers = new Set<(m: ChannelMessage) => Promise<void> | void>();

  constructor(opts: { id?: string; name?: string } = {}) {
    this.id = opts.id ?? `channel-${Date.now()}`;
    this.name = opts.name ?? 'channel';
  }

  /** Whether this channel supports streaming partial responses */
  abstract supportsStreaming(): boolean;

  /** Subscribe to inbound messages from the channel */
  onMessage(cb: (msg: ChannelMessage) => Promise<void> | void): void {
    this.handlers.add(cb);
  }

  /** Unsubscribe message handler */
  offMessage(cb: (msg: ChannelMessage) => Promise<void> | void): void {
    this.handlers.delete(cb);
  }

  /** Emit an incoming message to subscribed handlers (used by implementations) */
  protected async emitMessage(msg: ChannelMessage): Promise<void> {
    for (const h of Array.from(this.handlers)) {
      try { await h(msg); } catch (e) { logger.error('channel handler failed', { error: e }); }
    }
  }

  /** Send response to the channel. Implementations should handle stream vs full message */
  abstract sendResponse(resp: ChannelResponse): Promise<void>;

  /** Send a channel-level event (typing/thinking/progress) */
  abstract sendEvent(ev: ChannelEvent): Promise<void>;

}

export default BaseChannel;
