import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';
import { generateUUID } from '../../utils/UUID';

/**
 * InputHandler that normalizes whitespace.
 * Collapses multiple consecutive whitespace characters to single spaces and trims leading/trailing whitespace.
 */
export class WhitespaceNormalisationInputHandler extends BaseInputHandler {
  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const rawText = input.text ?? '';
    const normalisationLog = [];

    // Normalise whitespace (collapse multiple spaces, trim)
    const whitespaceNormalised = rawText
      .replace(/\s+/g, ' ')  // Collapse multiple whitespace to single space
      .trim();                // Remove leading/trailing whitespace

    if (whitespaceNormalised !== rawText) {
      normalisationLog.push({
        name: 'whitespace_normalisation',
        params: {},
      });
    }

    const cleanText = whitespaceNormalised;

    // Calculate text lengths
    const lengths = {
      chars: cleanText.length,
      words: cleanText.split(/\s+/).filter(w => w.length > 0).length,
      tokens: 0, // Would be populated by tokenization downstream if needed
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
