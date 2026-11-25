import React, { useState, useEffect, useRef } from 'react';
import { StudentApi } from '../core/services';
import { getUserFromAuth } from '../core/api';
import { useToast } from '../components/ui/Toast/ToastContext';
import { 
  Platform, 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Alert,
  Modal 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RNContainerSkeleton } from '../components/ui/RNSkeleton';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

export const StudentPayFeesPage = ({ darkMode = false }: { darkMode?: boolean }) => {
  let toastContext: any = null;
  try {
    toastContext = useToast();
  } catch (_) {}

  const showSuccess = (msg: string) => {
    if (Platform.OS === 'web' && toastContext?.success) {
      toastContext.success(msg);
    } else {
      Alert.alert('Success', msg);
    }
  };

  const showError = (msg: string) => {
    if (Platform.OS === 'web' && toastContext?.error) {
      toastContext.error(msg);
    } else {
      Alert.alert('Error', msg);
    }
  };

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Payment Transaction States
  const [transactionId, setTransactionId] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [expandedAckId, setExpandedAckId] = useState<string | null>(null);

  const fetchQrStatus = async () => {
    try {
      const res = await StudentApi.getStudentQrStatus();
      const data = res.data?.data;
      setStatus(data);
      if (data?.qrCodeEnabled && data?.remainingSeconds > 0) {
        setTimeLeft(data.remainingSeconds);
      } else {
        setTimeLeft(0);
      }
    } catch (err) {
      console.error('Failed to load QR code status', err);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const res = await StudentApi.getStudentPaymentAcknowledgements();
      setPaymentHistory(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load payment history', err);
    }
  };

  const initData = async () => {
    setLoading(true);
    await Promise.all([fetchQrStatus(), fetchPaymentHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    initData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Tick the countdown timer using device local time
  useEffect(() => {
    if (status?.qrCodeEnabled && timeLeft > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      
      const enabledAtTime = new Date(status.qrCodeEnabledAt).getTime();
      const durationMs = status.timerDuration * (status.timerUnit === 'minutes' ? 60 : 3600) * 1000;
      const expiryTime = enabledAtTime + durationMs;

      timerRef.current = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
        
        setTimeLeft(diff);
        
        if (diff <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Set qrCodeEnabled to false locally so page updates
          setStatus((prev: any) => ({ ...prev, qrCodeEnabled: false }));
          showSuccess("The payment QR code session has expired.");
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status?.qrCodeEnabled, timeLeft, status?.qrCodeEnabledAt]);

  // Real-time zero-cost sync for student QR status, QR settings & payment history
  useEffect(() => {
    let unsubStudent: (() => void) | null = null;
    let unsubPayments: (() => void) | null = null;
    try {
      const authUser = getUserFromAuth();
      let studentDocId = authUser?.userId;
      if (!studentDocId && typeof localStorage !== 'undefined') {
        try {
          const storedUser = JSON.parse(localStorage.getItem('nermai_auth_user') || '{}');
          studentDocId = storedUser?.studentId || storedUser?.id || storedUser?.userId;
        } catch (_) {}
      }

      if (studentDocId) {
        unsubStudent = onSnapshot(doc(db, 'students', studentDocId), () => {
          fetchQrStatus();
        }, (err) => {
          console.warn('[StudentPayFeesPage] Realtime student sync error:', err);
        });

        // Scope payment listener strictly to this student to prevent academy-wide read multiplier
        const qPayments = query(collection(db, 'payment_acknowledgements'), where('studentId', '==', studentDocId));
        unsubPayments = onSnapshot(qPayments, () => {
          fetchPaymentHistory();
        }, (err) => {
          console.warn('[StudentPayFeesPage] Realtime payment sync error:', err);
        });
      }
    } catch (e) {}

    const unsubSettings = onSnapshot(doc(db, 'system_settings', 'payment_qr_code'), () => {
      fetchQrStatus();
    }, (err) => {
      console.warn('[StudentPayFeesPage] Realtime qr settings sync error:', err);
    });

    return () => {
      if (unsubStudent) unsubStudent();
      unsubSettings();
      if (unsubPayments) unsubPayments();
    };
  }, []);

  const handleRequestQr = async () => {
    setSubmitting(true);
    try {
      await StudentApi.requestStudentQr();
      showSuccess("Request sent, admin will respond in a short time");
      setIsDialogOpen(false);
      await fetchQrStatus();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to send request.';
      showError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down dimensions to keep it lightweight
        const MAX_DIM = 600;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Adjust quality to ensure size is strictly less than 50KB (base64 length < ~68000 chars)
        let quality = 0.8;
        let compressed = canvas.toDataURL('image/jpeg', quality);
        
        while (compressed.length > 50 * 1024 && quality > 0.1) {
          quality -= 0.1;
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        // Second fallback: scale down by half if still too large
        if (compressed.length > 50 * 1024) {
          canvas.width = Math.round(width / 2);
          canvas.height = Math.round(height / 2);
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          compressed = canvas.toDataURL('image/jpeg', 0.5);
        }

        setScreenshotUrl(compressed);
        showSuccess("Screenshot processed & compressed below 50KB successfully!");
      };
    };
    reader.readAsDataURL(file);
  };

  const handleMobileScreenshotPick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to upload screenshots!');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Data = result.assets[0].base64;
        setScreenshotUrl(`data:image/jpeg;base64,${base64Data}`);
        Alert.alert("Success", "Screenshot attached successfully!");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to pick image");
    }
  };

  const handleSubmitAcknowledgement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!transactionId && !screenshotUrl) {
      const msg = "Please enter a Transaction ID or upload a payment screenshot.";
      return showError(msg);
    }

    setSubmittingPayment(true);
    try {
      await StudentApi.submitPaymentAcknowledgement({
        transactionId,
        screenshotUrl
      });
      const msg = "Transaction acknowledgement submitted successfully!";
      showSuccess(msg);
      setTransactionId('');
      setScreenshotUrl('');
      
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        // Reset file input on web
        const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }

      fetchPaymentHistory();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to submit acknowledgement.';
      showError(errMsg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: 16, width: '100%' }}>
        {/* Section Header */}
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: darkMode ? '#ffffff' : '#111827' }}>Pay Fees</Text>
          <Text style={{ fontSize: 15, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
            View payment terms, scan QR codes, and pay your fees.
          </Text>
        </View>

        {loading ? (
          <RNContainerSkeleton rows={2} darkMode={darkMode} />
        ) : (
          <View style={{ gap: 20 }}>
            {/* 3-Step Fee Payment Guide */}
            <View style={{
              backgroundColor: darkMode ? '#222' : '#f8fafc',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: darkMode ? '#333' : '#e2e8f0',
            }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: darkMode ? '#fff' : '#1e293b', marginBottom: 10 }}>
                💡 HOW TO PAY FEES IN 3 EASY STEPS:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <View style={{ flex: 1, minWidth: 200, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#c62828', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: darkMode ? '#fff' : '#1e293b' }}>Request Access</Text>
                    <Text style={{ fontSize: 12, color: darkMode ? '#aaa' : '#64748b' }}>Tap the button below. Admin grants temporary QR permission.</Text>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 200, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#1565c0', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>2</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: darkMode ? '#fff' : '#1e293b' }}>Scan & Pay via UPI</Text>
                    <Text style={{ fontSize: 12, color: darkMode ? '#aaa' : '#64748b' }}>Scan QR using GPay, PhonePe, Paytm or BHIM app.</Text>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 200, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#2e7d32', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>3</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: darkMode ? '#fff' : '#1e293b' }}>Upload Receipt</Text>
                    <Text style={{ fontSize: 12, color: darkMode ? '#aaa' : '#64748b' }}>Enter 12-digit UTR & upload receipt for instant verification.</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Main Payment Card */}
            <View style={{
              backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
              borderRadius: 12,
              padding: 26,
              borderWidth: 1,
              borderColor: darkMode ? '#333333' : '#e0e0e0',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              alignItems: 'center',
            }}>
              {!status?.qrCodeEnabled ? (
                // Not Enabled State
                <View style={{ alignItems: 'center', width: '100%', maxWidth: 520, gap: 16 }}>
                  <View style={{
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    backgroundColor: darkMode ? '#3a1a1a' : '#ffebee',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="qr-code-outline" size={36} color="#c62828" />
                  </View>

                  {status?.qrCodeRequested ? (
                    <View style={{ alignItems: 'center', gap: 12, width: '100%' }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: darkMode ? '#3a2e1a' : '#fff8e1',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: darkMode ? '#5a461a' : '#ffe082',
                      }}>
                        <Ionicons name="time" size={16} color="#f57c00" />
                        <Text style={{ color: '#f57c00', fontSize: 14, fontWeight: 'bold' }}>Request Pending Approval</Text>
                      </View>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: darkMode ? '#ffffff' : '#111111', textAlign: 'center' }}>
                        Your Request Has Been Sent!
                      </Text>
                      <Text style={{ fontSize: 14, color: darkMode ? '#9ca3af' : '#64748b', textAlign: 'center', lineHeight: 20 }}>
                        The academy administrator has been notified. Once approved, the payment QR code will automatically appear on this screen.
                      </Text>
                      <TouchableOpacity
                        onPress={fetchQrStatus}
                        style={{
                          marginTop: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: darkMode ? '#444' : '#d0d0d0',
                          backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                        }}
                      >
                        <Ionicons name="refresh-outline" size={16} color={darkMode ? '#fff' : '#333'} />
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: darkMode ? '#fff' : '#333' }}>Refresh Status</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', gap: 12, width: '100%' }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: darkMode ? '#ffffff' : '#111111', textAlign: 'center' }}>
                        Scan QR Code for Fee Payment
                      </Text>
                      <Text style={{ fontSize: 14, color: darkMode ? '#9ca3af' : '#64748b', textAlign: 'center', lineHeight: 20 }}>
                        To access the official fee payment QR code, tap the button below. Permission will be granted by the academy administrator for a secure time window.
                      </Text>
                      <TouchableOpacity
                        onPress={handleRequestQr}
                        disabled={submitting}
                        style={{
                          marginTop: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: submitting ? '#e57373' : '#c62828',
                          paddingHorizontal: 26,
                          paddingVertical: 14,
                          borderRadius: 10,
                          opacity: submitting ? 0.8 : 1,
                          shadowColor: '#c62828',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.25,
                          shadowRadius: 8,
                          elevation: 3,
                        }}
                      >
                        {submitting ? (
                          <>
                            <ActivityIndicator size="small" color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold' }}>Sending Request...</Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="qr-code" size={19} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold' }}>Request QR Code Access</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                // Active QR Code State
                <View style={{ width: '100%', gap: 20 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'center',
                    gap: 6,
                    backgroundColor: darkMode ? '#1a3a1a' : '#e8f5e9',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: darkMode ? '#2e5e2e' : '#c8e6c9',
                  }}>
                    <Ionicons name="checkmark-circle" size={16} color="#2e7d32" />
                    <Text style={{ color: '#2e7d32', fontSize: 14, fontWeight: 'bold' }}>Payment QR Code Active</Text>
                  </View>

                  {/* QR Image & Form Grid */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
                    <View style={{ alignItems: 'center', gap: 10 }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}>
                        <Ionicons name="time-outline" size={16} color="#c62828" />
                        <Text style={{ fontSize: 14, color: darkMode ? '#aaa' : '#666' }}>
                          Expires in: <Text style={{ fontWeight: 'bold', color: '#c62828' }}>{formatTime(timeLeft)}</Text>
                        </Text>
                      </View>

                      {status?.qrCodeUrl ? (
                        <Image
                          source={{ uri: status.qrCodeUrl }}
                          style={{ width: 220, height: 220, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0' }}
                        />
                      ) : (
                        <View style={{ width: 220, height: 220, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center', justify: 'center' }}>
                          <Ionicons name="alert-circle-outline" size={32} color="#c62828" />
                          <Text style={{ fontSize: 14, color: '#9e9e9e', marginTop: 4 }}>No QR image uploaded.</Text>
                        </View>
                      )}
                    </View>

                    {/* Submit Proof Form */}
                    <View style={{
                      flex: 1,
                      minWidth: 280,
                      backgroundColor: darkMode ? '#141414' : '#fafafa',
                      padding: 18,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: darkMode ? '#333' : '#eee',
                      gap: 12,
                    }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: darkMode ? '#fff' : '#111' }}>
                        Submit Transaction Proof
                      </Text>

                      <View style={{ gap: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: darkMode ? '#aaa' : '#666' }}>Transaction ID / UTR</Text>
                        <TextInput
                          placeholder="Enter 12-digit transaction ID"
                          placeholderTextColor={darkMode ? '#666' : '#999'}
                          value={transactionId}
                          onChangeText={setTransactionId}
                          style={{
                            backgroundColor: darkMode ? '#222' : '#fff',
                            borderWidth: 1,
                            borderColor: darkMode ? '#444' : '#ccc',
                            borderRadius: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 15,
                            color: darkMode ? '#fff' : '#000',
                          }}
                        />
                      </View>

                      <View style={{ gap: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: darkMode ? '#aaa' : '#666' }}>Upload Receipt Screenshot</Text>
                        <input
                          id="screenshot-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          style={{ fontSize: 14, color: darkMode ? '#aaa' : '#666' }}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={() => handleSubmitAcknowledgement()}
                        disabled={submittingPayment}
                        style={{
                          backgroundColor: '#c62828',
                          paddingVertical: 12,
                          borderRadius: 8,
                          alignItems: 'center',
                          marginTop: 8,
                          opacity: submittingPayment ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                          {submittingPayment ? 'Submitting...' : 'Submit Acknowledgement'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Acknowledgement History Section */}
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 17, fontWeight: 'bold', color: darkMode ? '#ffffff' : '#111827' }}>
                • Transaction Acknowledgement History
              </Text>

              {paymentHistory.length === 0 ? (
                <View style={{
                  backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
                  borderRadius: 12,
                  padding: 22,
                  borderWidth: 1,
                  borderColor: darkMode ? '#333' : '#e0e0e0',
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 14, color: darkMode ? '#9e9e9e' : '#757575', textAlign: 'center' }}>
                    No payment submissions found. Once you submit transaction receipts, they will list here.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {paymentHistory.map((item, idx) => (
                    <View key={item.id || idx} style={{
                      backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
                      borderRadius: 10,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: darkMode ? '#333' : '#e0e0e0',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: darkMode ? '#fff' : '#111' }}>
                          Submission #{paymentHistory.length - idx}
                        </Text>
                        <Text style={{ fontSize: 13, color: darkMode ? '#aaa' : '#666' }}>
                          UTR: {item.transactionId || 'Not Entered'} | {formatDate(item.submittedAt)}
                        </Text>
                      </View>
                      <View style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        backgroundColor: item.status === 'approved' ? '#e8f5e9' : item.status === 'rejected' ? '#ffebee' : '#fff8e1',
                      }}>
                        <Text style={{
                          fontSize: 13,
                          fontWeight: 'bold',
                          color: item.status === 'approved' ? '#2e7d32' : item.status === 'rejected' ? '#c62828' : '#f57c00',
                        }}>
                          {(item.status || 'pending').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  }

  // NATIVE MOBILE LAYOUT (Safe from div crashes)
  return (
    <ScrollView style={[styles.container, darkMode && { backgroundColor: '#0B0B14' }]} contentContainerStyle={{ paddingBottom: 50 }}>
      <Text style={[styles.headerTitle, darkMode && { color: '#ffffff' }]}>Pay Fees</Text>
      <Text style={[styles.headerSub, darkMode && { color: '#aaaaaa' }]}>View payment terms, scan QR codes, and pay your fees.</Text>

      {/* 3-Step Fee Payment Guide */}
      <View style={{
        backgroundColor: darkMode ? '#1e1e1e' : '#f8fafc',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: darkMode ? '#333333' : '#e2e8f0',
        marginBottom: 16,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: darkMode ? '#ffffff' : '#1e293b', marginBottom: 8, textTransform: 'uppercase' }}>
          💡 How to Pay Fees in 3 Easy Steps
        </Text>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#c62828', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>1</Text>
            </View>
            <Text style={{ fontSize: 12, color: darkMode ? '#dddddd' : '#334155', flex: 1 }}>
              <Text style={{ fontWeight: 'bold' }}>Request Access:</Text> Tap the button below. Admin grants temporary QR permission.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#1565c0', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>2</Text>
            </View>
            <Text style={{ fontSize: 12, color: darkMode ? '#dddddd' : '#334155', flex: 1 }}>
              <Text style={{ fontWeight: 'bold' }}>Scan & Pay:</Text> Open any UPI App (GPay, PhonePe, Paytm, BHIM) to pay fees.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#2e7d32', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>3</Text>
            </View>
            <Text style={{ fontSize: 12, color: darkMode ? '#dddddd' : '#334155', flex: 1 }}>
              <Text style={{ fontWeight: 'bold' }}>Upload Proof:</Text> Enter 12-digit UTR & screenshot to confirm payment receipt.
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c62828" />
        </View>
      ) : (
        <View style={{ gap: 20 }}>
          
          <View style={[styles.card, darkMode && { backgroundColor: '#1b1b2a', borderColor: '#333333' }]}>
            {!status?.qrCodeEnabled ? (
              // Not enabled view
              <View style={{ alignItems: 'center', gap: 15 }}>
                <View style={[styles.iconCircle, { backgroundColor: darkMode ? '#3a1a1a' : '#ffebee' }]}>
                  <Ionicons name="qr-code" size={32} color="#c62828" />
                </View>

                {status?.qrCodeRequested ? (
                  <View style={{ alignItems: 'center', gap: 10, width: '100%' }}>
                    <View style={[styles.pendingBadge, darkMode && { backgroundColor: '#3a2e1a', borderColor: '#5a461a' }]}>
                      <Ionicons name="time" size={14} color="#f57c00" />
                      <Text style={styles.pendingBadgeText}>Request Pending Approval</Text>
                    </View>
                    <Text style={[styles.titleText, darkMode && { color: '#ffffff' }]}>Your Request Has Been Sent!</Text>
                    <Text style={[styles.bodyText, darkMode && { color: '#aaaaaa' }]}>
                      The administrator has been notified. Once approved, the payment QR code will automatically appear on this screen.
                    </Text>
                    <TouchableOpacity style={[styles.refreshBtn, darkMode && { backgroundColor: '#2a2a2a', borderColor: '#555555' }]} onPress={fetchQrStatus}>
                      <Ionicons name="refresh-outline" size={16} color="#c62828" />
                      <Text style={[styles.refreshBtnText, darkMode && { color: '#cccccc' }]}>Refresh Status</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 10, width: '100%' }}>
                    <Text style={[styles.titleText, darkMode && { color: '#ffffff' }]}>Scan QR Code for Fee Payment</Text>
                    <Text style={[styles.bodyText, darkMode && { color: '#aaaaaa' }]}>
                      To view the administration's fee payment QR code, tap the button below. Permission will be granted for a secure time window.
                    </Text>
                    <TouchableOpacity 
                      style={[styles.requestBtn, submitting && { opacity: 0.7 }]} 
                      onPress={handleRequestQr}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text style={[styles.requestBtnText, { marginLeft: 6 }]}>Sending Request...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="qr-code" size={18} color="#fff" />
                          <Text style={styles.requestBtnText}>Request QR Code Access</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              // Enabled/Active view
              <View style={{ gap: 15 }}>
                <View style={[styles.activeBadge, { alignSelf: 'center' }, darkMode && { backgroundColor: '#1b3b1b', borderColor: '#2e5e2e' }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#2e7d32" />
                  <Text style={styles.activeBadgeText}>Payment QR Code Active</Text>
                </View>

                {/* Countdown Timer */}
                <View style={[styles.timerBox, darkMode && { backgroundColor: '#2a2a3e', borderColor: '#444444' }]}>
                  <Ionicons name="time-outline" size={16} color="#c62828" />
                  <Text style={[styles.timerText, darkMode && { color: '#cccccc' }]}>
                    Expires in: <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
                  </Text>
                </View>

                {/* QR Code image & UPI Support Badges */}
                {status?.qrCodeUrl ? (
                  <View style={{ alignItems: 'center', gap: 10 }}>
                    <View style={styles.qrContainer}>
                      <Image 
                        source={{ uri: status.qrCodeUrl }} 
                        style={styles.qrImage}
                      />
                    </View>
                    <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                      Scan with any UPI App: GPay • PhonePe • Paytm • BHIM
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.placeholderBox, darkMode && { backgroundColor: '#222222', borderColor: '#444444' }]}>
                    <Ionicons name="alert-circle-outline" size={32} color="#c62828" />
                    <Text style={[styles.placeholderText, darkMode && { color: '#888888' }]}>No QR code uploaded by admin.</Text>
                  </View>
                )}

                {/* Submit Transaction Form */}
                <View style={[styles.formContainer, darkMode && { backgroundColor: '#222235', borderColor: '#3a3a52' }]}>
                  <Text style={[styles.formTitle, darkMode && { color: '#ffffff' }]}>
                    <Ionicons name="send" size={14} color="#c62828" /> Submit Transaction Proof
                  </Text>

                  <View style={{ gap: 12 }}>
                    <View>
                      <Text style={[styles.inputLabel, darkMode && { color: '#aaaaaa' }]}>Transaction ID / UTR (12 Digits) *</Text>
                      <TextInput 
                        placeholder="Enter 12-digit transaction ID or UTR"
                        placeholderTextColor={darkMode ? '#666666' : '#9ca3af'}
                        value={transactionId}
                        onChangeText={setTransactionId}
                        style={[styles.textInput, darkMode && { backgroundColor: '#1b1b2a', borderColor: '#444444', color: '#ffffff' }]}
                      />
                      <Text style={{ fontSize: 10, color: darkMode ? '#888888' : '#94a3b8', marginTop: 3 }}>
                        Check your UPI transaction details for the 12-digit UTR/UPI Ref ID
                      </Text>
                    </View>

                    <View>
                      <Text style={[styles.inputLabel, darkMode && { color: '#aaaaaa' }]}>Upload Receipt Screenshot *</Text>
                      <TouchableOpacity style={[styles.filePicker, darkMode && { backgroundColor: '#1b1b2a', borderColor: '#444444' }]} onPress={handleMobileScreenshotPick}>
                        <Text style={[styles.filePickerText, screenshotUrl ? { color: '#2e7d32', fontWeight: 'bold' } : (darkMode ? { color: '#aaaaaa' } : {})]}>
                          {screenshotUrl ? "✓ Screenshot attached" : "Choose payment receipt image"}
                        </Text>
                        <Ionicons name="cloud-upload-outline" size={16} color="#c62828" />
                      </TouchableOpacity>
                    </View>

                    {screenshotUrl !== "" && (
                      <View style={[styles.previewBox, darkMode && { backgroundColor: '#152b1b' }]}>
                        <Image source={{ uri: screenshotUrl }} style={styles.previewImage} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: 'bold' }}>✓ Receipt Attached</Text>
                          <TouchableOpacity onPress={() => setScreenshotUrl('')}>
                            <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: 'bold' }}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <TouchableOpacity 
                      style={[styles.submitBtn, submittingPayment && { opacity: 0.7 }]} 
                      onPress={() => handleSubmitAcknowledgement()}
                      disabled={submittingPayment}
                    >
                      <Text style={styles.submitBtnText}>
                        {submittingPayment ? 'Submitting...' : 'Submit Acknowledgement'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Payment Acknowledgement History */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.smallCircle} />
              <Text style={[styles.sectionHeader, darkMode && { color: '#ffffff' }]}>Acknowledgement History</Text>
            </View>

            {paymentHistory.length === 0 ? (
              <View style={[styles.emptyCard, darkMode && { backgroundColor: '#1b1b2a', borderColor: '#333333' }]}>
                <Text style={[styles.emptyText, darkMode && { color: '#888888' }]}>No payment submissions found. Once you submit transaction receipts, they will list here.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {paymentHistory.map((item, idx) => {
                  const isApproved = item.status === 'approved';
                  const isRejected = item.status === 'rejected';
                  return (
                    <View key={item.id || idx} style={[styles.historyCard, darkMode && { backgroundColor: '#1b1b2a', borderColor: '#333333' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.historyCardTitle, darkMode && { color: '#ffffff' }]}>Submission #{paymentHistory.length - idx}</Text>
                        <View style={[
                          styles.statusBadge, 
                          isApproved && { backgroundColor: '#e8f5e9', borderColor: '#2e7d32' },
                          isRejected && { backgroundColor: '#ffebee', borderColor: '#c62828' },
                          !isApproved && !isRejected && { backgroundColor: '#fff8e1', borderColor: '#ffe0b2' }
                        ]}>
                          <Text style={[
                            styles.statusBadgeText,
                            isApproved && { color: '#2e7d32' },
                            isRejected && { color: '#c62828' },
                            !isApproved && !isRejected && { color: '#f57c00' }
                          ]}>{(item.status || 'pending').toUpperCase()}</Text>
                        </View>
                      </View>

                      <View style={styles.historyCardRow}>
                        <Text style={[styles.historyLabel, darkMode && { color: '#aaaaaa' }]}>Date:</Text>
                        <Text style={[styles.historyValue, darkMode && { color: '#ffffff' }]}>{formatDate(item.submittedAt)}</Text>
                      </View>

                      <View style={styles.historyCardRow}>
                        <Text style={[styles.historyLabel, darkMode && { color: '#aaaaaa' }]}>UTR ID:</Text>
                        <Text style={[styles.historyValue, darkMode && { color: '#ffffff' }]} numberOfLines={1}>{item.transactionId || 'N/A'}</Text>
                      </View>

                      {item.screenshotUrl && (
                        <View style={{ marginTop: 8 }}>
                          <TouchableOpacity 
                            style={[styles.viewReceiptBtn, darkMode && { backgroundColor: '#2a2a3e', borderColor: '#444444' }]}
                            onPress={() => setExpandedAckId(expandedAckId === item.id ? null : item.id)}
                          >
                            <Text style={[styles.viewReceiptBtnText, darkMode && { color: '#cccccc' }]}>
                              {expandedAckId === item.id ? 'Hide Receipt' : 'View Receipt'}
                            </Text>
                          </TouchableOpacity>
                          {expandedAckId === item.id && (
                            <Image source={{ uri: item.screenshotUrl }} style={styles.expandedReceiptImage} />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* Confirmation Dialog Modal for Mobile */}
      <Modal visible={isDialogOpen} transparent animationType="fade" onRequestClose={() => setIsDialogOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && { backgroundColor: '#1e1e1e', borderColor: '#333333' }]}>
            <Text style={[styles.modalTitle, darkMode && { color: '#ffffff' }]}>Request Payment QR Code</Text>
            <Text style={[styles.modalBody, darkMode && { color: '#aaaaaa' }]}>
              Are you sure you want to request the fee payment QR code? 
              Once approved, it will be visible for a limited duration set by the administrator.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 }}>
              <TouchableOpacity onPress={() => setIsDialogOpen(false)} style={[styles.modalCancelBtn, darkMode && { backgroundColor: '#2a2a2a' }]}>
                <Text style={[styles.modalCancelBtnText, darkMode && { color: '#cccccc' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRequestQr} disabled={submitting} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmBtnText}>{submitting ? 'Sending...' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: '#f5f5f5'
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4
  },
  headerSub: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20
  },
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center'
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff3e0',
    borderColor: '#ffe0b2',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 15
  },
  pendingBadgeText: {
    color: '#e65100',
    fontSize: 13,
    fontWeight: 'bold'
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f5e9',
    borderColor: '#c8e6c9',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 15
  },
  activeBadgeText: {
    color: '#2e7d32',
    fontSize: 13,
    fontWeight: 'bold'
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    textAlign: 'center'
  },
  bodyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginHorizontal: 10
  },
  refreshBtn: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 5
  },
  refreshBtnText: {
    color: '#c62828',
    fontSize: 14,
    fontWeight: 'bold'
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#c62828',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginTop: 5
  },
  requestBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold'
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    maxWidth: 200,
    alignSelf: 'center'
  },
  timerText: {
    fontSize: 14,
    color: '#666666'
  },
  timerValue: {
    color: '#c62828',
    fontWeight: 'bold'
  },
  qrContainer: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 5
  },
  qrImage: {
    width: 180,
    height: 180,
    resizeMode: 'contain'
  },
  placeholderBox: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    gap: 6
  },
  placeholderText: {
    color: '#9e9e9e',
    fontSize: 14
  },
  formContainer: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 17,
    borderWidth: 1,
    borderColor: '#eeeeee',
    marginTop: 10
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
    fontWeight: 'bold'
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderColor: '#cccccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#000000',
    fontSize: 15
  },
  filePicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cccccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  filePickerText: {
    color: '#666666',
    fontSize: 14
  },
  previewBox: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0fdf4',
    borderColor: '#2e7d32',
    borderWidth: 1,
    borderRadius: 6
  },
  previewImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    borderRadius: 4
  },
  submitBtn: {
    backgroundColor: '#c62828',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold'
  },
  smallCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#c62828'
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111827'
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center'
  },
  emptyText: {
    color: '#757575',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 17,
    width: 260,
    gap: 6
  },
  historyCardTitle: {
    fontSize: 13,
    color: '#111827',
    fontWeight: 'bold'
  },
  statusBadge: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffe0b2',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2
  },
  statusBadgeText: {
    color: '#e65100',
    fontSize: 11,
    fontWeight: 'bold'
  },
  historyCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 14
  },
  historyLabel: {
    color: '#666666',
    fontSize: 14
  },
  historyValue: {
    color: '#111111',
    fontWeight: 'bold',
    fontSize: 14
  },
  viewReceiptBtn: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center'
  },
  viewReceiptBtnText: {
    color: '#333333',
    fontSize: 13,
    fontWeight: 'bold'
  },
  expandedReceiptImage: {
    width: '100%',
    height: 120,
    resizeMode: 'contain',
    borderRadius: 6,
    marginTop: 8,
    backgroundColor: '#fff'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 8
  },
  modalBody: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 18
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
    backgroundColor: '#f0f0f0'
  },
  modalCancelBtnText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: 'bold'
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
    backgroundColor: '#c62828'
  },
  modalConfirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
