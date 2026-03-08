import { BaseInputHandler, InputHandlerInput } from './input-handlers';
import { BaseContextManager } from './context-managers';
import { BaseActionHandler } from './ActionHandler';
import { BaseOutputHandler } from './OutputHandler';
import { Message } from '../models/BaseModel';
import { loadConfig } from '@openglove/base';

export interface PipelineOptions {
  inputHandler?: BaseInputHandler;
  contextManager?: BaseContextManager;
  actionHandler?: BaseActionHandler;
  outputHandler?: BaseOutputHandler;
  emitMessage?: (message: Message) => Promise<void>;
}

/**
 * Abstract base class for the agent pipeline.
 * Orchestrates the four stages: ingestion, context management, execution, and output.
 */
export abstract class BasePipeline {
  protected abstract inputHandler: BaseInputHandler;
  protected abstract contextManager: BaseContextManager;
  protected abstract actionHandler: BaseActionHandler;
  protected abstract outputHandler: BaseOutputHandler;
  name?: string = 'BasePipeline';
  

  /** Path used to load the skills config; env PIPELINE_CONFIG_PATH or ./pipeline.json */
  private static get configPath(): string {
    return process.env.PIPELINE_CONFIG_PATH ?? './pipeline.json';
  }

  /**
   * Run input through all four pipeline stages sequentially:
   * 1. Ingestion        (BaseInputHandler)   — structured InputHandlerInput → InputHandlerOutput
   * 2. Context Mgmt     (BaseContextManager) — enriches/transforms the text
   * 3. Execution        (BaseActionHandler)  — executes any actions
   * 4. Output           (BaseOutputHandler)  — formats the final result
   */
  async run(input: InputHandlerInput, emitMessage?: (message: Message) => Promise<void>): Promise<string> {

    const all = loadConfig(BasePipeline.configPath) || {};
    const cfg = (this.name && all && all[this.name]) || {};
    const config = cfg;

    const ingested = await this.inputHandler.handle(input);
    const managed = await this.contextManager.manage(ingested, config['contextManager'] || {});
    const executed = await this.actionHandler.execute(managed.cleanText);
    const result = await this.outputHandler.output(executed);

    return result;
  }
}
