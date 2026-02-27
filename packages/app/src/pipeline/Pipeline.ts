import { BaseInputHandler, InputHandlerInput } from './input-handlers';
import { BaseContextManager } from './context-managers';
import { BaseActionHandler } from './ActionHandler';
import { BaseOutputHandler } from './OutputHandler';

/**
 * Abstract base class for the agent pipeline.
 * Orchestrates the four stages: ingestion, context management, execution, and output.
 */
export abstract class BasePipeline {
  protected abstract inputHandler: BaseInputHandler;
  protected abstract contextManager: BaseContextManager;
  protected abstract actionHandler: BaseActionHandler;
  protected abstract outputHandler: BaseOutputHandler;

  /**
   * Run input through all four pipeline stages sequentially:
   * 1. Ingestion        (BaseInputHandler)   — structured InputHandlerInput → InputHandlerOutput
   * 2. Context Mgmt     (BaseContextManager) — enriches/transforms the text
   * 3. Execution        (BaseActionHandler)  — executes any actions
   * 4. Output           (BaseOutputHandler)  — formats the final result
   */
  async run(input: InputHandlerInput): Promise<string> {
    const ingested = await this.inputHandler.handle(input);
    const managed = await this.contextManager.manage(ingested.text);
    const executed = await this.actionHandler.execute(managed);
    const result = await this.outputHandler.output(executed);
    return result;
  }
}
