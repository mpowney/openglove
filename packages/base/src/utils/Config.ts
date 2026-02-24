export type ConfigMap = Record<string, any> | null;

const cache: Record<string, ConfigMap> = {};

import { Logger } from './Logger';
import { loadSecrets, replaceSecrets } from './Secrets';
const logger = new Logger('Config');

export function loadConfig(path: string, secretsDir?: string): ConfigMap {
  if (!path) return null;
  if (Object.prototype.hasOwnProperty.call(cache, path)) return cache[path];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const pathModule = require('path');
    if (!fs.existsSync(path)) {
      cache[path] = null;
      return null;
    }
    const raw = fs.readFileSync(path, { encoding: 'utf8' });
    let parsed = JSON.parse(raw);
    
    // Replace secrets if secretsDir is provided
    if (secretsDir) {
      const secrets = loadSecrets(secretsDir);
      parsed = replaceSecrets(parsed, secrets);
    } else {
      // Auto-detect secrets directory relative to config file
      const configDir = pathModule.dirname(path);
      const defaultSecretsDir = pathModule.join(configDir, 'secrets');
      if (fs.existsSync(defaultSecretsDir)) {
        const secrets = loadSecrets(defaultSecretsDir);
        parsed = replaceSecrets(parsed, secrets);
      }
    }
    
    cache[path] = parsed;
    return parsed;
  } catch (e: unknown) {
    logger.warn('Failed to load config', { path, error: e });
    cache[path] = null;
    return null;
  }
}
