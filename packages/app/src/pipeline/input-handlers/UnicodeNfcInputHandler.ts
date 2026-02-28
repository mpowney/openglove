import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';
import { generateUUID } from '../../utils/UUID';

/**
 * InputHandler that performs Unicode NFC normalisation.
 * Strips control characters and applies Unicode Normalization Form Canonical Composition.
 */
export class UnicodeNfcInputHandler extends BaseInputHandler {
  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const rawText = input.text ?? '';
    const normalisationLog = [];

    // Step 1: Strip control characters (except common whitespace: \t, \n, \r)
    const controlCharsStripped = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    if (controlCharsStripped !== rawText) {
      normalisationLog.push({
        name: 'control_character_stripping',
        params: { removed: rawText.length - controlCharsStripped.length },
      });
    }

    // Step 2: Apply Unicode NFC normalisation
    const nfcNormalised = controlCharsStripped.normalize('NFC');
    if (nfcNormalised !== controlCharsStripped) {
      normalisationLog.push({
        name: 'unicode_nfc_normalisation',
        params: { form: 'NFC' },
      });
    }

    // Step 3: Normalise whitespace (collapse multiple spaces, trim)
    const whitespaceNormalised = nfcNormalised
      .replace(/\s+/g, ' ')  // Collapse multiple whitespace to single space
      .trim();                // Remove leading/trailing whitespace

    if (whitespaceNormalised !== nfcNormalised) {
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
      originalText: controlCharsStripped,
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
