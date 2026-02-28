import { BaseContextManager } from './BaseContextManager';

/** Default pass-through ContextManager */
export class DefaultContextManager extends BaseContextManager {
  async manage(input: string): Promise<string> {
    return input;
  }
}
