/**
 * Production Weather Service with MCP Integration
 * 
 * This service provides weather information with multiple fallback strategies:
 * 1. Primary: Direct HTTP API (no MCP dependency for now - production safe)
 * 2. Fallback: Generic responses if all else fails
 * 
 * Design decisions:
 * - Start with HTTP API instead of MCP for production safety
 * - Add proper error handling and timeouts
 * - Cache responses to avoid repeated API calls
 * - Format responses for TTS (Text-to-Speech) optimization
 */

interface WeatherResponse {
  success: boolean;
  data?: {
    location: string;
    temperature: number;
    description: string;
    humidity?: number;
    windSpeed?: number;
  };
  error?: string;
  source: 'api' | 'cache' | 'fallback';
}

interface CacheEntry {
  data: WeatherResponse;
  timestamp: number;
  ttl: number;
}

export class WeatherService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = parseInt(process.env.WEATHER_CACHE_TTL || '300000'); // 5 minutes default
  private readonly REQUEST_TIMEOUT = parseInt(process.env.WEATHER_TIMEOUT || '5000'); // 5 seconds default
  private readonly MAX_RETRIES = 2;
  private readonly ENABLED = process.env.WEATHER_ENABLED !== 'false'; // Enabled by default

  constructor() {
    console.log(`WeatherService initialized - Enabled: ${this.ENABLED}, Timeout: ${this.REQUEST_TIMEOUT}ms, Cache TTL: ${this.CACHE_TTL}ms`);
  }

  /**
   * Get weather for a location with comprehensive error handling
   * @param location - City name or location string
   * @returns Promise with weather data or fallback response
   */
  async getWeather(location: string): Promise<WeatherResponse> {
    // Production safety: Check if weather service is enabled
    if (!this.ENABLED) {
      console.log('Weather service is disabled via WEATHER_ENABLED environment variable');
      return this.createFallbackResponse(location, 'Weather service is currently disabled');
    }

    try {
      console.log(`Weather request for: ${location}`);
      
      // Validate and clean location input
      const cleanLocation = this.sanitizeLocation(location);
      if (!cleanLocation) {
        return this.createFallbackResponse(location, 'Invalid location format');
      }

      // Check cache first
      const cached = this.getCachedWeather(cleanLocation);
      if (cached) {
        console.log(`Weather cache hit for ${cleanLocation}`);
        return cached;
      }

      // Try primary weather service (wttr.in - no API key required)
      const weatherData = await this.fetchWeatherWithRetry(cleanLocation);
      
      // Cache successful response
      this.cacheWeather(cleanLocation, weatherData);
      
      return weatherData;

    } catch (error) {
      console.error('Weather service error:', error);
      return this.createFallbackResponse(location, 'Weather service temporarily unavailable');
    }
  }

  /**
   * Sanitize location input to prevent injection and normalize format
   */
  private sanitizeLocation(location: string): string | null {
    if (!location || typeof location !== 'string') return null;
    
    // Remove potential harmful characters and normalize
    const cleaned = location
      .trim()
      .replace(/[^a-zA-Z0-9\s,-]/g, '')
      .substring(0, 50); // Limit length
    
    return cleaned.length >= 2 ? cleaned : null;
  }

  /**
   * Fetch weather with retry logic and circuit breaker pattern
   */
  private async fetchWeatherWithRetry(location: string): Promise<WeatherResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`Weather API attempt ${attempt} for ${location}`);
        
        // Use wttr.in API - reliable and no API key required
        const response = await this.fetchWithTimeout(
          `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
          this.REQUEST_TIMEOUT
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return this.parseWttrResponse(data, location);

      } catch (error) {
        lastError = error as Error;
        console.warn(`Weather API attempt ${attempt} failed:`, error);
        
        // Exponential backoff for retries
        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All retries failed, return fallback
    console.error(`All weather API attempts failed for ${location}:`, lastError);
    return this.createFallbackResponse(location, 'Weather data temporarily unavailable');
  }

  /**
   * Fetch with timeout to prevent hanging requests
   */
  private async fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LiveKit-SIP-Agent/1.0',
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Parse wttr.in API response into our standard format
   */
  private parseWttrResponse(data: any, location: string): WeatherResponse {
    try {
      if (!data.current_condition || !data.current_condition[0]) {
        throw new Error('Invalid API response format');
      }

      const current = data.current_condition[0];
      const area = data.nearest_area?.[0];
      
      return {
        success: true,
        data: {
          location: area?.areaName?.[0]?.value || location,
          temperature: parseInt(current.temp_C) || 0,
          description: current.weatherDesc?.[0]?.value || 'Unknown',
          humidity: parseInt(current.humidity) || undefined,
          windSpeed: parseInt(current.windspeedKmph) || undefined,
        },
        source: 'api' as const,
      };
    } catch (error) {
      console.error('Failed to parse weather API response:', error);
      return this.createFallbackResponse(location, 'Unable to parse weather data');
    }
  }

  /**
   * Create fallback response when weather service fails
   */
  private createFallbackResponse(location: string, reason: string): WeatherResponse {
    console.log(`Creating fallback weather response for ${location}: ${reason}`);
    
    return {
      success: false,
      error: reason,
      source: 'fallback' as const,
    };
  }

  /**
   * Cache management
   */
  private getCachedWeather(location: string): WeatherResponse | null {
    const cacheKey = location.toLowerCase();
    const entry = this.cache.get(cacheKey);
    
    if (entry && (Date.now() - entry.timestamp) < entry.ttl) {
      return { ...entry.data, source: 'cache' as const };
    }
    
    // Clean expired entry
    if (entry) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  private cacheWeather(location: string, response: WeatherResponse): void {
    if (response.success) {
      const cacheKey = location.toLowerCase();
      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL,
      });
    }
  }

  /**
   * Format weather response for TTS (optimized for phone conversation)
   */
  formatForSpeech(response: WeatherResponse): string {
    if (!response.success || !response.data) {
      return "I'm sorry, I couldn't get the weather information right now. Please try again later.";
    }

    const { location, temperature, description } = response.data;
    
    // Format temperature and description for natural speech
    let speech = `The weather in ${location} is currently ${temperature} degrees Celsius with ${description.toLowerCase()}.`;
    
    // Add additional details if available
    if (response.data.humidity) {
      speech += ` The humidity is ${response.data.humidity} percent.`;
    }
    
    return speech;
  }

  /**
   * Detect if user input is asking for weather information
   */
  static isWeatherQuery(input: string): boolean {
    const weatherKeywords = [
      'weather', 'temperature', 'forecast', 'rain', 'sunny', 'cloudy',
      'hot', 'cold', 'degrees', 'climate', 'humidity', 'wind'
    ];
    
    const lowerInput = input.toLowerCase();
    return weatherKeywords.some(keyword => lowerInput.includes(keyword));
  }

  /**
   * Extract location from user input
   */
  static extractLocation(input: string): string | null {
    // Simple patterns to extract location
    // "weather in London" -> "London"
    // "temperature in New York" -> "New York"
    // "how's the weather in Berlin" -> "Berlin"
    
    const patterns = [
      /(?:weather|temperature|forecast).*?(?:in|for|at)\s+([a-zA-Z\s,]+?)(?:\s|$|\?)/i,
      /(?:in|for|at)\s+([a-zA-Z\s,]+?)(?:\s+(?:weather|temperature|forecast))/i,
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // If no pattern matches, look for city-like words after common prepositions
    const words = input.split(' ');
    const inIndex = words.findIndex(word => /^(in|for|at)$/i.test(word));
    if (inIndex !== -1 && inIndex < words.length - 1) {
      // Take next 1-3 words as potential location
      const locationWords = words.slice(inIndex + 1, inIndex + 4);
      return locationWords.join(' ').replace(/[^\w\s]/g, '').trim();
    }
    
    return null;
  }
}

// Create singleton instance for use across the application
export const weatherService = new WeatherService(); 