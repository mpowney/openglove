import { ChannelRoleType } from '../../channels/BaseChannel';
import { Message } from '../../models/BaseModel';

/**
 * Shared metadata context for input and output.
 * Contains common properties present in both InputHandlerInput and InputHandlerOutput.
 */
export interface InputHandlerContext {
  /** Guaranteed epoch-ms timestamp (falls back to Date.now()). */
  ts: number;
  /** IETF language tag of the client locale (e.g. `'en-US'`). */
  clientLocale?: string;
  /** Client platform identifier (e.g. `'chrome'`, `'ios'`). */
  clientPlatform?: string;
  /** Surface the message originated from (e.g. `'web'`, `'api'`, `'mobile'`). */
  source?: 'web' | 'api' | 'mobile' | string;
  /** Opaque session identifier. */
  sessionId?: string;
}

/**
 * Structured input to the pipeline's input-handling stage.
 * Represents all information a caller may supply alongside the user's message.
 */
export interface InputHandlerInput extends Message, InputHandlerContext {
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

  // ── User & context ────────────────────────────────────────────────────────
  /** Opaque user identifier; `null` for anonymous sessions. */
  userId?: string | null;
  /** Identifier of the ongoing conversation thread. */
  conversationId?: string;
  /** Identifier of the message this is a reply to. */
  parentMessageId?: string;
  /** Preceding messages for in-context continuations. */
  previousMessages?: Message[];

  // ── Tooling / routing hints ────────────────────────────────────────────────
  /** Opaque routing hint for the pipeline (e.g. `'needs-tool'`, `'priority'`). */
  routingHint?: string;
  /** Tool names the caller requires the pipeline to invoke. */
  requiredTools?: string[];

  // ── Metadata & flags ──────────────────────────────────────────────────────
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
 * Entity detected in the input text.
 * Represents extracted named entities with type, location, and confidence.
 */
export interface DetectedEntity {
  /** Type of entity (e.g., 'person', 'organisation', 'location', 'email', etc.). */
  type: 'person' | 'organisation' | 'location' | 'email' | string;
  /** Start and end indices in the original text. */
  span: { start: number; end: number };
  /** Normalised or canonical form of the entity. */
  normalisedValue: string;
  /** Confidence score (0–1) for detection. */
  confidence: number;
}

/**
 * Intent signal extracted from the input.
 * Represents primary intent, optional sub-intent, and confidence score.
 */
export interface IntentSignal {
  /** Primary intent label (e.g., 'greeting', 'question', 'request', 'complaint'). */
  intent: string;
  /** Optional sub-intent for further specificity. */
  subintent?: string;
  /** Confidence score (0–1) for the intent classification. */
  confidence: number;
}

/**
 * Detected sensitive pattern in the input (PII, credentials, etc.).
 * Includes location and recommended redaction action.
 */
export interface SensitiveFlag {
  /** Type of sensitive pattern (e.g., 'credit_card', 'ssn', 'api_key', 'email', 'phone'). */
  type: string;
  /** Start and end indices in the original text. */
  span: { start: number; end: number };
  /** Recommended redaction action (e.g., 'mask', 'remove', 'hash'). */
  maskAction: string;
}

/**
 * Detected mention (URL, email, phone, handle, etc.) in the input.
 * Includes anonymization flag for downstream processing.
 */
export interface Mention {
  /** Type of mention (e.g., 'url', 'email', 'phone', 'handle'). */
  type: string;
  /** Detected mention text. */
  value: string;
  /** Whether this mention should be anonymized. */
  anonymize: boolean;
}

/**
 * Applied normalisation step with parameters and order.
 */
export interface NormalisationStep {
  /** Name of the normalisation step (e.g., 'unicode_normalisation', 'whitespace_fix'). */
  name: string;
  /** Parameters that were used (as JSON-serializable values). */
  params?: Record<string, any>;
}

/**
 * Truncation metadata; present if the text was truncated during processing.
 */
export interface TruncationInfo {
  /** Whether the text was truncated. */
  truncated: boolean;
  /** Reason for truncation, if applicable. */
  truncationReason?: string;
  /** Indices of preserved context spans if partial content retained. */
  preservedContextIds?: string[];
}

/**
 * Language-specific annotations (script type, sentence boundaries, etc.).
 */
export interface LanguageSpecific {
  /** Script type (e.g., 'Latin', 'Cyrillic', 'Arabic', 'CJK'). */
  script?: string;
  /** Sentence boundaries (start/end indices). */
  sentenceSplits?: Array<{ start: number; end: number }>;
}

/**
 * Structured output produced by the input-handling stage.
 * Represents a normalised, validated, and enriched message ready for downstream stages.
 * Extends Message so it can be used wherever a Message is expected.
 */
export interface InputHandlerOutput extends Message, InputHandlerContext {
  /** Original user input (post-control-character stripping). */
  originalText: string;
  /** Normalised text (Unicode/whitespace/punctuation fixes). */
  cleanText: string;
  /** BCP-47 language code determined for this input. */
  language: string;
  /** Tokenized form (model-specific token IDs or token strings). */
  tokens?: (string | number)[];
  /** Truncated/condensed version for quick intent classifiers. */
  shortText?: string;
  /** Extracted intent labels/scores. */
  intentSignals?: IntentSignal[];
  /** List of detected entities with type, span, normalised value, and confidence. */
  entities?: DetectedEntity[];
  /** Detected sensitive patterns (PII, credentials) with mask action. */
  sensitiveFlags?: SensitiveFlag[];
  /** Detected URLs, emails, phone numbers, handles (with anonymization flag). */
  mentions?: Mention[];
  /** Message sizes: character count, word count, token count. */
  lengths?: {
    chars: number;
    words: number;
    tokens: number;
  };
  /** Language-dependent annotations (script, sentence_splits). */
  langSpecific?: LanguageSpecific;
  /** List of applied normalisation steps (order and params). */
  normalisationLog?: NormalisationStep[];
  /** Truncation metadata (boolean + reason and preserved_context_ids if truncated). */
  truncation?: TruncationInfo;
  /** Vector(s) for retrieval/ranking (precomputed embeddings). */
  precomputedEmbeddings?: number[][];
  /** Lightweight features for classifiers (bag-of-words, sentiment, formality). */
  featureVectors?: Record<string, number | string>;
  /** Spacing/escape flags for safe prompt insertion. */
  tokenizationHints?: Record<string, string | boolean>;
  /** Recommended privacy action (include, redact, summarize-only). */
  privacyAction?: 'include' | 'redact' | 'summarize-only';
  /** Downstream routing hint for planner (e.g., 'needs-tool', 'clarify-first', 'direct-answer'). */
  routingHint?: string;
  /** Metadata carried over or enriched from the input. */
  metadata?: Record<string, any>;
}

/**
 * Abstract base class for pipeline input ingestion.
 * Responsible for receiving, validating, and normalising raw input
 * before it is forwarded to the ContextManager stage.
 */
export abstract class BaseInputHandler {
  abstract handle(input: InputHandlerInput): Promise<InputHandlerOutput>;
}
