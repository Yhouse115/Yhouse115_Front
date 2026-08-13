import { createClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { logger } from '../services/logger';

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  logger.warn('supabase_env_missing', {
    hasUrl: Boolean(env.supabaseUrl),
    hasAnonKey: Boolean(env.supabaseAnonKey),
  });
}

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
