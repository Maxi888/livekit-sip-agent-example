export const verifyEnv = <T extends string>(
  keys: T[], 
  optionalKeys: string[] = []
): Record<T, string> => {
  const result: Partial<Record<T, string>> = {};
  keys.forEach(key => {
    if (!process.env[key] && !optionalKeys.includes(key)) {
      console.error(`Environment variable ${key} is not set.`);
      // eslint-disable-next-line n/no-process-exit
      process.exit(1);
    }
    result[key] = process.env[key] || '';
  });
  return result as Record<T, string>;
};

const env = {
  ...process.env,
  // Weather feature control for production safety
  WEATHER_ENABLED: process.env.WEATHER_ENABLED || 'true',
  WEATHER_TIMEOUT: process.env.WEATHER_TIMEOUT || '5000',
  WEATHER_CACHE_TTL: process.env.WEATHER_CACHE_TTL || '300000',
};
