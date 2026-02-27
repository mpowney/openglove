/**
 * Abstract base class for pipeline input ingestion.
 * Responsible for receiving and validating raw input before processing.
 */
export abstract class BaseInputHandler {
  abstract handle(input: string): Promise<string>;
}

/** Default pass-through InputHandler */
export class DefaultInputHandler extends BaseInputHandler {
  async handle(input: string): Promise<string> {
    return input;
  }
}
