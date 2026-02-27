import { BasePipeline } from './Pipeline';
import { BaseInputHandler, DefaultInputHandler } from './InputHandler';
import { BaseProcessor, DefaultProcessor } from './Processor';
import { BaseActionHandler, DefaultActionHandler } from './ActionHandler';
import { BaseOutputHandler, DefaultOutputHandler } from './OutputHandler';

/**
 * Concrete example pipeline that wires together the default pass-through
 * handlers for each stage.  Extend or replace individual handlers to
 * customize behaviour.
 */
export class CustomPipeline extends BasePipeline {
  protected inputHandler: BaseInputHandler;
  protected processor: BaseProcessor;
  protected actionHandler: BaseActionHandler;
  protected outputHandler: BaseOutputHandler;

  constructor(opts: {
    inputHandler?: BaseInputHandler;
    processor?: BaseProcessor;
    actionHandler?: BaseActionHandler;
    outputHandler?: BaseOutputHandler;
  } = {}) {
    super();
    this.inputHandler = opts.inputHandler ?? new DefaultInputHandler();
    this.processor = opts.processor ?? new DefaultProcessor();
    this.actionHandler = opts.actionHandler ?? new DefaultActionHandler();
    this.outputHandler = opts.outputHandler ?? new DefaultOutputHandler();
  }
}
