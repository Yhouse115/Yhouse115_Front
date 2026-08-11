import { env } from '../config/env';
import { logger } from './logger';

export type HealthResponse = {
  status: string;
  service: string;
  environment: string;
  version: string;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const url = new URL('/health', env.apiBaseUrl);

  logger.info('health_check_requested', { url: url.toString() });

  const response = await fetch(url);
  if (!response.ok) {
    logger.warn('health_check_failed', { status: response.status });
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}
