import { useEffect, useRef, useState } from 'react';

export const ADSENSE_PUBLISHER_ID = 'ca-pub-9961117259642205';

export const ADSENSE_SLOTS = {
  top: '7524161905',
  middle: '8606590546',
  bottom: '9290658812',
} as const;

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & { loaded?: boolean };
  }
}

export interface AdSenseBannerProps {
  placement: 'top' | 'middle' | 'bottom';
  adSlot?: string;
  className?: string;
}

type AdLoadState = 'probing' | 'filled' | 'hidden';

const MIN_VISIBLE_AD_HEIGHT_PX = 45;
const MIN_VISIBLE_AD_WIDTH_PX = 120;

function hasRenderedVisibleAd(insEl: HTMLModElement): boolean {
  const status = insEl.getAttribute('data-ad-status');
  const inlineDisplay = insEl.style.display;
  if (status === 'unfilled' || inlineDisplay === 'none') {
    return false;
  }
  if (status !== 'filled') {
    return false;
  }

  const insStyle = window.getComputedStyle(insEl);
  if (insStyle.display === 'none' || insStyle.visibility === 'hidden' || insStyle.opacity === '0') {
    return false;
  }

  const iframes = Array.from(insEl.querySelectorAll('iframe'));
  for (const iframe of iframes) {
    const iframeStyle = window.getComputedStyle(iframe);
    if (
      iframeStyle.display === 'none' ||
      iframeStyle.visibility === 'hidden' ||
      iframeStyle.opacity === '0'
    ) {
      continue;
    }
    const rect = iframe.getBoundingClientRect();
    const attrH = Number(iframe.getAttribute('height') || 0);
    const attrW = Number(iframe.getAttribute('width') || 0);
    const effectiveH = Math.max(rect.height, Number.isFinite(attrH) ? attrH : 0);
    const effectiveW = Math.max(rect.width, Number.isFinite(attrW) ? attrW : 0);
    if (effectiveH >= MIN_VISIBLE_AD_HEIGHT_PX && effectiveW >= MIN_VISIBLE_AD_WIDTH_PX) {
      return true;
    }
  }

  return false;
}

export function AdSenseBanner({
  placement,
  adSlot,
  className = '',
}: AdSenseBannerProps) {
  const insRef = useRef<HTMLModElement | null>(null);
  const [adState, setAdState] = useState<AdLoadState>('probing');
  const resolvedSlot = adSlot || ADSENSE_SLOTS[placement];

  useEffect(() => {
    const insEl = insRef.current;
    if (!insEl) return;

    let disposed = false;

    const evaluateAdElement = () => {
      if (disposed || !insRef.current) return;
      const el = insRef.current;
      const status = el.getAttribute('data-ad-status');
      const inlineDisplay = el.style.display;

      if (status === 'unfilled' || inlineDisplay === 'none') {
        setAdState('hidden');
        return;
      }

      if (hasRenderedVisibleAd(el)) {
        setAdState('filled');
      } else if (status === 'filled') {
        // Marked filled by AdSense, but inner iframe has 0px / blocked dimensions
        setAdState((prev) => (prev === 'filled' ? 'hidden' : prev));
      }
    };

    const mutationObserver = new MutationObserver(() => {
      evaluateAdElement();
    });

    mutationObserver.observe(insEl, {
      attributes: true,
      attributeFilter: ['data-ad-status', 'data-adsbygoogle-status', 'style'],
      childList: true,
      subtree: true,
    });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            evaluateAdElement();
          })
        : null;
    resizeObserver?.observe(insEl);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setAdState('hidden');
      return () => {
        disposed = true;
        mutationObserver.disconnect();
        resizeObserver?.disconnect();
      };
    }

    const scriptEl = document.querySelector<HTMLScriptElement>(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
    );
    const handleScriptError = () => {
      if (!disposed) {
        setAdState('hidden');
      }
    };
    scriptEl?.addEventListener('error', handleScriptError);

    // Push after layout frame so responsive width > 0 while wrapper stays 0px tall and invisible
    const rafId = window.requestAnimationFrame(() => {
      if (disposed || !insRef.current) return;
      if (
        insRef.current.dataset.adPushed !== '1' &&
        !insRef.current.getAttribute('data-adsbygoogle-status')
      ) {
        try {
          insRef.current.dataset.adPushed = '1';
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          setAdState('hidden');
          return;
        }
      }
      evaluateAdElement();
    });

    // Unmount completely if no real visible ad fills within timeout
    const fallbackTimer = window.setTimeout(() => {
      if (disposed || !insRef.current) return;
      if (!hasRenderedVisibleAd(insRef.current)) {
        setAdState('hidden');
      }
    }, 3000);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(fallbackTimer);
      scriptEl?.removeEventListener('error', handleScriptError);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, [placement, resolvedSlot]);

  if (adState === 'hidden') {
    return null;
  }

  const isFilled = adState === 'filled';

  return (
    <aside
      aria-label="إعلان"
      aria-hidden={!isFilled}
      data-ad-placement={placement}
      className={
        isFilled
          ? `w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2 sm:p-3 dark:border-zinc-800 dark:bg-[#09090b] ${className}`
          : '!m-0 !p-0 w-full border-0 bg-transparent'
      }
      style={
        isFilled
          ? { display: 'block' }
          : {
              display: 'block',
              width: '100%',
              height: 0,
              minHeight: 0,
              maxHeight: 0,
              margin: 0,
              padding: 0,
              border: 0,
              overflow: 'hidden',
              visibility: 'hidden',
              pointerEvents: 'none',
              background: 'transparent',
            }
      }
    >
      <div className="block w-full overflow-hidden">
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_PUBLISHER_ID}
          data-ad-slot={resolvedSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
