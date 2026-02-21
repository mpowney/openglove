import { BaseChannel, ChannelMessage, ChannelResponse, ChannelEvent } from './BaseChannel';
import { Logger } from '../utils/Logger';

export type WebSocketChannelOptions = {
  // if a socket is provided, the channel will attach to it; otherwise you can provide a send function
  socket?: any; // a ws-like socket with `send` and `on('message')`
  streaming?: boolean; // whether the client supports streaming partial pieces
};

const logger = new Logger('WebSocketChannel');

export class WebSocketChannel extends BaseChannel {
  private socket: any | null = null;
  private streaming: boolean;

  constructor(opts: WebSocketChannelOptions & { id?: string; name?: string } = {}) {
    super({ id: opts.id, name: opts.name ?? 'websocket' });
    this.socket = opts.socket ?? null;
    this.streaming = opts.streaming ?? true;
    if (this.socket) this.attachSocket(this.socket);
  }

  supportsStreaming(): boolean { return this.streaming; }

  attachSocket(socket: any) {
    this.socket = socket;
    try {
      this.socket.on('message', async (data: any) => {
        try {
          let parsed: any = data;
          if (typeof data === 'string') {
            try { parsed = JSON.parse(data); } catch { parsed = { text: data }; }
          }
          const msg = { id: parsed.id, from: parsed.from, text: parsed.text ?? String(parsed), metadata: parsed.meta };
          await this.emitMessage(msg);
        } catch (e) {
          logger.warn('failed to process incoming ws message', { error: e });
        }
      });
    } catch (e) {
      logger.verbose('attachSocket failed', { error: e });
    }
  }

  onMessage(cb: (m: ChannelMessage) => Promise<void> | void): void { this.handlers.add(cb); }
  offMessage(cb: (m: ChannelMessage) => Promise<void> | void): void { this.handlers.delete(cb); }

  async sendResponse(resp: ChannelResponse): Promise<void> {
    if (!this.socket) {
      logger.warn('no socket attached, cannot sendResponse');
      return;
    }
    if (resp.stream && this.streaming) {
      for await (const part of resp.stream) {
        try { this.socket.send(JSON.stringify({ type: 'stream', part })); } catch (e) { logger.warn('socket.send failed', { error: e }); }
      }
      try { this.socket.send(JSON.stringify({ type: 'stream_end', id: resp.id })); } catch (e) { /* ignore */ }
      return;
    }
    try {
      this.socket.send(JSON.stringify({ type: 'message', id: resp.id, content: resp.content, meta: resp.meta }));
    } catch (e) {
      logger.error('socket.send failed', { error: e });
    }
  }

  async sendEvent(ev: ChannelEvent): Promise<void> {
    if (!this.socket) return;
    try {
      this.socket.send(JSON.stringify({ type: 'event', event: ev }));
    } catch (e) { logger.warn('socket.send event failed', { error: e }); }
  }
}

export default WebSocketChannel;
