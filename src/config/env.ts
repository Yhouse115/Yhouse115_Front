export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? 'WhyHouse Front',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  naverMapsClientId: import.meta.env.VITE_NAVER_MAPS_CLIENT_ID ?? '',
  naverMapsDefaultStyleId: import.meta.env.VITE_NAVER_MAPS_DEFAULT_STYLE_ID ?? '',
  naverMapsTransitStyleId: import.meta.env.VITE_NAVER_MAPS_TRANSIT_STYLE_ID ?? '',
  naverMapsSoftStyleId: import.meta.env.VITE_NAVER_MAPS_SOFT_STYLE_ID ?? '',
  naverMapsNoTransitStyleId: import.meta.env.VITE_NAVER_MAPS_NO_TRANSIT_STYLE_ID ?? '',
} as const;
