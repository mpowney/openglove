export type ModelMetadata = Record<string, any>;

export abstract class BaseModel {
  readonly id: string;
  name?: string;
  description?: string;
  version?: string;
  metadata: ModelMetadata;
  /** Optional configuration loaded from models.json (by `name`) */
  config: Record<string, any> | null = null;

  constructor(opts: { id?: string; name?: string; description?: string; version?: string; metadata?: ModelMetadata } = {}) {
    this.id = opts.id ?? `model-${Date.now()}`;
    this.name = opts.name;
    this.description = opts.description;
    this.version = opts.version;
    this.metadata = opts.metadata ?? {};

    // load model config using shared loader; default path is ./models.json, override via MODELS_CONFIG_PATH
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfgLoader = require('../config/loadConfig') as typeof import('../config/loadConfig');
    const modelConfigPath = process.env.MODELS_CONFIG_PATH ?? './models.json';
    const all = cfgLoader.loadConfig(modelConfigPath) || {};
    this.config = (this.name && all && all[this.name]) || null;
  }

  /**
   * Given an input (prompt, features, etc.), return a model response.
   */
  abstract predict(input: any): Promise<any>;
  /** Optional streaming API: yields partial outputs as they arrive */
  predictStream?(input: any): AsyncIterable<any>;

  /** Optional lifecycle hooks */
  async load(source?: string): Promise<void> {
    // override to load model weights or configuration
  }

  async save(target?: string): Promise<void> {
    // override to persist model state
  }
}
