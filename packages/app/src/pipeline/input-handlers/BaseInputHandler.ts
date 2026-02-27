/**
 * Structured input to the pipeline's input-handling stage.
 * Represents all information a caller may supply alongside the user's message.
 */
export interface InputHandlerInput {
  // ── Primary content ────────────────────────────────────────────────────────
  /** User-provided text. */
  text: string;
  /** Optional raw HTML if the message was submitted via a rich-text surface. */
  html?: string;
  /** File/media attachments accompanying the message. */
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType?: string;
    size?: number;
    /** Optional inline content or a reference URL / path. */
    content?: Uint8Array | string;
  }>;

  // ── Source & session ───────────────────────────────────────────────────────
  /** Surface the message originated from (e.g. `'web'`, `'api'`, `'mobile'`). */
  source?: 'web' | 'api' | 'mobile' | string;
  /** IETF language tag of the client locale (e.g. `'en-US'`). */
  clientLocale?: string;
  /** Client platform identifier (e.g. `'chrome'`, `'ios'`). */
  clientPlatform?: string;
  /** Opaque session identifier. */
  sessionId?: string;
  /** Opaque user identifier; `null` for anonymous sessions. */
  userId?: string | null;

  // ── Context hints ──────────────────────────────────────────────────────────
  /** Identifier of the ongoing conversation thread. */
  conversationId?: string;
  /** Identifier of the message this is a reply to. */
  parentMessageId?: string;
  /** Preceding messages for in-context continuations. */
  previousMessages?: Array<{
    role: 'user' | 'assistant' | 'system';
    text: string;
    timestamp?: string;
  }>;

  // ── Tooling / routing hints ────────────────────────────────────────────────
  /** Opaque routing hint for the pipeline (e.g. `'needs-tool'`, `'priority'`). */
  routingHint?: string;
  /** Tool names the caller requires the pipeline to invoke. */
  requiredTools?: string[];

  // ── Metadata & flags ──────────────────────────────────────────────────────
  /** ISO 8601 timestamp of when the message was created by the client. */
  timestamp?: string;
  /** IANA timezone of the client (e.g. `'America/New_York'`). */
  timezone?: string;
  /** BCP-47 language tag to bias language detection (e.g. `'fr'`). */
  languageHint?: string;
  /** Whether the originating source is considered trusted. */
  trusted?: boolean;
  /** Prefer to preserve line breaks and markdown in the output text. */
  preserveFormatting?: boolean;

  // ── Privacy-sensitive controls ─────────────────────────────────────────────
  /** Caller-requested PII redaction before processing. */
  redactPII?: boolean;
  /** Permit external fetches on behalf of this request. */
  allowExternalFetch?: boolean;

  // ── Rate / cost controls ───────────────────────────────────────────────────
  /** Maximum number of tokens the pipeline may consume for this request. */
  maxTokens?: number;
  /** Preferred end-to-end latency budget in milliseconds. */
  preferredLatencyMs?: number;

  // ── Developer / debugging ──────────────────────────────────────────────────
  /** Opaque identifier for tracing/debugging this specific request. */
  debugId?: string;
  /** Arbitrary string tags attached by the caller for routing or observability. */
  clientTags?: Record<string, string>;
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
