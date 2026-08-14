export function Portal({ front = false, opacity }: { front?: boolean; opacity: number }) {
  return <div className={`intro-portal intro-portal--${front ? 'front' : 'back'}`} style={{ opacity }}><i /><i /></div>;
}
