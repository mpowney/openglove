/**
 * Abstract base class for pipeline action execution.
 * Responsible for executing the core action or operation based on processed input.
 */
export abstract class ActionHandler {
  abstract execute(input: string): Promise<string>;
}

/** Default pass-through ActionHandler */
export class DefaultActionHandler extends ActionHandler {
  async execute(input: string): Promise<string> {
    return input;
  }
}
