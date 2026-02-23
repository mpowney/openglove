import { WebBrowserSkill } from './skills/WebBrowserSkill';

async function main() {
  const url = process.argv[2] || 'https://example.com';
  const skill = new WebBrowserSkill();
  try {
    const res = await skill.run(JSON.stringify({ url, actions: [{ click: 'Learn more' }] }));
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error running WebBrowserSkill:', err);
    process.exit(1);
  }
}

main();
