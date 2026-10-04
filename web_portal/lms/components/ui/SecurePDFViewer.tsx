import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Minimize, 
  BookOpen, 
  MoveVertical, 
  RefreshCw, 
  ShieldAlert,
  X,
  Download,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { WatermarkOverlay } from './WatermarkOverlay';

// Set up CDN worker matching the exact version used by react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SecurePDFViewerProps {
  url: string;
  onClose?: () => void;
  title?: string;
  onDownload?: () => void;
  isSecure?: boolean;
}

export const SecurePDFViewer: React.FC<SecurePDFViewerProps> = ({ 
  url, 
  onClose,
  title = 'Document',
  onDownload,
  isSecure = true
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  // View mode: 'slide' (Book Slide: Left ⇄ Right) vs 'swipe' (Vertical Swipe: Up ↕ Down)
  const [viewMode, setViewMode] = useState<'slide' | 'swipe'>('slide');
  // Slide animation direction: 1 = forward, -1 = backward
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Google Drive & URL normalization (Preserved 100%) ───────────────────────
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

  const driveId = getDriveId(cleanUrl);
  const pdfSource = driveId ? `https://lh3.googleusercontent.com/d/${driveId}` : cleanUrl;
  const fallbackIframeSrc = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : cleanUrl;

  // If Google Drive link, immediately start in secure iframe mode so header never flickers/vanishes
  const [useIframeFallback, setUseIframeFallback] = useState(!!driveId);
  
  // Security Screenshot Blocker states (Web)
  const [isBlackoutActive, setIsBlackoutActive] = useState(false);
  const [screenshotAlert, setScreenshotAlert] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const pageCooldownRef = useRef(false);

  // ── Page Navigation Callbacks (Declared before useEffect hooks) ───────────
  const goNext = useCallback(() => {
    if (pageCooldownRef.current) return;
    if (numPages && pageNumber >= numPages) return;
    pageCooldownRef.current = true;
    setDirection(1);
    setPageNumber(prev => (numPages ? Math.min(prev + 1, numPages) : prev + 1));
    setTimeout(() => {
      pageCooldownRef.current = false;
    }, 280);
  }, [pageNumber, numPages]);

  const goPrev = useCallback(() => {
    if (pageCooldownRef.current) return;
    if (pageNumber <= 1) return;
    pageCooldownRef.current = true;
    setDirection(-1);
    setPageNumber(prev => Math.max(prev - 1, 1));
    setTimeout(() => {
      pageCooldownRef.current = false;
    }, 280);
  }, [pageNumber]);

  // Ensure keyboard focus returns to the viewer when mouse moves or enters
  const ensureViewerFocus = useCallback(() => {
    if (typeof document !== 'undefined' && document.activeElement?.tagName === 'IFRAME') {
      containerRef.current?.focus();
      window.focus();
    }
  }, []);

  // ── Auto-fit Scale Computation ────────────────────────────────────────────
  const computeAutoFit = useCallback(() => {
    if (viewerRef.current) {
      const padding = 24;
      const containerW = viewerRef.current.clientWidth - padding * 2;
      const containerH = viewerRef.current.clientHeight - padding * 2;

      // Target page aspect ratio: standard 612 x 792 (Letter)
      const scaleByW = containerW / 612;
      const scaleByH = containerH / 792;
      // Fit neatly so the single page fits the screen comfortably
      const targetScale = Math.min(scaleByW, scaleByH > 0.4 ? scaleByH : scaleByW);
      const clamped = Math.max(0.35, Math.min(2.0, targetScale));
      setScale(parseFloat(clamped.toFixed(2)));
    }
  }, []);

  // Auto-focus container on mount so keyboard arrows work immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    computeAutoFit();
    window.addEventListener('resize', computeAutoFit);
    return () => window.removeEventListener('resize', computeAutoFit);
  }, [computeAutoFit]);

  // ── Mobile OS Screenshot Guard (Android FLAG_SECURE) ──────────────────────
  useEffect(() => {
    try {
      if (Platform.OS !== 'web') {
        ScreenCapture.preventScreenCaptureAsync().catch(() => {});
      }
    } catch (_) {}

    return () => {
      try {
        if (Platform.OS !== 'web') {
          ScreenCapture.allowScreenCaptureAsync().catch(() => {});
        }
      } catch (_) {}
    };
  }, []);

  // ── Web Screenshot Guard (PrintScreen, Snipping tool, Print blocking) ─────
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Inject print block CSS
    let printStyle = document.getElementById('nermai-pdf-print-guard');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'nermai-pdf-print-guard';
      printStyle.innerHTML = '@media print { body, #pdf-secure-root { display: none !important; } }';
      document.head.appendChild(printStyle);
    }

    const triggerScreenshotBlock = (e?: Event) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      try {
        navigator.clipboard?.writeText('');
      } catch (_) {}
      setIsBlackoutActive(true);
      setScreenshotAlert(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to close viewer or exit fullscreen
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else if (onClose) {
          onClose();
        }
        return;
      }

      // PrintScreen / Snapshot (key 44)
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        triggerScreenshotBlock(e);
        return;
      }
      // Windows Snipping Tool (Win + Shift + S) or Mac (Cmd + Shift + 3 / 4)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['s', 'S', '3', '4', 'i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) {
        triggerScreenshotBlock(e);
        return;
      }
      // Print command (Ctrl + P / Cmd + P)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        triggerScreenshotBlock(e);
        return;
      }
      // Save command (Ctrl + S / Cmd + S)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        return;
      }

      // Keyboard navigation (Arrow keys, PageUp/PageDown, Space)
      if (!screenshotAlert) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
          e.preventDefault();
          goNext();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
          e.preventDefault();
          goPrev();
        } else if (viewMode === 'swipe') {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            goNext();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            goPrev();
          }
        }
      }
    };

    // Fullscreen change listener to sync isFullscreen state
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [viewMode, screenshotAlert, pageNumber, numPages, goNext, goPrev]);

  // ── Touch Gesture Handling (Slide Left/Right vs Swipe Up/Down) ────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;
    const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;

    if (viewMode === 'slide') {
      // Horizontal slide: swipe left (deltaX > 45) -> next, swipe right (deltaX < -45) -> prev
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
        if (deltaX > 40) goNext();
        else if (deltaX < -40) goPrev();
      }
    } else {
      // Vertical swipe: swipe up (deltaY > 45) -> next, swipe down (deltaY < -45) -> prev
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 40) {
        if (deltaY > 40) goNext();
        else if (deltaY < -40) goPrev();
      }
    }
  };

  // ── Wheel navigation at boundary in swipe mode ────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    if (viewMode !== 'swipe') return;
    const el = viewerRef.current;
    if (!el) return;

    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
    const atTop = el.scrollTop <= 6;

    if (e.deltaY > 40 && atBottom) {
      goNext();
    } else if (e.deltaY < -40 && atTop) {
      goPrevPageScroll();
    }
  };

  const goPrevPageScroll = () => {
    if (pageNumber <= 1 || pageCooldownRef.current) return;
    pageCooldownRef.current = true;
    setDirection(-1);
    setPageNumber(prev => Math.max(prev - 1, 1));
    setTimeout(() => {
      pageCooldownRef.current = false;
    }, 300);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    computeAutoFit();
  };

  const handleDocumentLoadError = (err: Error) => {
    console.warn('[SecurePDFViewer] PDF load error, fallback to secure preview:', err.message);
    setUseIframeFallback(true);
  };

  // ── Slide Animation Variants ──────────────────────────────────────────────
  const slideVariants = {
    enter: (dir: number) => ({
      x: viewMode === 'slide' ? (dir > 0 ? 120 : -120) : 0,
      y: viewMode === 'swipe' ? (dir > 0 ? 120 : -120) : 0,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
    },
    exit: (dir: number) => ({
      x: viewMode === 'slide' ? (dir > 0 ? -120 : 120) : 0,
      y: viewMode === 'swipe' ? (dir > 0 ? -120 : 120) : 0,
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.18, ease: 'easeIn' },
    }),
  };

  // Sync useIframeFallback when url/driveId changes
  useEffect(() => {
    if (driveId) {
      setUseIframeFallback(true);
    }
  }, [driveId]);

  return (
    <div
      ref={containerRef}
      id="pdf-secure-root"
      tabIndex={0}
      onMouseMove={ensureViewerFocus}
      onMouseEnter={ensureViewerFocus}
      className={`relative flex flex-col w-full h-full bg-[#11141d] rounded-xl overflow-hidden border border-white/10 select-none outline-none ${
        isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-none' : ''
      }`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ height: '100%', minHeight: 0 }}
    >
      {/* ── TOP FLOATING CONTROL BAR (Always visible with clear reserved space) ── */}
      <header className="w-full bg-[#151924]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between border-b border-white/10 shrink-0 z-30">
        
        {/* Left: Close button (if provided) & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors shrink-0"
              title="Close Viewer"
            >
              <X size={18} />
            </button>
          )}
          <span className="text-xs sm:text-sm font-semibold text-white/90 truncate max-w-[120px] sm:max-w-[220px]">
            {title}
          </span>
        </div>

        {/* Center: Mode Switcher (Book Slide ⇄ vs Vertical Swipe ↕) & Page indicator */}
        <div className="flex items-center gap-1 sm:gap-2">
          
          {/* Mode Switcher Toggle */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10">
            <button
              onClick={() => setViewMode('slide')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                viewMode === 'slide'
                  ? 'bg-blue-600/90 text-white shadow-sm shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Book Slide Mode (Horizontal Left/Right)"
            >
              <BookOpen size={14} />
              <span>Book Slide</span>
            </button>
            <button
              onClick={() => setViewMode('swipe')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                viewMode === 'swipe'
                  ? 'bg-blue-600/90 text-white shadow-sm shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Vertical Swipe Mode (Up/Down)"
            >
              <MoveVertical size={14} />
              <span>Vertical Swipe</span>
            </button>
          </div>

          {/* Page Counter & Controls */}
          <div className="flex items-center gap-0.5 ml-0.5 sm:ml-1">
            <button
              disabled={pageNumber <= 1}
              onClick={goPrev}
              className="p-1 sm:p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] sm:text-sm font-medium text-white/90 px-0.5 sm:px-1 whitespace-nowrap">
              {pageNumber} {numPages ? `/ ${numPages}` : ''}
            </span>
            <button
              disabled={numPages ? pageNumber >= numPages : false}
              onClick={goNext}
              className="p-1 sm:p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Right: Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={() => setScale(s => parseFloat(Math.max(s - 0.15, 0.4).toFixed(2)))}
            className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white transition-colors hidden sm:flex"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono text-gray-300 w-9 text-center select-none hidden sm:inline">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => parseFloat(Math.min(s + 0.15, 2.2).toFixed(2)))}
            className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white transition-colors hidden sm:flex"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={computeAutoFit}
            className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white transition-colors hidden sm:flex"
            title="Auto-Fit Page"
          >
            <RefreshCw size={15} />
          </button>

          <div className="w-px h-4 bg-white/15 mx-1 hidden sm:block" />

          {/* Download button if not secure, or Protected badge if secure */}
          {!isSecure && onDownload && (
            <button
              onClick={onDownload}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
              title="Download Resource"
            >
              <Download size={16} />
            </button>
          )}
          {isSecure && (
            <div 
              className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-semibold tracking-wider uppercase"
              title="Downloads disabled for secure documents"
            >
              <EyeOff size={11} />
              <span>Protected</span>
            </div>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Single Page'}
          >
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        </div>
      </header>

      {/* ── VIEWER AREA (Clean single-page fit, with slide/swipe gesture capture) ── */}
      <div
        ref={viewerRef}
        className={`relative w-full flex-1 min-h-0 bg-[#0c0f17] flex justify-center items-center ${
          useIframeFallback ? 'overflow-hidden p-0' : 'overflow-auto p-2 sm:p-4'
        } custom-scrollbar`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Floating Left Arrow Button (<) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
            containerRef.current?.focus();
          }}
          disabled={pageNumber <= 1}
          className={`absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-2xl backdrop-blur-md border ${
            pageNumber <= 1
              ? 'bg-black/30 border-white/5 text-gray-500 opacity-20 cursor-not-allowed pointer-events-none'
              : 'bg-[#151924]/90 hover:bg-blue-600 text-white border-white/20 hover:border-blue-400/50 hover:scale-110 active:scale-95 hover:shadow-lg hover:shadow-blue-500/30 cursor-pointer'
          }`}
          title="Previous Page (Left Arrow Key)"
          aria-label="Previous Page"
        >
          <ChevronLeft size={26} className="shrink-0 -ml-0.5" />
        </button>

        {/* Floating Right Arrow Button (>) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
            containerRef.current?.focus();
          }}
          disabled={numPages ? pageNumber >= numPages : false}
          className={`absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-2xl backdrop-blur-md border ${
            numPages && pageNumber >= numPages
              ? 'bg-black/30 border-white/5 text-gray-500 opacity-20 cursor-not-allowed pointer-events-none'
              : 'bg-[#151924]/90 hover:bg-blue-600 text-white border-white/20 hover:border-blue-400/50 hover:scale-110 active:scale-95 hover:shadow-lg hover:shadow-blue-500/30 cursor-pointer'
          }`}
          title="Next Page (Right Arrow Key)"
          aria-label="Next Page"
        >
          <ChevronRight size={26} className="shrink-0 -mr-0.5" />
        </button>

        {useIframeFallback ? (
          <div className="relative w-full h-full bg-[#0d1017] flex items-center justify-center overflow-hidden">
            <iframe
              src={fallbackIframeSrc}
              className="w-full h-full border-none bg-white"
              title="Secure PDF Content"
              allow="autoplay; fullscreen"
            />
            {driveId && (
              <div 
                className="absolute top-0 right-0 w-28 h-12 bg-[#121620]/95 backdrop-blur-md z-30 select-none cursor-default flex items-center justify-center border-b border-l border-white/10"
                title="Protected Document"
              >
                <span className="text-white/80 text-[11px] font-bold tracking-wide">NERMAI SECURE</span>
              </div>
            )}
            {/* THE 2-WATERMARK RULE — Always strictly 2 watermarks, moves dynamically per page */}
            <WatermarkOverlay pageNumber={pageNumber} />
          </div>
        ) : (
          <Document
            file={pdfSource}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center py-20 text-white/70 gap-3">
                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium tracking-wide">Loading Secure Document...</span>
              </div>
            }
          >
            {numPages && (
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={pageNumber}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="relative bg-white rounded-md shadow-2xl overflow-hidden shrink-0"
                >
                  {/* Single Page Rendering */}
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />

                  {/* THE 2-WATERMARK RULE — Always strictly 2 watermarks, moves dynamically per page */}
                  <WatermarkOverlay pageNumber={pageNumber} />
                </motion.div>
              </AnimatePresence>
            )}
          </Document>
        )}
      </div>

      {/* ── SCREENSHOT BLOCKED ALERT MODAL (Instant blackout veil + alert) ── */}
      {isBlackoutActive && (
        <div className="absolute inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#181c28] border border-red-500/40 rounded-2xl p-6 sm:p-7 shadow-2xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-4 text-red-500 shadow-lg shadow-red-500/10">
              <ShieldAlert size={32} />
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white mb-2 tracking-tight">
              SCREENSHOT BLOCKED
            </h3>

            <p className="text-xs sm:text-sm text-gray-300 mb-5 leading-relaxed">
              Taking screenshots or screen captures of academy study materials is strictly prohibited by security policy.
            </p>

            <div className="w-full bg-black/40 border border-white/10 rounded-xl p-3 mb-6 text-xs text-gray-400">
              <span className="text-red-400 font-semibold">Security Notice: </span>
              Repeated screen capture attempts will trigger automatic account review.
            </div>

            <button
              onClick={() => {
                setIsBlackoutActive(false);
                setScreenshotAlert(false);
              }}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
            >
              I Understand & Resume Reading
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
