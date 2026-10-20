import React, { useState, useEffect, useMemo } from 'react';
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
  Linking,
  StyleSheet,
  Dimensions,
  Share,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, onSnapshot } from 'firebase/firestore';
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
  createdAt?: any;
}

const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
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

const getThumbnail = (url: string, customThumb?: string): string => {
  if (customThumb && customThumb.trim().length > 0) return customThumb.trim();
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }
  return 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80';
};

interface GuestRecordingsPageProps {
  onApplyClick?: () => void;
  darkMode?: boolean;
}

export const GuestRecordingsPage: React.FC<GuestRecordingsPageProps> = ({
  onApplyClick,
  darkMode = false,
}) => {
  const [recordings, setRecordings] = useState<GuestRecordingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [search, setSearch] = useState('');
  const [activeVideo, setActiveVideo] = useState<GuestRecordingItem | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const isMobile = screenWidth < 768;

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'guest_recordings'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: GuestRecordingItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          if (!data.isDeleted && data.isPublished !== false) {
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
        console.error('Error loading guest recordings:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const topicsList = useMemo(() => {
    const set = new Set<string>();
    recordings.forEach((r) => {
      if (r.topic && r.topic.trim()) {
        set.add(r.topic.trim());
      }
    });
    return Array.from(set).sort();
  }, [recordings]);

  const filteredRecordings = useMemo(() => {
    return recordings.filter((r) => {
      const matchesTopic = selectedTopic === 'All' || r.topic.toLowerCase() === selectedTopic.toLowerCase();
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.topic.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.facultyName && r.facultyName.toLowerCase().includes(q));
      return matchesTopic && matchesSearch;
    });
  }, [recordings, selectedTopic, search]);

  const handleShare = async (item: GuestRecordingItem) => {
    const shareUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/#recordings`
      : item.videoUrl;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: item.title,
          text: `Watch free demo lecture from NERMAI IAS: "${item.title}"`,
          url: shareUrl,
        });
      } else {
        await Share.share({
          message: `Watch free demo lecture: "${item.title}"\n${item.videoUrl}`,
          title: item.title,
        });
      }
    } catch {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(item.videoUrl);
        Alert.alert('Link Copied', 'Video URL copied to your clipboard!');
      }
    }
  };

  const handlePlayVideo = (item: GuestRecordingItem) => {
    setActiveVideo(item);
  };

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      
      {/* ── HERO BANNER ────────────────────────────────────────────────────────── */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles" size={13} color="#FFD700" />
          <Text style={styles.heroBadgeText}>Free Demo Lectures &amp; Orientation</Text>
        </View>

        <Text style={styles.heroTitle}>
          Civil Services Demo Classes &amp; Recordings
        </Text>

        <Text style={styles.heroSubtitle}>
          Explore subject overviews, high-yield Prelims &amp; Mains strategies, and recorded demo classes taught by NERMAI IAS faculty. Completely free for all aspirants!
        </Text>

        {onApplyClick && (
          <TouchableOpacity
            onPress={onApplyClick}
            activeOpacity={0.88}
            style={styles.heroApplyBtn}
          >
            <Ionicons name="school" size={16} color="#7b0000" />
            <Text style={styles.heroApplyBtnText}>Apply for Admission</Text>
            <Ionicons name="arrow-forward" size={15} color="#7b0000" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── SEARCH & FILTER ROW ───────────────────────────────────────────────── */}
      <View style={[styles.filterBar, darkMode && styles.filterBarDark]}>
        {/* Search Input */}
        <View style={[styles.searchInputWrapper, darkMode && styles.searchInputWrapperDark]}>
          <Ionicons name="search-outline" size={18} color={darkMode ? "#888" : "#777"} style={{ marginLeft: 10 }} />
          <TextInput
            placeholder="Search classes by title, topic, or mentor..."
            placeholderTextColor={darkMode ? "#777" : "#999"}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, darkMode && styles.searchInputDark]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 6, marginRight: 6 }}>
              <Ionicons name="close-circle" size={16} color={darkMode ? "#888" : "#999"} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Topic Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicScrollView}
        >
          <TouchableOpacity
            onPress={() => setSelectedTopic('All')}
            style={[
              styles.topicPill,
              selectedTopic === 'All' ? styles.topicPillActive : (darkMode ? styles.topicPillDark : styles.topicPillLight),
            ]}
          >
            <Text style={[styles.topicPillText, selectedTopic === 'All' && styles.topicPillTextActive]}>
              All ({recordings.length})
            </Text>
          </TouchableOpacity>

          {topicsList.map((top) => {
            const count = recordings.filter((r) => r.topic.toLowerCase() === top.toLowerCase()).length;
            const isActive = selectedTopic.toLowerCase() === top.toLowerCase();
            return (
              <TouchableOpacity
                key={top}
                onPress={() => setSelectedTopic(top)}
                style={[
                  styles.topicPill,
                  isActive ? styles.topicPillActive : (darkMode ? styles.topicPillDark : styles.topicPillLight),
                ]}
              >
                <Text style={[styles.topicPillText, isActive && styles.topicPillTextActive]}>
                  {top} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CLASSES GRID ──────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#7b0000" />
          <Text style={[styles.loadingText, darkMode && { color: "#aaa" }]}>
            Loading free demo classes...
          </Text>
        </View>
      ) : filteredRecordings.length === 0 ? (
        <View style={[styles.emptyBox, darkMode && styles.emptyBoxDark]}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="videocam-outline" size={40} color="#7b0000" />
          </View>
          <Text style={[styles.emptyTitle, darkMode && { color: "#fff" }]}>
            No Demo Recordings Found
          </Text>
          <Text style={[styles.emptySub, darkMode && { color: "#888" }]}>
            {search || selectedTopic !== 'All'
              ? 'Try adjusting your search terms or filter selection.'
              : 'New demo classes will be uploaded soon. Stay tuned!'}
          </Text>
          {(search || selectedTopic !== 'All') && (
            <TouchableOpacity
              onPress={() => { setSearch(''); setSelectedTopic('All'); }}
              style={styles.clearFilterBtn}
            >
              <Text style={styles.clearFilterBtnText}>Reset Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.gridContainer}>
          {filteredRecordings.map((rec) => {
            const thumbUri = getThumbnail(rec.videoUrl, rec.thumbnailUrl);
            return (
              <View
                key={rec.id}
                style={[
                  styles.card,
                  darkMode && styles.cardDark,
                  isMobile ? { width: '100%' } : { width: '48%', minWidth: 320 }
                ]}
              >
                {/* Thumbnail Banner */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handlePlayVideo(rec)}
                  style={styles.thumbWrapper}
                >
                  <Image source={{ uri: thumbUri }} style={styles.thumbImage} resizeMode="cover" />
                  
                  {/* Play overlay button */}
                  <View style={styles.playOverlay}>
                    <View style={styles.playCircle}>
                      <Ionicons name="play" size={24} color="#ffffff" style={{ marginLeft: 3 }} />
                    </View>
                  </View>

                  {/* Topic badge */}
                  <View style={styles.cardTopicBadge}>
                    <Ionicons name="pricetag" size={11} color="#fff" />
                    <Text style={styles.cardTopicBadgeText}>{rec.topic}</Text>
                  </View>

                  {/* Duration badge */}
                  {rec.duration ? (
                    <View style={styles.cardDurationBadge}>
                      <Ionicons name="time-outline" size={11} color="#fff" />
                      <Text style={styles.cardDurationBadgeText}>{rec.duration}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                {/* Card Info */}
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, darkMode && { color: "#ffffff" }]} numberOfLines={2}>
                    {rec.title}
                  </Text>

                  {rec.facultyName ? (
                    <View style={styles.facultyRow}>
                      <Ionicons name="person-circle-outline" size={15} color="#7b0000" />
                      <Text style={[styles.facultyText, darkMode && { color: "#bbb" }]}>
                        {rec.facultyName}
                      </Text>
                    </View>
                  ) : null}

                  {rec.description ? (
                    <Text style={[styles.cardDescription, darkMode && { color: "#999" }]} numberOfLines={2}>
                      {rec.description}
                    </Text>
                  ) : null}

                  {/* Card Action Footer */}
                  <View style={[styles.cardFooter, darkMode && styles.cardFooterDark]}>
                    <TouchableOpacity
                      onPress={() => handlePlayVideo(rec)}
                      style={styles.watchBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play-circle" size={17} color="#ffffff" />
                      <Text style={styles.watchBtnText}>Watch Class</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleShare(rec)}
                      style={[styles.shareBtn, darkMode && styles.shareBtnDark]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="share-social-outline" size={16} color={darkMode ? "#ccc" : "#444"} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── VIDEO PLAYER MODAL (LMS RECORDED PAGE CONTAINER) ────────────────── */}
      {activeVideo && (() => {
        const ytId = extractYouTubeId(activeVideo.videoUrl);
        const playerHtml = ytId ? buildGuestPlayerHtml(ytId, activeVideo.title, activeVideo.topic) : '';

        return (
          <Modal
            visible={!!activeVideo}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setActiveVideo(null)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: isMobile ? 8 : 20 }}>
              <View style={{ width: isMobile ? "100%" : "95%", height: isMobile ? "82%" : "90%", maxWidth: 1100, backgroundColor: "#000", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: darkMode ? "#333" : "#555" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, backgroundColor: darkMode ? "#18181b" : "#222" }}>
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Video Player</Text>
                  <TouchableOpacity onPress={() => setActiveVideo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                {Platform.OS === "web" ? (
                  playerHtml ? (
                    <iframe
                      key={activeVideo.id || activeVideo.videoUrl}
                      srcDoc={playerHtml}
                      title={activeVideo.title}
                      style={{ flex: 1, width: "100%", height: "100%", border: "none", backgroundColor: "black" }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  ) : (
                    <iframe
                      key={activeVideo.id || activeVideo.videoUrl}
                      src={getEmbedUrl(activeVideo.videoUrl)}
                      title={activeVideo.title}
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
                        key={activeVideo.id || activeVideo.videoUrl}
                        source={playerHtml ? { html: playerHtml, baseUrl: 'https://nermaiias.in' } : { uri: getEmbedUrl(activeVideo.videoUrl) }}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  containerDark: {
    backgroundColor: '#0a0a0f',
  },

  /* ── Hero Banner ── */
  heroCard: {
    backgroundColor: '#7b0000',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#7b0000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  heroBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    lineHeight: 20,
    marginBottom: 18,
    maxWidth: 720,
  },
  heroApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFD700',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  heroApplyBtnText: {
    color: '#7b0000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  /* ── Filter Bar ── */
  filterBar: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  filterBarDark: {
    backgroundColor: '#161622',
    borderColor: '#262638',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInputWrapperDark: {
    backgroundColor: '#11111c',
    borderColor: '#2a2a3e',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: '#111827',
  },
  searchInputDark: {
    color: '#ffffff',
  },
  topicScrollView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  topicPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  topicPillLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  topicPillDark: {
    backgroundColor: '#11111c',
    borderColor: '#2e2e42',
  },
  topicPillActive: {
    backgroundColor: '#7b0000',
    borderColor: '#7b0000',
  },
  topicPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  topicPillTextActive: {
    color: '#ffffff',
  },

  /* ── Loading / Empty ── */
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 20,
  },
  emptyBoxDark: {
    backgroundColor: '#161622',
    borderColor: '#262638',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(123, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 18,
  },
  clearFilterBtn: {
    marginTop: 16,
    backgroundColor: '#7b0000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  clearFilterBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },

  /* ── Cards Grid ── */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 8,
  },
  cardDark: {
    backgroundColor: '#151522',
    borderColor: '#262638',
  },
  thumbWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7b0000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  cardTopicBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(123, 0, 0, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTopicBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardDurationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDurationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardBody: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 21,
    marginBottom: 6,
  },
  facultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  facultyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  cardDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  cardFooterDark: {
    borderTopColor: '#222232',
  },
  watchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7b0000',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  watchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  shareBtn: {
    padding: 9,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnDark: {
    backgroundColor: '#222232',
  },

  /* ── Video Modal ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 820,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 10,
  },
  modalCardDark: {
    backgroundColor: '#161624',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderDark: {
    borderBottomColor: '#252538',
  },
  modalTopicBadge: {
    backgroundColor: '#7b0000',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalTopicBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
  },
  videoPlayerWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
  },
  modalFooter: {
    padding: 18,
  },
  modalApplyBtn: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7b0000',
    paddingVertical: 11,
    borderRadius: 12,
    gap: 8,
  },
  modalApplyBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  modalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  modalShareBtnDark: {
    backgroundColor: '#262638',
  },
  modalShareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
});

export default GuestRecordingsPage;
