import { BaseInputHandler, DetectedEntity, InputHandlerInput, InputHandlerOptions, InputHandlerOutput } from './BaseInputHandler';
import { BaseModel } from '../../models/BaseModel';
import { PromptTemplate } from '../../prompts';
import { generateUUID } from '../../utils/UUID';

/**
 * InputHandler that uses a model to perform pattern matching.
 * Requires a model and prompt template to be specified during initialization.
 * 
 * The prompt template should contain an "input-text" placeholder that will be
 * replaced with the input text before sending to the model for prediction.
 * 
 * Example usage:
 * ```typescript
 * const model = await BaseModel.require('OllamaModel', { ... });
 * const template = new PromptTemplate('pattern-matching.txt');
 * const handler = new ModelMatchingInputHandler(model, template);
 * ```
 */
export class ModelMatchingInputHandler extends BaseInputHandler {
  
  constructor(opts?: InputHandlerOptions) {
    super(opts);
    
    if (!this.opts?.model) {
      throw new Error('ModelMatchingInputHandler requires a model to be specified');
    }
    
    if (!this.opts?.promptTemplate) {
      throw new Error('ModelMatchingInputHandler requires a prompt template to be specified');
    }
  }

  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const rawText = input.text ?? '';
    const normalisationLog = [];

    // Ensure model and template are available (should always be true due to constructor check)
    if (!this.opts?.model || !this.opts?.promptTemplate) {
      throw new Error('Model or PromptTemplate not initialized');
    }

    // Set the input-text placeholder in the prompt template
    this.opts.promptTemplate.setPlaceholders({
      'input-text': rawText
    });

    // Render the prompt with the placeholder replaced
    const prompt = await this.opts.promptTemplate.render();

    // Use the model to perform prediction
    const startTime = Date.now();
    const modelResponse = await this.opts.model.predict(prompt);
    const predictionTime = Date.now() - startTime;

    normalisationLog.push({
      name: 'model_based_pattern_matching',
      params: {
        model_id: this.opts.model.id,
        model_name: this.opts.model.name || 'unknown',
        prediction_time_ms: predictionTime,
        prompt_length: prompt.length,
        input_length: rawText.length
      },
    });

    // Extract the response content
    let cleanText = rawText;
    let modelOutput = '';
    
    const content = modelResponse.response || String(modelResponse);
    let detectedEntities: DetectedEntity[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        detectedEntities = parsed.map((item: any) => item as DetectedEntity);
      }
    }
    catch (e) {
      // If response is not JSON, treat the whole content as model output
      modelOutput = content;
    }

    // Store model output in metadata
    const metadata: Record<string, any> = {
      ...(input.clientTags || {}),
      modelPrediction: detectedEntities.length > 0 ? detectedEntities : undefined,
      modelResponseRaw: modelResponse
    };

    // Calculate text lengths
    const lengths = {
      chars: cleanText.length,
      words: cleanText.split(/\s+/).filter(w => w.length > 0).length,
      tokens: 0,
    };

    // Parse the ISO-8601 timestamp supplied by the caller, fall back to now
    const ts = input.timestamp ? Date.parse(input.timestamp) : Date.now();

    return {
      id: input.id || generateUUID(),
      type: 'full',
      originalText: rawText,
      cleanText,
      role: 'user',
      language: input.languageHint || 'en',
      timestamp: input.timestamp,
      clientLocale: input.clientLocale,
      clientPlatform: input.clientPlatform,
      source: input.source,
      sessionId: input.sessionId,
      routingHint: input.routingHint,
      lengths,
      normalisationLog,
      metadata,
      detectedEntities,
      ts: isNaN(ts) ? Date.now() : ts,
    };
  }
}
