import { BaseSkill, SkillContext } from '@openglove/base';

export interface WebBrowserSkillResult {
  url: string;
  html: string;
  markdown: string;
  text: string;
  links: { href: string; text: string }[];
  buttons: { text: string; location: string }[];
}

export interface WebBrowserSkillAction { 
  click?: string; 
  fill?: Record<string, string>; 
}

export interface WebBrowserSkillInput {
  url: string;
  actions?: WebBrowserSkillAction[];
}

export class WebBrowserSkill extends BaseSkill {
  constructor(opts: { id?: string; name?: string; description?: string; tags?: string[] } = {}) {
    super({ 
      name: opts.name ?? 'WebBrowserSkill', 
      description: opts.description ?? 'Handles web browser related tasks', 
      tags: opts.tags ?? ['web-browser'] 
    });
  }

  canHandle(input: string): boolean {
    const s = (input || '').toLowerCase();
    return /\b(browse a web page|browse to|open site|open a web page)\b/.test(s);
  }

  async run(_input: string, _ctx?: SkillContext) {
    let config: WebBrowserSkillInput;
    
    // Try to parse _input as JSON; if it fails, treat it as a plain URL string
    try {
      config = JSON.parse(_input || '{}');
    } catch {
      config = { url: (_input || '').trim() };
    }

    if (!config.url) throw new Error('No URL provided to WebBrowserSkill.run');

    const url = /^(https?:)?\/\//i.test(config.url) ? config.url : `http://${config.url}`;

    // Dynamic import so we don't force-playwright as a hard dependency at module load
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    const buttonsSelector = 'button, [role="button"], input[type=button], input[type=submit]';
    const linksSelector = 'a[href]';

    try {
      await page.goto(url, { waitUntil: 'networkidle' });

      // Execute actions if specified
      if (config.actions && Array.isArray(config.actions)) {
        for (const action of config.actions) {
          // Handle fill action: fill in form fields
          if (action.fill) {
            for (const [selector, value] of Object.entries(action.fill)) {
              await page.fill(selector, value);
            }
          }

          // Handle click action: find button or link by text and click it
          if (action.click) {
            const clickText = action.click;
            
            // Try to find a button with matching text
            const button = await page.locator(buttonsSelector)
              .filter({ hasText: clickText })
              .first();
            
            if (await button.count() > 0) {
              await button.click();
            } else {
              // Try to find a link with matching text
              const link = await page.locator(linksSelector)
                .filter({ hasText: clickText })
                .first();
              
              if (await link.count() > 0) {
                await link.click();
              } else {
                throw new Error(`Could not find button or link with text: ${clickText}`);
              }
            }
            
            // Wait for navigation or network idle after click
            await page.waitForLoadState('networkidle').catch(() => {});
          }

        }
      }

      const html = await page.content();
      const text = (await page.evaluate(() => document.body ? document.body.innerText : '')) || '';

      const links = await page.$$eval(linksSelector, (els: any) =>
        els.map((e: any) => ({ href: e.href, text: (e.innerText || '').trim() }))
      );

      const buttons = await page.$$eval(
        buttonsSelector,
        (els: any) => {
          function cssPath(el: any) {
            if (!el || !el.ownerDocument) return '';
            const parts: string[] = [];
            while (el && el.nodeType === 1 && el.tagName.toLowerCase() !== 'html') {
              let part = el.tagName.toLowerCase();
              if (el.id) {
                part += `#${el.id}`;
                parts.unshift(part);
                break;
              }
              const parent = el.parentNode as any;
              if (!parent) {
                parts.unshift(part);
                break;
              }
              const children = Array.prototype.filter.call(parent.children, (c: any) => c.tagName === el.tagName);
              const sameTagIndex = Array.prototype.indexOf.call(parent.children, el) + 1;
              part += `:nth-child(${sameTagIndex})`;
              parts.unshift(part);
              el = parent;
            }
            return parts.join(' > ');
          }

          return els.map((e: any) => ({
            text: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim(),
            selector: cssPath(e),
          }));
        }
      );

      function htmlToMarkdown(h: string) {
        let s = h;
        s = s.replace(/<h1[^>]*>(.*?)<\/h1>/gis, '\n# $1\n\n');
        s = s.replace(/<h2[^>]*>(.*?)<\/h2>/gis, '\n## $1\n\n');
        s = s.replace(/<h3[^>]*>(.*?)<\/h3>/gis, '\n### $1\n\n');
        s = s.replace(/<h4[^>]*>(.*?)<\/h4>/gis, '\n#### $1\n\n');
        s = s.replace(/<h5[^>]*>(.*?)<\/h5>/gis, '\n##### $1\n\n');
        s = s.replace(/<h6[^>]*>(.*?)<\/h6>/gis, '\n###### $1\n\n');
        s = s.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
        s = s.replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n');
        s = s.replace(/<a[^>]*href=["']?([^"' >]+)["']?[^>]*>(.*?)<\/a>/gis, '[$2]($1)');
        s = s.replace(/<br\s*\/?>/gis, '\n');
        s = s.replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**');
        s = s.replace(/<b[^>]*>(.*?)<\/b>/gis, '**$1**');
        s = s.replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*');
        s = s.replace(/<i[^>]*>(.*?)<\/i>/gis, '_$1_');
        s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        s = s.replace(/<[^>]+>/g, '');
        s = s.replace(/&nbsp;/g, ' ');
        s = s.replace(/&amp;/g, '&');
        s = s.replace(/&lt;/g, '<');
        s = s.replace(/&gt;/g, '>');
        return s.trim();
      }

      const markdown = htmlToMarkdown(html);

      return {
        url,
        html,
        markdown,
        text,
        links,
        buttons,
      };
    } finally {
      await browser.close();
    }
  }
}
