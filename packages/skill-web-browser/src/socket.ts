import { Logger, SocketServer } from '@openglove/base';
import { WebBrowserSkill } from './skills/WebBrowserSkill';

/**
 * Socket server for WebBrowserSkill
 * Listens on /tmp/web_browser_skill.sock and handles JSON-RPC requests
 */

const logger = new Logger('WebBrowserSkillServer');
logger.subscribe(Logger.ConsoleSubscriber());

async function main() {
  const server = new SocketServer('WebBrowserSkill');
  let skill = new WebBrowserSkill();

  // Register the "run" method
  server.registerMethod('canHandle', async (params: any) => {
    const input = Array.isArray(params) ? params[0] : params;
    return await skill.canHandle(input as string);
  });

  server.registerMethod('getInfo', async (params: any) => {
    return await skill.getInfo();
  });

  server.registerMethod('runSkill', async (params: any) => {
    let input: any;
    let ctx: any;

    if (Array.isArray(params)) {
      // Multiple params sent as array
      [input, ctx] = params;
    } else {
      // Single param or undefined
      input = params;
    }

    const result = await skill.run(input, ctx);
    logger.log('runSkill result:', result);

    return result;
  });

  try {
    await server.start();
    logger.log(`Server listening on ${server.getSocketPath()}`);
    
    // Keep the server running
    await new Promise(() => {});
  } catch (err) {
    logger.error(`Failed to start server: ${err}`);
    process.exit(1);
  }
}

main();
