import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';
import { generateUUID } from '../../utils/UUID';

/**
 * InputHandler that parses and reformats dates, numbers, and currencies to canonical forms.
 * 
 * Transformations:
 * - Dates: Converts common date formats to ISO 8601 (YYYY-MM-DD)
 * - Numbers: Normalizes thousand separators and decimal points
 * - Currencies: Standardizes currency amounts to numeric form with currency code
 */
export class CanonicalFormatInputHandler extends BaseInputHandler {
  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const rawText = input.text ?? '';
    const normalisationLog = [];
    let processedText = rawText;
    let transformations = 0;

    // Step 1: Normalize dates to ISO 8601 format (YYYY-MM-DD)
    // Match common date formats: MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY, Month DD, YYYY
    const datePatterns = [
      // MM/DD/YYYY or DD/MM/YYYY with slashes
      { 
        pattern: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, 
        format: (match: string, p1: string, p2: string, p3: string) => {
          // Assume MM/DD/YYYY for US locale, could use clientLocale hint
          const month = p1.padStart(2, '0');
          const day = p2.padStart(2, '0');
          return `${p3}-${month}-${day}`;
        }
      },
      // DD-MM-YYYY with dashes
      {
        pattern: /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g,
        format: (match: string, p1: string, p2: string, p3: string) => {
          const day = p1.padStart(2, '0');
          const month = p2.padStart(2, '0');
          return `${p3}-${month}-${day}`;
        }
      },
      // Month DD, YYYY (e.g., "January 15, 2024")
      {
        pattern: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
        format: (match: string, monthName: string, day: string, year: string) => {
          const months: Record<string, string> = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
          };
          const month = months[monthName.toLowerCase()];
          return `${year}-${month}-${day.padStart(2, '0')}`;
        }
      }
    ];

    datePatterns.forEach(({ pattern, format }) => {
      const original = processedText;
      processedText = processedText.replace(pattern, format as any);
      if (processedText !== original) transformations++;
    });

    // Step 2: Normalize numbers with thousand separators
    // Match numbers like "1,234.56" or "1.234,56" (European format)
    const numberPattern = /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/g;
    processedText = processedText.replace(numberPattern, (match) => {
      transformations++;
      // Remove commas from US-style numbers
      return match.replace(/,/g, '');
    });

    // European-style numbers (1.234,56 -> 1234.56)
    const euroNumberPattern = /\b(\d{1,3}(?:\.\d{3})+,\d+)\b/g;
    processedText = processedText.replace(euroNumberPattern, (match) => {
      transformations++;
      // Convert European format to standard: remove dots, replace comma with dot
      return match.replace(/\./g, '').replace(/,/, '.');
    });

    // Step 3: Normalize currency amounts
    // Pattern: $1,234.56, €1.234,56, £100, ¥1000, etc.
    const currencyPatterns = [
      // US Dollar format: $1,234.56
      {
        pattern: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/g,
        format: (match: string, amount: string) => {
          const normalized = amount.replace(/,/g, '');
          return `${normalized} USD`;
        }
      },
      // Euro format: €1,234.56 or €1.234,56
      {
        pattern: /€\s*(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)\b/g,
        format: (match: string, amount: string) => {
          // Determine if it's EU format (uses . for thousands, , for decimal)
          const hasDotThousands = /\d\.\d{3}/.test(amount);
          let normalized = amount;
          if (hasDotThousands) {
            normalized = amount.replace(/\./g, '').replace(/,/, '.');
          } else {
            normalized = amount.replace(/,/g, '');
          }
          return `${normalized} EUR`;
        }
      },
      // British Pound: £1,234.56
      {
        pattern: /£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/g,
        format: (match: string, amount: string) => {
          const normalized = amount.replace(/,/g, '');
          return `${normalized} GBP`;
        }
      },
      // Japanese Yen: ¥1,234
      {
        pattern: /¥\s*(\d{1,3}(?:,\d{3})*)\b/g,
        format: (match: string, amount: string) => {
          const normalized = amount.replace(/,/g, '');
          return `${normalized} JPY`;
        }
      }
    ];

    currencyPatterns.forEach(({ pattern, format }) => {
      const original = processedText;
      processedText = processedText.replace(pattern, format as any);
      if (processedText !== original) transformations++;
    });

    const cleanText = processedText;

    if (transformations > 0) {
      normalisationLog.push({
        name: 'canonical_format_normalisation',
        params: {
          transformations,
          types: ['dates', 'numbers', 'currencies']
        },
      });
    }

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
      normalisationLog,
      metadata,
      ts: isNaN(ts) ? Date.now() : ts,
    };
  }
}
