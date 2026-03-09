import * as path from 'path';

import { DefaultPipeline } from '../../src/pipeline/DefaultPipeline';
import { InputHandlerInput } from '../../src/pipeline/input-handlers';

describe('DefaultPipeline integration', () => {
  const originalPipelineConfigPath = process.env.PIPELINE_CONFIG_PATH;
  const isolatedPipelineConfigPath = path.join(
    process.cwd(),
    '__tests__',
    'fixtures',
    '__missing-default-pipeline-config.integration.json'
  );

  beforeEach(() => {
    // Keep this integration test deterministic by bypassing model-backed pipeline config.
    process.env.PIPELINE_CONFIG_PATH = isolatedPipelineConfigPath;
  });

  afterEach(() => {
    if (originalPipelineConfigPath === undefined) {
      delete process.env.PIPELINE_CONFIG_PATH;
      return;
    }
    process.env.PIPELINE_CONFIG_PATH = originalPipelineConfigPath;
  });

  it('processes InputHandlerInput text through DefaultPipeline.run', async () => {
    const pipeline = new DefaultPipeline();
    const input: InputHandlerInput = {
      text: "I'm looking to book the Pickleball in Caulfield, browse to the website and sign up",
      ts: Date.now(),
      type: 'text',
      role: 'user'
    };
    const result = await pipeline.run(input);
    // TODO: This response will become a response to the pipeline, instead of a version of the original prompt
    expect(result).toBe("i'm looking to book the pickleball in caulfield, browse to the website and sign up");
  });
});