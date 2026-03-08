import { BaseGenerativeModel } from '../../models/generative';
import { InputHandlerOutput } from '../input-handlers';
import { BaseContextManager } from './BaseContextManager';

/** Default pass-through ContextManager */
export class DefaultContextManager extends BaseContextManager {
  name?: string = 'DefaultContextManager';

  async manage(input: InputHandlerOutput, config: Record<string, any>): Promise<InputHandlerOutput> {
    if (config.planningModel && config.planningModel.type) {
      this.planningModel = await BaseGenerativeModel.require(config.planningModel);
    }
    return input;
  }
}
