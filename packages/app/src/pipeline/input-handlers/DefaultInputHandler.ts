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
    const text = (input.text ?? '').trim();

    // Parse the ISO-8601 timestamp supplied by the caller, fall back to now.
    const ts = input.timestamp ? Date.parse(input.timestamp) : Date.now();

    // Carry caller tags forward as generic metadata.
    const metadata: Record<string, any> | undefined = input.clientTags
      ? { ...input.clientTags }
      : undefined;

    return {
      id: generateUUID(),
      text,
      role: 'user',
      metadata,
      ts: isNaN(ts) ? Date.now() : ts,
    };
  }
}
