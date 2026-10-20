import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface UniversalDropdownOption {
  label: string;
  value: string;
  count?: number | string;
  disabled?: boolean;
}

export interface UniversalDropdownProps {
  value: string;
  options: UniversalDropdownOption[];
  onSelect: (val: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  darkMode?: boolean;
  style?: any;
  themeColor?: string;
  iconName?: any;
}

export const UniversalDropdown: React.FC<UniversalDropdownProps> = ({
  value,
  options,
  onSelect,
  placeholder = '-- Select --',
  label,
  disabled = false,
  darkMode = false,
  style,
  themeColor = '#8B0000',
  iconName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => String(o.value) === String(value));

  const bgInput = darkMode ? '#222230' : '#ffffff';
  const textPrimary = darkMode ? '#ffffff' : '#1e293b';
  const textSecondary = darkMode ? '#94a3b8' : '#64748b';
  const borderCol = darkMode ? '#3b3b4f' : '#cbd5e1';

  if (Platform.OS === 'web') {
    return (
      <View style={[{ width: '100%' }, style]}>
        {label ? (
          <Text style={{ fontSize: 11, fontWeight: '700', color: textSecondary, marginBottom: 4 }}>
            {label}
          </Text>
        ) : null}
        <div style={{ position: 'relative', width: '100%' }}>
          <select
            disabled={disabled}
            value={value}
            onChange={(e: any) => onSelect(e.target.value)}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 8,
              paddingLeft: iconName ? 34 : 12,
              paddingRight: 32,
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: bgInput,
              color: textPrimary,
              border: `1px solid ${borderCol}`,
              outline: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              appearance: 'none',
              WebkitAppearance: 'none'
            }}
          >
            {placeholder && !options.some((o) => o.value === '') ? (
              <option value="">{placeholder}</option>
            ) : null}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label} {opt.count !== undefined ? `(${opt.count})` : ''}
              </option>
            ))}
          </select>
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: textSecondary
            }}
          >
            ▼
          </div>
        </div>
      </View>
    );
  }

  return (
    <View style={[{ width: '100%' }, style]}>
      {label ? (
        <Text style={{ fontSize: 11, fontWeight: '700', color: textSecondary, marginBottom: 4 }}>
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        disabled={disabled}
        activeOpacity={0.7}
        onPress={() => setIsOpen(true)}
        style={[
          styles.triggerBtn,
          {
            backgroundColor: bgInput,
            borderColor: isOpen ? themeColor : borderCol,
            opacity: disabled ? 0.6 : 1
          }
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
          {iconName ? (
            <Ionicons name={iconName} size={16} color={selectedOption ? themeColor : textSecondary} />
          ) : null}
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: selectedOption ? '600' : '500',
              color: selectedOption ? textPrimary : textSecondary,
              flex: 1
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
          {selectedOption && selectedOption.count !== undefined ? (
            <View
              style={{
                backgroundColor: darkMode ? '#3b3b4f' : '#f1f5f9',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 12
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: themeColor }}>
                {selectedOption.count}
              </Text>
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-down" size={16} color={textSecondary} />
      </TouchableOpacity>

      {isOpen && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
            style={styles.modalOverlay}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.modalCard,
                {
                  backgroundColor: darkMode ? '#181824' : '#ffffff',
                  borderColor: darkMode ? '#2e2e42' : '#e2e8f0'
                }
              ]}
            >
              {/* Header */}
              <View
                style={[
                  styles.modalHeader,
                  {
                    backgroundColor: darkMode ? '#12121b' : '#f8fafc',
                    borderBottomColor: darkMode ? '#2e2e42' : '#e2e8f0'
                  }
                ]}
              >
                <Text style={[styles.modalTitle, { color: textPrimary }]}>
                  {label || placeholder || 'Select Option'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsOpen(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Options List */}
              <ScrollView
                style={{ maxHeight: 360 }}
                contentContainerStyle={{ paddingVertical: 4 }}
                showsVerticalScrollIndicator={true}
              >
                {placeholder && !options.some((o) => o.value === '') && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelect('');
                      setIsOpen(false);
                    }}
                    style={[
                      styles.optionRow,
                      {
                        borderBottomColor: darkMode ? '#222232' : '#f1f5f9',
                        backgroundColor: value === '' ? (darkMode ? '#2c1e28' : '#fef2f2') : 'transparent'
                      }
                    ]}
                  >
                    <Text style={{ fontSize: 13, color: textSecondary, fontStyle: 'italic' }}>
                      {placeholder}
                    </Text>
                    {value === '' && (
                      <Ionicons name="checkmark-circle" size={18} color={themeColor} />
                    )}
                  </TouchableOpacity>
                )}

                {options.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      disabled={opt.disabled}
                      activeOpacity={0.7}
                      onPress={() => {
                        onSelect(opt.value);
                        setIsOpen(false);
                      }}
                      style={[
                        styles.optionRow,
                        {
                          borderBottomColor: darkMode ? '#222232' : '#f1f5f9',
                          backgroundColor: isSelected
                            ? (darkMode ? '#2c1e28' : '#fef2f2')
                            : 'transparent'
                        }
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? themeColor : textPrimary,
                            flex: 1
                          }}
                        >
                          {opt.label}
                        </Text>
                        {opt.count !== undefined && (
                          <View
                            style={{
                              backgroundColor: isSelected ? themeColor : (darkMode ? '#2e2e42' : '#e2e8f0'),
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 12
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: isSelected ? '#ffffff' : textSecondary
                              }}
                            >
                              {opt.count}
                            </Text>
                          </View>
                        )}
                      </View>

                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={18} color={themeColor} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  triggerBtn: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  }
});
