import { useEffect } from 'react';

// Refresh after trades/FX, after returning from another tab, and while visible.
// Serialize each view's requests so a slow quote does not create a polling queue.
export function usePortfolioRefresh(load: () => Promise<void>, market: 'KR' | 'US' | 'ALL') {
  useEffect(() => {
    let pending = false;
    let disposed = false;
    const refresh = async () => {
      if (pending || disposed || document.hidden) return;
      pending = true;
      try { await load(); } finally { pending = false; }
    };
    const changed = (event: Event) => {
      const affected = (event as CustomEvent).detail?.market;
      if (market === 'ALL' || !affected || affected === market || affected === 'ALL') void refresh();
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('antitude:portfolio-updated', changed);
    window.addEventListener('antitude:mypage-refresh', refresh);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('antitude:portfolio-updated', changed);
      window.removeEventListener('antitude:mypage-refresh', refresh);
    };
  }, [load, market]);
}
