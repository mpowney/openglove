import { BasePipeline } from './Pipeline';
import { BaseInputHandler, DefaultInputHandler } from './input-handlers';
import { BaseContextManager, DefaultContextManager } from './context-managers';
import { BaseActionHandler, DefaultActionHandler } from './ActionHandler';
import { BaseOutputHandler, DefaultOutputHandler } from './OutputHandler';

/**
 * Concrete example pipeline that wires together the default pass-through
 * handlers for each stage.  Extend or replace individual handlers to
 * customize behaviour.
 */
export class CustomPipeline extends BasePipeline {
  protected inputHandler: BaseInputHandler;
  protected contextManager: BaseContextManager;
  protected actionHandler: BaseActionHandler;
  protected outputHandler: BaseOutputHandler;

  constructor(opts: {
    inputHandler?: BaseInputHandler;
    contextManager?: BaseContextManager;
    actionHandler?: BaseActionHandler;
    outputHandler?: BaseOutputHandler;
  } = {}) {
    super();
    this.inputHandler = opts.inputHandler ?? new DefaultInputHandler();
    this.contextManager = opts.contextManager ?? new DefaultContextManager();
    this.actionHandler = opts.actionHandler ?? new DefaultActionHandler();
    this.outputHandler = opts.outputHandler ?? new DefaultOutputHandler();
  }
}
