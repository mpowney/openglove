import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';

const logger = new Logger('SocketServer');

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id?: string | number;
}

export type MethodHandler = (params?: unknown) => Promise<unknown>;

/**
 * Convert class name to Unix socket naming convention (snake_case)
 * e.g., "WebBrowserSkill" -> "web_browser_skill"
 */
export const classNameToSocketName = (className: string): string => {
  return className
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * SocketServer listens on a Unix domain socket and handles JSON-RPC 2.0 requests.
 * Socket name is derived from class name in Unix socket conventions (snake_case).
 */
export class SocketServer {
  private server: net.Server | null = null;
  private socketPath: string;
  private methods: Map<string, MethodHandler> = new Map();

  constructor(className: string, socketDir: string = '/tmp') {
    // Convert class name to snake_case for unix socket naming
    const socketName = classNameToSocketName(className);
    this.socketPath = path.join(socketDir, `${socketName}.sock`);
  }

  /**
   * Register a method handler
   */
  registerMethod(method: string, handler: MethodHandler): void {
    this.methods.set(method, handler);
  }

  /**
   * Start listening on the Unix socket
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Remove existing socket file if it exists
      if (fs.existsSync(this.socketPath)) {
        try {
          fs.unlinkSync(this.socketPath);
        } catch (err) {
          logger.warn(`Failed to remove existing socket: ${err}`);
        }
      }

      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.listen(this.socketPath, () => {
        logger.log(`Socket server listening at ${this.socketPath}`);
        resolve();
      });

      this.server.on('error', (err) => {
        logger.error(`Socket server error: ${err}`);
        reject(err);
      });
    });
  }

  /**
   * Handle incoming connection
   */
  private handleConnection(socket: net.Socket): void {
    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Try to parse complete JSON-RPC messages
      let lastIndex = 0;
      const lines = buffer.split('\n');

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            const request = JSON.parse(line) as JSONRPCRequest;
            const response = await this.handleRequest(request);
            socket.write(JSON.stringify(response) + '\n');
          } catch (err) {
            logger.error(`Error processing request: ${err}`);
            const errorResponse: JSONRPCResponse = {
              jsonrpc: '2.0',
              error: { code: -32700, message: 'Parse error' },
              id: undefined,
            };
            socket.write(JSON.stringify(errorResponse) + '\n');
          }
          lastIndex = i + 1;
        }
      }

      // Keep unparsed partial data in buffer
      buffer = lines[lines.length - 1];
    });

    socket.on('end', () => {
      logger.verbose('Socket connection closed');
    });

    socket.on('error', (err) => {
      logger.error(`Socket error: ${err}`);
    });
  }

  /**
   * Handle JSON-RPC request
   */
  private async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const handler = this.methods.get(request.method);

    if (!handler) {
      return {
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id: request.id,
      };
    }

    try {
      const result = await handler(request.params);
      return {
        jsonrpc: '2.0',
        result,
        id: request.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error', data: message },
        id: request.id,
      };
    }
  }

  /**
   * Stop the socket server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (fs.existsSync(this.socketPath)) {
            try {
              fs.unlinkSync(this.socketPath);
            } catch (err) {
              logger.warn(`Failed to clean up socket: ${err}`);
            }
          }
          logger.log('Socket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the socket path
   */
  getSocketPath(): string {
    return this.socketPath;
  }
}
