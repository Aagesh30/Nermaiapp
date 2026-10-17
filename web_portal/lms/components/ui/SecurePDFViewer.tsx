import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Maximize,
  Minimize,
  ShieldAlert,
  X,
  EyeOff,
  RefreshCw,
  AlertCircle,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { WatermarkOverlay } from './WatermarkOverlay';

// Set up local & CDN worker fallback
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = window.location.origin
    ? `${window.location.origin}/pdf.worker.min.mjs`
    : `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// Disable byte-range requests and stream chunking to prevent "Invalid PDF structure" errors on streamed files
const PDF_DOCUMENT_OPTIONS = {
  disableRange: true,
  disableStream: true,
  disableAutoFetch: false,
};

interface SecurePDFViewerProps {
  url: string;
  fallbackUrl?: string;
  onClose?: () => void;
  title?: string;
  onDownload?: () => void;
  isSecure?: boolean;
}

export const SecurePDFViewer: React.FC<SecurePDFViewerProps> = ({
  url,
  fallbackUrl,
  onClose,
  title = 'Document',
  onDownload,
  isSecure = true
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBlackoutActive, setIsBlackoutActive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(360);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [useIframeFallback, setUseIframeFallback] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const docWrapperRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef<boolean>(false);

  // Gesture tracking refs (zero canvas re-render overhead during movement)
  const pinchDistRef = useRef<number>(0);
  const pinchScaleRef = useRef<number>(1);
  const isPinchingRef = useRef<boolean>(false);
  const latestPinchScaleRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const prevZoomScaleRef = useRef<number>(1);

  // Mouse pan tracking refs (for desktop drag-to-pan)
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0
  });

  const handleZoomIn = () => setZoomScale(prev => Math.min(Number((prev + 0.25).toFixed(2)), 3.0));
  const handleZoomOut = () => setZoomScale(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.6));
  const handleResetZoom = () => setZoomScale(1);

  // ── Normalize URL & Route Google Drive through streaming proxy ─────────────
  let cleanUrl = (url || '').trim();
  if (cleanUrl.includes('#toolbar=0')) {
    cleanUrl = cleanUrl.replace('#toolbar=0', '');
  }

  const getDriveId = (u: string) => {
    if (!u) return null;
    const m = u.match(/\/file\/d\/([-\w]{25,})/) || u.match(/[?&]id=([-\w]{25,})/);
    if (m && m[1]) return m[1];
    if (u.includes('drive.google.com') || u.includes('docs.google.com')) {
      const m2 = u.match(/([-\w]{25,})/);
      if (m2) return m2[1];
    }
    return null;
  };

  const driveId = getDriveId(cleanUrl) || getDriveId(fallbackUrl || '') || getDriveId(url || '');
  const apiOrigin = typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://nermaiiasacademy-519c8.web.app';

  // Check if daily content storage URL with ID
  const dailyContentMatch = cleanUrl.match(/daily_content\/([0-9a-fA-F-]{36})/);
  const dailyContentId = dailyContentMatch ? dailyContentMatch[1] : null;

  const computeSource = useCallback((targetUrl: string, bustCache = false): string => {
    let u = (targetUrl || '').trim();
    if (u.includes('#toolbar=0')) u = u.replace('#toolbar=0', '');
    const dId = getDriveId(u);
    if (dId) {
      return `${apiOrigin}/api/resources/stream/drive/${dId}${bustCache ? `?t=${Date.now()}` : ''}`;
    }
    const dcMatch = u.match(/daily_content\/([0-9a-fA-F-]{36})/);
    if (dcMatch) {
      return `${apiOrigin}/api/lms/daily-content/${dcMatch[1]}/stream${bustCache ? `?t=${Date.now()}` : ''}`;
    }
    if (u.includes('storage.googleapis.com')) {
      const hasQuery = u.includes('?');
      if (bustCache) {
        return `${u}${hasQuery ? '&' : '?'}v=1&t=${Date.now()}`;
      } else if (!hasQuery) {
        return `${u}?v=1`;
      }
    }
    return bustCache ? `${u}${u.includes('?') ? '&' : '?'}t=${Date.now()}` : u;
  }, [apiOrigin]);

  const [activePdfSource, setActivePdfSource] = useState<string>(() => computeSource(cleanUrl));
  const [retryAttempt, setRetryAttempt] = useState<number>(0);

  useEffect(() => {
    setActivePdfSource(computeSource(cleanUrl));
    setRetryAttempt(0);
    setLoadError(null);
    setNumPages(null);
  }, [url, computeSource]);

  // ── Responsive Width Calculation (Full width on phone, centered on desktop) ─
  const updateContainerWidth = useCallback(() => {
    if (viewerRef.current) {
      const clientW = viewerRef.current.clientWidth;
      const isMobile = window.innerWidth < 640;
      // On mobile, take 100% width with 0 padding for perfect phone screen fit
      const targetW = isMobile ? clientW : Math.min(clientW - 32, 860);
      setContainerWidth(Math.max(260, targetW));
    }
  }, []);

  useEffect(() => {
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, [updateContainerWidth]);

  // ── Maintain reading scroll position when zooming in/out ──────────────────
  useEffect(() => {
    if (viewerRef.current && prevZoomScaleRef.current !== zoomScale) {
      const ratio = zoomScale / prevZoomScaleRef.current;
      if (prevZoomScaleRef.current > 0 && ratio !== 1 && !isNaN(ratio)) {
        viewerRef.current.scrollTop = Math.round(viewerRef.current.scrollTop * ratio);
      }
      if (zoomScale <= 1) {
        viewerRef.current.scrollLeft = 0;
      }
      prevZoomScaleRef.current = zoomScale;
    }
  }, [zoomScale]);

  // ── Touch Handling (Hardware GPU Pinch Zoom & Double-Tap on Mobile) ─────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchDistRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        pinchScaleRef.current = zoomScale;
        isPinchingRef.current = true;
      } else if (e.touches.length === 1) {
        // Double tap toggle between 1x and 1.75x
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          if (zoomScale > 1) {
            setZoomScale(1);
          } else {
            setZoomScale(1.75);
          }
          lastTapRef.current = 0;
          return;
        }
        lastTapRef.current = now;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinchingRef.current && pinchDistRef.current > 0) {
        if (e.cancelable) e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = dist / pinchDistRef.current;
        const targetScale = Math.min(Math.max(pinchScaleRef.current * factor, 0.6), 3.0);
        latestPinchScaleRef.current = targetScale;

        // Apply pure CSS GPU transform during pinch: 60/120 FPS butter-smooth, 0 CPU re-renders
        if (docWrapperRef.current) {
          const scaleRatio = targetScale / pinchScaleRef.current;
          docWrapperRef.current.style.transform = `scale(${scaleRatio})`;
          docWrapperRef.current.style.transformOrigin = 'center top';
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isPinchingRef.current && e.touches.length < 2) {
        isPinchingRef.current = false;
        pinchDistRef.current = 0;
        if (docWrapperRef.current) {
          docWrapperRef.current.style.transform = 'none';
        }
        if (latestPinchScaleRef.current !== null) {
          const next = Number(latestPinchScaleRef.current.toFixed(2));
          latestPinchScaleRef.current = null;
          setZoomScale(next);
        }
      }
    };

    viewer.addEventListener('touchstart', onTouchStart, { passive: true });
    viewer.addEventListener('touchmove', onTouchMove, { passive: false });
    viewer.addEventListener('touchend', onTouchEnd, { passive: true });
    viewer.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      viewer.removeEventListener('touchstart', onTouchStart);
      viewer.removeEventListener('touchmove', onTouchMove);
      viewer.removeEventListener('touchend', onTouchEnd);
      viewer.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoomScale]);

  // ── Desktop Drag-to-Pan (Hand Tool Mode when Zoomed In) ─────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || zoomScale <= 1 || !viewerRef.current) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewerRef.current.scrollLeft,
      scrollTop: viewerRef.current.scrollTop
    };
  };

  useEffect(() => {
    const onGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !viewerRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      viewerRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
      viewerRef.current.scrollTop = dragStartRef.current.scrollTop - dy;
    };

    const onGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, []);

  // ── Desktop Ctrl + Wheel Zoom Listener ──────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const step = delta > 0 ? 0.15 : -0.15;
        setZoomScale(prev => {
          const next = Math.min(Math.max(prev + step, 0.6), 3.0);
          return Number(next.toFixed(2));
        });
      }
    };

    viewer.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewer.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Mobile OS Screenshot Guard (Android FLAG_SECURE) ──────────────────────
  useEffect(() => {
    try {
      if (Platform.OS !== 'web') {
        ScreenCapture.preventScreenCaptureAsync().catch(() => { });
      }
    } catch (_) { }
  }, []);

  // ── Web Screenshot Guard (Instant Synchronous DOM Veil & Blur — 0ms Latency) ─
  const triggerScreenshotBlock = useCallback((e?: Event) => {
    if (isInteractingRef.current) return;
    if (e) {
      try { e.preventDefault(); } catch (_) { }
      try { e.stopPropagation(); } catch (_) { }
      try { (e as any).stopImmediatePropagation?.(); } catch (_) { }
    }

    // 1. Immediately wipe clipboard if document has focus
    try {
      if (typeof document !== 'undefined' && document.hasFocus && document.hasFocus() && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText('').catch(() => {});
      }
    } catch (_) { }

    // 2. Immediately apply heavy blur & dimming directly to the document DOM (synchronous, 0ms lag)
    if (viewerRef.current) {
      viewerRef.current.style.filter = 'blur(45px)';
      viewerRef.current.style.opacity = '0.04';
      viewerRef.current.style.pointerEvents = 'none';
      viewerRef.current.style.userSelect = 'none';
    }

    // 3. Immediately display the opaque security veil synchronously
    if (veilRef.current) {
      veilRef.current.style.display = 'flex';
    }

    setIsBlackoutActive(true);
  }, []);

  const handleResume = useCallback(() => {
    isInteractingRef.current = true;
    setTimeout(() => { isInteractingRef.current = false; }, 800);

    try {
      if (typeof window !== 'undefined') window.focus();
    } catch (_) { }

    // 1. Synchronously lift background blur and restore full opacity
    if (viewerRef.current) {
      viewerRef.current.style.filter = 'none';
      viewerRef.current.style.opacity = '1';
      viewerRef.current.style.pointerEvents = 'auto';
      viewerRef.current.style.userSelect = 'none';
    }

    // 2. Synchronously hide security veil
    if (veilRef.current) {
      veilRef.current.style.display = 'none';
    }

    setIsBlackoutActive(false);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    let printStyle = document.getElementById('nermai-pdf-print-guard');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'nermai-pdf-print-guard';
      printStyle.innerHTML = '@media print { body, #pdf-secure-root { display: none !important; } }';
      document.head.appendChild(printStyle);
    }

    const handleKeyEvent = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          isInteractingRef.current = true;
          setTimeout(() => { isInteractingRef.current = false; }, 800);
          document.exitFullscreen().catch(() => { });
          setIsFullscreen(false);
        } else if (onClose) {
          onClose();
        }
        return;
      }

      // PrintScreen (key, hardware code, or keyCode 44) across Windows/Mac/Linux
      const isPrntScrn =
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.key === 'Snapshot' ||
        (e.altKey && (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44)) ||
        (e.metaKey && (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44));

      // Windows Snipping Tool (Win + Shift + S) or Mac (Cmd + Shift + 3/4/5)
      const isSnippingTool =
        (e.ctrlKey || e.metaKey) && e.shiftKey && ['s', 'S', '3', '4', '5', 'i', 'I', 'j', 'J', 'c', 'C'].includes(e.key);

      // Print command (Ctrl + P / Cmd + P)
      const isPrint =
        (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P');

      // Save command (Ctrl + S / Cmd + S)
      const isSave =
        (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');

      if (isPrntScrn || isSnippingTool || isPrint) {
        triggerScreenshotBlock(e);
        return;
      }

      if (isSave) {
        e.preventDefault();
        return;
      }
    };

    const handleFullscreenChange = () => {
      isInteractingRef.current = true;
      setTimeout(() => { isInteractingRef.current = false; }, 800);
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleWindowBlur = (e: any) => {
      if (isInteractingRef.current) return;
      if (e && e.target && e.target !== window && e.target !== document) return;
      triggerScreenshotBlock();
    };

    const handleVisibilityChange = () => {
      if (isInteractingRef.current) return;
      if (document.hidden || document.visibilityState === 'hidden') {
        triggerScreenshotBlock();
      } else {
        try {
          if (typeof window !== 'undefined') window.focus();
        } catch (_) { }
      }
    };

    const handlePageHide = () => {
      if (isInteractingRef.current) return;
      triggerScreenshotBlock();
    };

    const handleTouchGesture = (e: TouchEvent) => {
      if (isInteractingRef.current) return;
      // Intercept 3-finger swipe screenshot gestures on mobile OS
      if (e.touches && e.touches.length >= 3) {
        triggerScreenshotBlock(e);
      }
    };

    const handleTouchCancel = (e: TouchEvent) => {
      if (isInteractingRef.current) return;
      // Android OS hardware button screenshots (Power + Vol Down) trigger touchcancel
      triggerScreenshotBlock(e);
    };

    // Listen to BOTH keydown and keyup on window AND document (Windows Chrome dispatches PrintScreen on keyup)
    window.addEventListener('keydown', handleKeyEvent, true);
    window.addEventListener('keyup', handleKeyEvent, true);
    document.addEventListener('keydown', handleKeyEvent, true);
    document.addEventListener('keyup', handleKeyEvent, true);
    window.addEventListener('blur', handleWindowBlur, false);
    document.addEventListener('visibilitychange', handleVisibilityChange, true);
    window.addEventListener('pagehide', handlePageHide, true);
    window.addEventListener('touchstart', handleTouchGesture, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyEvent, true);
      window.removeEventListener('keyup', handleKeyEvent, true);
      document.removeEventListener('keydown', handleKeyEvent, true);
      document.removeEventListener('keyup', handleKeyEvent, true);
      window.removeEventListener('blur', handleWindowBlur, false);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      window.removeEventListener('pagehide', handlePageHide, true);
      window.removeEventListener('touchstart', handleTouchGesture);
      window.removeEventListener('touchcancel', handleTouchCancel);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [onClose, triggerScreenshotBlock]);

  const toggleFullscreen = () => {
    isInteractingRef.current = true;
    setTimeout(() => { isInteractingRef.current = false; }, 800);
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(null);
    setTimeout(updateContainerWidth, 60);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('[SecurePDFViewer] PDF loading error:', err);
    if (driveId && !useIframeFallback) {
      console.log('[SecurePDFViewer] PDF rendering failed, switching to secure Google Drive preview fallback...');
      setUseIframeFallback(true);
      setLoadError(null);
      return;
    }
    // Automatic fallback logic on first error
    if (retryAttempt === 0) {
      if (dailyContentId && !activePdfSource.includes('/api/lms/daily-content/')) {
        console.log('[SecurePDFViewer] Retrying with stream proxy fallback...');
        setRetryAttempt(1);
        setActivePdfSource(`${apiOrigin}/api/lms/daily-content/${dailyContentId}/stream?t=${Date.now()}`);
        return;
      }
      if (dailyContentId && activePdfSource.includes('/api/lms/daily-content/')) {
        console.log('[SecurePDFViewer] Retrying with direct storage URL...');
        setRetryAttempt(1);
        const sep = cleanUrl.includes('?') ? '&' : '?';
        setActivePdfSource(`${cleanUrl}${sep}v=1&t=${Date.now()}`);
        return;
      }
      if (fallbackUrl && activePdfSource !== fallbackUrl) {
        console.log('[SecurePDFViewer] Retrying with fallbackUrl...');
        setRetryAttempt(1);
        setActivePdfSource(fallbackUrl);
        return;
      }
      if (activePdfSource.includes('storage.googleapis.com') && !activePdfSource.includes('t=')) {
        console.log('[SecurePDFViewer] Retrying with cache-bust...');
        setRetryAttempt(1);
        const sep = activePdfSource.includes('?') ? '&' : '?';
        setActivePdfSource(`${activePdfSource}${sep}t=${Date.now()}`);
        return;
      }
    }
    setLoadError(err.message || 'Failed to render PDF document in secure view.');
  };

  const handleRetry = () => {
    setLoadError(null);
    setNumPages(null);
    setRetryAttempt(prev => prev + 1);
    setActivePdfSource(computeSource(cleanUrl, true));
  };

  const renderedWidth = Math.round(containerWidth * zoomScale);

  return (
    <div
      ref={containerRef}
      id="pdf-secure-root"
      tabIndex={0}
      className={`relative flex flex-col w-full h-full bg-[#0c0f17] overflow-hidden select-none outline-none ${
        isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-none' : 'border-none'
      }`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ height: '100%', minHeight: 0 }}
    >
      {/* ── TOP CONTROL BAR (Custom Academy Header — No Browser Toolbars) ── */}
      <header className="w-full bg-[#121622]/95 backdrop-blur-md px-2.5 sm:px-4 py-1.5 sm:py-2.5 flex items-center justify-between border-b border-white/10 shrink-0 z-30 gap-1.5 sm:gap-2">

        {/* Left: Close button & Document Title */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 sm:p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors shrink-0"
              title="Close Viewer"
              aria-label="Close Viewer"
            >
              <X size={18} />
            </button>
          )}
          <span className="text-xs sm:text-sm font-semibold text-white/90 truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[280px] md:max-w-md">
            {title}
          </span>
          {numPages && (
            <span className="text-[10px] sm:text-[11px] text-gray-400 bg-white/5 px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline-block">
              {numPages} {numPages === 1 ? 'Page' : 'Pages'}
            </span>
          )}
        </div>

        {/* Center/Right: Zoom Controls & Protection & Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Zoom In / Out / Reset Toolbar */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5 sm:p-1 shrink-0">
            <button
              onClick={handleZoomOut}
              disabled={zoomScale <= 0.6}
              className="p-0.5 sm:p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut size={13} className="sm:w-[15px] sm:h-[15px]" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors tabular-nums min-w-[36px] sm:min-w-[42px] text-center"
              title="Reset Zoom (100%)"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoomScale >= 3.0}
              className="p-0.5 sm:p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn size={13} className="sm:w-[15px] sm:h-[15px]" />
            </button>
          </div>

          {isSecure && (
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-[9px] sm:text-xs font-semibold tracking-wider uppercase hidden sm:flex"
              title="Protected academy document (Screenshots & downloads restricted)"
            >
              <EyeOff size={11} className="shrink-0" />
              <span>Protected</span>
            </div>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1 sm:p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen View'}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={15} className="sm:w-[17px] sm:h-[17px]" /> : <Maximize size={15} className="sm:w-[17px] sm:h-[17px]" />}
          </button>
        </div>
      </header>

      {/* ── SECURE VIEWER VIEWPORT (Fixed non-scrolling reading frame) ── */}
      <div className="relative w-full flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* ── SECURE VIEWER BODY: Smooth Multi-Directional Pan (360°), Desktop Mouse Drag & Mobile Touch ── */}
        <div
          ref={viewerRef}
          id="pdf-canvas-body"
          onMouseDown={handleMouseDown}
          className={`w-full flex-1 min-h-0 bg-[#0d1017] overflow-y-auto ${
            zoomScale > 1 ? 'overflow-x-auto' : 'overflow-x-hidden'
          } p-0 sm:py-4 custom-scrollbar select-none ${
            zoomScale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: zoomScale > 1 ? 'pan-x pan-y' : 'pan-y',
            overscrollBehavior: 'contain',
            transition: 'filter 0.1s ease, opacity 0.1s ease'
          }}
        >
          {useIframeFallback && driveId ? (
            <div className="relative w-full h-full min-h-[500px] flex-1">
              <iframe
                src={`https://drive.google.com/file/d/${driveId}/preview`}
                className="w-full h-full border-none bg-[#0d1017]"
                title={title}
                allow="autoplay"
              />
              {isSecure && (
                <div
                  className="absolute top-0 right-0 w-20 sm:w-32 h-14 sm:h-20 bg-[#151515]/90 backdrop-blur-xl z-50 select-none cursor-default flex items-center justify-center pointer-events-auto"
                  title="Pop-out disabled for secure documents"
                >
                  <span className="text-[10px] sm:text-xs text-white/50 font-bold tracking-widest uppercase">SECURE</span>
                </div>
              )}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center my-auto min-h-full">
              <AlertCircle size={40} className="text-red-400 mb-3" />
              <p className="text-sm font-medium text-white mb-2">Unable to Load Document</p>
              <p className="text-xs text-gray-400 mb-4 max-w-sm">{loadError}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2"
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <div
              ref={docWrapperRef}
              className="flex flex-col py-1 sm:py-3 will-change-transform"
              style={{
                minWidth: zoomScale > 1 ? `${renderedWidth}px` : '100%',
                width: zoomScale > 1 ? `${renderedWidth}px` : '100%',
                margin: zoomScale > 1 ? '0 auto 0 0' : '0 auto',
                alignItems: zoomScale > 1 ? 'flex-start' : 'center',
              }}
            >
              <Document
                file={activePdfSource}
                options={PDF_DOCUMENT_OPTIONS}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex flex-col items-center justify-center py-28 text-white/70 gap-3 my-auto w-full">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium tracking-wide">Loading Secure Document...</span>
                  </div>
                }
              >
                {numPages && Array.from(new Array(numPages), (_, index) => (
                  <div
                    key={`page_${index + 1}`}
                    className="mb-2 sm:mb-4 relative shrink-0 shadow-xl bg-white overflow-hidden"
                    style={{
                      width: renderedWidth,
                      minWidth: renderedWidth,
                      maxWidth: renderedWidth,
                    }}
                  >
                    <Page
                      pageNumber={index + 1}
                      width={renderedWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="overflow-hidden"
                    />
                  </div>
                ))}
              </Document>
            </div>
          )}
        </div>

        {/* ── STATIC 2-LOCATION WATERMARK: Sits permanently over the reading viewport, does NOT scroll away ── */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-20 overflow-hidden"
          style={{ pointerEvents: 'none' }}
        >
          <WatermarkOverlay pageNumber={1} />
        </div>
      </div>

      {/* ── TEST PORTAL STYLE SECURITY VEIL & ALERT (0ms Synchronous Mask, Heavy Background Blur, Solid Opaque Card) ── */}
      <div
        ref={veilRef}
        id="pdf-security-veil"
        style={{
          display: isBlackoutActive ? 'flex' : 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(10, 15, 30, 0.98)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2147483647,
          padding: '16px',
          boxSizing: 'border-box',
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
      >
        <div
          style={{
            width: '92%',
            maxWidth: '460px',
            backgroundColor: '#151926',
            borderRadius: '20px',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 30px 70px rgba(0, 0, 0, 0.9)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderTop: '6px solid #dc2626',
            boxSizing: 'border-box'
          }}
        >
          {/* Warning Icon Badge */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '32px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '18px',
              color: '#ef4444'
            }}
          >
            <ShieldAlert size={34} />
          </div>

          <h3
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#ffffff',
              marginBottom: '10px',
              letterSpacing: '-0.02em'
            }}
          >
            SCREENSHOT BLOCKED
          </h3>

          <p
            style={{
              fontSize: '15px',
              color: '#cbd5e1',
              lineHeight: '1.6',
              marginBottom: '20px',
              maxWidth: '380px'
            }}
          >
            Taking screenshots, snipping, or screen captures of academy study materials is strictly prohibited by security policy.
          </p>

          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '24px',
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: '1.5'
            }}
          >
            <span style={{ color: '#f87171', fontWeight: 700 }}>Security Notice: </span>
            Screen capture attempts are logged to your student session.
          </div>

          <button
            onClick={handleResume}
            style={{
              width: '100%',
              padding: '12px 20px',
              backgroundColor: '#dc2626',
              backgroundImage: 'linear-gradient(to right, #dc2626, #b91c1c)',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(220, 38, 38, 0.35)',
              transition: 'transform 0.15s ease, background-color 0.2s ease'
            }}
          >
            I Understand & Resume Reading
          </button>
        </div>
      </div>
    </div>
  );
};
