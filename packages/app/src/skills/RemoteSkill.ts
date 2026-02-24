import * as net from 'net';
import * as path from 'path';
import { BaseSkill, classNameToSocketName, JSONRPCRequest, JSONRPCResponse, Logger, SkillContext } from '@openglove/base';

const logger = new Logger('RemoteSkill');

/**
 * RemoteSkill connects to a Unix domain socket and makes JSON-RPC calls
 */
export class RemoteSkill extends BaseSkill {
  private socketPath: string;

  constructor(skillName: string, socketDir: string = '/tmp') {
    super({ name: skillName });
    this.socketPath = path.join(socketDir, `${classNameToSocketName(skillName)}.sock`);
  }

  async canHandle(_input: string): Promise<boolean> {
    return await this.call('canHandle', _input) as boolean;
  }

  async getInfo(): Promise<{ name: string; description?: string; tags: string[] }> {
    const debug = await this.call('getInfo') as { name: string; description?: string; tags: string[] };
    return debug;
  }

  async run(_input: any, _ctx?: SkillContext) {
    return await this.executeWithRunner(
      async (input: any, ctx?: SkillContext) => {
        return await this.call('run', input, ctx);
      },
      _input,
      _ctx
    );
  }

  /**
   * Make a JSON-RPC call to the socket server with n parameters
   */
  async call(method: string, ...params: unknown[]): Promise<unknown> {
    logger.log(`RemoteSkill calling method ${method} with params:`, params);
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      let responseBuffer = '';
      let requestId = String(Date.now());

      socket.on('connect', () => {
        const request: JSONRPCRequest = {
          jsonrpc: '2.0',
          method,
          params: params.length === 0 ? undefined : params.length === 1 ? params[0] : params,
          id: requestId,
        };
        socket.write(JSON.stringify(request) + '\n');
      });

      socket.on('data', (data) => {
        responseBuffer += data.toString();
        const lines = responseBuffer.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const response = JSON.parse(line) as JSONRPCResponse;
              if (response.id === requestId) {
                socket.end();
                if (response.error) {
                  reject(new Error(`RPC Error: ${response.error.message}`));
                } else {
                  resolve(response.result);
                }
              }
            } catch (err) {
              socket.end();
              reject(err);
            }
          }
        }

        responseBuffer = lines[lines.length - 1];
      });

      socket.on('error', (err) => {
        reject(err);
      });

      socket.on('end', () => {
        if (responseBuffer.trim()) {
          try {
            const response = JSON.parse(responseBuffer) as JSONRPCResponse;
            if (response.id === requestId) {
              if (response.error) {
                reject(new Error(`RPC Error: ${response.error.message}`));
              } else {
                resolve(response.result);
              }
            }
          } catch (err) {
            reject(err);
          }
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        socket.end();
        reject(new Error('Socket call timeout'));
      }, 30000);
    });
  }
}
