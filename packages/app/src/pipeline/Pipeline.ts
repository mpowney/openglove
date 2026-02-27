import { BaseInputHandler } from './InputHandler';
import { BaseProcessor } from './Processor';
import { BaseActionHandler } from './ActionHandler';
import { BaseOutputHandler } from './OutputHandler';

/**
 * Abstract base class for the agent pipeline.
 * Orchestrates the four stages: ingestion, processing, execution, and output.
 */
export abstract class BasePipeline {
  protected abstract inputHandler: BaseInputHandler;
  protected abstract processor: BaseProcessor;
  protected abstract actionHandler: BaseActionHandler;
  protected abstract outputHandler: BaseOutputHandler;

  /**
   * Run input through all four pipeline stages sequentially:
   * 1. Ingestion  (BaseInputHandler)
   * 2. Processing (BaseProcessor)
   * 3. Execution  (BaseActionHandler)
   * 4. Output     (BaseOutputHandler)
   */
  async run(input: string): Promise<string> {
    const ingested = await this.inputHandler.handle(input);
    const processed = await this.processor.process(ingested);
    const executed = await this.actionHandler.execute(processed);
    const result = await this.outputHandler.output(executed);
    return result;
  }
}
