import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';

/** Generates a RFC 4122 UUID v4 without requiring external dependencies. */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Default InputHandler: normalises and validates the incoming message. */
export class DefaultInputHandler extends BaseInputHandler {
  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const originalText = input.text ?? '';
    const cleanText = originalText.trim();

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

    return {
      id: generateUUID(),
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
  }
}
