/**
 * Structured input to the pipeline's input-handling stage.
 * Mirrors the shape of a raw inbound message (e.g. from a channel).
 */
export interface InputHandlerInput {
  /** Raw text sent by the user or an upstream system. */
  text: string;
  /** Optional message identifier provided by the source. */
  id?: string;
  /** Identifier of the sender (user id, username, etc.). */
  from?: string;
  /** Identifier of the originating channel. */
  channelId?: string;
  /** Arbitrary extra metadata supplied by the source. */
  metadata?: Record<string, any>;
  /** Unix-ms timestamp of when the message was received. */
  ts?: number;
}

/**
 * Structured output produced by the input-handling stage.
 * Represents a normalised, validated message ready for downstream stages.
 */
export interface InputHandlerOutput {
  /** Normalised text to be forwarded through the pipeline. */
  text: string;
  /** Echoed or generated identifier for this message. */
  id?: string;
  /** Role assigned to the message (defaults to 'user'). */
  role: 'user' | 'system' | 'assistant' | 'supplementary';
  /** Metadata carried over or enriched from the input. */
  metadata?: Record<string, any>;
  /** Guaranteed timestamp (falls back to Date.now()). */
  ts: number;
}

/**
 * Abstract base class for pipeline input ingestion.
 * Responsible for receiving, validating, and normalising raw input
 * before it is forwarded to the ContextManager stage.
 */
export abstract class BaseInputHandler {
  abstract handle(input: InputHandlerInput): Promise<InputHandlerOutput>;
}
