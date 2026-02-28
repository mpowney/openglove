import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';
import { generateUUID } from '../../utils/UUID';

/**
 * InputHandler that strips control and format characters from text.
 * Removes ASCII control characters, zero-width characters, directional formatting,
 * and other problematic Unicode characters while preserving common whitespace (\t, \n, \r, space).
 * 
 * Stripped characters include:
 * - ASCII control characters (U+0000–U+001F, U+007F–U+009F) except \t, \n, \r
 * - Zero-width characters (U+200B–U+200D, U+FEFF, U+2060)
 * - Directional formatting (U+200E–U+200F, U+202A–U+202E, U+2066–U+2069)
 * - Line/paragraph separators (U+2028–U+2029)
 * - Soft hyphen (U+00AD)
 * - Replacement/object characters (U+FFFC–U+FFFD)
 */
export class ControlCharacterStripInputHandler extends BaseInputHandler {
  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const rawText = input.text ?? '';
    const normalisationLog = [];

    // Strip dangerous control and format characters
    let processedText = rawText;
    
    // Step 1: ASCII control characters (except \t \n \r which are 0x09, 0x0A, 0x0D)
    processedText = processedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Step 2: Zero-width characters
    processedText = processedText.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
    
    // Step 3: Directional formatting characters
    processedText = processedText.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
    
    // Step 4: Line/paragraph separators
    processedText = processedText.replace(/[\u2028\u2029]/g, '');
    
    // Step 5: Soft hyphen and other problematic characters
    processedText = processedText.replace(/[\u00AD\uFFFC\uFFFD]/g, '');

    const controlCharsStripped = processedText;
    
    if (controlCharsStripped !== rawText) {
      normalisationLog.push({
        name: 'control_character_stripping',
        params: { 
          removed: rawText.length - controlCharsStripped.length,
          categories: [
            'ascii_control',
            'zero_width',
            'directional_formatting',
            'line_separators',
            'soft_hyphen_and_replacement'
          ]
        },
      });
    }

    const cleanText = controlCharsStripped;

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
