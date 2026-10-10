import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export interface UniversalTime12PickerProps {
  value: string; // 24-hour time format e.g. "10:00" or "22:30"
  onChange: (val24: string) => void;
  darkMode?: boolean;
  style?: any;
}

/**
 * Splits a 24-hour time string ("HH:mm") into 12-hour components ("hh:mm", "AM"|"PM").
 */
function parse24To12(val24?: string): { time12: string; period: 'AM' | 'PM' } {
  if (!val24 || typeof val24 !== 'string') {
    return { time12: '10:00', period: 'AM' };
  }
  const parts = val24.split(':');
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (isNaN(h)) h = 10;
  if (isNaN(m)) m = 0;

  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  const time12 = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { time12, period };
}

/**
 * Converts 12-hour components ("hh:mm", "AM"|"PM") back into 24-hour string ("HH:mm").
 */
function convert12To24(time12Str: string, period: 'AM' | 'PM'): string {
  const cleaned = time12Str.replace(/[^0-9:]/g, '');
  let h = 10;
  let m = 0;

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    h = parseInt(parts[0], 10);
    m = parts.length > 1 && parts[1] ? parseInt(parts[1], 10) : 0;
  } else if (cleaned.length === 3) {
    // e.g. "730" -> 7:30
    h = parseInt(cleaned.slice(0, 1), 10);
    m = parseInt(cleaned.slice(1), 10);
  } else if (cleaned.length === 4) {
    // e.g. "1030" -> 10:30
    h = parseInt(cleaned.slice(0, 2), 10);
    m = parseInt(cleaned.slice(2), 10);
  } else if (cleaned.length > 0) {
    // e.g. "7" -> 7:00
    h = parseInt(cleaned, 10);
    m = 0;
  }

  if (isNaN(h)) h = 12;
  if (isNaN(m)) m = 0;

  // Clamp within 12-hour bounds
  h = Math.min(Math.max(h, 1), 12);
  m = Math.min(Math.max(m, 0), 59);

  let h24 = h;
  if (period === 'AM') {
    h24 = h === 12 ? 0 : h;
  } else {
    h24 = h === 12 ? 12 : h + 12;
  }

  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const UniversalTime12Picker: React.FC<UniversalTime12PickerProps> = ({
  value,
  onChange,
  darkMode = false,
  style,
}) => {
  const parsed = parse24To12(value);
  const [displayTime, setDisplayTime] = useState<string>(parsed.time12);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);

  // Sync if value changes externally (e.g. form reset or modal opened for edit)
  useEffect(() => {
    const nextParsed = parse24To12(value);
    const currentComputed24 = convert12To24(displayTime, period);
    if (value && value !== currentComputed24) {
      setDisplayTime(nextParsed.time12);
      setPeriod(nextParsed.period);
    }
  }, [value]);

  const handleTextChange = (text: string) => {
    setDisplayTime(text);

    // Auto-compute 24-hr if user entered full hour:minute
    if (text.includes(':') || text.length >= 3) {
      const next24 = convert12To24(text, period);
      onChange(next24);
    }
  };

  const handleBlur = () => {
    // Format nicely on blur (e.g. "9:5" -> "09:05")
    const next24 = convert12To24(displayTime, period);
    const reformatted = parse24To12(next24);
    setDisplayTime(reformatted.time12);
    onChange(next24);
  };

  const handlePeriodToggle = (newPeriod: 'AM' | 'PM') => {
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    const next24 = convert12To24(displayTime, newPeriod);
    onChange(next24);
  };

  const activeColor = '#8B0000';
  const borderColor = darkMode ? '#444' : '#ccc';
  const inputBg = darkMode ? '#2a2a2a' : '#fff';
  const inactiveBg = darkMode ? '#222' : '#f3f4f6';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  const inactiveText = darkMode ? '#888' : '#666';

  return (
    <View style={[styles.container, style]}>
      {/* 12-Hour Time TextInput */}
      <TextInput
        style={[
          styles.timeInput,
          {
            backgroundColor: inputBg,
            borderColor,
            color: textColor,
          },
        ]}
        placeholder="10:00"
        placeholderTextColor={inactiveText}
        value={displayTime}
        onChangeText={handleTextChange}
        onBlur={handleBlur}
        keyboardType="default"
        maxLength={5}
      />

      {/* AM / PM Segmented Control */}
      <View style={[styles.toggleContainer, { borderColor }]}>
        <TouchableOpacity
          onPress={() => handlePeriodToggle('AM')}
          activeOpacity={0.7}
          style={[
            styles.toggleBtn,
            {
              backgroundColor: period === 'AM' ? activeColor : inactiveBg,
            },
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color: period === 'AM' ? '#fff' : inactiveText,
                fontWeight: period === 'AM' ? '800' : '600',
              },
            ]}
          >
            AM
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handlePeriodToggle('PM')}
          activeOpacity={0.7}
          style={[
            styles.toggleBtn,
            {
              backgroundColor: period === 'PM' ? activeColor : inactiveBg,
              borderLeftWidth: 1,
              borderLeftColor: borderColor,
            },
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color: period === 'PM' ? '#fff' : inactiveText,
                fontWeight: period === 'PM' ? '800' : '600',
              },
            ]}
          >
            PM
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    width: '100%',
  },
  timeInput: {
    flex: 1,
    minWidth: 72,
    maxWidth: 110,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    flexShrink: 0,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    minWidth: 32,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  toggleText: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
