import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { parseSyllabusWorkbook, ParsedSyllabusResult } from '../utils/excelSyllabusParser';
import { CourseApi } from '../core/services';
import { UniversalDropdown } from '../components/UniversalDropdown';

interface MobileExcelSyllabusModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Array<{ id: string; name?: string; title?: string }>;
  defaultCourseId?: string;
  onSyncSuccess?: (courseId: string) => void;
  darkMode?: boolean;
}

export const MobileExcelSyllabusModal: React.FC<MobileExcelSyllabusModalProps> = ({
  isOpen,
  onClose,
  courses,
  defaultCourseId,
  onSyncSuccess,
  darkMode = false,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    defaultCourseId || courses[0]?.id || ''
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSyllabusResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const bgCard = darkMode ? '#1a1a2e' : '#ffffff';
  const textPrimary = darkMode ? '#ffffff' : '#111827';
  const textSecondary = darkMode ? '#9ca3af' : '#6b7280';
  const borderColor = darkMode ? 'rgba(139,0,0,0.35)' : '#e5e7eb';
  const inputBg = darkMode ? '#0f0f1a' : '#f9fafb';
  const themeRed = '#8B0000';

  useEffect(() => {
    if (defaultCourseId) {
      setSelectedCourseId(defaultCourseId);
    } else if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [defaultCourseId, courses]);

  const handleReset = () => {
    setFileName(null);
    setParsedData(null);
    setParseError(null);
    setSyncSuccess(null);
    setSyncError(null);
    setIsParsing(false);
    setIsSyncing(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const pickExcelFile = async () => {
    try {
      setParseError(null);
      setSyncError(null);
      setSyncSuccess(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const pickedName = asset.name || 'syllabus.xlsx';

      if (!pickedName.toLowerCase().endsWith('.xlsx') && !pickedName.toLowerCase().endsWith('.xls')) {
        setParseError('Please upload a valid Excel file (.xlsx or .xls)');
        return;
      }

      setIsParsing(true);
      setFileName(pickedName);

      let workbook: XLSX.WorkBook;

      // Universal read for Web and Native (Android/iOS)
      const readLegacyBase64 = async (uri: string) => {
        const fn = (FileSystemLegacy as any)?.readAsStringAsync || (FileSystemLegacy as any)?.default?.readAsStringAsync;
        if (typeof fn === 'function') {
          return await fn(uri, { encoding: 'base64' });
        }
        throw new Error('readAsStringAsync unavailable');
      };

      try {
        const base64 = await readLegacyBase64(asset.uri);
        workbook = XLSX.read(base64, { type: 'base64' });
      } catch (legacyErr) {
        const res = await fetch(asset.uri);
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf && arrayBuf.byteLength > 0) {
          workbook = XLSX.read(arrayBuf, { type: 'array' });
        } else {
          throw new Error('Unable to read selected Excel file.');
        }
      }

      const parsed = parseSyllabusWorkbook(workbook, pickedName);

      if (parsed.subjects.length === 0) {
        setParseError('No curriculum sheets matching Subject / Topic / Subtopic structure found in this file.');
        setParsedData(null);
      } else {
        setParsedData(parsed);
      }
    } catch (err: any) {
      console.error('[MobileExcelSyllabusModal] Excel parse error:', err);
      setParseError(err.message || 'Failed to read Excel file.');
      setParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSync = async () => {
    if (!selectedCourseId) {
      Alert.alert('Required', 'Please select a course to sync syllabus into.');
      return;
    }
    if (!parsedData || parsedData.subjects.length === 0) {
      Alert.alert('Required', 'Please select and parse an Excel syllabus file first.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const res = await CourseApi.syncSyllabus(selectedCourseId, {
        subjects: parsedData.subjects,
      });

      const count = res.data?.result?.length || parsedData.subjects.length;
      const successMsg = `Successfully synced ${count} Subjects, ${parsedData.stats.totalTopics} Topics, and ${parsedData.stats.totalSubtopics} Subtopics!`;
      setSyncSuccess(successMsg);

      if (onSyncSuccess) {
        onSyncSuccess(selectedCourseId);
      }

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error('[MobileExcelSyllabusModal] Sync error:', err);
      setSyncError(err.response?.data?.message || err.message || 'Failed to sync syllabus.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { backgroundColor: bgCard, borderColor }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.iconCircle, { backgroundColor: darkMode ? '#2d1517' : '#fee2e2' }]}>
                <Ionicons name="document-text-outline" size={18} color={themeRed} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: textPrimary }]}>Upload Syllabus Excel</Text>
                <Text style={{ fontSize: 13, color: textSecondary }}>Auto-sync subjects, topics & subtopics</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 14, paddingVertical: 12 }}>
            {/* Target Course Selector */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.sectionLabel, { color: textSecondary }]}>Target Course</Text>
              <UniversalDropdown
                value={selectedCourseId}
                options={courses.map((c) => ({
                  label: c.name || c.title || 'Course',
                  value: c.id
                }))}
                onSelect={(val) => setSelectedCourseId(val)}
                placeholder="-- Select Target Course --"
                darkMode={darkMode}
                themeColor={themeRed}
                iconName="school-outline"
              />
            </View>

            {/* File Picker Section */}
            <View style={[styles.uploadBox, { backgroundColor: inputBg, borderColor }]}>
              <Ionicons name="cloud-upload-outline" size={32} color={themeRed} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary, marginTop: 6 }}>
                {fileName ? fileName : 'Choose Excel Worksheet (.xlsx, .xls)'}
              </Text>
              <Text style={{ fontSize: 13, color: textSecondary, textAlign: 'center', marginTop: 2, paddingHorizontal: 14 }}>
                Each sheet will be converted into a Subject, with its Topic & Subtopic hierarchy.
              </Text>

              <TouchableOpacity
                onPress={pickExcelFile}
                disabled={isParsing || isSyncing}
                style={[styles.pickBtn, { backgroundColor: themeRed, marginTop: 10 }]}
              >
                {isParsing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="folder-open-outline" size={15} color="#fff" />
                    <Text style={styles.pickBtnText}>{fileName ? 'Change File' : 'Browse File'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {parseError && (
              <View style={[styles.alertBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={{ fontSize: 13, color: '#dc2626', flex: 1 }}>{parseError}</Text>
              </View>
            )}

            {/* Sync Error */}
            {syncError && (
              <View style={[styles.alertBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={{ fontSize: 13, color: '#dc2626', flex: 1 }}>{syncError}</Text>
              </View>
            )}

            {/* Sync Success */}
            {syncSuccess && (
              <View style={[styles.alertBox, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text style={{ fontSize: 13, color: '#16a34a', flex: 1, fontWeight: '700' }}>{syncSuccess}</Text>
              </View>
            )}

            {/* Parsed Summary Preview */}
            {parsedData && (
              <View style={[styles.previewCard, { backgroundColor: inputBg, borderColor }]}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: textPrimary }}>Curriculum Preview</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <View style={[styles.statBadge, { backgroundColor: darkMode ? '#1a2a3a' : '#e0f2fe' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0284c7' }}>
                      {parsedData.stats.totalSubjects} Subjects
                    </Text>
                  </View>
                  <View style={[styles.statBadge, { backgroundColor: darkMode ? '#1c3320' : '#dcfce7' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#16a34a' }}>
                      {parsedData.stats.totalTopics} Topics
                    </Text>
                  </View>
                  <View style={[styles.statBadge, { backgroundColor: darkMode ? '#33201a' : '#ffedd5' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#ea580c' }}>
                      {parsedData.stats.totalSubtopics} Subtopics
                    </Text>
                  </View>
                </View>

                {/* Subject list snippet */}
                <View style={{ marginTop: 10, gap: 4 }}>
                  {parsedData.subjects.slice(0, 5).map((subj, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="book-outline" size={12} color={themeRed} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary, flex: 1 }}>
                        {subj.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: textSecondary }}>
                        {subj.topics.length} topics
                      </Text>
                    </View>
                  ))}
                  {parsedData.subjects.length > 5 && (
                    <Text style={{ fontSize: 12, color: textSecondary, fontStyle: 'italic', marginTop: 2 }}>
                      + {parsedData.subjects.length - 5} more subjects...
                    </Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={handleClose} style={[styles.cancelBtn, { borderColor }]}>
              <Text style={[styles.cancelBtnText, { color: textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSync}
              disabled={isSyncing || !parsedData}
              style={[
                styles.syncBtn,
                {
                  backgroundColor: !parsedData ? '#9ca3af' : themeRed,
                  opacity: isSyncing || !parsedData ? 0.7 : 1,
                },
              ]}
            >
              {isSyncing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={15} color="#fff" />
                  <Text style={styles.syncBtnText}>Sync Curriculum</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.15)',
    paddingBottom: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  uploadBox: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pickBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  statBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  cancelBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  syncBtn: {
    flex: 1.5,
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
