import { 
  BaseInputHandler, 
  InputHandlerInput, 
  InputHandlerOutput,
  DetectedEntity,
  InputHandlerOptions
} from './BaseInputHandler';
import { generateUUID } from '../../utils/UUID';

/**
 * InputHandler that detects hostnames in text.
 * 
 * Detects domain names without protocols (e.g., "example.com", "api.github.com")
 * using TLD patterns as strong indicators of hostnames.
 * 
 * Outputs detected hostnames as entities with type 'hostname'.
 */
export class HostnameDetectionInputHandler extends BaseInputHandler {
  
  /**
   * Comprehensive list of common TLDs for hostname detection.
   * Includes generic, country-code, and new gTLDs.
   */
  private readonly tlds = [
    // Generic TLDs
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
    'info', 'biz', 'name', 'mobi', 'pro', 'coop', 'aero', 'museum',
    
    // New generic TLDs
    'app', 'dev', 'io', 'ai', 'tech', 'online', 'site', 'website',
    'store', 'shop', 'blog', 'news', 'media', 'agency', 'company',
    'digital', 'email', 'cloud', 'network', 'services', 'solutions',
    'systems', 'technology', 'today', 'world', 'zone', 'space',
    'live', 'studio', 'design', 'art', 'photos', 'video', 'music',
    'games', 'deals', 'wiki', 'xyz', 'top', 'win', 'download',
    
    // Country code TLDs (popular ones)
    'us', 'uk', 'au', 'ca', 'de', 'fr', 'jp', 'cn', 'in', 'br',
    'ru', 'it', 'es', 'nl', 'se', 'no', 'dk', 'fi', 'pl', 'be',
    'ch', 'at', 'nz', 'ie', 'sg', 'hk', 'kr', 'mx', 'ar', 'za',
    'ae', 'il', 'tr', 'gr', 'pt', 'cz', 'ro', 'hu', 'ua', 'th',
    
    // Combined country codes
    'co.uk', 'co.nz', 'co.za', 'co.jp', 'com.au', 'com.br', 'com.cn',
    'com.mx', 'gov.au', 'gov.uk', 'ac.uk', 'edu.au', 'org.uk'
  ];
  
  /**
   * Build regex pattern for hostname detection.
   * Matches: subdomain.domain.tld or domain.tld
   * Does not match: URLs with protocols, email addresses
   */
  private buildHostnamePattern(): RegExp {
    // Escape dots in combined TLDs and create pattern
    const tldPattern = this.tlds
      .sort((a, b) => b.length - a.length) // Sort by length desc to match longer first
      .map(tld => tld.replace(/\./g, '\\.'))
      .join('|');
    
    // Pattern explanation:
    // (?<![@/]) - Negative lookbehind: not preceded by @ (email) or / (URL)
    // (?<![a-zA-Z0-9]) - Not preceded by alphanumeric (for word boundaries)
    // ([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?) - Label (subdomain/domain)
    // (?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+ - More labels (dots + labels)
    // \.(?:TLD_PATTERN) - Dot followed by TLD
    // (?![a-zA-Z0-9]) - Not followed by alphanumeric
    
    return new RegExp(
      `(?<![/:])(?<![a-zA-Z0-9])([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\\.(?:${tldPattern})(?![a-zA-Z0-9])`,
      'gi'
    );
  }
  
  /**
   * Determine confidence score based on hostname characteristics.
   * Higher confidence for known patterns and multiple labels.
   */
  private calculateConfidence(hostname: string, tld: string): number {
    let confidence = 0.7; // Base confidence
    
    // Higher confidence for well-known TLDs
    const popularTlds = ['com', 'org', 'net', 'edu', 'gov', 'io', 'dev', 'app'];
    if (popularTlds.includes(tld.toLowerCase())) {
      confidence += 0.15;
    }
    
    // Higher confidence for multiple subdomains (e.g., api.example.com)
    const labelCount = hostname.split('.').length;
    if (labelCount >= 3) {
      confidence += 0.1;
    }
    
    // Lower confidence for very short domains (might be abbreviations)
    if (hostname.length < 6) {
      confidence -= 0.1;
    }
    
    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  async handle(input: InputHandlerInput): Promise<InputHandlerOutput> {
    const rawText = input.text ?? '';
    const normalisationLog = [];
    const entities: DetectedEntity[] = [];
    
    // Build the hostname detection pattern
    const hostnamePattern = this.buildHostnamePattern();
    
    // Find all hostname matches
    const matches = [...rawText.matchAll(hostnamePattern)];
    
    for (const match of matches) {
      const hostname = match[0];
      const startIndex = match.index ?? 0;
      const endIndex = startIndex + hostname.length;
      
      // Extract TLD for confidence calculation
      const tldMatch = hostname.match(/\.([a-z]{2,}(?:\.[a-z]{2,})?)$/i);
      const tld = tldMatch ? tldMatch[1] : '';
      
      // Calculate confidence
      const confidence = this.calculateConfidence(hostname, tld);
      
      // Add to entities
      entities.push({
        type: 'hostname',
        span: { start: startIndex, end: endIndex },
        normalisedValue: hostname.toLowerCase(),
        confidence
      });
    }
    
    if (entities.length > 0) {
      normalisationLog.push({
        name: 'hostname_detection',
        params: {
          hostnames_found: entities.length,
          unique_hostnames: [...new Set(entities.map(e => e.normalisedValue))].length
        },
      });
    }
    
    const cleanText = rawText;
    
    // Calculate text lengths
    const lengths = {
      chars: cleanText.length,
      words: cleanText.split(/\s+/).filter(w => w.length > 0).length,
      tokens: 0,
    };
    
    // Carry caller tags forward as generic metadata
    const metadata: Record<string, any> | undefined = input.clientTags
      ? { ...input.clientTags }
      : undefined;
    
    // Parse the ISO-8601 timestamp supplied by the caller, fall back to now
    const ts = input.timestamp ? Date.parse(input.timestamp) : Date.now();
    
    return {
      id: input.id || generateUUID(),
      type: 'full',
      originalText: rawText,
      cleanText,
      role: 'user',
      language: input.languageHint || 'en',
      ts: isNaN(ts) ? Date.now() : ts,
      clientLocale: input.clientLocale,
      clientPlatform: input.clientPlatform,
      source: input.source,
      sessionId: input.sessionId,
      routingHint: input.routingHint,
      lengths,
      entities: entities.length > 0 ? entities : undefined,
      normalisationLog,
      metadata,
    };
  }
}
