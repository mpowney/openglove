import { BaseTool, Logger } from '@openglove/base';
import { BaseGenerativeModel } from '../../models/generative';
import { PromptTemplate } from '../../utils/prompts';
import { InputHandlerOutput } from '../input-handlers';
import { BaseContextManager } from './BaseContextManager';
import { RemoteTool } from '../../tools';

const logger = new Logger('DefaultContextManager');

/** Default pass-through ContextManager */
export class DefaultContextManager extends BaseContextManager {
  name?: string = 'DefaultContextManager';

  async manage(input: InputHandlerOutput, config: Record<string, any>): Promise<InputHandlerOutput> {

    const availableTools: BaseTool[] = 
    Array.isArray(config.availableTools) ? await Promise.all(config.availableTools.map( async toolName => {
      return await BaseTool.require(toolName);
    })) : [];
    
    Array.isArray(config.availableRemoteTools) ? config.availableRemoteTools.forEach( async toolName => {
      const remoteTool = new RemoteTool(toolName);
      if (remoteTool) {
        availableTools.push(remoteTool);
      }
    }) : null;

    const planningPrompt = new PromptTemplate(config.planningPromptTemplate || 'context-managers/DefaultContextManager-tool-planning.txt');
    if (config.planningModel && config.planningModel.type) {
      
      const availableToolsInfo = await Promise.all(availableTools.map( tool => tool.getInfo() ));
      planningPrompt.setPlaceholders({ "tools-list": availableToolsInfo.map( info => `- ${info.name}: ${info.description}`).join("\n") });
      planningPrompt.setPlaceholders({ "input": input.cleanText });
      this.planningModel = await BaseGenerativeModel.require(config.planningModel.type, config.planningModel);
      
      if (this.planningModel) {

        const renderedPlanningPrompt = await planningPrompt.render();
        this.emitContextPrompt(renderedPlanningPrompt);
        const response = await this.planningModel.predict(await planningPrompt.render());
        if (response.response) {
          this.emitContextResponse(response);
          response.response.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0).forEach((line: string) => this.addProposedToolName(line));
        }
        logger.verbose('Planning model response for context management:', { response });
      }
    }
    return input;
  }
}
