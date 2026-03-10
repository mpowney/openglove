import { InputHandlerOutput } from "../input-handlers";
import { BaseGenerativeModel } from "../../models/generative";
import { Message } from "../../models/BaseModel";

export interface ContextManagerOptions {
  emitMessage?: (message: Message) => Promise<void>;
  conversationContext?: InputHandlerOutput[];
  planningModel?: BaseGenerativeModel;
}

/**
 * Abstract base class for pipeline context management.
 * Responsible for transforming or enriching the data received from the InputHandler.
 */
export abstract class BaseContextManager {
  protected readonly conversationContext: InputHandlerOutput[];
  protected planningModel?: BaseGenerativeModel;
  protected proposedToolNames: string[];
  protected emitMessage?: (message: Message) => Promise<void>;

  constructor(options: ContextManagerOptions) {
    this.conversationContext = [...(options.conversationContext ?? [])];
    this.planningModel = options.planningModel;
    this.emitMessage = options.emitMessage;
    this.proposedToolNames = [];
  }

  protected setProposedToolNames(toolNames: string[]): void {
    this.proposedToolNames = [...toolNames];
  }

  protected addProposedToolName(toolName: string): void {
    if (!this.proposedToolNames.includes(toolName)) {
      this.proposedToolNames.push(toolName);
    }
  }

  protected emitContextPrompt(content: string): void {
    if (this.emitMessage) {
      const message: Message = { type: 'prompt', role: 'system', content, ts: Date.now() };
      this.emitMessage(message).catch(() => {});
    }
  }

  protected emitContextResponse(content: string | any): void {
    if (this.emitMessage) {
      const message: Message = { 
        role: 'system', 
        content: typeof content === 'string' ? content : JSON.stringify(content), 
        ts: Date.now(), 
        type: 'full' 
      };
      this.emitMessage(message).catch(() => {});
    }
  }

  getProposedToolNames(): string[] {
    return [...this.proposedToolNames];
  }

  abstract manage(input: InputHandlerOutput, config: Record<string, any>): Promise<InputHandlerOutput>;
}
