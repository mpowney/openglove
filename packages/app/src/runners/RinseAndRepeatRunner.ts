import { BaseTool, BaseToolRunner, loadConfig, Logger, ToolContext } from '@openglove/base';
import { BaseModel } from '../models/BaseModel';
import { BaseGenerativeModel } from '../models/generative';

const logger = new Logger('RinseAndRepeatRunner');

/**
 * RinseAndRepeatRunner initializes a language model and uses it before executing WebBrowserTool.
 * Configuration comes from runner.json with overrides applied on top of models.json.
 */
export class RinseAndRepeatRunner extends BaseToolRunner {
  private model: BaseGenerativeModel | null = null;
  private modelConfig: any = null;

  constructor(opts: any) {
    super();
    this.configDir = process.cwd(); // Set config directory to current working directory to find runner.json
  }

  async runBeforeTool(tool: BaseTool, input: any, _ctx?: ToolContext): Promise<void> {
    try {
      // Get tool info (name and description)
      const toolInfo = await tool.getInfo();
      const toolName = toolInfo.name || 'unknown';
      const toolDescription = toolInfo.description || 'No description available';
      const toolParamSchema = toolInfo.parameterSchema || '{}';

      // Load configuration
      const toolRunnerConfig = this.loadToolRunnerConfig();
      const modelsConfig = this.loadModelsConfig();

      const runBeforeModelConfig = toolRunnerConfig?.RinseAndRepeatRunner?.runBeforeModel;
      if (!runBeforeModelConfig) {
        throw new Error('No runBeforeModel configuration found in runner.json');
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

      let modelInput = this.modelConfig.prompt || `You are a system agent helping to execute a defined tool called {tool-name}.  The tool is described as follows: {tool-description}. The tool accepts parameters as a JSON object with the following schema: {tool-parameters-schema}.  Using the following user input, determine the appropriate parameters to pass to the tool.  Respond with only a JSON object containing the parameters, and no other text. User input: {input}`;
      modelInput = modelInput.replace('{input}', inputStr);
      modelInput = modelInput.replace('{tool-name}', toolName);
      modelInput = modelInput.replace('{tool-description}', toolDescription);
      modelInput = modelInput.replace('{tool-parameters-schema}', toolParamSchema);
      
      // Instantiate the model
      this.model = await BaseGenerativeModel.require(modelName, this.modelConfig);
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
