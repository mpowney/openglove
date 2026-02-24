/**
 * Example demonstrating Logger secret redaction
 * 
 * When secrets are loaded using loadSecrets(), they are automatically
 * registered with the Logger. Any log messages or metadata containing
 * those secret values will have them replaced with [REDACTED].
 */

import { Logger, loadSecrets } from '@openglove/base';

// Setup console logging
const logger = new Logger('Example');
Logger.subscribe(Logger.ConsoleSubscriber());

// Load secrets - this automatically registers them for redaction
const secrets = loadSecrets('./secrets');

// Example: logging a message that contains a secret value
// If secrets contains { "api-key": "super-secret-key-123" }
logger.log('Connecting to API with key: super-secret-key-123');
// Output: [timestamp] [Example] INFO: Connecting to API with key: [REDACTED]

// Example: logging metadata that contains secrets
logger.log('Configuration loaded', {
  apiKey: 'super-secret-key-123',
  baseUrl: 'https://api.example.com'
});
// Output: [timestamp] [Example] INFO: Configuration loaded {"apiKey":"[REDACTED]","baseUrl":"https://api.example.com"}

// Secret values in nested objects and arrays are also redacted
logger.log('Full config', {
  database: {
    password: 'super-secret-key-123'
  },
  apiKeys: ['super-secret-key-123', 'another-key']
});
// Output: All instances of the secret are replaced with [REDACTED]
