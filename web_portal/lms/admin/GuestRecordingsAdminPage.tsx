import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
  Alert,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export interface GuestRecordingItem {
  id: string;
  title: string;
  topic: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: string;
  facultyName?: string;
  isPublished?: boolean;
  isDeleted?: boolean;
  createdAt?: any;
  order?: number;
}

const DEFAULT_TOPIC_PILLS = [
  'UPSC',
  'TNPSC',
  'Mains Strategy',
  'Prelims Quick Tips',
  'Ethics & Essay',
  'Current Affairs',
  'Orientation',
];

const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const getAutoThumbnail = (url: string, customThumb?: string): string => {
  if (customThumb && customThumb.trim().length > 0) return customThumb.trim();
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }
  return 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80';
};

const escapeHtml = (str: string): string => {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const buildGuestPlayerHtml = (videoId: string, title: string, topic?: string): string => {
  const escTitle = escapeHtml(title || 'Civil Services Lecture');
  const escTopic = escapeHtml(topic || 'NERMAI IAS ACADEMY');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${escTitle} — NERMAI IAS</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: #000;
      width: 100%; height: 100%;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      cursor: default;
    }
    #player-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }
    #frame {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
      display: block;
      pointer-events: none;
    }
    #interaction-shield {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: calc(100% - 64px);
      z-index: 10;
      background: transparent;
      cursor: pointer;
    }
    /* Top Left Video Details Overlay (LMS recorded style) */
    #top-video-info {
      position: absolute;
      top: 14px; left: 18px;
      z-index: 22;
      display: flex;
      flex-direction: column;
      gap: 3px;
      pointer-events: none;
      max-width: 65%;
    }
    .video-info-title {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow: 0 2px 8px rgba(0,0,0,0.9);
    }
    .video-info-sub {
      font-size: 10px;
      font-weight: 600;
      color: #38bdf8;
      letter-spacing: 0.8px;
      text-shadow: 0 1px 4px rgba(0,0,0,0.9);
    }
    /* Top Right Watermark Badge (LMS recorded style) */
    #watermark {
      position: absolute;
      top: 12px; right: 14px;
      z-index: 22;
      padding: 5px 12px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      pointer-events: none;
      display: flex;
      flex-direction: column;
      text-align: right;
    }
    .wm-name {
      font-size: 11px;
      font-weight: 700;
      color: #fbbf24;
      letter-spacing: 0.4px;
    }
    .wm-sub {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 1px;
    }
    /* Center Play Button Overlay (LMS recorded style) */
    #center-play-overlay {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 25;
      width: 66px; height: 66px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
    }
    #center-play-overlay:hover {
      transform: translate(-50%, -50%) scale(1.1);
      background: rgba(15, 23, 42, 0.95);
      border-color: #38bdf8;
      color: #38bdf8;
    }
    #center-play-overlay.playing {
      opacity: 0;
      pointer-events: none;
    }
    /* End Screen Overlay */
    #end-screen-overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 30;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      padding: 24px;
      text-align: center;
    }
    #end-screen-overlay.active { display: flex; }
    #end-screen-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; color: #f8fafc; }
    #end-screen-sub { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .replay-btn {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff; border: none; padding: 12px 28px;
      border-radius: 9999px; font-weight: 600; font-size: 14px;
      cursor: pointer; display: flex; align-items: center; gap: 8px;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
      transition: all 0.2s;
    }
    .replay-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6); }
    /* Custom Controls Bar (LMS recorded style) */
    #custom-controls {
      position: absolute;
      bottom: 0; left: 0;
      width: 100%; height: 64px;
      z-index: 35;
      background: #0f172a;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    #custom-controls.hidden {
      opacity: 0;
      transform: translateY(100%);
      pointer-events: none;
    }
    .ctrl-btn {
      background: transparent;
      border: none;
      color: #e2e8f0;
      font-size: 16px;
      width: 36px; height: 36px;
      border-radius: 8px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .ctrl-btn:hover { background: rgba(255, 255, 255, 0.12); color: #38bdf8; }
    #ctrl-time {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
      white-space: nowrap;
      flex-shrink: 0;
      min-width: 90px;
    }
    .scrubber-container {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      height: 24px;
      cursor: pointer;
    }
    .scrubber-track {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      position: relative;
      overflow: hidden;
    }
    .scrubber-fill {
      position: absolute;
      top: 0; left: 0;
      height: 100%;
      background: #38bdf8;
      border-radius: 2px;
      width: 0%;
    }
    .scrubber-input {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      opacity: 0;
      cursor: pointer;
      margin: 0;
    }
    .vol-container {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .vol-slider {
      width: 60px;
      height: 4px;
      accent-color: #38bdf8;
      cursor: pointer;
    }
    .secure-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.6px;
      user-select: none;
      flex-shrink: 0;
    }
    .secure-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #38bdf8;
    }
    @media (max-width: 640px) {
      .vol-slider, .secure-badge { display: none; }
      #ctrl-time { font-size: 11px; min-width: 70px; }
      #custom-controls { padding: 0 10px; gap: 8px; }
      #top-video-info { max-width: 55%; top: 10px; left: 12px; }
      .video-info-title { font-size: 11px; }
      #watermark { top: 8px; right: 10px; padding: 4px 8px; }
      .wm-name { font-size: 9px; }
      .wm-sub { font-size: 8px; }
    }
  </style>
