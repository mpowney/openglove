import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';

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
      text,
      role: 'user',
      metadata,
      ts: isNaN(ts) ? Date.now() : ts,
    };
  }
}
