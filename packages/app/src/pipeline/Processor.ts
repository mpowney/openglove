/**
 * Abstract base class for pipeline data processing/transformation.
 * Responsible for transforming or enriching the data received from the InputHandler.
 */
export abstract class BaseProcessor {
  abstract process(input: string): Promise<string>;
}

/** Default pass-through Processor */
export class DefaultProcessor extends BaseProcessor {
  async process(input: string): Promise<string> {
    return input;
  }
}
