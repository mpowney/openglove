import { Message } from "../models/BaseModel";

export interface OutputHandlerOptions {
  emitMessage?: (message: Message) => Promise<void>;
}

/**
 * Abstract base class for pipeline output handling.
 * Responsible for formatting or delivering the final result of the pipeline.
 */
export abstract class BaseOutputHandler {
  protected emitMessage?: (message: Message) => Promise<void>;

  constructor(opts: OutputHandlerOptions = {}) {
    this.emitMessage = opts.emitMessage;
  }

  abstract output(result: string): Promise<string>;
}

/** Default pass-through OutputHandler */
export class DefaultOutputHandler extends BaseOutputHandler {
  async output(result: string): Promise<string> {
    return result;
  }
}
