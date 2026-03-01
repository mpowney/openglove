import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';
import { generateUUID } from '../../utils/UUID';
import { WhitespaceNormalisationInputHandler } from './WhitespaceNormalisationInputHandler';
import { UnicodeNfcInputHandler } from './UnicodeNfcInputHandler';
import { LowercaseInputHandler } from './LowercaseInputHandler';
import { ControlCharacterStripInputHandler } from './ControlCharacterStripInputHandler';
import { CanonicalFormatInputHandler } from './CanonicalFormatInputHandler';
import { SpacingPunctuationInputHandler } from './SpacingPunctuationInputHandler';
import { PatternDetectionInputHandler } from './PatternDetectionInputHandler';
import { ModelMatchingInputHandler } from './ModelMatchingInputHandler';
import { Logger } from '@openglove/base';

const logger = new Logger('DefaultInputHandler');

/** Default InputHandler: normalises and validates the incoming message. */
export class DefaultInputHandler extends BaseInputHandler {
  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const originalText = input.text ?? '';

    try {

      let handlers = [
        new UnicodeNfcInputHandler(this.opts),
        new LowercaseInputHandler(this.opts),
        new ControlCharacterStripInputHandler(this.opts),
        new CanonicalFormatInputHandler(this.opts),
        new SpacingPunctuationInputHandler(this.opts),
        new PatternDetectionInputHandler(this.opts),
        new WhitespaceNormalisationInputHandler(this.opts),
      ]

      try {
        handlers.push(new ModelMatchingInputHandler(this.opts));
      }
      catch (err) {
        logger.warn('ModelMatchingInputHandler could not be initialized, skipping. Error:', err);
      }

      let cleanText = originalText;
      let workingInput = {...input, text: cleanText };
      let workingOutput: InputHandlerOutput | undefined = {
        id: input.id || generateUUID(),
        type: input.type || 'full',
        language: input.languageHint || 'en',
        ts: Date.now(),
        originalText,
        cleanText,
        role: input.role,
      };

      for (const handler of handlers) {
        const output = await handler.handle({
          ...workingInput
        });

        workingOutput = {
          ...output,
          cleanText: output.cleanText || cleanText,
          originalText: output?.originalText || output.originalText || originalText,
          metadata: {
            ...(workingOutput?.metadata || {}),
            ...(output.metadata || {}),
          },
          normalisationLog: [
            ...(workingOutput?.normalisationLog || []),
            ...(output.normalisationLog || []),
          ],
          ts: output.ts || Date.now(),
        };

        workingInput = { ...workingInput, 
          text: output.cleanText, 
          clientTags: {
            ...workingInput.clientTags,
            ...output.metadata,
          }
        };
      }

      
      // Carry caller tags forward as generic metadata.
      const metadata: Record<string, any> | undefined = input.clientTags
        ? { ...input.clientTags }
        : undefined;

      // Calculate text lengths
      const lengths = {
        chars: cleanText.length,
        words: cleanText.split(/\s+/).filter(w => w.length > 0).length,
        tokens: 0, // Would be populated by tokenization downstream if needed
      };

      return workingOutput || {
        id: input.id || generateUUID(),
        type: 'full',
        originalText,
        cleanText,
        role: input.role,
        language: input.languageHint || 'en',
        ts: Date.now(),
        clientLocale: input.clientLocale,
        clientPlatform: input.clientPlatform,
        source: input.source,
        sessionId: input.sessionId,
        routingHint: input.routingHint,
        lengths,
        metadata,
      };
    } catch (error) {
      logger.error('Error in DefaultInputHandler:', error);
      // In case of any error during processing, return the original text with minimal metadata
      return {
        id: input.id || generateUUID(),
        type: 'full',
        originalText,
        cleanText: originalText,
        role: input.role,
        language: input.languageHint || 'en',
        ts: Date.now(),
      };
    }
  }
}
