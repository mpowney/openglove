import { RemoteSkill } from './skills/RemoteSkill';
import { Logger, classNameToSocketName } from '@openglove/base';

const logger = new Logger('testSkillClient');
logger.subscribe(Logger.ConsoleSubscriber());

async function main() {
  const client = new RemoteSkill(classNameToSocketName('WebBrowserSkill'));

  try {
    logger.log('Calling WebBrowserSkill.run via socket...');
    const result = await client.call('run', {
      input: JSON.stringify({ url: 'https://example.com', actions: [{ click: 'Learn more' }] }),
    });
    logger.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
