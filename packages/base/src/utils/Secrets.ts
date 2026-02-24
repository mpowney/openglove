import { Logger } from './Logger';
const logger = new Logger('Secrets');

type SecretsMap = Record<string, string>;
let secretsCache: SecretsMap | null = null;

/**
 * Load all secrets from JSON files in the secrets directory
 * @param secretsDir Path to the secrets directory
 * @returns A map of secret names to secret values
 */
export function loadSecrets(secretsDir: string): SecretsMap {
  if (secretsCache !== null) {
    return secretsCache;
  }

  const fs = require('fs');
  const path = require('path');
  const secrets: SecretsMap = {};

  try {
    if (!fs.existsSync(secretsDir)) {
      logger.warn('Secrets directory does not exist', { secretsDir });
      secretsCache = {};
      return secrets;
    }

    const files = fs.readdirSync(secretsDir);
    const jsonFiles = files.filter((file: string) => file.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(secretsDir, file);
      try {
        const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
        const parsed = JSON.parse(raw);
        
        // Merge secrets from this file into the secrets map
        Object.assign(secrets, parsed);
        logger.verbose('Loaded secrets from file', { file, count: Object.keys(parsed).length });
      } catch (e: unknown) {
        logger.warn('Failed to load secrets file', { file, error: e });
      }
    }

    secretsCache = secrets;
    logger.log('Loaded secrets', { totalCount: Object.keys(secrets).length });
    
    // Register secrets with Logger for redaction
    Logger.registerSecrets(secrets);
    
    return secrets;
  } catch (e: unknown) {
    logger.error('Failed to load secrets', { secretsDir, error: e });
    secretsCache = {};
    return secrets;
  }
}

/**
 * Replace secret placeholders in a value with actual secret values
 * Format: {SECRET:secret-name}
 * @param value The value that may contain secret placeholders
 * @param secrets Map of secret names to secret values
 * @returns The value with secrets replaced
 */
export function replaceSecrets(value: any, secrets: SecretsMap): any {
  if (typeof value === 'string') {
    // Replace all {SECRET:secret-name} patterns
    return value.replace(/\{SECRET:([^}]+)\}/g, (match, secretName) => {
      if (secretName in secrets) {
        return secrets[secretName];
      }
      logger.warn('Secret not found', { secretName });
      return match; // Keep the placeholder if secret not found
    });
  } else if (Array.isArray(value)) {
    return value.map((item) => replaceSecrets(item, secrets));
  } else if (typeof value === 'object' && value !== null) {
    const result: Record<string, any> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = replaceSecrets(value[key], secrets);
      }
    }
    return result;
  }
  return value;
}

/**
 * Clear the secrets cache (useful for testing)
 */
export function clearSecretsCache(): void {
  secretsCache = null;
  Logger.clearSecrets();
}
