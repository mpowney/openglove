/**
 * Abstract base class for pipeline context management.
 * Responsible for transforming or enriching the data received from the InputHandler.
 */
export abstract class BaseContextManager {
  abstract manage(input: string): Promise<string>;
}
