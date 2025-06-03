export const verifyEnv = (
  requiredEnvs: string[],
  optionalEnvs: string[] = []
): Record<string, string> => {
  const allKeys = [...requiredEnvs, ...optionalEnvs];
  const missingKeys: string[] = [];
  const env: Record<string, string> = {};

  for (const key of allKeys) {
    const value = process.env[key];
    if (!value) {
      if (requiredEnvs.includes(key)) {
        missingKeys.push(key);
      }
    } else {
      env[key] = value;
    }
  }

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  }

  // Set defaults for important configurations
  return {
    ...env,
    // Weather feature control for production safety
    WEATHER_ENABLED: process.env.WEATHER_ENABLED || 'true',
    WEATHER_TIMEOUT: process.env.WEATHER_TIMEOUT || '5000',
    WEATHER_CACHE_TTL: process.env.WEATHER_CACHE_TTL || '300000',
    // MCP server configuration
    MCP_SERVER_URL: process.env.MCP_SERVER_URL || 'https://prod-backend.maltesten.com:9000',
    MCP_ENABLED: process.env.MCP_ENABLED || 'true',
  };
};

const env = {
  ...process.env,
  // Weather feature control for production safety
  WEATHER_ENABLED: process.env.WEATHER_ENABLED || 'true',
  WEATHER_TIMEOUT: process.env.WEATHER_TIMEOUT || '5000',
  WEATHER_CACHE_TTL: process.env.WEATHER_CACHE_TTL || '300000',
  
  // OpenAI Realtime API control for production safety
  // Start with realtime disabled by default for safe deployment
  REALTIME_ENABLED: process.env.REALTIME_ENABLED || 'false',
  REALTIME_PERCENTAGE: process.env.REALTIME_PERCENTAGE || '0', // Gradual rollout control
  REALTIME_FALLBACK_TIMEOUT: process.env.REALTIME_FALLBACK_TIMEOUT || '5000',
  REALTIME_MAX_RETRIES: process.env.REALTIME_MAX_RETRIES || '2',
};
