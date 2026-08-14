import React from 'react';

interface StitchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'drawer' | 'split';
  children: React.ReactNode;
}

export const StitchDrawer: React.FC<StitchDrawerProps> = ({
  isOpen,
  onClose,
  mode = 'drawer',
  children,
}) => {
  if (!isOpen) return null;

  if (mode === 'split') {
    return (
      <div
        className="stitch-split-container"
        style={{
          width: '400px',
          height: '100%',
          flexShrink: 0,
          position: 'relative',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
          transition: 'width 0.3s ease-in-out',
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="stitch-drawer-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 31, 61, 0.4)',
        backdropFilter: 'blur(3px)',
        animation: 'stitch-fade-in 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="stitch-drawer-content"
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100%',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
          animation: 'stitch-slide-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes stitch-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes stitch-slide-left {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};
