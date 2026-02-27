import { BaseInputHandler, InputHandlerInput, InputHandlerOutput } from './BaseInputHandler';

/** Default InputHandler: normalises and validates the incoming message. */
export class DefaultInputHandler extends BaseInputHandler {
  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const text = (input.text ?? '').trim();

    return {
      id: input.id,
      text,
      role: 'user',
      metadata: input.metadata,
      ts: input.ts ?? Date.now(),
    };
  }
}