</head>
<body>
  <div id="player-wrapper">
    <div id="frame"></div>
    <div id="interaction-shield"></div>

    <div id="top-video-info">
      <div class="video-info-title">${escTitle}</div>
      <div class="video-info-sub">${escTopic}</div>
    </div>

    <div id="watermark">
      <span class="wm-name">NERMAI IAS ACADEMY</span>
      <span class="wm-sub">Free Demo Lecture</span>
    </div>

    <div id="center-play-overlay">▶</div>

    <div id="end-screen-overlay">
      <div id="end-screen-title">${escTitle}</div>
      <div id="end-screen-sub">Demo Class Completed</div>
      <button class="replay-btn" id="replay-btn">
        <span>🔄</span> Replay Video
      </button>
    </div>

    <div id="custom-controls">
      <button class="ctrl-btn" id="ctrl-play-btn" title="Play/Pause">▶</button>
      <span id="ctrl-time">0:00 / 0:00</span>
      <div class="scrubber-container">
        <div class="scrubber-track">
          <div class="scrubber-fill" id="scrubber-fill"></div>
        </div>
        <input type="range" id="ctrl-scrubber" class="scrubber-input" min="0" max="100" value="0" step="0.1" />
      </div>
      <div class="vol-container">
        <button class="ctrl-btn" id="ctrl-mute-btn" title="Mute/Unmute">🔊</button>
        <input type="range" id="ctrl-vol-slider" class="vol-slider" min="0" max="100" value="100" />
      </div>
      <div class="secure-badge">
        <span class="secure-dot"></span> <span>NERMAI SECURE</span>
      </div>
      <button class="ctrl-btn" id="ctrl-fs-btn" title="Toggle Fullscreen">⛶</button>
    </div>
  </div>

<script>
  let player;
  let isSeeking = false;
  let hideControlsTimer = null;

  function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updateScrubber() {
    if (!player || typeof player.getCurrentTime !== 'function' || isSeeking) return;
    const current = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 0;
    const fill = document.getElementById('scrubber-fill');
    const input = document.getElementById('ctrl-scrubber');
    const timeEl = document.getElementById('ctrl-time');
    if (duration > 0) {
      const pct = (current / duration) * 100;
      if (fill) fill.style.width = pct + '%';
      if (input) input.value = pct;
      if (timeEl) timeEl.textContent = formatTime(current) + ' / ' + formatTime(duration);
    }
  }

  function togglePlay() {
    if (!player || typeof player.getPlayerState !== 'function') return;
    const state = player.getPlayerState();
    const endOverlay = document.getElementById('end-screen-overlay');
    if (state === 1) { // 1 = YT.PlayerState.PLAYING
      player.pauseVideo();
    } else {
      if (endOverlay) endOverlay.classList.remove('active');
      player.playVideo();
    }
  }

  function initCustomControls() {
    const wrapper = document.getElementById('player-wrapper');
    const shield = document.getElementById('interaction-shield');
    const centerBtn = document.getElementById('center-play-overlay');
    const playBtn = document.getElementById('ctrl-play-btn');
    const scrubber = document.getElementById('ctrl-scrubber');
    const fill = document.getElementById('scrubber-fill');
    const muteBtn = document.getElementById('ctrl-mute-btn');
    const volSlider = document.getElementById('ctrl-vol-slider');
    const fsBtn = document.getElementById('ctrl-fs-btn');
    const controls = document.getElementById('custom-controls');
    const endOverlay = document.getElementById('end-screen-overlay');
    const replayBtn = document.getElementById('replay-btn');

    if (shield) shield.addEventListener('click', togglePlay);
    if (centerBtn) centerBtn.addEventListener('click', togglePlay);
    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (replayBtn) replayBtn.addEventListener('click', () => {
      if (endOverlay) endOverlay.classList.remove('active');
      if (player && player.seekTo) { player.seekTo(0, true); player.playVideo(); }
    });

    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        isSeeking = true;
        const pct = parseFloat(e.target.value);
        if (fill) fill.style.width = pct + '%';
      });
      scrubber.addEventListener('change', (e) => {
        if (!player || typeof player.getDuration !== 'function') return;
        const duration = player.getDuration() || 0;
        const pct = parseFloat(e.target.value);
        const targetTime = duration * (pct / 100);
        player.seekTo(targetTime, true);
        isSeeking = false;
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (!player || !player.isMuted) return;
        if (player.isMuted()) {
          player.unMute();
          muteBtn.textContent = '🔊';
        } else {
          player.mute();
          muteBtn.textContent = '🔇';
        }
      });
    }

    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        if (!player || !player.setVolume) return;
        const val = parseInt(e.target.value, 10);
        player.setVolume(val);
        if (val === 0) player.mute(); else player.unMute();
        if (muteBtn) muteBtn.textContent = val === 0 ? '🔇' : '🔊';
      });
    }

    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          if (wrapper.requestFullscreen) wrapper.requestFullscreen();
          else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      });
    }

    function resetHideControlsTimer() {
      if (controls) controls.classList.remove('hidden');
      if (hideControlsTimer) clearTimeout(hideControlsTimer);
      hideControlsTimer = setTimeout(() => {
        if (player && player.getPlayerState && player.getPlayerState() === 1) {
          if (controls) controls.classList.add('hidden');
        }
      }, 5000);
    }

    if (wrapper) {
      wrapper.addEventListener('mousemove', resetHideControlsTimer);
      wrapper.addEventListener('touchstart', resetHideControlsTimer);
    }

    setInterval(updateScrubber, 250);
  }

  function onPlayerReady() {
    initCustomControls();
  }

  function onPlayerStateChange(event) {
    const centerBtn = document.getElementById('center-play-overlay');
    const playBtn = document.getElementById('ctrl-play-btn');
    const endOverlay = document.getElementById('end-screen-overlay');

    if (event.data === 1) { // PLAYING
      if (centerBtn) centerBtn.classList.add('playing');
      if (playBtn) playBtn.textContent = '❚❚';
      if (endOverlay) endOverlay.classList.remove('active');
    } else if (event.data === 2) { // PAUSED
      if (centerBtn) centerBtn.classList.remove('playing');
      if (playBtn) playBtn.textContent = '▶';
    } else if (event.data === 0) { // ENDED
      if (centerBtn) centerBtn.classList.remove('playing');
      if (playBtn) playBtn.textContent = '▶';
      if (endOverlay) endOverlay.classList.add('active');
    }
  }

  function onYouTubeIframeAPIReady() {
    const domain = (window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://nermaiias.in';
    player = new YT.Player('frame', {
      height: '100%',
      width: '100%',
      videoId: "${videoId}",
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
        color: 'white',
        enablejsapi: 1,
        fs: 0,
        playsinline: 1,
        origin: domain
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
      }
    });
  }
