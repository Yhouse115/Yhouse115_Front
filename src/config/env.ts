export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? 'WhyHouse Front',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
} as const;
