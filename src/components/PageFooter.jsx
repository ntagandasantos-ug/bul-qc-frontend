// ============================================================
// FILE: frontend/bul-qc-app/src/components/PageFooter.jsx
// ============================================================

import React from 'react';

export default function PageFooter() {
  return (
    <div style={{
      position      : 'fixed',
      bottom        : 0,
      left          : 0,
      width         : '100%',
      background    : 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
      color         : '#E9D5FF',
      fontSize      : '11px',
      padding       : '6px 16px',
      display       : 'flex',
      alignItems    : 'center',
      justifyContent: 'space-between',
      zIndex        : 40,
      borderTop     : '1px solid rgba(255,255,255,0.15)',
      boxSizing     : 'border-box',
    }}>
      {/* Left */}
      <span style={{ fontWeight:'600', color:'#DDD6FE' }}>
        SantosInfographics — Copyright © {new Date().getFullYear()}
      </span>

      {/* Centre */}
      <span style={{
        fontWeight    : '700',
        color         : '#FFB81C',
        letterSpacing : '0.3px',
        fontSize      : '11px',
      }}>
        Designed by Santos @ QC - 2026
      </span>

      {/* Right */}
      <span style={{ fontWeight:'600', color:'#DDD6FE' }}>
        BUL QC App v1.0.4
      </span>
    </div>
  );
}
