import React, { useEffect, useState, lazy, Suspense, useRef, useCallback } from 'react';
import { ResourceApi } from '../core/services';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getUserFromAuth } from '../core/api';
import {
  X,
  ShieldCheck,
  Download,
  Maximize2,
  Minimize2,
  AlertTriangle,
  FileDown,
  EyeOff,
  ZoomIn,
  ZoomOut,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { ResourceViewerSkeleton } from '../components/ui/Skeleton';
import { WatermarkOverlay } from '../components/ui/WatermarkOverlay';
// @ts-ignore
import logoImg from '../../assets/logo.png';

const SecurePDFViewer = lazy(() =>
  import('../components/ui/SecurePDFViewer').then(m => ({ default: m.SecurePDFViewer }))
);

interface ResourceViewerProps {
  resourceId: string;
  onClose: () => void;
}

export const ResourceViewer: React.FC<ResourceViewerProps> = ({ resourceId, onClose }) => {
  const [resource, setResource] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imgErrorCount, setImgErrorCount] = useState(0);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');

  const isSecure = resource?.isSecure;
  const isImage = !useIframeFallback && (
    access?.viewerType === 'image' ||
    ['image', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(resource?.type?.toLowerCase()) ||
    access?.contentType?.toLowerCase()?.startsWith('image/') ||
    resource?.mimeType?.toLowerCase()?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(resource?.sourceUrl || '') ||
    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(access?.viewerUrl || '') ||
    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(access?.signedUrl || '') ||
    Boolean(imageSrc && imageSrc.startsWith('data:image/'))
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
  }, [isImage]);

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

    let printStyle = document.getElementById('nermai-res-print-guard');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'nermai-res-print-guard';
      printStyle.innerHTML = '@media print { body, #root { display: none !important; } }';
      document.head.appendChild(printStyle);
    }

    const handleKeyEvent = (e: KeyboardEvent) => {
      if (!isImage) return;
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
      if (!isImage) return;
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
  }, [onClose, triggerScreenshotBlock, isImage]);

  // ── Google Drive & Image URL resolution (100% Preserved) ───────────────────
  useEffect(() => {
    if (access) {
      const isImg = access?.viewerType === 'image' ||
        ['image', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(resource?.type?.toLowerCase()) ||
        access?.contentType?.toLowerCase()?.startsWith('image/') ||
        resource?.mimeType?.toLowerCase()?.startsWith('image/');
      if (isImg) {
        let targetUrl = access.viewerUrl || access.signedUrl || resource?.sourceUrl || '';

        const rawDriveId = resource?.sourceUrl || (access.viewerUrl?.includes('drive.google.com') ? access.viewerUrl : '');
        const driveMatch = rawDriveId ? rawDriveId.match(/[-\w]{25,}/) : null;
        if (driveMatch && driveMatch[0]) {
          targetUrl = `https://lh3.googleusercontent.com/d/${driveMatch[0]}`;
        } else if (targetUrl.includes('drive.google.com/file/d/')) {
          const m = targetUrl.match(/\/file\/d\/([-\w]{25,})/);
          if (m && m[1]) {
            targetUrl = `https://lh3.googleusercontent.com/d/${m[1]}`;
          }
        }
        setImageSrc(targetUrl);
      } else {
        setImageSrc(access.signedUrl || access.viewerUrl || '');
      }
    }
  }, [access, resource]);

  // ── Backend Resource & SACS Fetching (100% Preserved) ──────────────────────
  useEffect(() => {
    const fetchResource = async () => {
      try {
        const [res, acc] = await Promise.all([
          ResourceApi.getResource(resourceId),
          ResourceApi.getAccess(resourceId)
        ]);
        setResource(res.data?.data || res.data);
        setAccess(acc.data?.data || acc.data);
        setError('');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load resource or access denied.');
      } finally {
        setLoading(false);
      }
    };
    fetchResource();

    // Auto-unlock listener: when admin approves access in SACS
    let unsub: (() => void) | null = null;
    try {
      const user = getUserFromAuth();
      if (user?.userId) {
        const qReq = query(
          collection(db, 'access_requests'),
          where('contentId', '==', resourceId),
          where('studentId', '==', user.userId),
          where('status', '==', 'APPROVED')
        );
        unsub = onSnapshot(qReq, (snap) => {
          if (!snap.empty) {
            fetchResource();
          }
        }, (err) => console.log('ResourceViewer access snapshot note:', err?.message));
      }
    } catch (e) {
      console.warn('Real-time resource access listener note:', e);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [resourceId]);

  const toggleFullscreen = () => {
    isInteractingRef.current = true;
    setTimeout(() => { isInteractingRef.current = false; }, 800);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.log(err));
      setIsFullscreen(false);
    }
  };

  const handleDownload = () => {
    if (!access?.viewerUrl) return;
    const a = document.createElement('a');
    a.href = access.viewerUrl;
    a.download = resource?.title || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImageError = () => {
    console.warn('[ResourceViewer] Image load failed for src:', imageSrc, 'attempting fallback...');

    const rawDriveId = resource?.sourceUrl || access?.viewerUrl || '';
    const driveMatch = rawDriveId ? rawDriveId.match(/[-\w]{25,}/) : null;
    const fileId = driveMatch ? driveMatch[0] : null;

    if (imgErrorCount === 0 && fileId) {
      const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
      if (imageSrc !== thumbUrl) {
        setImageSrc(thumbUrl);
        setImgErrorCount(1);
        return;
      }
    }
    if (imgErrorCount <= 1 && fileId) {
      const exportUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      if (imageSrc !== exportUrl) {
        setImageSrc(exportUrl);
        setImgErrorCount(2);
        return;
      }
    }
    if (imgErrorCount <= 2 && access?.signedUrl && imageSrc !== access.signedUrl) {
      setImageSrc(access.signedUrl);
      setImgErrorCount(3);
      return;
    }
    if (imgErrorCount <= 3) {
      try {
        const rawAuth = typeof localStorage !== 'undefined' ? localStorage.getItem('nermai_auth_user') : null;
        const userToken = rawAuth ? JSON.parse(rawAuth)?.token : '';
        const apiBase = (ResourceApi as any).getApiClient ? (ResourceApi as any).getApiClient().defaults?.baseURL : '/api';
        const fallbackUrl = `${apiBase}/resources/${resourceId}/content?token=${userToken || access?.token || ''}`;
        if (imageSrc !== fallbackUrl) {
          setImageSrc(fallbackUrl);
          setImgErrorCount(4);
          return;
        }
      } catch (e) {
        console.error('[ResourceViewer] Fallback URL generation error', e);
      }
    }

    if (fileId || access?.viewerUrl) {
      console.log('[ResourceViewer] Direct <img> load failed. Switching to secure iframe preview.');
      const previewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : (access?.viewerUrl || '');
      setIframeUrl(previewUrl);
      setUseIframeFallback(true);
    }
  };

  // Image pan & zoom handlers
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  if (loading) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#0f1219]/90 backdrop-blur-xl p-8 flex items-center justify-center">
        <ResourceViewerSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#0f1219]/95 flex items-center justify-center p-4">
        <div className="bg-[#1a1f2b] border border-red-500/30 p-8 rounded-3xl max-w-md w-full text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={32} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">{error}</p>
          <button onClick={onClose} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium transition-colors">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── ALL DOCUMENTS / PDFS / GOOGLE DRIVE / WEBVIEWS: Use the new SecurePDFViewer full-screen ──
  if (!isImage) {
    const documentUrl = iframeUrl || access?.viewerUrl || access?.signedUrl || resource?.sourceUrl || '';
    return (
      <div className="fixed inset-0 z-[99999] bg-[#0f1219]">
        <Suspense fallback={
          <div className="fixed inset-0 z-[99999] bg-[#0f1219] flex items-center justify-center">
            <ResourceViewerSkeleton />
          </div>
        }>
          <SecurePDFViewer
            url={documentUrl}
            onClose={onClose}
            title={resource?.title || 'Resource Document'}
            onDownload={handleDownload}
            isSecure={isSecure}
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
            <button onClick={onClose} className="p-1 sm:p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors shrink-0" title="Close Viewer">
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
            <div className="h-5 sm:h-6 w-px bg-white/10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-white font-semibold flex items-center gap-1 sm:gap-2 text-xs sm:text-base">
                <span className="truncate max-w-[100px] xs:max-w-[140px] sm:max-w-xs">{resource?.title}</span>
                {isSecure && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1 sm:px-1.5 py-0.5 rounded flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <ShieldCheck size={11} className="sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline">Secure View</span>
                    <span className="sm:hidden">SECURE</span>
                  </span>
                )}
              </h1>
              <p className="text-[9px] sm:text-xs text-gray-500 truncate">{resource?.type} • v{resource?.version}</p>
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
            {!isSecure && (
              <button onClick={handleDownload} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] sm:text-sm font-medium text-white transition-colors">
                <Download size={13} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Download</span>
              </button>
            )}
            {isSecure && (
              <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] sm:text-xs font-medium">
                <EyeOff size={13} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Downloads Disabled</span>
              </div>
            )}
            <button onClick={toggleFullscreen} className="p-1 sm:p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors" title="Toggle Fullscreen">
              {isFullscreen ? <Minimize2 size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Maximize2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
            </button>
          </div>
        </header>

        {/* Viewer Content */}
        <div
          ref={imageContainerRef}
          className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-0"
          style={{ transition: 'filter 0.1s ease, opacity 0.1s ease' }}
        >
          {(imageSrc || access?.viewerUrl || iframeUrl) ? (
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
                    src={imageSrc || access?.viewerUrl}
                    alt={resource?.title || 'Resource Image'}
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
            ) : (access?.viewerType === 'webview' || useIframeFallback) ? (
              <div className="relative w-full h-full">
                <iframe
                  src={iframeUrl || access?.viewerUrl}
                  className="w-full h-full border-none bg-white"
                  title={resource?.title || 'Resource Viewer'}
                />
                {isSecure && (
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
                )}
                <WatermarkOverlay pageNumber={1} />
              </div>
            ) : (
              <div className="text-center mt-20">
                <FileDown size={64} className="mx-auto text-gray-500 mb-4" />
                <h3 className="text-xl text-white mb-2">External Resource</h3>
                <p className="text-gray-400 mb-6">Click below to open the resource.</p>
                <a href={access?.viewerUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 inline-block">
                  Open File
                </a>
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
          id="res-security-veil"
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
