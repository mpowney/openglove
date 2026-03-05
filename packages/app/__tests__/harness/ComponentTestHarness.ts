/**
 * Base test harness for testing components in isolation
 * Supports both mocked dependencies and real external services
 */

export type MockMode = 'full' | 'partial' | 'none';

export interface HarnessConfig {
  /**
   * 'full': All external services mocked (default, fast)
   * 'partial': Selected services mocked, others real
   * 'none': All real external services (requires service availability)
   */
  mockMode?: MockMode;

  /**
   * For 'partial' mode: array of service names to mock
   * e.g., ['embeddings', 'fetch']
   */
  mockedServices?: string[];

  /**
   * For 'partial' mode: array of service names to use real
   * e.g., ['filesystem']
   */
  realServices?: string[];

  /**
   * Base URL for external services
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Skip test if service is unavailable (for integration tests)
   */
  skipIfUnavailable?: boolean;

  /**
   * Enable verbose logging for debugging
   */
  verbose?: boolean;
}

export class ComponentTestHarness<T extends object> {
  protected component: T;
  protected config: Required<HarnessConfig>;
  protected mocks: Map<string, jest.SpyInstance> = new Map();
  protected testResults: Array<{ name: string; passed: boolean; error?: Error }> = [];

  constructor(
    protected ComponentClass: new (opts?: any) => T,
    config: HarnessConfig = {}
  ) {
    this.config = {
      mockMode: config.mockMode ?? 'full',
      mockedServices: config.mockedServices ?? [],
      realServices: config.realServices ?? [],
      baseUrl: config.baseUrl ?? 'http://localhost:11434',
      timeout: config.timeout ?? 30000,
      skipIfUnavailable: config.skipIfUnavailable ?? false,
      verbose: config.verbose ?? false
    };

    this.log('Initializing harness', { mode: this.config.mockMode });

    if (this.config.mockMode === 'full') {
      this.setupMocks();
    } else if (this.config.mockMode === 'partial') {
      this.setupPartialMocks();
    } else {
      this.setupRealServices();
    }

    this.component = new ComponentClass(this.getComponentConfig());
  }

  /**
   * Setup all mocks (default mode)
   */
  protected setupMocks(): void {
    this.log('Setting up full mock mode');
    // Mocks should already be in place via jest.mock() in test file
  }

  /**
   * Setup partial mocks - some real, some mocked
   */
  protected setupPartialMocks(): void {
    this.log('Setting up partial mock mode', {
      mocked: this.config.mockedServices,
      real: this.config.realServices
    });

    // For real services, unmock them
    for (const service of this.config.realServices) {
      this.unmockService(service);
    }
  }

  /**
   * Setup all real services (no mocks)
   */
  protected setupRealServices(): void {
    this.log('Setting up real services mode');
    // Unmock all services
    jest.unmock('../../src/utils/Fetch');
    jest.unmock('../../src/models');
  }

  /**
   * Unmock a specific service by name
   */
  protected unmockService(serviceName: string): void {
    try {
      switch (serviceName.toLowerCase()) {
        case 'fetch':
        case 'http':
          jest.unmock('../../src/utils/Fetch');
          break;
        case 'filesystem':
        case 'fs':
          jest.unmock('fs');
          break;
        case 'embeddings':
          jest.unmock('../../src/models');
          break;
        default:
          this.log(`Unknown service: ${serviceName}`, { level: 'warn' });
      }
    } catch (e) {
      this.log(`Failed to unmock ${serviceName}`, { error: e, level: 'warn' });
    }
  }

  /**
   * Get configuration object for component constructor
   */
  protected getComponentConfig(): Record<string, any> {
    return {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout
    };
  }

  /**
   * Get the component instance
   */
  public getComponent(): T {
    return this.component;
  }

  /**
   * Execute a test function with optional service availability check
   */
  public async executeTest<R>(
    testName: string,
    testFn: () => Promise<R>,
    options: { checkAvailability?: boolean } = {}
  ): Promise<R | null> {
    this.log(`Executing test: ${testName}`);

    try {
      if (
        options.checkAvailability &&
        this.config.skipIfUnavailable &&
        !(await this.checkServiceAvailability())
      ) {
        this.log(`Skipping test - service unavailable: ${testName}`, {
          level: 'info'
        });
        this.testResults.push({ name: testName, passed: true });
        return null;
      }

      const result = await testFn();
      this.testResults.push({ name: testName, passed: true });
      this.log(`✓ Test passed: ${testName}`);
      return result;
    } catch (error) {
      this.testResults.push({
        name: testName,
        passed: false,
        error: error instanceof Error ? error : new Error(String(error))
      });
      this.log(`✗ Test failed: ${testName}`, {
        error: error instanceof Error ? error.message : String(error),
        level: 'error'
      });
      throw error;
    }
  }

  /**
   * Check if external service is available (for integration tests)
   */
  protected async checkServiceAvailability(): Promise<boolean> {
    if (this.config.mockMode === 'full') {
      return true; // Mocks don't need availability check
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok || response.status < 500;
    } catch (e) {
      this.log('Service availability check failed', { error: e, level: 'warn' });
      return false;
    }
  }

  /**
   * Get test results summary
   */
  public getTestResults() {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;

    return {
      total: this.testResults.length,
      passed,
      failed,
      results: this.testResults,
      summary: `${passed}/${this.testResults.length} tests passed`
    };
  }

  /**
   * Setup mock for a specific method
   */
  protected mockMethod<K extends keyof T>(
    obj: T,
    method: K,
    implementation?: jest.Mock
  ): jest.SpyInstance {
    const spy = jest.spyOn(obj, method as any);
    if (implementation) {
      spy.mockImplementation(implementation);
    }
    this.mocks.set(String(method), spy);
    return spy;
  }

  /**
   * Restore all mocks
   */
  public restoreAllMocks(): void {
    this.mocks.forEach(mock => mock.mockRestore());
    this.mocks.clear();
    this.log('All mocks restored');
  }

  /**
   * Get all recorded mocks
   */
  public getMocks(): Map<string, jest.SpyInstance> {
    return this.mocks;
  }

  /**
   * Internal logging
   */
  protected log(
    message: string,
    context?: Record<string, any> & { level?: 'info' | 'warn' | 'error' }
  ): void {
    if (!this.config.verbose && context?.level !== 'error') {
      return;
    }

    const level = context?.level ?? 'info';
    const icon = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
    const { level: _, ...ctx } = context ?? {};

    console.log(`${icon} [Harness] ${message}`, Object.keys(ctx).length > 0 ? ctx : '');
  }

  /**
   * Reset harness state for fresh test execution
   */
  public reset(): void {
    this.testResults = [];
    this.restoreAllMocks();
    this.log('Harness reset');
  }

  /**
   * Cleanup harness
   */
  public cleanup(): void {
    this.restoreAllMocks();
    this.log('Harness cleanup complete');
  }
}
