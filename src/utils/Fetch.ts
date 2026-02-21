import Logger from "./Logger";

const logger = new Logger('Fetch');

export async function fetchWithTimeout(url: string, method: "GET" | "POST" | "PUT" | "DELETE", headers: any = {}, payload?: any, timeout = 15000): Promise<Response | undefined> {
    try {
        // @ts-ignore
        if (typeof fetch === 'function') {
            return fetch(url, { 
                method: method, 
                headers: headers,
                body: payload ? JSON.stringify(payload) : undefined
            });
        }
    } catch (e: unknown) {
        logger.warn('fetch sendResponse failed', { error: e });
    }

    // Node fallback
    try {
        const { URL } = await import('url');
        const u = new URL(url);
        const lib = u.protocol === 'https:' ? await import('https') : await import('http');
        return new Promise((resolve, reject) => {
            const req = lib.request(u, { method: 'POST', headers: { 'content-type': 'application/json' } } as any, (res: any) => {
                res.on('data', ()=>{});
                res.on('end', resolve);
            });
            req.on('error', reject);
            req.write(JSON.stringify(payload));
            req.end();
        });
    } catch (e: unknown) {
        logger.error('sendResponse failed', { error: e });
    }

    return undefined;
}

export async function *fetchWithTimeoutAndStream(url: string, method: "GET" | "POST" | "PUT" | "DELETE", headers: any = {}, payload?: any, timeout = 15000): AsyncIterable<string | any> {
    
    // Try fetch streaming
    try {
      // @ts-ignore
      if (typeof fetch === 'function') {
        const resp = await fetch(url, { method: method, headers, body: payload ? JSON.stringify(payload) : undefined });
        if (!resp.body) return;
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line) continue;
            try { yield JSON.parse(line); } catch { yield line; }
          }
        }
        if (buffer.trim()) {
          try { yield JSON.parse(buffer); } catch { yield buffer; }
        }
        return;
      }
    } catch (e: unknown) {
      logger.verbose('fetch streaming failed, falling back to node http(s)', { error: e });
    }

    // Node http fallback: make request and stream data
    const { URL } = await import('url');
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? await import('https') : await import('http');
    const req = lib.request(u, { method: 'POST', headers, timeout: 15000 } as any);
    req.on('error', () => {});
    req.write(payload);
    req.end();

    const iterable = (async function* (reqStream: any) {
      for await (const chunk of reqStream) {
        const s = String(chunk);
        const parts = s.split(/\r?\n/).filter(Boolean);
        for (const p of parts) {
          try { yield JSON.parse(p); } catch { yield p; }
        }
      }
    })(await new Promise<any>((resolve) => {
      req.on('response', (res: any) => resolve(res));
    }));

    for await (const v of iterable) yield v;
  }