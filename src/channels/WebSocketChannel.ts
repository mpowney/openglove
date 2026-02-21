import { BaseChannel, ChannelMessage, ChannelResponse, ChannelEvent } from './BaseChannel';
import { Logger } from '../utils/Logger';
import { loadConfig } from '../config/loadConfig';
import WebSocket from 'ws';

export type WebSocketChannelOptions = {
  // if a socket is provided, the channel will attach to it; otherwise you can provide a send function
  socket?: any; // a ws-like socket with `send` and `on('message')`
  streaming?: boolean; // whether the client supports streaming partial pieces
  configPath?: string; // optional path to load server configuration
};

export type WebSocketServerConfig = {
  port: number;
  host?: string;
};

const logger = new Logger('WebSocketChannel');

export class WebSocketChannel extends BaseChannel {
  private socket: any | null = null;
  private streaming: boolean;
  private serverConfig: WebSocketServerConfig | null = null;
  private wss: WebSocket.Server | null = null;
  private clientSockets = new Map<string, WebSocket>();

  constructor(opts: WebSocketChannelOptions & { id?: string; name?: string } = {}) {
    super({ id: opts.id, name: opts.name ?? 'websocket' });
    this.socket = opts.socket ?? null;
    this.streaming = opts.streaming ?? true;

    // Load server configuration if path provided
    if (opts.configPath) {
      const config = loadConfig(opts.configPath);
      if (config) {
        this.serverConfig = config as WebSocketServerConfig;
        logger.verbose('Server configuration loaded', { port: this.serverConfig.port });
      } else {
        logger.warn('Failed to load server configuration', { configPath: opts.configPath });
      }
    }

    this.startServer().catch(e => logger.error('Failed to start WebSocket server', e));
    if (this.socket) this.attachSocket(this.socket);

  }

  supportsStreaming(): boolean { return this.streaming; }

  private startServer(port: number = this.serverConfig?.port ?? 8080, host: string = this.serverConfig?.host ?? 'localhost'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.log('Starting WebSocket server', { port, host });
        this.wss = new WebSocket.Server({ port, host });

        this.wss.on('connection', (clientSocket: WebSocket) => {
          const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          this.clientSockets.set(clientId, clientSocket);
          logger.log('WebSocket client connected', { clientId, port, host });

          // Attach the client socket to receive chat messages
          this.attachSocket(clientSocket);

          clientSocket.on('close', () => {
            this.clientSockets.delete(clientId);
            logger.log('WebSocket client disconnected', { clientId });
          });

          clientSocket.on('error', (error) => {
            logger.error('WebSocket client error', { clientId, error });
            this.clientSockets.delete(clientId);
          });
        });

        this.wss.on('error', (error) => {
          logger.error('WebSocket server error', { error });
          reject(error);
        });

        logger.log('WebSocket server started', { port, host });
        resolve();
      } catch (error) {
        logger.error('Failed to start WebSocket server', { error });
        reject(error);
      }
    });
  }

  private stopServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all client connections
      this.clientSockets.forEach((socket) => {
        try { socket.close(); } catch { /* ignore */ }
      });
      this.clientSockets.clear();

      this.wss.close((error) => {
        if (error) {
          logger.error('Error closing WebSocket server', { error });
          reject(error);
        } else {
          logger.log('WebSocket server stopped');
          this.wss = null;
          resolve();
        }
      });
    });
  }

  getConnectedClients(): number {
    return this.clientSockets.size;
  }

  attachSocket(socket: any) {
    this.socket = socket;
    try {
      this.socket.on('message', async (data: any) => {
        try {
          let parsed: any = data;
          if (typeof data === 'string') {
            try { parsed = JSON.parse(data); } catch { parsed = { text: data }; }
          }

          // Identify chat messages: messages without a type, or with type 'message' or 'chat'
          const isChatMessage = !parsed.type || parsed.type === 'message' || parsed.type === 'chat';

          if (isChatMessage) {
            const msg: ChannelMessage = {
              id: parsed.id,
              from: parsed.from,
              text: parsed.text ?? String(parsed),
              metadata: parsed.meta
            };
            await this.emitMessage(msg);
            logger.verbose('Chat message emitted', { id: msg.id, from: msg.from });
          } else {
            logger.verbose('Non-chat message received, skipped', { type: parsed.type });
          }
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
    // Send to all connected clients
    const sockets: any[] = [this.socket, ...this.clientSockets.values()].filter(s => s);
    
    if (sockets.length === 0) {
      logger.warn('no sockets connected, cannot sendResponse');
      return;
    }

    for (const socket of sockets) {
      if (resp.stream && this.streaming) {
        for await (const part of resp.stream) {
          logger.verbose('Sending streaming response', String(part));
          try { socket.send(JSON.stringify({ type: 'stream', part })); } catch (e) { logger.warn('socket.send failed', { error: e }); }
        }
        try { socket.send(JSON.stringify({ type: 'stream_end', id: resp.id })); } catch (e) { /* ignore */ }
      } else {
        try {
          logger.verbose('Sending non-streamed response', resp.content );
          socket.send(JSON.stringify({ type: 'message', id: resp.id, content: resp.content, meta: resp.meta }));
        } catch (e) {
          logger.error('socket.send failed', { error: e });
        }
      }
    }
  }

  async sendEvent(ev: ChannelEvent): Promise<void> {
    // Send to all connected clients
    const sockets: any[] = [this.socket, ...this.clientSockets.values()].filter(s => s);
    
    for (const socket of sockets) {
      try {
        socket.send(JSON.stringify({ type: 'event', event: ev }));
      } catch (e) { logger.warn('socket.send event failed', { error: e }); }
    }
  }
}

export default WebSocketChannel;
