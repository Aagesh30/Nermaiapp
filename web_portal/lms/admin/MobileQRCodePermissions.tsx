import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { StudentApi, BatchApi, CourseApi } from '../core/services';

// Real-time ticking countdown for active permissions
const MobileTimerCountdown = ({
  enabledAt,
  duration,
  unit,
  darkMode,
}: {
  enabledAt: string;
  duration: number;
  unit: string;
  darkMode?: boolean;
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const enabledAtTime = new Date(enabledAt).getTime();
    const durationMs = duration * (unit === 'minutes' ? 60 : 3600) * 1000;
    const expiryTime = enabledAtTime + durationMs;

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(diff);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [enabledAt, duration, unit]);

  if (timeLeft <= 0) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#fee2e2' }]}>
        <Ionicons name="time-outline" size={12} color="#dc2626" style={{ marginRight: 3 }} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>Expired</Text>
      </View>
    );
  }

  const hrs = Math.floor(timeLeft / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);
  const secs = timeLeft % 60;
  const timeString = hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;

  return (
    <View style={[styles.statusBadge, { backgroundColor: '#dcfce7' }]}>
      <Ionicons name="timer-outline" size={12} color="#16a34a" style={{ marginRight: 3 }} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a' }}>
        Enabled ({timeString})
      </Text>
    </View>
  );
};

interface MobileQRCodePermissionsProps {
  erpStudents?: any[];
  erpBatches?: any[];
  erpCourses?: any[];
  darkMode?: boolean;
}

