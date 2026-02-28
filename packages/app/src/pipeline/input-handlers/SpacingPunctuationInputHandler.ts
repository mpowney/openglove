import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';
import { generateUUID } from '../../utils/UUID';

/**
 * InputHandler that normalizes spacing, punctuation, and line endings.
 * 
 * Normalizations:
 * - Line endings: Converts CRLF (\r\n) and CR (\r) to LF (\n)
 * - Spacing: Normalizes multiple spaces, tabs to spaces, and fixes spacing around punctuation
 * - Punctuation: Converts smart quotes, ellipsis, em/en dashes to standard ASCII equivalents
 * - Multiple punctuation: Reduces repeated punctuation (e.g., "!!!" → "!")
 */
export class SpacingPunctuationInputHandler extends BaseInputHandler {
  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const rawText = input.text ?? '';
    const normalisationLog = [];
    let processedText = rawText;
    const appliedSteps: string[] = [];

    // Step 1: Normalize line endings to LF (\n)
    const originalLineEndings = processedText;
    processedText = processedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (processedText !== originalLineEndings) {
      appliedSteps.push('line_endings');
    }

    // Step 2: Normalize smart quotes and typographic quotes to straight quotes
    const originalQuotes = processedText;
    processedText = processedText
      .replace(/[\u2018\u2019\u201B]/g, "'")  // Smart single quotes → '
      .replace(/[\u201C\u201D\u201F]/g, '"')  // Smart double quotes → "
      .replace(/[\u2039]/g, '<')              // Single left-pointing angle quote
      .replace(/[\u203A]/g, '>');             // Single right-pointing angle quote
    if (processedText !== originalQuotes) {
      appliedSteps.push('smart_quotes');
    }

    // Step 3: Normalize dashes and hyphens
    const originalDashes = processedText;
    processedText = processedText
      .replace(/[\u2013\u2014]/g, '-')        // En dash, em dash → hyphen
      .replace(/\u2212/g, '-')                // Minus sign → hyphen
      .replace(/\u2015/g, '-');               // Horizontal bar → hyphen
    if (processedText !== originalDashes) {
      appliedSteps.push('dashes');
    }

    // Step 4: Normalize ellipsis
    const originalEllipsis = processedText;
    processedText = processedText
      .replace(/\u2026/g, '...')              // Ellipsis character → three dots
      .replace(/\.{4,}/g, '...');             // Multiple dots (4+) → three dots
    if (processedText !== originalEllipsis) {
      appliedSteps.push('ellipsis');
    }

    // Step 5: Normalize bullet points and list markers
    const originalBullets = processedText;
    processedText = processedText
      .replace(/[\u2022\u2023\u2043]/g, '•')  // Various bullets → standard bullet
      .replace(/[\u25E6\u25AA\u25AB]/g, '•'); // Square bullets → standard bullet
    if (processedText !== originalBullets) {
      appliedSteps.push('bullets');
    }

    // Step 6: Reduce multiple consecutive punctuation marks
    const originalMultiPunct = processedText;
    processedText = processedText
      .replace(/!{2,}/g, '!')                 // Multiple exclamation → single
      .replace(/\?{2,}/g, '?')                // Multiple question → single
      .replace(/,{2,}/g, ',')                 // Multiple commas → single
      .replace(/;{2,}/g, ';')                 // Multiple semicolons → single
      .replace(/:{2,}/g, ':');                // Multiple colons → single (except ::)
    if (processedText !== originalMultiPunct) {
      appliedSteps.push('multiple_punctuation');
    }

    // Step 7: Normalize spacing around punctuation
    const originalPunctSpacing = processedText;
    processedText = processedText
      .replace(/\s+([,.;:!?])/g, '$1')        // Remove space before punctuation
      .replace(/([,.;:])(\S)/g, '$1 $2')      // Add space after punctuation (if missing)
      .replace(/([!?])(\S)/g, '$1 $2');       // Add space after ! or ? (if missing)
    if (processedText !== originalPunctSpacing) {
      appliedSteps.push('punctuation_spacing');
    }

    // Step 8: Normalize whitespace (tabs to spaces, multiple spaces to single)
    const originalWhitespace = processedText;
    processedText = processedText
      .replace(/\t/g, ' ')                    // Tabs → spaces
      .replace(/ {2,}/g, ' ')                 // Multiple spaces → single space
      .replace(/^ +/gm, '')                   // Remove leading spaces on lines
      .replace(/ +$/gm, '');                  // Remove trailing spaces on lines
    if (processedText !== originalWhitespace) {
      appliedSteps.push('whitespace');
    }

    // Step 9: Normalize multiple consecutive line breaks
    const originalLineBreaks = processedText;
    processedText = processedText.replace(/\n{3,}/g, '\n\n');  // Max 2 consecutive newlines
    if (processedText !== originalLineBreaks) {
      appliedSteps.push('line_breaks');
    }

    // Step 10: Trim leading and trailing whitespace
    const originalTrim = processedText;
    processedText = processedText.trim();
    if (processedText !== originalTrim) {
      appliedSteps.push('trim');
    }

    const cleanText = processedText;

    if (appliedSteps.length > 0) {
      normalisationLog.push({
        name: 'spacing_punctuation_normalisation',
        params: {
          steps: appliedSteps,
          original_length: rawText.length,
          normalized_length: cleanText.length
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
