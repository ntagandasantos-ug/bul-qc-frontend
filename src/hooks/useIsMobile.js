// ============================================================
// FILE: src/hooks/useIsMobile.js
// Returns true when screen width is phone or tablet (<1024px)
// Updates automatically when window is resized
// ============================================================

import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < 1024
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return isMobile;
}