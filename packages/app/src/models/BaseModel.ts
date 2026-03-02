import { ChannelRoleType } from '../channels/BaseChannel';
import { loadConfig, Logger } from '@openglove/base';

export type ModelMetadata = Record<string, any>;

export interface Chunk {
    type: 'delta' | 'full' | 'start' | 'end' | string;
    role?: 'system' | 'user' | 'assistant' | 'supplementary';
    content?: string;
    [key: string]: any;
}

export interface Message extends Chunk {
  /** Immutable UUID identifier for this message. */
  id?: string;
  /** Guaranteed epoch-ms timestamp (falls back to Date.now()). */
  ts: number;
}

const logger = new Logger('BaseModel');

export abstract class BaseModel {
  readonly id: string;
  name?: string;
  description?: string;
  version?: string;
  metadata: ModelMetadata;
  /** Optional configuration loaded from models.json (by `name`) */
  config: Record<string, any> | null = null;
  role: ChannelRoleType = "assistant";


  constructor(opts: { id?: string; name?: string; description?: string; version?: string; metadata?: ModelMetadata; role?: ChannelRoleType } = {}) {
    this.id = opts.id ?? `model-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.version = opts.version;
    this.metadata = opts.metadata ?? {};


    // load model config using shared loader; default path is ./models.json, override via MODELS_CONFIG_PATH
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const modelConfigPath = process.env.MODELS_CONFIG_PATH ?? './models.json';
    const all = loadConfig(modelConfigPath) || {};
    this.config = (this.name && all && all[this.name]) || null;
    this.role = opts.role ?? (all as any)?.role ?? 'assistant';
  }

  /**
   * Must be implemented by subclasses to indicate if streaming is supported
   */
  abstract supportsStreaming(): Promise<boolean>;

  /**
   * Build the URL for the API endpoint
   */
  abstract buildUrl?(): Promise<string>;

  /**
   * Build the request headers
   */
  abstract buildHeaders?(): Promise<Record<string, string>>;

  /**
   * Build the request payload
   */
  abstract buildPayload?(url: string, input: any): any;

  /** Optional lifecycle hooks */
  async load(source?: string): Promise<void> {
    // override to load model weights or configuration
  }

  async save(target?: string): Promise<void> {
    // override to persist model state
  }
}
