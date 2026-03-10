import { Message } from "../models/BaseModel";

export interface ActionHandlerOptions {
  emitMessage?: (message: Message) => Promise<void>;
}

/**
 * Abstract base class for pipeline action execution.
 * Responsible for executing the core action or operation based on processed input.
 */
export abstract class BaseActionHandler {
  protected emitMessage?: (message: Message) => Promise<void>;

  constructor(opts: ActionHandlerOptions = {}) {
    this.emitMessage = opts.emitMessage;
  }

  abstract execute(input: string): Promise<string>;
}

/** Default pass-through ActionHandler */
export class DefaultActionHandler extends BaseActionHandler {
  async execute(input: string): Promise<string> {
    return input;
  }
}
