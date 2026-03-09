import { InputHandlerOutput } from "../input-handlers";
import { BaseGenerativeModel } from "../../models/generative";

/**
 * Abstract base class for pipeline context management.
 * Responsible for transforming or enriching the data received from the InputHandler.
 */
export abstract class BaseContextManager {
  protected readonly conversationContext: InputHandlerOutput[];
  protected planningModel?: BaseGenerativeModel;
  protected proposedToolNames: string[];

  constructor(conversationContext: InputHandlerOutput[] = [], planningModel?: BaseGenerativeModel) {
    this.conversationContext = [...conversationContext];
    this.planningModel = planningModel;
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

  getProposedToolNames(): string[] {
    return [...this.proposedToolNames];
  }

  abstract manage(input: InputHandlerOutput, config: Record<string, any>): Promise<InputHandlerOutput>;
}
