import { 
  BaseInputHandler, 
  InputHandlerInput, 
  InputHandlerOutput,
  SensitiveFlag,
  Mention 
} from './BaseInputHandler';
import { generateUUID } from '../../utils/UUID';

/**
 * InputHandler that performs pattern-based detection for sensitive information.
 * 
 * Detects:
 * - Email addresses
 * - Phone numbers (international formats)
 * - Credit card numbers (Visa, MasterCard, Amex, etc.)
 * - US Social Security Numbers (SSN)
 * - API keys (common formats)
 * - Private keys (PEM format indicators)
 * - Australian Medicare card numbers
 * - Australian Tax File Numbers (TFN)
 * - Australian passport numbers
 * - Australian BSB and account numbers
 */
export class PatternDetectionInputHandler extends BaseInputHandler {
  
  /**
   * Pattern definitions for sensitive data detection
   */
  private readonly patterns = {
    // Email addresses (RFC 5322 simplified)
    email: {
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      type: 'email',
      sensitive: false,
      maskAction: 'anonymize'
    },
    
    // Phone numbers (international formats)
    phone: {
      regex: /\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b/g,
      type: 'phone',
      sensitive: true,
      maskAction: 'mask'
    },
    
    // Credit card numbers (Luhn algorithm not validated, just pattern)
    creditCard: {
      regex: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      type: 'credit_card',
      sensitive: true,
      maskAction: 'mask'
    },
    
    // US Social Security Number
    ssn: {
      regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      type: 'ssn',
      sensitive: true,
      maskAction: 'remove'
    },
    
    // API keys (common patterns: 32-40 hex chars, or base64-like strings)
    apiKey: {
      regex: /\b(?:api[_-]?key|apikey|api[_-]?secret)[:\s=]+['"]?([a-zA-Z0-9_\-]{32,}|[A-Za-z0-9+/]{40,}={0,2})['"]?\b/gi,
      type: 'api_key',
      sensitive: true,
      maskAction: 'remove'
    },
    
    // Private keys (PEM format)
    privateKey: {
      regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
      type: 'private_key',
      sensitive: true,
      maskAction: 'remove'
    },
    
    // Australian Medicare card number (10 digits with optional position)
    medicareCard: {
      regex: /\b\d{4}\s?\d{5}\s?\d(?:\s?-?\s?\d)?\b/g,
      type: 'au_medicare',
      sensitive: true,
      maskAction: 'mask'
    },
    
    // Australian Tax File Number (8 or 9 digits, often formatted)
    tfn: {
      regex: /\b\d{3}\s?\d{3}\s?\d{3}\b/g,
      type: 'au_tfn',
      sensitive: true,
      maskAction: 'remove'
    },
    
    // Australian passport number (letter followed by 7 digits)
    auPassport: {
      regex: /\b[A-Z]\d{7}\b/g,
      type: 'au_passport',
      sensitive: true,
      maskAction: 'mask'
    },
    
    // Australian BSB (6 digits, often formatted as XXX-XXX)
    bsb: {
      regex: /\b\d{3}-\d{3}\b/g,
      type: 'au_bsb',
      sensitive: true,
      maskAction: 'mask'
    },
    
    // Australian bank account number (6-10 digits)
    bankAccount: {
      regex: /\b(?:account|acc)[\s#:]*(\d{6,10})\b/gi,
      type: 'au_bank_account',
      sensitive: true,
      maskAction: 'mask'
    },
    
    // URLs (for mention detection, not necessarily sensitive)
    url: {
      regex: /\b(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*\b/gi,
      type: 'url',
      sensitive: false,
      maskAction: 'include'
    }
  };

  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const rawText = input.text ?? '';
    const normalisationLog = [];
    const sensitiveFlags: SensitiveFlag[] = [];
    const mentions: Mention[] = [];

    // Detect all patterns
    for (const [patternName, pattern] of Object.entries(this.patterns)) {
      const matches = [...rawText.matchAll(pattern.regex)];
      
      for (const match of matches) {
        const matchedText = match[0];
        const startIndex = match.index ?? 0;
        const endIndex = startIndex + matchedText.length;
        
        const span = { start: startIndex, end: endIndex };

        if (pattern.sensitive) {
          // Add to sensitive flags
          sensitiveFlags.push({
            type: pattern.type,
            span,
            maskAction: pattern.maskAction
          });
        } else {
          // Add to mentions (non-sensitive patterns like emails, URLs)
          mentions.push({
            type: pattern.type,
            value: matchedText,
            anonymize: pattern.maskAction === 'anonymize'
          });
        }
      }
    }

    if (sensitiveFlags.length > 0 || mentions.length > 0) {
      normalisationLog.push({
        name: 'pattern_detection',
        params: {
          sensitive_patterns_found: sensitiveFlags.length,
          mentions_found: mentions.length,
          types_detected: [
            ...new Set([
              ...sensitiveFlags.map(f => f.type),
              ...mentions.map(m => m.type)
            ])
          ]
        },
      });
    }

    const cleanText = rawText;

    // Calculate text lengths
    const lengths = {
      chars: cleanText.length,
      words: cleanText.split(/\s+/).filter(w => w.length > 0).length,
      tokens: 0,
    };

    // Carry caller tags forward as generic metadata
    const metadata: Record<string, any> | undefined = input.clientTags
      ? { ...input.clientTags }
      : undefined;

    // Parse the ISO-8601 timestamp supplied by the caller, fall back to now
    const ts = input.timestamp ? Date.parse(input.timestamp) : Date.now();

    // Determine privacy action based on detected patterns
    let privacyAction: 'include' | 'redact' | 'summarize-only' = 'include';
    if (sensitiveFlags.length > 0) {
      // If we have highly sensitive data (private keys, SSN), recommend redaction
      const highRiskTypes = ['private_key', 'ssn', 'api_key', 'au_tfn'];
      const hasHighRisk = sensitiveFlags.some(f => highRiskTypes.includes(f.type));
      privacyAction = hasHighRisk ? 'redact' : 'summarize-only';
    }

    return {
      id: input.id || generateUUID(),
      type: 'full',
      originalText: rawText,
      cleanText,
      role: 'user',
      language: input.languageHint || 'en',
      timestamp: input.timestamp,
      clientLocale: input.clientLocale,
      clientPlatform: input.clientPlatform,
      source: input.source,
      sessionId: input.sessionId,
      routingHint: input.routingHint,
      lengths,
      sensitiveFlags: sensitiveFlags.length > 0 ? sensitiveFlags : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
      privacyAction,
      normalisationLog,
      metadata,
      ts: isNaN(ts) ? Date.now() : ts,
    };
  }
}
