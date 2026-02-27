import { InputHandler } from './InputHandler';
import { Processor } from './Processor';
import { ActionHandler } from './ActionHandler';
import { OutputHandler } from './OutputHandler';

/**
 * Abstract base class for the agent pipeline.
 * Orchestrates the four stages: ingestion, processing, execution, and output.
 */
export abstract class Pipeline {
  protected abstract inputHandler: InputHandler;
  protected abstract processor: Processor;
  protected abstract actionHandler: ActionHandler;
  protected abstract outputHandler: OutputHandler;

  /**
   * Run input through all four pipeline stages sequentially:
   * 1. Ingestion  (InputHandler)
   * 2. Processing (Processor)
   * 3. Execution  (ActionHandler)
   * 4. Output     (OutputHandler)
   */
  async run(input: string): Promise<string> {
    const ingested = await this.inputHandler.handle(input);
    const processed = await this.processor.process(ingested);
    const executed = await this.actionHandler.execute(processed);
    const result = await this.outputHandler.output(executed);
    return result;
  }
}
