/**
 * Abstract base class for pipeline output handling.
 * Responsible for formatting or delivering the final result of the pipeline.
 */
export abstract class OutputHandler {
  abstract output(result: string): Promise<string>;
}

/** Default pass-through OutputHandler */
export class DefaultOutputHandler extends OutputHandler {
  async output(result: string): Promise<string> {
    return result;
  }
}
