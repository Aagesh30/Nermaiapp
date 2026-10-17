import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { parseStudentUploadFromBase64, parseStudentUploadFile, ParsedStudentUploadResult, ParsedStudentRow } from '../utils/excelStudentParser';
import api from '../core/api';

interface MobileBulkStudentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  batches: Array<{ id: string; batchName: string; course?: string }>;
  onSuccess?: () => void;
  darkMode?: boolean;
}

export const MobileBulkStudentUploadModal: React.FC<MobileBulkStudentUploadModalProps> = ({
  isOpen,
  onClose,
  batches,
  onSuccess,
  darkMode = false,
}) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedStudentUploadResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'valid' | 'invalid'>('all');

  const [isRegistering, setIsRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    skipped?: string[];
    errors?: string[];
  } | null>(null);

  const bgCard = darkMode ? '#181824' : '#ffffff';
  const textPrimary = darkMode ? '#ffffff' : '#111827';
  const textSecondary = darkMode ? '#9ca3af' : '#6b7280';
  const borderColor = darkMode ? '#2d2d3f' : '#e5e7eb';
  const inputBg = darkMode ? '#12121c' : '#f9fafb';
  const themeRed = '#8B0000';

  const handleReset = () => {
    setFileName(null);
    setParsedData(null);
    setParseError(null);
    setRegisterResult(null);
    setSearchQuery('');
    setFilterType('all');
    setIsParsing(false);
    setIsRegistering(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const pickExcelFile = async () => {
    try {
      setParseError(null);
      setRegisterResult(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const pickedName = asset.name || 'students.xlsx';

      if (
        !pickedName.toLowerCase().endsWith('.xlsx') &&
        !pickedName.toLowerCase().endsWith('.xls') &&
        !pickedName.toLowerCase().endsWith('.csv')
      ) {
        setParseError('Please upload a valid Excel workbook (.xlsx or .xls)');
        return;
      }

      setIsParsing(true);
      setFileName(pickedName);

      let parsed: ParsedStudentUploadResult;

      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        const fileObj = new File([blob], pickedName, { type: blob.type });
        parsed = await parseStudentUploadFile(fileObj, batches);
      } else {
        let base64 = '';
        try {
          if (FileSystemLegacy && typeof FileSystemLegacy.readAsStringAsync === 'function') {
            base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, {
              encoding: FileSystemLegacy.EncodingType.Base64,
            });
          } else {
            throw new Error('legacy readAsStringAsync unavailable');
          }
        } catch (legacyErr) {
          try {
            const fsFile = new (FileSystem as any).File(asset.uri);
            if (typeof fsFile.base64 === 'function') {
              base64 = await fsFile.base64();
            } else {
              throw new Error('File.base64 unavailable');
            }
          } catch {
            base64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
            });
          }
        }
        parsed = parseStudentUploadFromBase64(base64, pickedName, batches);
      }

      if (!parsed.students || parsed.students.length === 0) {
        setParseError('No student rows found in the uploaded file.');
        setParsedData(null);
      } else {
        setParsedData(parsed);
      }
    } catch (err: any) {
      console.error('[MobileBulkStudentUploadModal] Parse error:', err);
      setParseError(err.message || 'Failed to read or parse Excel file.');
      setParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!parsedData) return [];
    let list = parsedData.students;

    if (filterType === 'valid') {
      list = list.filter((s) => s.isValid);
    } else if (filterType === 'invalid') {
      list = list.filter((s) => !s.isValid);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.loginUsername && s.loginUsername.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q)) ||
          (s.batch && s.batch.toLowerCase().includes(q))
      );
    }

    return list;
  }, [parsedData, searchQuery, filterType]);

  const handleRegisterAll = async () => {
    if (!parsedData || parsedData.students.length === 0) return;

    const validStudents = parsedData.students.filter((s) => s.isValid);
    if (validStudents.length === 0) {
      Alert.alert('No Valid Rows', 'No valid student rows found to register. Please check the validation warnings.');
      return;
    }

    setIsRegistering(true);
    setRegisterResult(null);

    try {
      const payload = validStudents.map((s) => ({
        firstName: s.firstName,
        name: s.name,
        loginUsername: s.loginUsername,
        rollNumber: s.rollNumber,
        phone: s.phone,
        email: s.email || '',
        loginPassword: s.password,
        batches: s.batches,
        batchModes: s.batchModes,
        batch: s.batch,
        course: s.course || '',
        type: s.type,
        totalFees: s.totalFees,
        feesPaid: s.feesPaid,
        courseDuration: s.courseDuration,
        joiningDate: s.joiningDate,
        modeOfPayment: s.modeOfPayment,
        transactionId: s.transactionId || '',
      }));

      const res = await api.post('/erp/student/bulk', { students: payload });

      setRegisterResult({
        success: true,
        message: res.data?.message || `Successfully registered ${res.data?.count || validStudents.length} students!`,
        count: res.data?.count,
        skipped: res.data?.skipped || [],
        errors: res.data?.errors || [],
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('[MobileBulkStudentUploadModal] Register error:', err);
      setRegisterResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to complete bulk student registration.',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
        <View
          style={{
            backgroundColor: bgCard,
            width: '100%',
            maxWidth: 620,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            overflow: 'hidden',
            maxHeight: '90%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: borderColor,
              backgroundColor: darkMode ? '#151520' : '#f9fafb',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: darkMode ? '#3b1c1c' : '#fef2f2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="people" size={20} color="#b91c1c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }} numberOfLines={1}>
                  Bulk Student Upload (Excel)
                </Text>
                <Text style={{ fontSize: 11, color: textSecondary }} numberOfLines={1}>
                  Auto-detects columns, generates passwords & enrols into batches
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: darkMode ? '#26263a' : '#f3f4f6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
            {/* File Pick Area (When no data yet) */}
            {!parsedData && (
              <View
                style={{
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: darkMode ? '#4a2525' : '#fca5a5',
                  backgroundColor: darkMode ? '#1c151b' : '#fffafb',
                  borderRadius: 14,
                  padding: 20,
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: darkMode ? '#4a1515' : '#fee2e2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="document-text" size={28} color="#b91c1c" />
                </View>

                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary, textAlign: 'center' }}>
                    Select Student Roster Excel (.xlsx, .xls)
                  </Text>
                  <Text style={{ fontSize: 11, color: textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 10 }}>
                    Supports any column order: Name, Roll Number, Batches, Fees (Total & Paid), Duration, Joining Date, Phone & Payment Mode.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={pickExcelFile}
                  disabled={isParsing}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: themeRed,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 10,
                    marginTop: 6,
                  }}
                >
                  {isParsing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="folder-open-outline" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Choose Excel File</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: darkMode ? '#162238' : '#eff6ff',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                >
                  <Ionicons name="sparkles" size={13} color="#2563eb" />
                  <Text style={{ fontSize: 11, color: darkMode ? '#93c5fd' : '#1d4ed8', fontWeight: '600' }}>
                    Auto-creates Password: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' }}>Username + Phone Last 4</Text>
                  </Text>
                </View>
              </View>
            )}

            {/* Error Banner */}
            {parseError && (
              <View
                style={{
                  backgroundColor: darkMode ? '#3b1c1c' : '#fef2f2',
                  borderWidth: 1,
                  borderColor: darkMode ? '#7f1d1d' : '#fecaca',
                  borderRadius: 10,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Ionicons name="alert-circle" size={18} color="#dc2626" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626' }}>Excel Parsing Failed</Text>
                  <Text style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{parseError}</Text>
                </View>
              </View>
            )}

            {/* Registration Result Banner */}
            {registerResult && (
              <View
                style={{
                  backgroundColor: registerResult.success ? (darkMode ? '#132e1e' : '#f0fdf4') : (darkMode ? '#3b1c1c' : '#fef2f2'),
                  borderWidth: 1,
                  borderColor: registerResult.success ? (darkMode ? '#166534' : '#bbf7d0') : (darkMode ? '#7f1d1d' : '#fecaca'),
                  borderRadius: 10,
                  padding: 12,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name={registerResult.success ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={registerResult.success ? '#16a34a' : '#dc2626'}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: registerResult.success ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {registerResult.success ? 'Registration Succeeded' : 'Registration Failed'}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: textPrimary, paddingLeft: 26 }}>{registerResult.message}</Text>
                {registerResult.skipped && registerResult.skipped.length > 0 && (
                  <Text style={{ fontSize: 11, color: '#d97706', paddingLeft: 26, marginTop: 4 }}>
                    Skipped (Already registered): {registerResult.skipped.join(', ')}
                  </Text>
                )}
              </View>
            )}

            {/* Parsed Roster View */}
            {parsedData && (
              <View style={{ gap: 12 }}>
                {/* Stats Bar & File Change */}
                <View
                  style={{
                    backgroundColor: darkMode ? '#1e1e2d' : '#f8fafc',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor,
                    padding: 12,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Ionicons name="document-attach" size={16} color="#16a34a" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary }} numberOfLines={1}>
                        {fileName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={pickExcelFile}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: darkMode ? '#2d2d42' : '#e2e8f0',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: textPrimary }}>Change File</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <View
                      style={{
                        flex: 1,
                        minWidth: 80,
                        backgroundColor: darkMode ? '#141420' : '#ffffff',
                        padding: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 10, color: textSecondary, fontWeight: '600' }}>TOTAL ROWS</Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary, marginTop: 2 }}>
                        {parsedData.stats.totalRows}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        minWidth: 80,
                        backgroundColor: darkMode ? '#14271d' : '#ecfdf5',
                        padding: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: darkMode ? '#166534' : '#a7f3d0',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '700' }}>VALID</Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#16a34a', marginTop: 2 }}>
                        {parsedData.stats.validCount}
                      </Text>
                    </View>

                    {parsedData.stats.invalidCount > 0 && (
                      <View
                        style={{
                          flex: 1,
                          minWidth: 80,
                          backgroundColor: darkMode ? '#322312' : '#fffbeb',
                          padding: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: darkMode ? '#92400e' : '#fde68a',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 10, color: '#d97706', fontWeight: '700' }}>WARNINGS</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#d97706', marginTop: 2 }}>
                          {parsedData.stats.invalidCount}
                        </Text>
                      </View>
                    )}

                    <View
                      style={{
                        flex: 1,
                        minWidth: 110,
                        backgroundColor: darkMode ? '#141420' : '#ffffff',
                        padding: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 10, color: textSecondary, fontWeight: '600' }}>TOTAL FEES</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#16a34a', marginTop: 2 }}>
                        ₹{parsedData.stats.totalPaidSum.toLocaleString()} / ₹{parsedData.stats.totalFeesSum.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Filter and Search */}
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: inputBg,
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      height: 36,
                      gap: 6,
                    }}
                  >
                    <Ionicons name="search" size={14} color={textSecondary} />
                    <TextInput
                      placeholder="Search name, roll, phone..."
                      placeholderTextColor={textSecondary}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      style={{ flex: 1, fontSize: 12, color: textPrimary, padding: 0 }}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => setFilterType('all')}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: filterType === 'all' ? themeRed : (darkMode ? '#222234' : '#f1f5f9'),
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: filterType === 'all' ? '#fff' : textSecondary }}>
                        All ({parsedData.students.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setFilterType('valid')}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: filterType === 'valid' ? '#16a34a' : (darkMode ? '#14271d' : '#ecfdf5'),
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: filterType === 'valid' ? '#fff' : '#16a34a' }}>
                        Valid ({parsedData.stats.validCount})
                      </Text>
                    </TouchableOpacity>

                    {parsedData.stats.invalidCount > 0 && (
                      <TouchableOpacity
                        onPress={() => setFilterType('invalid')}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderRadius: 6,
                          backgroundColor: filterType === 'invalid' ? '#d97706' : (darkMode ? '#322312' : '#fffbeb'),
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: filterType === 'invalid' ? '#fff' : '#d97706' }}>
                          Warnings ({parsedData.stats.invalidCount})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Students List Cards */}
                <View style={{ gap: 8 }}>
                  {filteredStudents.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: textSecondary, fontSize: 12, paddingVertical: 14 }}>
                      No students match the current filter.
                    </Text>
                  ) : (
                    filteredStudents.map((s, idx) => (
                      <View
                        key={idx}
                        style={{
                          backgroundColor: darkMode ? '#1c1c28' : '#ffffff',
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: !s.isValid ? (darkMode ? '#78350f' : '#fde68a') : borderColor,
                          padding: 10,
                          gap: 6,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: textPrimary }} numberOfLines={1}>
                              {s.rowIndex}. {s.name || 'Unnamed Student'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: '700', marginTop: 1 }}>
                              Roll: {s.loginUsername || '-'} • Phone: {s.phone || '-'}
                            </Text>
                          </View>

                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              backgroundColor: s.isValid ? (darkMode ? '#14271d' : '#ecfdf5') : (darkMode ? '#322312' : '#fffbeb'),
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: s.isValid ? '#16a34a' : '#d97706' }}>
                              {s.isValid ? '✓ Ready' : '⚠ Warning'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                          <View style={{ backgroundColor: darkMode ? '#262638' : '#f1f5f9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 }}>
                            <Text style={{ fontSize: 10, color: textSecondary }}>
                              Batch: <Text style={{ fontWeight: '700', color: textPrimary }}>{s.batch || '-'}</Text> ({s.type})
                            </Text>
                          </View>

                          <View style={{ backgroundColor: darkMode ? '#262638' : '#f1f5f9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 }}>
                            <Text style={{ fontSize: 10, color: textSecondary }}>
                              Paid: <Text style={{ fontWeight: '800', color: '#16a34a' }}>₹{s.feesPaid.toLocaleString()}</Text> / ₹{s.totalFees.toLocaleString()}
                              {s.dueFees > 0 ? (
                                <Text style={{ color: '#d97706', fontWeight: '700' }}> (Due: ₹{s.dueFees.toLocaleString()})</Text>
                              ) : (
                                <Text style={{ color: '#16a34a', fontWeight: '700' }}> (Cleared)</Text>
                              )}
                            </Text>
                          </View>

                          <View style={{ backgroundColor: darkMode ? '#262638' : '#f1f5f9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 }}>
                            <Text style={{ fontSize: 10, color: textSecondary }}>
                              Pwd: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700', color: textPrimary }}>{s.password}</Text>
                            </Text>
                          </View>
                        </View>

                        {!s.isValid && s.validationErrors && s.validationErrors.length > 0 && (
                          <Text style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>
                            Note: {s.validationErrors.join(' • ')}
                          </Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: borderColor,
              backgroundColor: darkMode ? '#151520' : '#f9fafb',
            }}
          >
            <TouchableOpacity
              onPress={handleClose}
              disabled={isRegistering}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: darkMode ? '#26263a' : '#e5e7eb',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary }}>
                {registerResult?.success ? 'Close' : 'Cancel'}
              </Text>
            </TouchableOpacity>

            {parsedData && !registerResult?.success && (
              <TouchableOpacity
                onPress={handleRegisterAll}
                disabled={isRegistering || parsedData.stats.validCount === 0}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: parsedData.stats.validCount > 0 ? themeRed : '#9ca3af',
                }}
              >
                {isRegistering ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={15} color="#fff" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                      Register All ({parsedData.stats.validCount})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
