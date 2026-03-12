/// <reference types="jest" />

import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';

import { RemoteTool } from '../../src/skills/RemoteTool';
import { classNameToSocketName } from '@openglove/base';

const SOCKET_DIR = '/tmp';
const SKILL_NAME = 'WebBrowserTool';
const SOCKET_NAME = classNameToSocketName(SKILL_NAME);
const SOCKET_PATH = path.join(SOCKET_DIR, `${SOCKET_NAME}.sock`);

jest.setTimeout(60000);

describe('WebBrowserTool socket integration', () => {
  let socketAvailable = false;

  beforeAll(async () => {
    // Check if socket file exists
    if (!fs.existsSync(SOCKET_PATH)) {
      socketAvailable = false;
      return;
    }

    // Try to connect to verify it's actually listening
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(SOCKET_PATH);
        
        socket.on('connect', () => {
          socket.end();
          resolve();
        });

        socket.on('error', (err) => {
          reject(err);
        });

        // 2 second timeout for connection attempt
        setTimeout(() => {
          socket.end();
          reject(new Error('Connection timeout'));
        }, 2000);
      });

      socketAvailable = true;
    } catch (_err) {
      socketAvailable = false;
    }
  });

  it('should confirm WebBrowserTool socket availability', () => {
    if (!socketAvailable) {
      console.warn(
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️  WebBrowserTool socket server is not running at ${SOCKET_PATH}\n` +
        `\n` +
        `To start the server, run in a separate terminal:\n` +
        `  cd packages/skill-web-browser\n` +
        `  pnpm dev-socket\n` +
        `\n` +
        `or after building:\n` +
        `  cd packages/skill-web-browser\n` +
        `  pnpm socket\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      );
    }

    expect(socketAvailable).toBe(true);
  });

  it('should successfully call getInfo via socket', async () => {
    if (!socketAvailable) {
      console.warn('Skipping test: socket not available');
      return;
    }

    const client = new RemoteTool(SKILL_NAME, SOCKET_DIR);

    const info = await client.getInfo();

    expect(info).toBeDefined();
    expect(info.name).toBe(SKILL_NAME);
    expect(info.description).toBeDefined();
    expect(Array.isArray(info.tags)).toBe(true);
  });

  it('should successfully call canHandle via socket', async () => {
    if (!socketAvailable) {
      console.warn('Skipping test: socket not available');
      return;
    }

    const client = new RemoteTool(SKILL_NAME, SOCKET_DIR);

    const canHandleTrue = await client.canHandle(
      'browse to https://example.com'
    );
    expect(canHandleTrue).toBe(true);

    const canHandleFalse = await client.canHandle('what is the weather');
    expect(canHandleFalse).toBe(false);
  });

  it('should successfully call run via socket', async () => {
    if (!socketAvailable) {
      console.warn('Skipping test: socket not available');
      return;
    }

    const client = new RemoteTool(SKILL_NAME, SOCKET_DIR);

    const result = await client.run({
        url: 'https://example.com',
        actions: []
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});
