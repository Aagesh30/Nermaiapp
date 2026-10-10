import React, { useMemo, useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WatermarkOverlayProps {
  pageNumber?: number;
  customText?: string;
  isDarkBackground?: boolean;
}

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({
  pageNumber = 1,
  customText,
  isDarkBackground = false,
}) => {
  const { currentUser } = useAuth();
  const [userInfo, setUserInfo] = useState<{ name: string; phone: string }>({
    name: 'Student',
    phone: '',
  });

  useEffect(() => {
    let isMounted = true;

    const loadUserDetails = async () => {
      try {
        let raw: string | null = null;
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          raw = localStorage.getItem('nermai_auth_user');
        } else {
          raw = await AsyncStorage.getItem('nermai_auth_user');
        }

        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && isMounted) {
            const name = parsed.name || parsed.fullName || parsed.displayName || currentUser?.displayName || 'Student';
            let phone = parsed.phone || parsed.phoneNumber || parsed.mobile || '';

            // If phone is missing from login session, fetch directly from Firestore student/user record
            const targetId = parsed.studentId || parsed.userId || parsed.uid || parsed.id || currentUser?.uid;
            if (!phone && targetId) {
              try {
                const { doc, getDoc } = require('firebase/firestore');
                const { db } = require('../../../firebaseConfig');
                const sSnap = await getDoc(doc(db, 'students', targetId));
                if (sSnap.exists()) {
                  const sData = sSnap.data();
                  phone = sData?.phone || sData?.mobile || sData?.phoneNumber || '';
                }
                if (!phone) {
                  const uSnap = await getDoc(doc(db, 'users', targetId));
                  if (uSnap.exists()) {
                    const uData = uSnap.data();
                    phone = uData?.phone || uData?.mobile || uData?.phoneNumber || '';
                  }
                }
              } catch (_) {}
            }

            if (!phone) {
              phone = parsed.email || currentUser?.email || '';
            }

            setUserInfo({ name, phone });
            return;
          }
        }

        // Global fallback if available
        if (typeof globalThis !== 'undefined' && (globalThis as any).__NERMAI_USER__ && isMounted) {
          const u = (globalThis as any).__NERMAI_USER__;
          setUserInfo({
            name: u.name || u.fullName || currentUser?.displayName || 'Student',
            phone: u.phone || u.phoneNumber || u.email || currentUser?.email || '',
          });
          return;
        }

        // Fallback to AuthProvider currentUser
        if (currentUser && isMounted) {
          setUserInfo({
            name: currentUser.displayName || 'Student',
            phone: currentUser.email || '',
          });
        }
      } catch (err) {
        if (currentUser && isMounted) {
          setUserInfo({
            name: currentUser.displayName || 'Student',
            phone: currentUser.email || '',
          });
        }
      }
    };

    loadUserDetails();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Construct single clean watermark text: [Name] • [Phone]
  const watermarkText = useMemo(() => {
    if (customText) return customText;
    const parts: string[] = [];
    if (userInfo.name && userInfo.name !== 'Student') {
      parts.push(userInfo.name);
    } else {
      parts.push('NERMAI Student');
    }
    if (userInfo.phone) parts.push(userInfo.phone);
    return parts.join(' • ');
  }, [customText, userInfo]);

  // Generate a seamless SVG data URI pattern for the repeating diagonal watermark
  const svgPatternUri = useMemo(() => {
    const textColor = isDarkBackground ? 'rgba(255, 255, 255, 0.28)' : 'rgba(15, 23, 42, 0.16)';
    const escapedText = encodeURIComponent(watermarkText);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="180" viewBox="0 0 280 180"><text x="140" y="90" fill="${textColor}" font-size="12" font-weight="700" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" transform="rotate(-22 140 90)">${escapedText}</text></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
  }, [watermarkText, isDarkBackground]);

  // Common watermark styling for static rendering in 2 positions
  const commonWatermarkStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 'clamp(11px, 2.5vw, 13px)',
    fontWeight: 700,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    letterSpacing: '0.04em',
    color: isDarkBackground ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.22)',
    whiteSpace: 'nowrap',
    maxWidth: '90%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    userSelect: 'none',
    pointerEvents: 'none',
    zIndex: 25,
    textAlign: 'center',
    textShadow: isDarkBackground ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
  };

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-20"
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        backgroundImage: svgPatternUri,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center'
      }}
    >
      {/* 2-Location Static Central Watermark (Upper 25% & Lower 72%) */}
      <div style={{ ...commonWatermarkStyle, top: '25%' }}>
        {watermarkText}
      </div>
      <div style={{ ...commonWatermarkStyle, top: '72%' }}>
        {watermarkText}
      </div>
    </div>
  );
};
