import { BaseSkill, Logger } from '@openglove/base';
import { BaseGenerativeModel } from '../../models/generative';
import { PromptTemplate } from '../../utils/prompts';
import { InputHandlerOutput } from '../input-handlers';
import { BaseContextManager } from './BaseContextManager';
import { RemoteSkill } from '../../skills';

const logger = new Logger('DefaultContextManager');

/** Default pass-through ContextManager */
export class DefaultContextManager extends BaseContextManager {
  name?: string = 'DefaultContextManager';

  async manage(input: InputHandlerOutput, config: Record<string, any>): Promise<InputHandlerOutput> {

    const availableSkills: BaseSkill[] = 
    Array.isArray(config.availableSkills) ? await Promise.all(config.availableSkills.map( async skillName => {
      return await BaseSkill.require(skillName);
    })) : [];
    
    Array.isArray(config.availableRemoteSkills) ? config.availableRemoteSkills.forEach( async skillName => {
      const remoteSkill = new RemoteSkill(skillName);
      if (remoteSkill) {
        availableSkills.push(remoteSkill);
      }
    }) : null;

    const planningPrompt = new PromptTemplate(config.planningPromptTemplate || 'context-managers/DefaultContextManager-skill-planning.txt');
    if (config.planningModel && config.planningModel.type) {
      const availableSkillsInfo = await Promise.all(availableSkills.map( skill => skill.getInfo() ));
      planningPrompt.setPlaceholders({ "skills-list": availableSkillsInfo.map( info => `- ${info.name}: ${info.description}`).join("\n") });
      planningPrompt.setPlaceholders({ "input": input.cleanText });
      this.planningModel = await BaseGenerativeModel.require(config.planningModel.type, config.planningModel);
      if (this.planningModel) {
        const response = await this.planningModel.predict(await planningPrompt.render());
        if (response.response) {
          response.response.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0).forEach((line: string) => this.addProposedToolName(line));
        }
        logger.verbose('Planning model response for context management:', { response });
      }
    }
    return input;
  }
}
