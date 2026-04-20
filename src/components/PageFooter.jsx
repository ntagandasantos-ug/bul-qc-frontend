import React from 'react';

export default function PageFooter() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0,
      width: '100%',
      background: 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
      color: '#E9D5FF',
      fontSize: '11px',
      padding: '5px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 40,
      borderTop: '1px solid rgba(255,255,255,0.1)',
    }}>
      <span>SantosInfographics — Copyright © {new Date().getFullYear()}</span>
      <span style={{ color: '#DDD6FE' }}>BUL QC App v1.0.0</span>
    </div>
  );
}