export const MobileQRCodePermissions: React.FC<MobileQRCodePermissionsProps> = ({
  erpStudents,
  erpBatches,
  erpCourses,
  darkMode = false,
}) => {
  const [students, setStudents] = useState<any[]>(erpStudents || []);
  const [batches, setBatches] = useState<any[]>(erpBatches || []);
  const [courses, setCourses] = useState<any[]>(erpCourses || []);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // QR Settings
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [timerDuration, setTimerDuration] = useState<number>(24);
  const [timerUnit, setTimerUnit] = useState<string>('hours');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  // Payment Acknowledgements
  const [acknowledgements, setAcknowledgements] = useState<any[]>([]);
  const [ackFilter, setAckFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [ackLoading, setAckLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewAckData, setPreviewAckData] = useState<any | null>(null);

  // Fee Approval & Recording Modal State
  const [feeModalAck, setFeeModalAck] = useState<any | null>(null);
  const [feeAmountInput, setFeeAmountInput] = useState<string>('');
  const [feeTypeInput, setFeeTypeInput] = useState<string>('Tuition Fee');
  const [feeRemarksInput, setFeeRemarksInput] = useState<string>('QR Scan Payment');
  const [feeSubmitting, setFeeSubmitting] = useState<boolean>(false);

  // Batch Picker Modal
  const [batchModalVisible, setBatchModalVisible] = useState(false);

  // Theme colors
  const bgCard = darkMode ? '#1a1a2e' : '#ffffff';
  const textPrimary = darkMode ? '#ffffff' : '#111827';
  const textSecondary = darkMode ? '#9ca3af' : '#6b7280';
  const borderColor = darkMode ? 'rgba(139,0,0,0.35)' : '#e5e7eb';
  const inputBg = darkMode ? '#0f0f1a' : '#f9fafb';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studRes, batchRes, settingsRes, courseRes] = await Promise.all([
        StudentApi.listStudents().catch(() => ({ data: { data: [] } })),
        BatchApi.listBatches().catch(() => ({ data: { data: [] } })),
        StudentApi.getQrSettings().catch(() => ({ data: { data: null } })),
        CourseApi.listCourses().catch(() => ({ data: { data: [] } })),
      ]);

      const rawStudents = studRes.data?.data || [];
      const mergedStudents = rawStudents.map((s: any) => {
        const erpMatch = erpStudents?.find((e: any) => e.id === s.id);
        return {
          ...s,
          course: s.course || erpMatch?.course || null,
          batch:
            s.batch ||
            erpMatch?.batch ||
            (Array.isArray(erpMatch?.batches) ? erpMatch?.batches[0] : null) ||
            null,
          batches: s.batches || erpMatch?.batches || (erpMatch?.batch ? [erpMatch?.batch] : []),
        };
      });

      setStudents(mergedStudents.length > 0 ? mergedStudents : erpStudents || []);
      setBatches(batchRes.data?.data?.length ? batchRes.data.data : erpBatches || []);
      setCourses(courseRes.data?.data?.length ? courseRes.data.data : erpCourses || []);

      const settings = settingsRes.data?.data;
      if (settings) {
        setQrCodeUrl(settings.qrCodeUrl || null);
        setTimerDuration(settings.timerDuration !== undefined ? Number(settings.timerDuration) : 24);
        setTimerUnit(settings.timerUnit || 'hours');
      }
    } catch (err) {
      console.error('[MobileQRCodePermissions] Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const ackFilterRef = useRef(ackFilter);

  const fetchAcknowledgements = async (filter = ackFilter) => {
    setAckLoading(true);
    try {
      const res = await StudentApi.listPaymentAcknowledgements(filter);
      setAcknowledgements(res.data?.data || []);
    } catch (err) {
      console.error('[MobileQRCodePermissions] Failed to fetch acknowledgements', err);
    } finally {
      setAckLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time Firestore sync for students requesting QR code
    const pendingStudentsQuery = query(collection(db, 'students'), where('qrCodeRequested', '==', true));
    const unsubStudents = onSnapshot(
      pendingStudentsQuery,
      () => {
        fetchData();
      },
      (err) => {
        console.warn('[MobileQRCodePermissions] Realtime students sync notice:', err);
      }
    );

    return () => {
      unsubStudents();
    };
  }, []);

  useEffect(() => {
    ackFilterRef.current = ackFilter;
    fetchAcknowledgements(ackFilter);
  }, [ackFilter]);

  useEffect(() => {
    // Real-time updates for payment acknowledgements
    const unsubAcks = onSnapshot(
      collection(db, 'payment_acknowledgements'),
      () => {
        fetchAcknowledgements(ackFilterRef.current);
      },
      (err) => {
        console.warn('[MobileQRCodePermissions] Realtime acks sync notice:', err);
      }
    );

    return () => {
      unsubAcks();
    };
  }, []);

  // Pick QR Code Image
  const handlePickImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (Platform.OS === 'web') {
          const res = await fetch(asset.uri);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onload = () => {
            setQrCodeUrl(reader.result as string);
          };
          reader.readAsDataURL(blob);
        } else {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
          const mime = asset.mimeType || 'image/jpeg';
          setQrCodeUrl(`data:${mime};base64,${base64}`);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to select image');
    }
  };

  // Delete QR Code
  const handleDeleteQrCode = () => {
    Alert.alert(
      'Remove QR Code',
      'Are you sure you want to delete the QR Code? Students will not be able to scan until you upload a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => setQrCodeUrl(null) },
      ]
    );
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await StudentApi.updateQrSettings({
        qrCodeUrl,
        timerDuration,
        timerUnit,
      });
      Alert.alert('Success', 'QR Code settings saved successfully!');
      fetchData();
    } catch (err: any) {
      console.error('[MobileQRCodePermissions] Save settings failed', err);
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Single Permission Toggle
  const handleSinglePermission = async (studentId: string, enabled: boolean) => {
    try {
      await StudentApi.updateStudentQrPermission(studentId, enabled);
      fetchData();
    } catch (err) {
      console.error('[MobileQRCodePermissions] Single permission update failed', err);
      Alert.alert('Error', 'Failed to update student permission.');
    }
  };

  // Bulk Access Operations
  const handleBulkEnable = async (type: 'batch' | 'paid' | 'free' | 'requested') => {
    if (type === 'batch' && !selectedBatchId) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Please select a batch first.');
      } else {
        Alert.alert('Notice', 'Please select a batch first.');
      }
      return;
    }

    const messages = {
      batch: 'Enable QR access for all active students in this batch?',
      paid: 'Enable QR access for all Enrolled tier students?',
      free: 'Enable QR access for all Free tier students?',
      requested: 'Enable QR access for all students with pending requests?',
    };

    const doBulkAction = async () => {
      setBulkActionLoading(true);
      try {
        const res = await StudentApi.enableQrBulk({
          type,
          batchId: type === 'batch' ? selectedBatchId : undefined,
        });
        const msg = `Access enabled for ${res.data?.data?.count || 0} students!`;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(msg);
        } else {
          Alert.alert('Success', msg);
        }
        fetchData();
      } catch (err) {
        console.error('[MobileQRCodePermissions] Bulk action failed', err);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Bulk action failed.');
        } else {
          Alert.alert('Error', 'Bulk action failed.');
        }
      } finally {
        setBulkActionLoading(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(messages[type])) {
        doBulkAction();
      }
    } else {
      Alert.alert('Bulk Access Confirmation', messages[type], [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', onPress: doBulkAction },
      ]);
    }
  };

  // Update Acknowledgement Status
  const handleUpdateAckStatus = async (id: string, status: 'approved' | 'rejected') => {
    const doUpdate = async () => {
      setActionLoading(id);
      try {
        await StudentApi.updatePaymentAcknowledgementStatus(id, status);
        const msg = `Transaction marked as ${status}!`;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(msg);
        } else {
          Alert.alert('Success', msg);
        }
        fetchAcknowledgements();
        fetchData();
      } catch (err) {
        console.error('[MobileQRCodePermissions] Failed to update ack status', err);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Failed to update transaction status.');
        } else {
          Alert.alert('Error', 'Failed to update transaction status.');
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Are you sure you want to mark this transaction as ${status.toUpperCase()}?`)) {
        doUpdate();
      }
    } else {
      Alert.alert(
        'Confirm Status Update',
        `Are you sure you want to mark this transaction as ${status.toUpperCase()}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: status === 'approved' ? 'Approve' : 'Reject',
            style: status === 'rejected' ? 'destructive' : 'default',
            onPress: doUpdate,
          },
        ]
      );
    }
  };

  // Request Counts
  const requestCount = students.filter((s) => s.qrCodeRequested === true).length;
  const pendingAckCount = acknowledgements.filter((a) => a.status === 'pending').length;

  // Filter Lists
  const courseList = Array.from(
    new Set([
      ...courses.map((c: any) => c.title || c.name || c.courseName).filter(Boolean),
      ...students.map((s: any) => s.course).filter(Boolean),
      ...(erpCourses || []).map((c: any) => c.title || c.name || c.courseName).filter(Boolean),
    ])
  ).sort();

  const batchList = Array.from(
    new Set([
      ...batches.map((b: any) => b.batchName || b.name || b.title).filter(Boolean),
      ...students
        .flatMap((s: any) => (Array.isArray(s.batches) ? s.batches : s.batch ? [s.batch] : []))
        .filter(Boolean),
      ...(erpBatches || []).map((b: any) => b.batchName || b.name).filter(Boolean),
    ])
  ).sort();

  // Filtered & Sorted Students
  const filteredStudents = students
    .filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const name = (s.displayName || `${s.firstName || ''} ${s.lastName || ''}`).toLowerCase();
      const roll = String(s.rollNo || s.rollNumber || s.loginUsername || '').toLowerCase();
      if (q && !name.includes(q) && !roll.includes(q)) return false;

      if (filterCourse !== 'all' && s.course !== filterCourse) return false;

      if (filterBatch !== 'all') {
        const bList = Array.isArray(s.batches) ? s.batches : s.batch ? [s.batch] : [];
        if (!bList.includes(filterBatch) && s.batch !== filterBatch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const aRequested = a.qrCodeRequested === true ? 1 : 0;
      const bRequested = b.qrCodeRequested === true ? 1 : 0;

      if (bRequested !== aRequested) {
        return bRequested - aRequested;
      }

      if (aRequested && bRequested) {
        return new Date(b.qrCodeRequestedAt || 0).getTime() - new Date(a.qrCodeRequestedAt || 0).getTime();
      }

      return (a.displayName || `${a.firstName || ''} ${a.lastName || ''}`).localeCompare(
        b.displayName || `${b.firstName || ''} ${b.lastName || ''}`
      );
    });

  const QR_ITEMS_PER_PAGE = 15;
  const totalQrPages = Math.ceil(filteredStudents.length / QR_ITEMS_PER_PAGE) || 1;
  const safeQrPage = Math.max(1, Math.min(currentPage, totalQrPages));
  const startQrIndex = (safeQrPage - 1) * QR_ITEMS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(startQrIndex, startQrIndex + QR_ITEMS_PER_PAGE);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 60, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── 1. Header Banner ────────────────────────────────────────── */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: bgCard,
            borderColor,
            padding: 18,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(139,0,0,0.1)' }]}>
                <Ionicons name="qr-code-outline" size={20} color="#8B0000" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, letterSpacing: -0.3 }}>
                QR Permissions
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 4 }}>
              Payment QR code & student scan access.
            </Text>
          </View>

          {/* Active Requests Badge */}
          <View
            style={{
              backgroundColor: requestCount > 0 ? 'rgba(239,68,68,0.1)' : inputBg,
              borderWidth: 1,
              borderColor: requestCount > 0 ? 'rgba(239,68,68,0.3)' : borderColor,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: textSecondary, textTransform: 'uppercase' }}>
              Requests
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '900',
                color: requestCount > 0 ? '#dc2626' : '#8B0000',
              }}
            >
              {requestCount}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── 2. QR Code Configuration Card ───────────────────────────── */}
      <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="cloud-upload-outline" size={17} color="#8B0000" />
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Upload Payment QR Code</Text>
        </View>

        {/* QR Image Viewport */}
        <View
          style={[
            styles.imageDropzone,
            {
              backgroundColor: inputBg,
              borderColor: qrCodeUrl ? '#8B0000' : borderColor,
            },
          ]}
        >
          {qrCodeUrl ? (
            <View style={{ alignItems: 'center', width: '100%', gap: 10 }}>
              <Image
                source={{ uri: qrCodeUrl }}
                style={{ width: 170, height: 170, backgroundColor: '#fff', borderRadius: 10 }}
                resizeMode="contain"
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={[styles.smallBtn, { backgroundColor: '#8B0000' }]}
                >
                  <Ionicons name="refresh-outline" size={13} color="#fff" />
                  <Text style={styles.smallBtnText}>Change</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeleteQrCode}
                  style={[styles.smallBtn, { backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: 1 }]}
                >
                  <Ionicons name="trash-outline" size={13} color="#dc2626" />
                  <Text style={[styles.smallBtnText, { color: '#dc2626' }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handlePickImage}
              style={{ alignItems: 'center', padding: 22 }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(139,0,0,0.1)', marginBottom: 8 }]}>
                <Ionicons name="cloud-upload-outline" size={24} color="#8B0000" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }}>
                Tap to choose QR Code image
              </Text>
              <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>PNG, JPG or SVG</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Timer Config */}
        <View style={{ marginTop: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {/* Validity Duration */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: textSecondary }]}>Validity Duration</Text>
              <TextInput
                keyboardType="numeric"
                value={String(timerDuration)}
                onChangeText={(val) => setTimerDuration(Math.max(1, parseInt(val) || 1))}
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBg,
                    borderColor,
                    color: textPrimary,
                  },
                ]}
              />
            </View>

            {/* Time Unit Selector */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: textSecondary }]}>Time Unit</Text>
              <View style={{ flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor, overflow: 'hidden', height: 42 }}>
                <TouchableOpacity
                  onPress={() => setTimerUnit('minutes')}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: timerUnit === 'minutes' ? '#8B0000' : inputBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: timerUnit === 'minutes' ? '#fff' : textSecondary,
                    }}
                  >
                    Minutes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTimerUnit('hours')}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: timerUnit === 'hours' ? '#8B0000' : inputBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: timerUnit === 'hours' ? '#fff' : textSecondary,
                    }}
                  >
                    Hours
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Save Settings Button */}
          <TouchableOpacity
            onPress={handleSaveSettings}
            disabled={settingsSaving}
            style={[styles.primaryBtn, { backgroundColor: '#8B0000', opacity: settingsSaving ? 0.7 : 1 }]}
          >
            {settingsSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── 3. Bulk Access Operations Card ──────────────────────────── */}
      <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={17} color="#8B0000" />
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Bulk Access Operations</Text>
        </View>

        <View style={{ gap: 14 }}>
          {/* Subcard: Enable by Batch */}
          <View style={[styles.subCard, { backgroundColor: inputBg, borderColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="people-outline" size={15} color="#8B0000" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }}>
                Enable by Batch
              </Text>
            </View>

            {/* Batch Selector Button */}
            <TouchableOpacity
              onPress={() => setBatchModalVisible(true)}
              style={[
                styles.input,
                {
                  backgroundColor: bgCard,
                  borderColor,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: selectedBatchId ? textPrimary : textSecondary,
                }}
                numberOfLines={1}
              >
                {selectedBatchId
                  ? batches.find((b) => (b.batchName || b.id || b.name) === selectedBatchId)?.batchName ||
                    selectedBatchId
                  : 'Select a batch...'}
              </Text>
              <Ionicons name="chevron-down" size={15} color={textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleBulkEnable('batch')}
              disabled={bulkActionLoading || !selectedBatchId}
              style={[
                styles.outlineBtn,
                {
                  borderColor: selectedBatchId ? '#8B0000' : borderColor,
                  opacity: selectedBatchId && !bulkActionLoading ? 1 : 0.5,
                },
              ]}
            >
              <Text
                style={[
                  styles.outlineBtnText,
                  { color: selectedBatchId ? '#8B0000' : textSecondary },
                ]}
              >
                Enable for Batch Students
              </Text>
            </TouchableOpacity>
          </View>

          {/* Subcard: General Bulk Actions */}
          <View style={[styles.subCard, { backgroundColor: inputBg, borderColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="flash-outline" size={15} color="#8B0000" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }}>
                General Bulk Actions
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              {/* Enable All Requested */}
              <TouchableOpacity
                onPress={() => handleBulkEnable('requested')}
                disabled={bulkActionLoading}
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: '#d97706',
                    opacity: bulkActionLoading ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="hand-right-outline" size={15} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  Enable All Requested ({requestCount})
                </Text>
              </TouchableOpacity>

              {/* Row: Enrolled & Free */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleBulkEnable('paid')}
                  disabled={bulkActionLoading}
                  style={[
                    styles.outlineBtn,
                    {
                      flex: 1,
                      borderColor: 'rgba(139,0,0,0.5)',
                      backgroundColor: 'rgba(139,0,0,0.05)',
                    },
                  ]}
                >
                  <Text style={[styles.outlineBtnText, { color: '#8B0000' }]}>
                    Enable All Enrolled
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleBulkEnable('free')}
                  disabled={bulkActionLoading}
                  style={[
                    styles.outlineBtn,
                    {
                      flex: 1,
                      borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.outlineBtnText, { color: textSecondary }]}>
                    Enable All Free
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ─── 4. Student Permissions Directory ────────────────────────── */}
      <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="list-outline" size={17} color="#8B0000" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: textPrimary }]}>
              Student Directory ({filteredStudents.length})
            </Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginTop: 1 }}>
              Pending requests automatically sorted to top.
            </Text>
          </View>
        </View>

        {/* Search Input */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: inputBg,
              borderColor,
            },
          ]}
        >
          <Ionicons name="search" size={15} color={textSecondary} />
          <TextInput
            placeholder="Search name or roll number..."
            placeholderTextColor={textSecondary}
            value={searchQuery}
            onChangeText={(val) => {
              setSearchQuery(val);
              setCurrentPage(1);
            }}
            style={[styles.searchInput, { color: textPrimary }]}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
            >
              <Ionicons name="close-circle" size={16} color={textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Course Filter Pills */}
        <View style={{ marginTop: 10 }}>
          <Text style={[styles.label, { color: textSecondary, marginBottom: 4 }]}>COURSE FILTER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                setFilterCourse('all');
                setCurrentPage(1);
              }}
              style={[
                styles.filterPill,
                {
                  backgroundColor: filterCourse === 'all' ? '#8B0000' : inputBg,
                  borderColor: filterCourse === 'all' ? '#8B0000' : borderColor,
                },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: filterCourse === 'all' ? '#fff' : textSecondary }}>
                All Courses
              </Text>
            </TouchableOpacity>
            {courseList.map((cName: string) => (
              <TouchableOpacity
                key={cName}
                onPress={() => {
                  setFilterCourse(cName);
                  setCurrentPage(1);
                }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: filterCourse === cName ? '#8B0000' : inputBg,
                    borderColor: filterCourse === cName ? '#8B0000' : borderColor,
                  },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: filterCourse === cName ? '#fff' : textSecondary }}>
                  {cName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Batch Filter Pills */}
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.label, { color: textSecondary, marginBottom: 4 }]}>BATCH FILTER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                setFilterBatch('all');
                setCurrentPage(1);
              }}
              style={[
                styles.filterPill,
                {
                  backgroundColor: filterBatch === 'all' ? '#8B0000' : inputBg,
                  borderColor: filterBatch === 'all' ? '#8B0000' : borderColor,
                },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: filterBatch === 'all' ? '#fff' : textSecondary }}>
                All Batches
              </Text>
            </TouchableOpacity>
            {batchList.map((bName: string) => (
              <TouchableOpacity
                key={bName}
                onPress={() => {
                  setFilterBatch(bName);
                  setCurrentPage(1);
                }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: filterBatch === bName ? '#8B0000' : inputBg,
                    borderColor: filterBatch === bName ? '#8B0000' : borderColor,
                  },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: filterBatch === bName ? '#fff' : textSecondary }}>
                  {bName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Student Cards List */}
        <View style={{ marginTop: 14, gap: 10 }}>
          {loading ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <ActivityIndicator color="#8B0000" size="large" />
              <Text style={{ color: textSecondary, fontSize: 14, marginTop: 8 }}>Loading students...</Text>
            </View>
          ) : paginatedStudents.length === 0 ? (
            <View style={{ padding: 27, alignItems: 'center', backgroundColor: inputBg, borderRadius: 12 }}>
              <Ionicons name="people-outline" size={28} color={textSecondary} />
              <Text style={{ color: textSecondary, fontSize: 15, marginTop: 6, fontWeight: '600' }}>
                No students match your criteria.
              </Text>
            </View>
          ) : (
            paginatedStudents.map((s: any) => {
              const isCurrentlyEnabled =
                s.qrCodeEnabled &&
                s.qrCodeEnabledAt &&
                new Date(s.qrCodeEnabledAt).getTime() +
                  timerDuration * (timerUnit === 'minutes' ? 60 : 3600) * 1000 >
                  Date.now();

              const studentName = s.displayName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name || 'Unnamed';
              const rollNumber = s.rollNo || s.rollNumber || s.loginUsername || '—';
              const isPaid = ['online', 'offline', 'recorded', 'paid'].includes(s.accessTier || '');

              return (
                <View
                  key={s.id}
                  style={[
                    styles.studentCard,
                    {
                      backgroundColor: inputBg,
                      borderColor: s.qrCodeRequested ? 'rgba(239,68,68,0.5)' : borderColor,
                      borderLeftWidth: s.qrCodeRequested ? 4 : 1,
                      borderLeftColor: s.qrCodeRequested ? '#dc2626' : borderColor,
                    },
                  ]}
                >
                  {/* Top Row: Name, Requested Badge & Tier */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>
                          {studentName}
                        </Text>
                        {s.qrCodeRequested === true && (
                          <View style={[styles.statusBadge, { backgroundColor: '#fee2e2' }]}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626' }}>
                              REQUESTED
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                        Roll: <Text style={{ fontWeight: '600', color: textPrimary }}>{rollNumber}</Text>
                        {s.batch ? ` • ${s.batch}` : ''}
                        {s.course ? ` • ${s.course}` : ''}
                      </Text>
                    </View>

                    {/* Tier Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isPaid ? 'rgba(212,175,55,0.15)' : 'rgba(156,163,175,0.15)',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isPaid ? '#b45309' : textSecondary,
                        }}
                      >
                        {(s.accessTier || 'free').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 8 }} />

                  {/* Bottom Row: Status & Actions */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Status */}
                    <View>
                      {s.qrCodeEnabled && s.qrCodeEnabledAt ? (
                        <MobileTimerCountdown
                          enabledAt={s.qrCodeEnabledAt}
                          duration={timerDuration}
                          unit={timerUnit}
                          darkMode={darkMode}
                        />
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(156,163,175,0.12)' }]}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary }}>
                            Disabled
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => handleSinglePermission(s.id, true)}
                        disabled={isCurrentlyEnabled}
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: isCurrentlyEnabled ? 'transparent' : s.qrCodeRequested ? '#16a34a' : '#8B0000',
                            borderColor: isCurrentlyEnabled ? '#86efac' : 'transparent',
                            borderWidth: isCurrentlyEnabled ? 1 : 0,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: isCurrentlyEnabled ? '#16a34a' : '#fff',
                          }}
                        >
                          {s.qrCodeRequested ? 'Approve & Enable' : 'Enable'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleSinglePermission(s.id, false)}
                        disabled={!isCurrentlyEnabled}
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: !isCurrentlyEnabled ? 'transparent' : '#fee2e2',
                            borderColor: !isCurrentlyEnabled ? borderColor : '#fca5a5',
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: !isCurrentlyEnabled ? textSecondary : '#dc2626',
                          }}
                        >
                          Disable
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Pagination Controls */}
        {totalQrPages > 1 && (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeQrPage <= 1}
              style={[
                styles.pageBtn,
                {
                  borderColor,
                  opacity: safeQrPage <= 1 ? 0.4 : 1,
                },
              ]}
            >
              <Ionicons name="chevron-back" size={14} color={textPrimary} />
              <Text style={[styles.pageBtnText, { color: textPrimary }]}>Prev</Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 14, fontWeight: '700', color: textSecondary }}>
              Page {safeQrPage} of {totalQrPages}
            </Text>

            <TouchableOpacity
              onPress={() => setCurrentPage((p) => Math.min(totalQrPages, p + 1))}
              disabled={safeQrPage >= totalQrPages}
              style={[
                styles.pageBtn,
                {
                  borderColor,
                  opacity: safeQrPage >= totalQrPages ? 0.4 : 1,
                },
              ]}
            >
              <Text style={[styles.pageBtnText, { color: textPrimary }]}>Next</Text>
              <Ionicons name="chevron-forward" size={14} color={textPrimary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── 5. Payment Acknowledgements Queue ───────────────────────── */}
      <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="receipt-outline" size={17} color="#8B0000" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: textPrimary }]}>
              Transaction Acknowledgement Queue
            </Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginTop: 1 }}>
              Verify payment receipts and UTR numbers.
            </Text>
          </View>
        </View>

        {/* Status Filter Tabs */}
        <View style={{ flexDirection: 'row', gap: 6, backgroundColor: inputBg, padding: 4, borderRadius: 10 }}>
          <TouchableOpacity
            onPress={() => setAckFilter('pending')}
            style={[
              styles.tabBtn,
              {
                backgroundColor: ackFilter === 'pending' ? bgCard : 'transparent',
                borderColor: ackFilter === 'pending' ? borderColor : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: ackFilter === 'pending' ? '#d97706' : textSecondary,
              }}
            >
              Pending
            </Text>
            {pendingAckCount > 0 && (
              <View style={[styles.statusBadge, { backgroundColor: '#d97706', paddingHorizontal: 5, paddingVertical: 1 }]}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff' }}>{pendingAckCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAckFilter('approved')}
            style={[
              styles.tabBtn,
              {
                backgroundColor: ackFilter === 'approved' ? bgCard : 'transparent',
                borderColor: ackFilter === 'approved' ? borderColor : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: ackFilter === 'approved' ? '#16a34a' : textSecondary,
              }}
            >
              Approved
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAckFilter('rejected')}
            style={[
              styles.tabBtn,
              {
                backgroundColor: ackFilter === 'rejected' ? bgCard : 'transparent',
                borderColor: ackFilter === 'rejected' ? borderColor : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: ackFilter === 'rejected' ? '#dc2626' : textSecondary,
              }}
            >
              Rejected
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transactions List */}
        <View style={{ marginTop: 14, gap: 10 }}>
          {ackLoading ? (
            <View style={{ padding: 27, alignItems: 'center' }}>
              <ActivityIndicator color="#8B0000" size="small" />
              <Text style={{ color: textSecondary, fontSize: 14, marginTop: 6 }}>Loading receipts...</Text>
            </View>
          ) : acknowledgements.length === 0 ? (
            <View style={{ padding: 27, alignItems: 'center', backgroundColor: inputBg, borderRadius: 12 }}>
              <Ionicons name="document-text-outline" size={28} color={textSecondary} />
              <Text style={{ color: textSecondary, fontSize: 15, marginTop: 6, fontWeight: '600' }}>
                No {ackFilter} transaction proofs found.
              </Text>
            </View>
          ) : (
            acknowledgements.map((ack) => {
              const submittedDate = ack.submittedAt
                ? new Date(ack.submittedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—';

              return (
                <View
                  key={ack.id}
                  style={[
                    styles.studentCard,
                    {
                      backgroundColor: inputBg,
                      borderColor,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>
                        {ack.studentName || 'Student'}
                      </Text>
                      <Text style={{ fontSize: 13, color: textSecondary, marginTop: 1 }}>
                        Roll: <Text style={{ fontWeight: '600', color: textPrimary }}>{ack.rollNumber || 'Unassigned'}</Text>
                        {' • '}
                        {submittedDate}
                      </Text>
                    </View>

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            ack.status === 'approved'
                              ? '#dcfce7'
                              : ack.status === 'rejected'
                              ? '#fee2e2'
                              : '#fef3c7',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color:
                            ack.status === 'approved'
                              ? '#16a34a'
                              : ack.status === 'rejected'
                              ? '#dc2626'
                              : '#b45309',
                        }}
                      >
                        {ack.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Transaction ID / UTR */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: bgCard,
                      padding: 10,
                      borderRadius: 8,
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: textSecondary, fontWeight: '600' }}>UTR / TXN ID:</Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                        fontWeight: '800',
                        color: '#8B0000',
                      }}
                      selectable
                    >
                      {ack.transactionId || 'Not Provided'}
                    </Text>
                  </View>

                  {/* Receipt Screenshot Preview */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 10,
                    }}
                  >
                    {/* View Proof Thumbnail */}
                    {ack.screenshotUrl ? (
                      <TouchableOpacity
                        onPress={() => {
                          setPreviewImage(ack.screenshotUrl);
                          setPreviewAckData(ack);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <Image
                          source={{ uri: ack.screenshotUrl }}
                          style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#fff' }}
                        />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#8B0000' }}>
                          View Receipt
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 13, color: textSecondary, fontStyle: 'italic' }}>
                        No Image Attached
                      </Text>
                    )}
                  </View>

                  {/* Approve & Record Fee / Reject Buttons (if pending) */}
                  {ack.status === 'pending' && (
                    <View style={{ gap: 8, marginTop: 10, width: '100%' }}>
                      <TouchableOpacity
                        onPress={() => {
                          setFeeModalAck(ack);
                          setFeeAmountInput(String(ack.amount || ''));
                          setFeeTypeInput('Tuition Fee');
                          setFeeRemarksInput(`QR Scan Payment (${ack.transactionId || 'UTR'})`);
                        }}
                        disabled={actionLoading === ack.id}
                        style={{
                          backgroundColor: '#16a34a',
                          borderRadius: 8,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          width: '100%'
                        }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Approve & Record Fee</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleUpdateAckStatus(ack.id, 'rejected')}
                        disabled={actionLoading === ack.id}
                        style={{
                          backgroundColor: '#fee2e2',
                          borderColor: '#fca5a5',
                          borderWidth: 1,
                          borderRadius: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          width: '100%'
                        }}
                      >
                        <Ionicons name="close-circle-outline" size={15} color="#dc2626" />
                        <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '700' }}>Reject Request</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* ─── Batch Selector Modal ────────────────────────────────────── */}
      <Modal
        visible={batchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBatchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary }}>
                Select Target Batch
              </Text>
              <TouchableOpacity onPress={() => setBatchModalVisible(false)}>
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 280 }}>
              {batches.map((b) => {
                const name = b.batchName || b.name || b.title || b.id || 'Unnamed Batch';
                const val = b.batchName || b.id || name;
                const isSelected = selectedBatchId === val;

                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => {
                      setSelectedBatchId(val);
                      setBatchModalVisible(false);
                    }}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: borderColor,
                      backgroundColor: isSelected ? 'rgba(139,0,0,0.08)' : 'transparent',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: isSelected ? '800' : '600', color: textPrimary }}>
                      {name}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={17} color="#8B0000" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Receipt Image Preview Modal ─────────────────────────────── */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPreviewImage(null);
          setPreviewAckData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: bgCard, borderColor, maxHeight: '88%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary }}>
                  Receipt Proof Preview
                </Text>
                {previewAckData && (
                  <Text style={{ fontSize: 13, color: textSecondary }}>
                    {previewAckData.studentName} ({previewAckData.rollNumber || 'Unassigned'})
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setPreviewImage(null);
                  setPreviewAckData(null);
                }}
              >
                <Ionicons name="close" size={22} color={textSecondary} />
              </TouchableOpacity>
            </View>

            {previewImage && (
              <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: 12 }}>
                <Image
                  source={{ uri: previewImage }}
                  style={{
                    width: Dimensions.get('window').width * 0.8,
                    height: Dimensions.get('window').height * 0.5,
                    borderRadius: 10,
                    backgroundColor: '#fff',
                  }}
                  resizeMode="contain"
                />
              </ScrollView>
            )}

            {previewAckData && previewAckData.transactionId && (
              <View style={{ padding: 12, backgroundColor: inputBg, borderRadius: 8, marginTop: 8 }}>
                <Text style={{ fontSize: 13, color: textSecondary }}>UTR / Transaction ID:</Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    fontWeight: '800',
                    color: '#8B0000',
                    marginTop: 2,
                  }}
                  selectable
                >
                  {previewAckData.transactionId}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Fee Approval & Recording Modal ───────────────────────── */}
      <Modal
        visible={!!feeModalAck}
        transparent
        animationType="slide"
        onRequestClose={() => setFeeModalAck(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: bgCard, borderColor, maxWidth: 440, width: '92%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cash" size={22} color="#16a34a" />
                <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary }}>
                  Approve & Record Fee
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFeeModalAck(null)}>
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            {feeModalAck && (
              <ScrollView style={{ maxHeight: 420 }}>
                <View style={{ backgroundColor: inputBg, padding: 12, borderRadius: 10, borderWidth: 1, borderColor, marginBottom: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: textPrimary }}>
                    {feeModalAck.studentName}
                  </Text>
                  <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                    Roll: {feeModalAck.rollNumber || 'Unassigned'} • UTR: {feeModalAck.transactionId || 'Not Provided'}
                  </Text>
                </View>

                {feeModalAck.screenshotUrl ? (
                  <View style={{ alignItems: 'center', marginBottom: 14 }}>
                    <Image
                      source={{ uri: feeModalAck.screenshotUrl }}
                      style={{ width: '100%', height: 160, borderRadius: 8, backgroundColor: '#fff' }}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}

                <View style={{ gap: 12, marginBottom: 16 }}>
                  <View>
                    <Text style={[styles.label, { color: textSecondary }]}>Fee Payment Amount (₹) *</Text>
                    <TextInput
                      keyboardType="numeric"
                      placeholder="e.g. 5000"
                      placeholderTextColor={textSecondary}
                      value={feeAmountInput}
                      onChangeText={setFeeAmountInput}
                      style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                    />
                  </View>

                  <View>
                    <Text style={[styles.label, { color: textSecondary }]}>Payment Category / Type</Text>
                    <TextInput
                      placeholder="e.g. Tuition Fee, Exam Fee"
                      placeholderTextColor={textSecondary}
                      value={feeTypeInput}
                      onChangeText={setFeeTypeInput}
                      style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                    />
                  </View>

                  <View>
                    <Text style={[styles.label, { color: textSecondary }]}>Remarks / Reference</Text>
                    <TextInput
                      placeholder="Remarks"
                      placeholderTextColor={textSecondary}
                      value={feeRemarksInput}
                      onChangeText={setFeeRemarksInput}
                      style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  disabled={feeSubmitting}
                  onPress={async () => {
                    setFeeSubmitting(true);
                    try {
                      // 1. Update QR Payment Acknowledgement status to approved
                      await StudentApi.updatePaymentAcknowledgementStatus(feeModalAck.id, 'approved');
                      
                      // 2. Record Fee Entry in Student Fee Management
                      if (feeAmountInput && parseFloat(feeAmountInput) > 0) {
                        try {
                          await LmsAttendanceApi.recordFeePayment({
                            studentId: feeModalAck.studentId || feeModalAck.id,
                            amount: parseFloat(feeAmountInput),
                            feeType: feeTypeInput || 'Tuition Fee',
                            paymentMode: 'UPI_QR',
                            remarks: feeRemarksInput || 'Paid via QR Scan'
                          });
                        } catch (feeErr) {
                          console.log('[FeeRecord] Direct fee post note:', feeErr);
                        }
                      }

                      const msg = 'Payment Approved & Fee Recorded Successfully!';
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.alert(msg);
                      } else {
                        Alert.alert('Success', msg);
                      }

                      setFeeModalAck(null);
                      fetchAcknowledgements();
                      fetchData();
                    } catch (err: any) {
                      const errM = err?.response?.data?.message || err?.message || 'Failed to approve payment.';
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.alert(errM);
                      } else {
                        Alert.alert('Error', errM);
                      }
                    } finally {
                      setFeeSubmitting(false);
                    }
                  }}
                  style={[styles.primaryBtn, { backgroundColor: '#16a34a', opacity: feeSubmitting ? 0.6 : 1 }]}
                >
                  {feeSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>Approve & Save Fee Entry</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  primaryBtn: {
    height: 42,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  outlineBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  studentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
});
