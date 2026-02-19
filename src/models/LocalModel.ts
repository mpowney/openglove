import { BaseModel } from './BaseModel';

export interface LocalModelOptions {
  deterministic?: boolean;
}

export class LocalModel extends BaseModel {
  private opts: LocalModelOptions;

  constructor(opts: LocalModelOptions = {}, baseOpts: any = {}) {
    super({...baseOpts, name: baseOpts.name ?? 'LocalModel'});
    this.opts = opts;
  }

  async predict(input: any): Promise<any> {
    // Very small, deterministic example model: echoes input with metadata
    const response = {
      id: `resp-${Date.now()}`,
      output: typeof input === 'string' ? `Echo: ${input}` : { echoed: input },
      modelId: this.id,
      metadata: this.metadata
    };
    return response;
  }
}
