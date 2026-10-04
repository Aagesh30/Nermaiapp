import React, { useMemo, useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WatermarkOverlayProps {
  pageNumber?: number;
  customText?: string;
  isDarkBackground?: boolean;
}

// 8 balanced, deterministic coordinate pairs across pages
// Positioned inside the content body (between 16% and 80%), avoiding outer edge clipping
const POSITION_PAIRS: Array<[ { top: string; left: string }, { top: string; left: string } ]> = [
  // Page 1: Upper-Left & Bottom-Right
  [ { top: '22%', left: '16%' }, { top: '72%', left: '56%' } ],
  // Page 2: Upper-Right & Bottom-Left
  [ { top: '20%', left: '58%' }, { top: '74%', left: '16%' } ],
  // Page 3: Mid-Left & Mid-Right
  [ { top: '44%', left: '14%' }, { top: '46%', left: '54%' } ],
  // Page 4: Upper-Center & Lower-Center
  [ { top: '24%', left: '36%' }, { top: '78%', left: '34%' } ],
  // Page 5: Center-Left & Lower-Right
  [ { top: '36%', left: '18%' }, { top: '68%', left: '54%' } ],
  // Page 6: Upper-Right & Center-Bottom
  [ { top: '18%', left: '54%' }, { top: '80%', left: '24%' } ],
  // Page 7: Center-Top & Lower-Left
  [ { top: '28%', left: '46%' }, { top: '64%', left: '20%' } ],
  // Page 8: Upper-Left & Bottom-Center
  [ { top: '22%', left: '24%' }, { top: '76%', left: '50%' } ]
];

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
            const phone = parsed.phone || parsed.phoneNumber || parsed.mobile || parsed.email || currentUser?.email || '';
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

  // Construct watermark text: NERMAI • [Name] • [Phone]
  const watermarkText = useMemo(() => {
    if (customText) return customText;
    const parts = ['NERMAI'];
    if (userInfo.name) parts.push(userInfo.name);
    if (userInfo.phone) parts.push(userInfo.phone);
    return parts.join(' • ');
  }, [customText, userInfo]);

  // Determine the 2 positions for the current page
  // Safe modulo to handle negative or 0 page numbers
  const safePage = Math.max(1, pageNumber);
  const pairIndex = (safePage - 1) % POSITION_PAIRS.length;
  const currentPair = POSITION_PAIRS[pairIndex];

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-20"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      {/* Watermark 1 — Static on this page, shifts when pageNumber changes */}
      <div
        style={{
          position: 'absolute',
          top: currentPair[0].top,
          left: currentPair[0].left,
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '0.04em',
          color: isDarkBackground ? 'rgba(255, 255, 255, 0.13)' : 'rgba(15, 23, 42, 0.11)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 25,
          textShadow: isDarkBackground ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
          transition: 'all 0.25s ease-out',
        }}
      >
        {watermarkText}
      </div>

      {/* Watermark 2 — Static on this page, shifts when pageNumber changes */}
      <div
        style={{
          position: 'absolute',
          top: currentPair[1].top,
          left: currentPair[1].left,
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '0.04em',
          color: isDarkBackground ? 'rgba(255, 255, 255, 0.13)' : 'rgba(15, 23, 42, 0.11)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 25,
          textShadow: isDarkBackground ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
          transition: 'all 0.25s ease-out',
        }}
      >
        {watermarkText}
      </div>
    </div>
  );
};
