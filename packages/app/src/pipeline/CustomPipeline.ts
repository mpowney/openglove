import { Pipeline } from './Pipeline';
import { InputHandler, DefaultInputHandler } from './InputHandler';
import { Processor, DefaultProcessor } from './Processor';
import { ActionHandler, DefaultActionHandler } from './ActionHandler';
import { OutputHandler, DefaultOutputHandler } from './OutputHandler';

/**
 * Concrete example pipeline that wires together the default pass-through
 * handlers for each stage.  Extend or replace individual handlers to
 * customize behaviour.
 */
export class CustomPipeline extends Pipeline {
  protected inputHandler: InputHandler;
  protected processor: Processor;
  protected actionHandler: ActionHandler;
  protected outputHandler: OutputHandler;

  constructor(opts: {
    inputHandler?: InputHandler;
    processor?: Processor;
    actionHandler?: ActionHandler;
    outputHandler?: OutputHandler;
  } = {}) {
    super();
    this.inputHandler = opts.inputHandler ?? new DefaultInputHandler();
    this.processor = opts.processor ?? new DefaultProcessor();
    this.actionHandler = opts.actionHandler ?? new DefaultActionHandler();
    this.outputHandler = opts.outputHandler ?? new DefaultOutputHandler();
  }
}
