/**
 * Abstract base class for pipeline data processing/transformation.
 * Responsible for transforming or enriching the data received from the InputHandler.
 */
export abstract class Processor {
  abstract process(input: string): Promise<string>;
}

/** Default pass-through Processor */
export class DefaultProcessor extends Processor {
  async process(input: string): Promise<string> {
    return input;
  }
}
