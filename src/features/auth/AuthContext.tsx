import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { env } from '../../config/env';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { logger } from '../../services/logger';
import { AuthContext, type AuthContextValue } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      signInWithGoogle: async () => {
        if (!isSupabaseConfigured || !supabase) {
          logger.warn('supabase_not_configured', { action: 'signInWithGoogle' });
          window.alert('Supabase 로그인 설정이 필요합니다. 프론트 .env의 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 확인해 주세요.');
          return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: env.authRedirectUrl || window.location.href,
            queryParams: {
              prompt: 'select_account',
            },
          },
        });
        if (error) {
          logger.error('google_sign_in_failed', { message: error.message });
        }
      },
      signOut: async () => {
        if (!isSupabaseConfigured || !supabase) {
          logger.warn('supabase_not_configured', { action: 'signOut' });
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) {
          logger.error('sign_out_failed', { message: error.message });
        }
      },
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
