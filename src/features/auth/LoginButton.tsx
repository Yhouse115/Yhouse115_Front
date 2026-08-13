import { useAuth } from './useAuth';

function displayName(session: ReturnType<typeof useAuth>['session']): string {
  const metadata = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  return metadata?.full_name ?? metadata?.name ?? session?.user.email ?? '사용자';
}

export function LoginButton() {
  const { session, isLoading, signInWithGoogle, signOut } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return (
      <button className="login-button" onClick={() => void signInWithGoogle()} type="button">
        로그인
      </button>
    );
  }

  return (
    <button className="login-button" onClick={() => void signOut()} type="button" title="로그아웃">
      {displayName(session)} 님 · 로그아웃
    </button>
  );
}
