export type ConfigMap = Record<string, any> | null;

const cache: Record<string, ConfigMap> = {};

export function loadConfig(path: string): ConfigMap {
  if (!path) return null;
  if (Object.prototype.hasOwnProperty.call(cache, path)) return cache[path];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    if (!fs.existsSync(path)) {
      cache[path] = null;
      return null;
    }
    const raw = fs.readFileSync(path, { encoding: 'utf8' });
    const parsed = JSON.parse(raw);
    cache[path] = parsed;
    return parsed;
  } catch (e) {
    cache[path] = null;
    return null;
  }
}
