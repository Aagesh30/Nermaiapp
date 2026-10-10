import React, { useState, useEffect, lazy, Suspense, useRef, useCallback } from 'react';
import {
  X,
  ShieldCheck,
  Maximize2,
  Minimize2,
  EyeOff,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { WatermarkOverlay } from '../components/ui/WatermarkOverlay';
// @ts-ignore
import logoImg from '../../assets/logo.png';

const SecurePDFViewer = lazy(() =>
  import('../components/ui/SecurePDFViewer').then(m => ({ default: m.SecurePDFViewer }))
);

export interface DailyContentViewerProps {
  content: {
    id?: string;
    title?: string;
    date?: string;
    type?: string;
    url?: string;
    fileBase64?: string;
    createdBy?: string;
    description?: string;
  };
  displaySrc: string;
  onClose: () => void;
  isAdmin?: boolean;
}

export const DailyContentViewer: React.FC<DailyContentViewerProps> = ({
  content,
  displaySrc,
  onClose,
  isAdmin = false
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imgErrorCount, setImgErrorCount] = useState(0);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');

  // Detect whether this is an image item (100% Preserved)
  const rawType = (content?.type || '').toLowerCase();
  const rawUrl = content?.url || displaySrc || '';
  const isImage =
    rawType === 'image' ||
    ['image', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(rawType) ||
    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(displaySrc) ||
    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(rawUrl) ||
    displaySrc.startsWith('data:image/');

  const isPdf = !isImage && (
    rawType === 'pdf' ||
    /\.pdf(\?.*)?$/i.test(displaySrc) ||
    /\.pdf(\?.*)?$/i.test(rawUrl) ||
    displaySrc.startsWith('data:application/pdf') ||
    true // Default Daily Content to PDF if unspecified
  );

  // Security Screenshot Blocker states (Web)
  const [isBlackoutActive, setIsBlackoutActive] = useState(false);
  const [screenshotAlert, setScreenshotAlert] = useState(false);
  const isInteractingRef = useRef<boolean>(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);

  // ── Mobile OS Screenshot Guard (Android FLAG_SECURE) ──────────────────────
  useEffect(() => {
    try {
      if (Platform.OS !== 'web') {
        ScreenCapture.preventScreenCaptureAsync().catch(() => { });
      }
    } catch (_) { }
  }, []);

  // ── Web Screenshot Guard (Instant Synchronous DOM Blur, keyup, Snipping Tool blur) ──
  const triggerScreenshotBlock = useCallback((e?: Event) => {
    if (isInteractingRef.current) return;
    if (e) {
      try { e.preventDefault(); } catch (_) { }
      try { e.stopPropagation(); } catch (_) { }
    }

    try {
      if (typeof document !== 'undefined' && document.hasFocus && document.hasFocus() && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText('').catch(() => {});
      }
    } catch (_) { }

    if (imageContainerRef.current) {
      imageContainerRef.current.style.filter = 'blur(45px)';
      imageContainerRef.current.style.opacity = '0.04';
      imageContainerRef.current.style.pointerEvents = 'none';
    }

    if (veilRef.current) {
      veilRef.current.style.display = 'flex';
    }

    setIsBlackoutActive(true);
    setScreenshotAlert(true);
  }, [isImage, useIframeFallback]);

  const handleResume = useCallback(() => {
    isInteractingRef.current = true;
    setTimeout(() => { isInteractingRef.current = false; }, 800);

    try {
      if (typeof window !== 'undefined') window.focus();
    } catch (_) { }

    if (imageContainerRef.current) {
      imageContainerRef.current.style.filter = 'none';
      imageContainerRef.current.style.opacity = '1';
      imageContainerRef.current.style.pointerEvents = 'auto';
    }

    if (veilRef.current) {
      veilRef.current.style.display = 'none';
    }

    setIsBlackoutActive(false);
    setScreenshotAlert(false);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    let printStyle = document.getElementById('nermai-daily-print-guard');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'nermai-daily-print-guard';
      printStyle.innerHTML = '@media print { body, #root { display: none !important; } }';
      document.head.appendChild(printStyle);
    }

    const handleKeyEvent = (e: KeyboardEvent) => {
      if (!isImage || useIframeFallback) return;
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

      const isPrntScrn =
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.key === 'Snapshot' ||
        (e.altKey && (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44)) ||
        (e.metaKey && (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44));

      const isSnippingTool =
        (e.ctrlKey || e.metaKey) && e.shiftKey && ['s', 'S', '3', '4', '5', 'i', 'I', 'j', 'J', 'c', 'C'].includes(e.key);

      const isPrint =
        (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P');

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
      if (!isImage || useIframeFallback) return;
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

  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Extract Google Drive ID if available (100% Preserved)
  const getGoogleDriveId = (urlStr: string) => {
    if (!urlStr) return null;
    const m1 = urlStr.match(/\/file\/d\/([-\w]{25,})/);
    if (m1 && m1[1]) return m1[1];
    const m2 = urlStr.match(/[?&]id=([-\w]{25,})/);
    if (m2 && m2[1]) return m2[1];
    if (urlStr.includes('drive.google.com') || urlStr.includes('docs.google.com')) {
      const m3 = urlStr.match(/([-\w]{25,})/);
      if (m3 && m3[1]) return m3[1];
    }
    return null;
  };

  const driveId = getGoogleDriveId(rawUrl) || getGoogleDriveId(displaySrc);

  const resolveInitialImageSrc = () => {
    if (driveId) {
      return `https://lh3.googleusercontent.com/d/${driveId}`;
    }
    return displaySrc || rawUrl;
  };

  const [imageSrc, setImageSrc] = useState<string>(resolveInitialImageSrc);

  useEffect(() => {
    if (isImage) {
      if (driveId) {
        setImageSrc(`https://lh3.googleusercontent.com/d/${driveId}`);
      } else {
        setImageSrc(displaySrc || rawUrl);
      }
    }
  }, [displaySrc, rawUrl, isImage, driveId]);

  const toggleFullscreen = () => {
    isInteractingRef.current = true;
    setTimeout(() => { isInteractingRef.current = false; }, 800);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  };

  const handleZoomReset = () => {
    setImageZoom(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleZoomChange = (delta: number) => {
    setImageZoom(prev => {
      const next = +(prev + delta).toFixed(2);
      const clamped = Math.max(0.5, Math.min(4, next));
      if (clamped === 1) {
        setPanPosition({ x: 0, y: 0 });
      }
      return clamped;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (imageZoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panPosition };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || imageZoom <= 1) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanPosition({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (imageZoom <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    panStartRef.current = { ...panPosition };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || imageZoom <= 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setPanPosition({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleImageError = () => {
    console.warn('[DailyContentViewer] Image load failed for src:', imageSrc, 'attempting fallback...');
    const apiOrigin = typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://nermaiiasacademy-519c8.web.app';
    const streamUrl = content?.id ? `${apiOrigin}/api/lms/daily-content/${content.id}/stream` : '';

    if (imgErrorCount === 0 && streamUrl && imageSrc !== streamUrl) {
      setImageSrc(streamUrl);
      setImgErrorCount(1);
      return;
    }
    if (imgErrorCount <= 1 && driveId) {
      const thumbUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
      if (imageSrc !== thumbUrl) {
        setImageSrc(thumbUrl);
        setImgErrorCount(2);
        return;
      }
    }
    if (imgErrorCount <= 2 && driveId) {
      const exportUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
      if (imageSrc !== exportUrl) {
        setImageSrc(exportUrl);
        setImgErrorCount(3);
        return;
      }
    }
    if (driveId) {
      setIframeUrl(`https://drive.google.com/file/d/${driveId}/preview`);
      setUseIframeFallback(true);
    }
  };

  // ── ALL DOCUMENTS / PDFS / GOOGLE DRIVE / WEBVIEWS: Use the new SecurePDFViewer full-screen ──
  if (!isImage || useIframeFallback) {
    const apiOrigin = typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://nermaiiasacademy-519c8.web.app';
    const streamUrl = content?.id ? `${apiOrigin}/api/lms/daily-content/${content.id}/stream` : '';
    const rawTarget = rawUrl || displaySrc || '';
    const isStorage = rawTarget.includes('storage.googleapis.com');
    const docSrc = iframeUrl || (isStorage && streamUrl ? streamUrl : (displaySrc || rawUrl || ''));
    const fallbackSrc = isStorage ? (rawTarget.includes('?') ? `${rawTarget}&v=1` : `${rawTarget}?v=1`) : (streamUrl || rawTarget);

    return (
      <div className="fixed inset-0 z-[99999] bg-[#0f1219]">
        <Suspense fallback={
          <div className="fixed inset-0 z-[99999] bg-[#0f1219] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <SecurePDFViewer
            url={docSrc}
            fallbackUrl={fallbackSrc}
            onClose={onClose}
            title={content?.title || "Daily Study Material"}
            isSecure={true}
          />
        </Suspense>
      </div>
    );
  }

  // ── IF IMAGE OR WEBVIEW OR FALLBACK: Render image viewer with Watermark & Screenshot Guard ──
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] bg-[#0f1219] flex flex-col"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Top Header */}
        <header className="h-14 sm:h-16 border-b border-white/5 bg-[#151923] flex items-center justify-between px-2.5 sm:px-6 shrink-0 relative z-20">
          <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
            <button
              onClick={onClose}
              className="p-1 sm:p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors shrink-0"
              title="Close Viewer"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
            <div className="h-5 sm:h-6 w-px bg-white/10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-white font-semibold flex items-center gap-1 sm:gap-2 text-xs sm:text-base">
                <span className="truncate max-w-[100px] xs:max-w-[140px] sm:max-w-xs">{content?.title || (isImage ? "Daily Study Image" : "Daily Study Material")}</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1 sm:px-1.5 py-0.5 rounded flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <ShieldCheck size={11} className="sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">Secure View</span>
                  <span className="sm:hidden">SECURE</span>
                </span>
              </h1>
              <p className="text-[9px] sm:text-xs text-gray-500 truncate">
                {content?.date || new Date().toISOString().split('T')[0]} • {isImage ? 'IMAGE' : 'STUDY MATERIAL'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {isImage && !useIframeFallback && (
              <div className="flex items-center gap-0.5 sm:gap-1 bg-white/5 rounded-xl px-1 sm:px-2 py-0.5 sm:py-1 border border-white/10">
                <button
                  onClick={() => handleZoomChange(-0.25)}
                  className="p-0.5 sm:p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="px-1 sm:px-2 py-0.5 text-[10px] sm:text-xs text-gray-300 hover:text-white transition-colors font-medium"
                  title="Reset Fit"
                >
                  {Math.round(imageZoom * 100)}%
                </button>
                <button
                  onClick={() => handleZoomChange(0.25)}
                  className="p-0.5 sm:p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
              </div>
            )}

            {/* Downloads Disabled Badge */}
            <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] sm:text-xs font-medium">
              <EyeOff size={13} className="sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Downloads Disabled</span>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1 sm:p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Maximize2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
            </button>
          </div>
        </header>

        {/* Viewer Content Canvas */}
        <div
          ref={imageContainerRef}
          className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-0"
          style={{ transition: 'filter 0.1s ease, opacity 0.1s ease' }}
        >
          {(displaySrc || rawUrl) ? (
            (isImage && !useIframeFallback) ? (
              <div
                className="relative w-full h-full flex items-center justify-center bg-[#151923] overflow-hidden min-h-0 select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ cursor: imageZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
              >
                <div className="relative inline-block max-w-full max-h-full">
                  <img
                    src={imageSrc || displaySrc || rawUrl}
                    alt={content?.title || 'Daily Content Image'}
                    style={{
                      maxHeight: 'calc(100vh - 70px)',
                      maxWidth: '100%',
                      transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${imageZoom})`,
                      transformOrigin: 'center center',
                      objectFit: 'contain'
                    }}
                    className={`w-auto h-auto rounded-lg shadow-2xl select-none ${isDragging ? '' : 'transition-transform duration-150 ease-out'}`}
                    onContextMenu={(e) => e.preventDefault()}
                    onError={handleImageError}
                  />

                  {/* 2-Watermark Rule applied to Image Viewer */}
                  <WatermarkOverlay pageNumber={1} isDarkBackground={true} />
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <iframe
                  src={iframeUrl || displaySrc || rawUrl}
                  className="w-full h-full border-none bg-white"
                  title={content?.title || 'Daily Content Viewer'}
                />
                <div
                  className="absolute top-0 right-0 w-16 sm:w-32 h-12 sm:h-20 bg-[#151515]/90 backdrop-blur-xl z-50 select-none cursor-default flex items-center justify-center"
                  title="Pop-out disabled for secure documents"
                >
                  <img
                    src={logoImg}
                    className="w-7 sm:w-10 h-7 sm:h-10 object-contain opacity-80"
                    alt="Nermai Logo"
                  />
                </div>
                <WatermarkOverlay pageNumber={1} />
              </div>
            )
          ) : (
            <div className="text-center">
              <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
              <h3 className="text-xl text-white mb-2">Media Not Available</h3>
              <p className="text-gray-400">The source file could not be located.</p>
            </div>
          )}
        </div>

        {/* Screenshot Blocked Alert Modal */}
        <div
          ref={veilRef}
          id="daily-security-veil"
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
              backgroundColor: '#151923',
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
              Taking screenshots or screen captures of academy study materials is strictly prohibited by security policy.
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
              Repeated screen capture attempts will trigger automatic account review.
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
      </motion.div>
    </AnimatePresence>
  );
};
