import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { logger } from '../../services/logger';
import { AuthContext, type AuthContextValue } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
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
        if (!isSupabaseConfigured) {
          logger.warn('supabase_not_configured', { action: 'signInWithGoogle' });
          return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) {
          logger.error('google_sign_in_failed', { message: error.message });
        }
      },
      signOut: async () => {
        if (!isSupabaseConfigured) {
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
