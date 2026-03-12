import { WebBrowserTool } from './tools/WebBrowserTool';

async function main() {
  const url = process.argv[2] || 'https://example.com';
  const tool = new WebBrowserTool();
  try {
    const res = await tool.run(JSON.stringify({ url, actions: [{ click: 'Learn more' }] }));
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error running WebBrowserTool:', err);
    process.exit(1);
  }
}

main();
