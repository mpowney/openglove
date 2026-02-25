import { BaseSkill, BaseSkillRunner, loadConfig, Logger, SkillContext } from '@openglove/base';
import { BaseModel } from '../models/BaseModel';

const logger = new Logger('RinseAndRepeatRunner');

/**
 * RinseAndRepeatRunner initializes a language model and uses it before executing WebBrowserSkill.
 * Configuration comes from skillRunner.json with overrides applied on top of models.json.
 */
export class RinseAndRepeatRunner extends BaseSkillRunner {
  private model: BaseModel | null = null;
  private modelConfig: any = null;

  constructor(opts: any) {
    super();
    this.configDir = process.cwd(); // Set config directory to current working directory to find skillRunner.json
    // Set the models path relative to app package
    this.modelsPath = '../models';
  }

  async runBeforeSkill(skill: BaseSkill, input: any, _ctx?: SkillContext): Promise<void> {
    try {
      // Get skill info (name and description)
      const skillInfo = await skill.getInfo();
      const skillName = skillInfo.name || 'unknown';
      const skillDescription = skillInfo.description || 'No description available';
      const skillParamSchema = skillInfo.paramaterSchema || '{}';

      // Load configuration
      const skillRunnerConfig = this.loadSkillRunnerConfig();
      const modelsConfig = this.loadModelsConfig();

      const runBeforeModelConfig = skillRunnerConfig?.RinseAndRepeatRunner?.runBeforeModel;
      if (!runBeforeModelConfig) {
        throw new Error('No runBeforeModel configuration found in skillRunner.json');
      }

      // Get the model name (first key in runBeforeModel)
      const modelName = Object.keys(runBeforeModelConfig)[0];
      if (!modelName) {
        throw new Error('No model specified in runners.json RinseAndRepeatRunner.runBeforeModel');
      }

      // Merge model configuration: base from models.json + overrides from runners.json
      const baseModelConfig = modelsConfig[modelName] || {};
      const overrideConfig = runBeforeModelConfig[modelName] || {};
      this.modelConfig = { ...baseModelConfig, ...overrideConfig };

      // Extract string representation of input for the prompt
      const inputStr = typeof input === 'object' ? JSON.stringify(input) : String(input);

      let modelInput = this.modelConfig.prompt || `You are a system agent helping to execute a defined skill called {skill-name}.  The skill is described as follows: {skill-description}. The skill accepts parameters as a JSON object with the following schema: {skill-parameters-schema}.  Using the following user input, determine the appropriate parameters to pass to the skill.  Respond with only a JSON object containing the parameters, and no other text. User input: {input}`;
      modelInput = modelInput.replace('{input}', inputStr);
      modelInput = modelInput.replace('{skill-name}', skillName);
      modelInput = modelInput.replace('{skill-description}', skillDescription);
      modelInput = modelInput.replace('{skill-parameters-schema}', skillParamSchema);
      
      // Instantiate the model
      this.model = await BaseModel.require(modelName, this.modelConfig);
      const result = await this.model?.predict(modelInput);

      logger.log(`Initialized model: ${modelName}`);
    } catch (err) {
      logger.error(`Error when initializing model: ${err}`);
      throw err;
    }
  }

  /**
   * Load models.json configuration
   */
  private loadModelsConfig(): any {
    return loadConfig('models.json');
  }

  /**
   * Get the initialized model
   */
  getModel(): any {
    return this.model;
  }
}
