/**
 * Weather Functions for OpenAI Realtime API
 * 
 * This module defines weather-related functions that can be called by the OpenAI Realtime API.
 * It integrates with our existing, production-tested WeatherService to ensure reliability.
 * 
 * Design decisions:
 * - Reuse existing WeatherService (already production-tested)
 * - German language support for function descriptions and responses
 * - Comprehensive error handling with fallbacks
 * - Structured function definitions compatible with OpenAI Realtime API
 */

import { weatherService, WeatherService } from '../mcp/weather-service.js';

/**
 * Weather function definition for OpenAI Realtime API
 * This follows the OpenAI function calling schema
 */
export const weatherFunctionDefinition = {
  name: 'get_weather',
  description: 'Aktuelle Wetterinformationen für einen beliebigen Ort abrufen. Unterstützt deutsche und internationale Städte.',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'Stadt oder Ortsname (z.B. "Berlin", "München", "Hamburg", "London")'
      }
    },
    required: ['location']
  }
};

/**
 * Execute weather function call from OpenAI Realtime API
 * 
 * This function handles weather requests from the realtime API and returns
 * properly formatted German responses using our existing weather service.
 * 
 * @param args - Function arguments from OpenAI Realtime API
 * @returns Promise with weather response formatted for German conversation
 */
export async function executeWeatherFunction(args: { location: string }): Promise<string> {
  console.log(`🌤️ Realtime API weather request for: ${args.location}`);
  
  try {
    // Validate input
    if (!args.location || typeof args.location !== 'string') {
      return "Entschuldigung, ich benötige einen gültigen Ortsnamen für die Wetterabfrage.";
    }
    
    // Use our existing, production-tested weather service
    // This ensures consistency with the current webhook-based implementation
    const weatherResponse = await weatherService.getWeather(args.location);
    
    // Format response for German conversation
    if (weatherResponse.success && weatherResponse.data) {
      const response = weatherService.formatForSpeech(weatherResponse);
      console.log(`✅ Weather response generated: ${response}`);
      return response;
    } else {
      // Fallback response in case of weather service failure
      console.warn(`⚠️ Weather service failed for ${args.location}: ${weatherResponse.error}`);
      return `Entschuldigung, ich konnte die Wetterinformationen für ${args.location} gerade nicht abrufen. Bitte versuchen Sie es später erneut.`;
    }
    
  } catch (error) {
    console.error('❌ Weather function execution failed:', error);
    // Provide graceful error response in German
    return "Es tut mir leid, bei der Wetterabfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.";
  }
}

/**
 * Available functions map for OpenAI Realtime API
 * This maps function names to their execution handlers
 */
export const availableFunctions = {
  'get_weather': executeWeatherFunction
};

/**
 * All function definitions for session configuration
 * This array contains all function definitions that will be sent to OpenAI Realtime API
 */
export const allFunctionDefinitions = [
  weatherFunctionDefinition
];

/**
 * Utility function to check if a message requires weather function calling
 * This helps decide whether to invoke weather functions during conversation
 * 
 * @param message - User message text
 * @returns boolean indicating if weather function should be called
 */
export function shouldCallWeatherFunction(message: string): boolean {
  // Reuse the existing weather query detection logic
  // This ensures consistency between webhook and realtime implementations
  return WeatherService.isWeatherQuery(message);
}

/**
 * Extract location from user message for weather function
 * 
 * @param message - User message text
 * @returns Extracted location or null if not found
 */
export function extractWeatherLocation(message: string): string | null {
  // Reuse existing location extraction logic
  return WeatherService.extractLocation(message);
} 