</script>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
  if (window.YT && typeof window.YT.Player === 'function' && !player) {
    onYouTubeIframeAPIReady();
  }
</script>
</body>
</html>`;
};

const getEmbedUrl = (url: string): string => {
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`;
  }
  return url;
};

interface GuestRecordingsAdminPageProps {
  isMobile?: boolean;
  darkMode?: boolean;
}

export const GuestRecordingsAdminPage: React.FC<GuestRecordingsAdminPageProps> = ({
  isMobile: isMobileProp,
  darkMode = false,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const isMobile = isMobileProp !== undefined ? isMobileProp : screenWidth < 768;

  const [recordings, setRecordings] = useState<GuestRecordingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GuestRecordingItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formTopic, setFormTopic] = useState('UPSC');
  const [isCustomTopicMode, setIsCustomTopicMode] = useState(false);
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formFacultyName, setFormFacultyName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Delete & Preview
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<GuestRecordingItem | null>(null);
  const [previewItem, setPreviewItem] = useState<GuestRecordingItem | null>(null);

  const fileInputRef = useRef<any>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'guest_recordings'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: GuestRecordingItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          if (!data.isDeleted) {
            list.push({
              id: d.id,
              title: data.title || '',
              topic: data.topic || 'General',
              description: data.description || '',
              videoUrl: data.videoUrl || '',
              thumbnailUrl: data.thumbnailUrl || '',
              duration: data.duration || '',
              facultyName: data.facultyName || '',
              isPublished: data.isPublished !== false,
              createdAt: data.createdAt,
              order: data.order || 0,
            });
          }
        });
        list.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0);
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0);
          return timeB - timeA;
        });
        setRecordings(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching guest recordings:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const availableTopics = useMemo(() => {
    const topicSet = new Set<string>(DEFAULT_TOPIC_PILLS);
    recordings.forEach((r) => {
      if (r.topic && r.topic.trim()) {
        topicSet.add(r.topic.trim());
      }
    });
    return Array.from(topicSet);
  }, [recordings]);

  const filteredRecordings = useMemo(() => {
    return recordings.filter((r) => {
      const matchesTopic = selectedTopicFilter === 'All' || r.topic.toLowerCase() === selectedTopicFilter.toLowerCase();
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.topic.toLowerCase().includes(q) ||
        (r.facultyName && r.facultyName.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q));
      return matchesTopic && matchesSearch;
    });
  }, [recordings, selectedTopicFilter, search]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormTopic('UPSC');
    setIsCustomTopicMode(false);
    setCustomTopicInput('');
    setFormVideoUrl('');
    setFormThumbnailUrl('');
    setUploadedFileName('');
    setFormDuration('');
    setFormFacultyName('');
    setFormDescription('');
    setFormIsPublished(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: GuestRecordingItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    if (availableTopics.includes(item.topic)) {
      setFormTopic(item.topic);
      setIsCustomTopicMode(false);
      setCustomTopicInput('');
    } else {
      setFormTopic('__custom__');
      setIsCustomTopicMode(true);
      setCustomTopicInput(item.topic);
    }
    setFormVideoUrl(item.videoUrl);
    setFormThumbnailUrl(item.thumbnailUrl || '');
    setUploadedFileName(item.thumbnailUrl ? 'Custom Image Attached' : '');
    setFormDuration(item.duration || '');
    setFormFacultyName(item.facultyName || '');
    setFormDescription(item.description || '');
    setFormIsPublished(item.isPublished !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  // Image Upload Handler (Web input file or Base64)
  const handlePickImage = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (uploadEvent: any) => {
      setFormThumbnailUrl(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setFormError('');
    const trimmedTitle = formTitle.trim();
    const trimmedVideoUrl = formVideoUrl.trim();
    const finalTopic = isCustomTopicMode ? customTopicInput.trim() : formTopic.trim();

    if (!trimmedVideoUrl) {
      setFormError('Please enter a video URL (YouTube link or direct MP4).');
      return;
    }
    if (!trimmedTitle) {
      setFormError('Please enter a title for this recording.');
      return;
    }
    if (!finalTopic) {
      setFormError('Please select or specify a topic.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        title: trimmedTitle,
        topic: finalTopic,
        videoUrl: trimmedVideoUrl,
        thumbnailUrl: formThumbnailUrl.trim() || getAutoThumbnail(trimmedVideoUrl) || '',
        duration: formDuration.trim() || '',
        facultyName: formFacultyName.trim() || '',
        description: formDescription.trim() || '',
        isPublished: formIsPublished,
        isDeleted: false,
        updatedAt: serverTimestamp(),
      };

      if (editingItem) {
        await updateDoc(doc(db, 'guest_recordings', editingItem.id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        payload.order = recordings.length;
        const newRef = doc(collection(db, 'guest_recordings'));
        await setDoc(newRef, payload);
      }

      setIsModalOpen(false);
      Alert.alert('Success', `Demo class ${editingItem ? 'updated' : 'published'} successfully!`);
    } catch (err: any) {
      console.error('Error saving guest recording:', err);
      setFormError(err.message || 'Failed to save recording.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await updateDoc(doc(db, 'guest_recordings', deleteConfirmItem.id), {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      });
      setDeleteConfirmItem(null);
    } catch (err: any) {
      console.error('Failed to delete recording:', err);
      Alert.alert('Error', 'Failed to delete recording: ' + err.message);
    }
  };

  const handleTogglePublished = async (item: GuestRecordingItem) => {
    try {
      await updateDoc(doc(db, 'guest_recordings', item.id), {
        isPublished: !item.isPublished,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('Toggle error:', err);
    }
  };

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      
      {/* ── HEADER & STATS ────────────────────────────────────────────────────── */}
      <View style={[styles.headerBox, isMobile && { flexDirection: 'column', alignItems: 'stretch', gap: 12 }, darkMode && styles.headerBoxDark]}>
        <View style={{ flex: isMobile ? undefined : 1, width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="film" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, darkMode && { color: '#fff' }]}>
                Guest Recordings &amp; Demo Lectures
              </Text>
              <Text style={[styles.pageSubtitle, darkMode && { color: '#aaa' }]}>
                Upload and manage public demo classes, orientation videos, and subject strategy lectures.
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleOpenCreateModal}
          activeOpacity={0.85}
          style={[styles.createBtn, isMobile && { width: '100%', justifyContent: 'center' }]}
        >
          <Ionicons name="add-circle" size={18} color="#fff" />
          <Text style={styles.createBtnText}>Upload New Recording</Text>
        </TouchableOpacity>
      </View>

      {/* ── STATS ROW ─────────────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, darkMode && styles.statCardDark]}>
          <Text style={[styles.statValue, { color: '#7b0000' }]}>{recordings.length}</Text>
          <Text style={[styles.statLabel, darkMode && { color: '#888' }]}>Total Classes</Text>
        </View>
        <View style={[styles.statCard, darkMode && styles.statCardDark]}>
          <Text style={[styles.statValue, { color: '#2e7d32' }]}>
            {recordings.filter((r) => r.isPublished !== false).length}
          </Text>
          <Text style={[styles.statLabel, darkMode && { color: '#888' }]}>Active / Published</Text>
        </View>
        <View style={[styles.statCard, darkMode && styles.statCardDark]}>
          <Text style={[styles.statValue, { color: '#1565c0' }]}>{availableTopics.length}</Text>
          <Text style={[styles.statLabel, darkMode && { color: '#888' }]}>Topics Covered</Text>
        </View>
      </View>

      {/* ── FILTER & SEARCH BAR ───────────────────────────────────────────────── */}
      <View style={[styles.filterBar, darkMode && styles.filterBarDark]}>
        <View style={[styles.searchBox, darkMode && styles.searchBoxDark]}>
          <Ionicons name="search" size={16} color={darkMode ? '#777' : '#999'} style={{ marginLeft: 8 }} />
          <TextInput
            placeholder="Search by title, faculty, or topic..."
            placeholderTextColor={darkMode ? '#777' : '#999'}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, darkMode && styles.searchInputDark]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4, marginRight: 4 }}>
              <Ionicons name="close-circle" size={16} color="#888" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Topic filter scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedTopicFilter('All')}
            style={[
              styles.filterPill,
              selectedTopicFilter === 'All' ? styles.filterPillActive : (darkMode ? styles.filterPillDark : styles.filterPillLight),
            ]}
          >
            <Text style={[styles.filterPillText, selectedTopicFilter === 'All' && styles.filterPillTextActive]}>
              All ({recordings.length})
            </Text>
          </TouchableOpacity>

          {availableTopics.map((top) => {
            const count = recordings.filter((r) => r.topic.toLowerCase() === top.toLowerCase()).length;
            const isActive = selectedTopicFilter.toLowerCase() === top.toLowerCase();
            return (
              <TouchableOpacity
                key={top}
                onPress={() => setSelectedTopicFilter(top)}
                style={[
                  styles.filterPill,
                  isActive ? styles.filterPillActive : (darkMode ? styles.filterPillDark : styles.filterPillLight),
                ]}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {top} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CONTENT AREA ──────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7b0000" />
          <Text style={[styles.loadingText, darkMode && { color: '#aaa' }]}>Loading guest recordings...</Text>
        </View>
      ) : filteredRecordings.length === 0 ? (
        <View style={[styles.emptyContainer, darkMode && styles.emptyContainerDark]}>
          <Ionicons name="film-outline" size={48} color="#7b0000" />
          <Text style={[styles.emptyTitle, darkMode && { color: '#fff' }]}>No Guest Recordings Found</Text>
          <Text style={[styles.emptySubtitle, darkMode && { color: '#888' }]}>
            {search || selectedTopicFilter !== 'All'
              ? 'No recordings match your current search/filter.'
              : 'Click "Upload New Recording" above to publish your first free demo class.'}
          </Text>
          <TouchableOpacity onPress={handleOpenCreateModal} style={styles.createBtnSmall}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>+ Add Demo Class</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardGrid}>
          {filteredRecordings.map((rec) => {
            const thumb = getAutoThumbnail(rec.videoUrl, rec.thumbnailUrl);
            const isPub = rec.isPublished !== false;
            return (
              <View
                key={rec.id}
                style={[
                  styles.adminCard,
                  darkMode && styles.adminCardDark,
                  isMobile ? { width: '100%' } : { width: '48%', minWidth: 320 },
                ]}
              >
                {/* Thumb */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => setPreviewItem(rec)}
                  style={styles.adminCardThumbWrapper}
                >
                  <Image source={{ uri: thumb }} style={styles.adminCardThumb} resizeMode="cover" />
                  <View style={styles.thumbPlayIcon}>
                    <Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
                  </View>
                  <View style={styles.topicBadge}>
                    <Text style={styles.topicBadgeText}>{rec.topic}</Text>
                  </View>
                  {rec.duration ? (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationBadgeText}>{rec.duration}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                {/* Body */}
                <View style={styles.adminCardBody}>
                  <Text style={[styles.adminCardTitle, darkMode && { color: '#fff' }]} numberOfLines={2}>
                    {rec.title}
                  </Text>
                  
                  {rec.facultyName ? (
                    <Text style={[styles.adminCardFaculty, darkMode && { color: '#bbb' }]}>
                      👨‍🏫 {rec.facultyName}
                    </Text>
                  ) : null}

                  {rec.description ? (
                    <Text style={[styles.adminCardDesc, darkMode && { color: '#888' }]} numberOfLines={2}>
                      {rec.description}
                    </Text>
                  ) : null}

                  {/* Status & Actions */}
                  <View style={[styles.adminCardFooter, darkMode && styles.adminCardFooterDark]}>
                    <TouchableOpacity
                      onPress={() => handleTogglePublished(rec)}
                      style={[styles.statusPill, isPub ? styles.statusPillPub : styles.statusPillDraft]}
                    >
                      <Ionicons name={isPub ? "checkmark-circle" : "pause-circle"} size={13} color={isPub ? "#2e7d32" : "#888"} />
                      <Text style={[styles.statusPillText, { color: isPub ? "#2e7d32" : "#888" }]}>
                        {isPub ? 'Published' : 'Draft'}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setPreviewItem(rec)}
                        style={[styles.actionIconBtn, { backgroundColor: '#e3f2fd' }]}
                        title="Preview Class"
                      >
                        <Ionicons name="eye-outline" size={16} color="#1565c0" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleOpenEditModal(rec)}
                        style={[styles.actionIconBtn, { backgroundColor: '#fff3e0' }]}
                        title="Edit Class"
                      >
                        <Ionicons name="create-outline" size={16} color="#e65100" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setDeleteConfirmItem(rec)}
                        style={[styles.actionIconBtn, { backgroundColor: '#ffebee' }]}
                        title="Delete Class"
                      >
                        <Ionicons name="trash-outline" size={16} color="#c62828" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── CREATE / EDIT MODAL ───────────────────────────────────────────────── */}
      {isModalOpen && (
        <Modal
          visible={isModalOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, isMobile && { height: '88%', maxHeight: '92%' }, darkMode && styles.modalCardDark]}>
              
              {/* Modal Top Bar */}
              <View style={[styles.modalTopBar, darkMode && styles.modalTopBarDark]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={editingItem ? "create" : "videocam"} size={20} color="#7b0000" />
                  <Text style={[styles.modalHeaderTitle, darkMode && { color: '#fff' }]}>
                    {editingItem ? 'Edit Demo Recording' : 'New Guest Demo Recording'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.modalCloseIconBtn}>
                  <Ionicons name="close" size={20} color={darkMode ? '#fff' : '#222'} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Form Body */}
              <ScrollView style={styles.modalFormScroll} contentContainerStyle={{ padding: 18, gap: 14 }}>
                
                {/* 1. Video URL Input */}
                <View>
                  <Text style={[styles.fieldLabel, darkMode && { color: '#ccc' }]}>
                    Video URL (YouTube or Direct MP4) *
                  </Text>
                  <TextInput
                    placeholder="e.g. https://youtu.be/3bSlNH5pZXE"
                    placeholderTextColor={darkMode ? '#666' : '#999'}
                    value={formVideoUrl}
                    onChangeText={(val) => {
                      setFormVideoUrl(val);
                      // If title is empty and we detect YouTube, give a friendly hint
                      if (!formTitle && extractYouTubeId(val)) {
                        setFormTitle('Civil Services Demo Lecture');
                      }
                    }}
                    style={[styles.formInput, darkMode && styles.formInputDark]}
                  />
                  {formVideoUrl && extractYouTubeId(formVideoUrl) ? (
                    <View style={styles.detectedYtBox}>
                      <Image source={{ uri: getAutoThumbnail(formVideoUrl) }} style={styles.detectedYtThumb} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#2e7d32' }}>
                          ✓ YouTube Video &amp; Thumbnail Detected
                        </Text>
                        <Text style={{ fontSize: 10, color: '#666' }}>ID: {extractYouTubeId(formVideoUrl)}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* 2. Title Input */}
                <View>
                  <Text style={[styles.fieldLabel, darkMode && { color: '#ccc' }]}>
                    Recording Title *
                  </Text>
                  <TextInput
                    placeholder="e.g. UPSC Prelims Strategy & Core Syllabus Walkthrough"
                    placeholderTextColor={darkMode ? '#666' : '#999'}
                    value={formTitle}
                    onChangeText={setFormTitle}
                    style={[styles.formInput, darkMode && styles.formInputDark, !formTitle && formError ? { borderColor: '#c62828' } : {}]}
                  />
                </View>

                {/* 3. Topic Selection (Pills + Custom) */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[styles.fieldLabel, darkMode && { color: '#ccc' }, { marginBottom: 0 }]}>
                      Topic / Subject *
                    </Text>
                    <TouchableOpacity onPress={() => setIsCustomTopicMode(!isCustomTopicMode)}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#1565c0' }}>
                        {isCustomTopicMode ? '← Pick from list' : '+ Custom Topic'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isCustomTopicMode ? (
                    <TextInput
                      placeholder="Type custom topic (e.g. Ethics, Current Affairs, Sociology)..."
                      placeholderTextColor={darkMode ? '#666' : '#999'}
                      value={customTopicInput}
                      onChangeText={setCustomTopicInput}
                      style={[styles.formInput, darkMode && styles.formInputDark]}
                      autoFocus
                    />
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {availableTopics.map((top) => {
                        const isSelected = formTopic.toLowerCase() === top.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={top}
                            onPress={() => setFormTopic(top)}
                            style={[
                              styles.modalTopicPill,
                              isSelected ? styles.modalTopicPillActive : (darkMode ? styles.modalTopicPillDark : styles.modalTopicPillLight),
                            ]}
                          >
                            <Text style={[styles.modalTopicPillText, isSelected && { color: '#fff' }]}>
                              {top}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* 4. Duration & Faculty Name */}
                <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, darkMode && { color: '#ccc' }]}>Duration (Optional)</Text>
                    <TextInput
                      placeholder="e.g. 45m or 1h 30m"
                      placeholderTextColor={darkMode ? '#666' : '#999'}
                      value={formDuration}
                      onChangeText={setFormDuration}
                      style={[styles.formInput, darkMode && styles.formInputDark]}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, darkMode && { color: '#ccc' }]}>Faculty / Mentor (Optional)</Text>
                    <TextInput
                      placeholder="e.g. Dr. Aagesh, IAS Mentor"
                      placeholderTextColor={darkMode ? '#666' : '#999'}
                      value={formFacultyName}
                      onChangeText={setFormFacultyName}
                      style={[styles.formInput, darkMode && styles.formInputDark]}
                    />
                  </View>
                </View>

                {/* 5. Description */}
                <View>
                  <Text style={[styles.fieldLabel, darkMode && { color: '#ccc' }]}>Description / Key Takeaways (Optional)</Text>
                  <TextInput
                    placeholder="Brief summary of concepts discussed in this session..."
                    placeholderTextColor={darkMode ? '#666' : '#999'}
                    value={formDescription}
                    onChangeText={setFormDescription}
                    multiline
                    numberOfLines={3}
                    style={[styles.formInput, darkMode && styles.formInputDark, { height: 70, textAlignVertical: 'top' }]}
                  />
                </View>

                {/* 6. Custom Thumbnail Image Upload & URL */}
                <View style={[styles.thumbUploadBox, darkMode && styles.thumbUploadBoxDark]}>
                  <Text style={[styles.fieldLabel, darkMode && { color: '#ccc' }]}>Custom Poster / Thumbnail (Optional)</Text>
                  
                  {/* Upload from device / Web */}
                  {Platform.OS === 'web' ? (
                    <View style={{ marginBottom: 10 }}>
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handlePickImage}
                        style={{ display: 'none' }}
                      />
                      <TouchableOpacity
                        onPress={() => fileInputRef.current?.click()}
                        style={styles.uploadImageBtn}
                      >
                        <Ionicons name="cloud-upload-outline" size={18} color="#7b0000" />
                        <Text style={styles.uploadImageBtnText}>
                          {uploadedFileName ? `Replace: ${uploadedFileName}` : '📸 Upload Poster Image From Device'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TextInput
                    placeholder="Or enter custom image URL directly (leave blank for YouTube thumbnail)"
                    placeholderTextColor={darkMode ? '#666' : '#999'}
                    value={formThumbnailUrl}
                    onChangeText={setFormThumbnailUrl}
                    style={[styles.formInput, darkMode && styles.formInputDark, { fontSize: 12 }]}
                  />

                  {formThumbnailUrl ? (
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Image source={{ uri: formThumbnailUrl }} style={{ width: 80, height: 48, borderRadius: 6 }} />
                      <Text style={{ fontSize: 11, color: '#2e7d32', fontWeight: '700' }}>✓ Custom Poster Attached</Text>
                    </View>
                  ) : null}
                </View>

                {/* 7. Published Toggle */}
                <TouchableOpacity
                  onPress={() => setFormIsPublished(!formIsPublished)}
                  style={styles.publishedToggleRow}
                >
                  <Ionicons
                    name={formIsPublished ? "checkbox" : "square-outline"}
                    size={22}
                    color={formIsPublished ? "#7b0000" : "#888"}
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.fieldLabel, darkMode && { color: '#fff' }, { marginBottom: 2 }]}>
                      Publish for All Public Guests Immediately
                    </Text>
                    <Text style={{ fontSize: 11, color: darkMode ? '#888' : '#666' }}>
                      When checked, aspirants on the guest portal can see and watch this recording immediately.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Validation Error Banner */}
                {formError ? (
                  <View style={styles.formErrorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#c62828" />
                    <Text style={styles.formErrorText}>{formError}</Text>
                  </View>
                ) : null}
              </ScrollView>

              {/* Bottom Sticky Action Bar */}
              <View style={[styles.modalActionBar, darkMode && styles.modalActionBarDark]}>
                <TouchableOpacity
                  onPress={() => setIsModalOpen(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={[styles.modalCancelBtnText, darkMode && { color: '#ccc' }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSave}
                  disabled={isSaving}
                  style={[styles.modalSaveBtn, isSaving && { opacity: 0.6 }]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.modalSaveBtnText}>
                        {editingItem ? 'Save Changes' : 'Publish Recording'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── PREVIEW MODAL ────────────────────────────────────────────────────── */}
      {previewItem && (() => {
        const ytId = extractYouTubeId(previewItem.videoUrl);
        const playerHtml = ytId ? buildGuestPlayerHtml(ytId, previewItem.title, previewItem.topic) : '';

        return (
          <Modal
            visible={!!previewItem}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setPreviewItem(null)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: isMobile ? 8 : 20 }}>
              <View style={{ width: isMobile ? "100%" : "95%", height: isMobile ? "82%" : "90%", maxWidth: 1100, backgroundColor: "#000", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: darkMode ? "#333" : "#555" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, backgroundColor: darkMode ? "#18181b" : "#222" }}>
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Video Player</Text>
                  <TouchableOpacity onPress={() => setPreviewItem(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                {Platform.OS === "web" ? (
                  playerHtml ? (
                    <iframe
                      key={previewItem.id || previewItem.videoUrl}
                      srcDoc={playerHtml}
                      title={previewItem.title}
                      style={{ flex: 1, width: "100%", height: "100%", border: "none", backgroundColor: "black" }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  ) : (
                    <iframe
                      key={previewItem.id || previewItem.videoUrl}
                      src={getEmbedUrl(previewItem.videoUrl)}
                      title={previewItem.title}
                      style={{ flex: 1, width: "100%", height: "100%", border: "none", backgroundColor: "black" }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  )
                ) : (
                  (() => {
                    const { WebView } = require("react-native-webview");
                    return (
                      <WebView
                        key={previewItem.id || previewItem.videoUrl}
                        source={playerHtml ? { html: playerHtml, baseUrl: 'https://nermaiias.in' } : { uri: getEmbedUrl(previewItem.videoUrl) }}
                        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                        style={{ flex: 1, width: "100%", height: "100%", backgroundColor: "#000" }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        allowsFullscreenVideo={true}
                        mediaPlaybackRequiresUserAction={false}
                        allowsInlineMediaPlayback={true}
                        originWhitelist={['*']}
                        startInLoadingState={true}
                        renderLoading={() => (
                          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
                            <ActivityIndicator size="large" color="#38bdf8" />
                            <Text style={{ color: "#fff", marginTop: 10, fontSize: 13 }}>Loading video player...</Text>
                          </View>
                        )}
                      />
                    );
                  })()
                )}
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* ── DELETE CONFIRM MODAL ─────────────────────────────────────────────── */}
      {deleteConfirmItem && (
        <Modal visible={!!deleteConfirmItem} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, darkMode && styles.modalCardDark]}>
              <Ionicons name="trash-bin" size={36} color="#c62828" style={{ marginBottom: 10 }} />
              <Text style={[styles.confirmTitle, darkMode && { color: '#fff' }]}>Delete Recording?</Text>
              <Text style={[styles.confirmSub, darkMode && { color: '#aaa' }]}>
                Are you sure you want to delete "{deleteConfirmItem.title}"? Aspirants will no longer be able to watch it.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' }}>
                <TouchableOpacity
                  onPress={() => setDeleteConfirmItem(null)}
                  style={[styles.modalCancelBtn, { flex: 1 }]}
                >
                  <Text style={[styles.modalCancelBtnText, darkMode && { color: '#ccc' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  style={[styles.modalSaveBtn, { flex: 1, backgroundColor: '#c62828' }]}
                >
                  <Text style={styles.modalSaveBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  containerDark: {
    backgroundColor: '#0b0b14',
  },

  /* ── Header ── */
  headerBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 14,
    gap: 12,
  },
  headerBoxDark: {
    backgroundColor: '#161622',
    borderColor: '#262638',
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#7b0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    maxWidth: 600,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7b0000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#7b0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  createBtnSmall: {
    marginTop: 14,
    backgroundColor: '#7b0000',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },

  /* ── Stats ── */
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  statCardDark: {
    backgroundColor: '#161622',
    borderColor: '#262638',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 2,
  },

  /* ── Filter Bar ── */
  filterBar: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    gap: 10,
  },
  filterBarDark: {
    backgroundColor: '#161622',
    borderColor: '#262638',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchBoxDark: {
    backgroundColor: '#11111c',
    borderColor: '#2a2a3e',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    color: '#111827',
  },
  searchInputDark: {
    color: '#ffffff',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  filterPillDark: {
    backgroundColor: '#11111c',
    borderColor: '#2e2e42',
  },
  filterPillActive: {
    backgroundColor: '#7b0000',
    borderColor: '#7b0000',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  filterPillTextActive: {
    color: '#fff',
  },

  /* ── Loading / Empty ── */
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#666',
  },
  emptyContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyContainerDark: {
    backgroundColor: '#161622',
    borderColor: '#262638',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 380,
  },

  /* ── Card Grid ── */
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  adminCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 6,
  },
  adminCardDark: {
    backgroundColor: '#151522',
    borderColor: '#262638',
  },
  adminCardThumbWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  adminCardThumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(123, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#7b0000',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topicBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  adminCardBody: {
    padding: 14,
    flex: 1,
    justifyContent: 'space-between',
  },
  adminCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 19,
    marginBottom: 4,
  },
  adminCardFaculty: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
    marginBottom: 4,
  },
  adminCardDesc: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 16,
    marginBottom: 10,
  },
  adminCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  adminCardFooterDark: {
    borderTopColor: '#252538',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillPub: {
    backgroundColor: '#e8f5e9',
  },
  statusPillDraft: {
    backgroundColor: '#eeeeee',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Modal Common ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCardDark: {
    backgroundColor: '#161624',
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  modalTopBarDark: {
    backgroundColor: '#12121c',
    borderBottomColor: '#252538',
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },
  modalCloseIconBtn: {
    padding: 4,
    borderRadius: 16,
  },
  modalFormScroll: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: '#4b5563',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#111827',
  },
  formInputDark: {
    backgroundColor: '#0f0f18',
    borderColor: '#303046',
    color: '#ffffff',
  },
  detectedYtBox: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8f5e9',
    padding: 8,
    borderRadius: 8,
  },
  detectedYtThumb: {
    width: 60,
    height: 38,
    borderRadius: 4,
  },
  modalTopicPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  modalTopicPillLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  modalTopicPillDark: {
    backgroundColor: '#11111c',
    borderColor: '#2e2e42',
  },
  modalTopicPillActive: {
    backgroundColor: '#7b0000',
    borderColor: '#7b0000',
  },
  modalTopicPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  thumbUploadBox: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
  },
  thumbUploadBoxDark: {
    backgroundColor: '#12121c',
    borderColor: '#262638',
  },
  uploadImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#7b0000',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
  },
  uploadImageBtnText: {
    color: '#7b0000',
    fontSize: 12,
    fontWeight: '800',
  },
  publishedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  formErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ef9a9a',
    borderRadius: 8,
    padding: 10,
  },
  formErrorText: {
    color: '#c62828',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  modalActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  modalActionBarDark: {
    backgroundColor: '#12121c',
    borderTopColor: '#252538',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7b0000',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  /* ── Preview & Confirm ── */
  previewCard: {
    width: '100%',
    maxWidth: 700,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
  },
  confirmSub: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});

export default GuestRecordingsAdminPage;
