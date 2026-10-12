import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SpecialMockRollNumberPageProps {
  api: any;
  user: any;
  darkMode: boolean;
  batches: any[];
  students: any[];
  loadStudents: () => Promise<void>;
  onNavigateToMocks?: () => void;
}

export const SpecialMockRollNumberPage: React.FC<SpecialMockRollNumberPageProps> = ({
  api,
  user,
  darkMode,
  batches = [],
  students = [],
  loadStudents,
  onNavigateToMocks
}) => {
  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });
    return () => sub?.remove?.();
  }, []);

  const isMobile = screenData.width < 768;

  // Server config state
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [startingRollNo, setStartingRollNo] = useState('182026');
  const [lastAssignedRollNo, setLastAssignedRollNo] = useState<number | null>(null);
  const [allocatedBatches, setAllocatedBatches] = useState<any[]>([]);

  // Form & selection states
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHallTicketSettings, setShowHallTicketSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'initial' | 'append' | 'history'>('initial');
  const [forceReassignAll, setForceReassignAll] = useState(false);

  // In-App Modal Dialog State (Universal Web & Mobile APK)
  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon: string;
    iconColor: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonColor?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    icon: 'information-circle',
    iconColor: '#1565c0'
  });

  const showNotification = (title: string, message: string, isError: boolean = false) => {
    setModalConfig({
      visible: true,
      title,
      message,
      icon: isError ? 'alert-circle' : 'checkmark-circle',
      iconColor: isError ? '#ef4444' : '#16a34a',
      confirmText: 'OK',
      cancelText: '',
      confirmButtonColor: isError ? '#ef4444' : '#16a34a',
      onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false }))
    });
  };

  const showConfirm = (options: {
    title: string;
    message: string;
    confirmText: string;
    confirmButtonColor?: string;
    icon?: string;
    iconColor?: string;
    onConfirm: () => void;
  }) => {
    setModalConfig({
      visible: true,
      title: options.title,
      message: options.message,
      icon: options.icon || 'help-circle',
      iconColor: options.iconColor || '#c62828',
      confirmText: options.confirmText,
      cancelText: 'Cancel',
      confirmButtonColor: options.confirmButtonColor || '#c62828',
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, visible: false }));
        options.onConfirm();
      }
    });
  };

  // Hall ticket metadata
  const [examName, setExamName] = useState('UPSC Special Mock Examination');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('10:00 AM - 12:00 PM');
  const [venue, setVenue] = useState('NERMAI IAS Academy Main Campus');
  const [instructions, setInstructions] = useState(
    '1. Bring printed copy of this Hall Ticket and original ID Proof.\n2. Standard blue/black ballpoint pen only.\n3. Electronic gadgets are strictly prohibited.'
  );

  // Fetch current config from backend
  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await api.get('/erp/student/mock-roll/config');
      const data = res?.data || res;
      if (data) {
        const locked = Boolean(data.isLocked);
        setIsLocked(locked);
        if (data.startingRollNo) setStartingRollNo(String(data.startingRollNo));
        if (data.lastAssignedRollNo !== undefined) setLastAssignedRollNo(data.lastAssignedRollNo);
        if (Array.isArray(data.allocatedBatches)) setAllocatedBatches(data.allocatedBatches);
        if (data.hallTicketDefaults) {
          if (data.hallTicketDefaults.examName) setExamName(data.hallTicketDefaults.examName);
          if (data.hallTicketDefaults.examDate) setExamDate(data.hallTicketDefaults.examDate);
          if (data.hallTicketDefaults.examTime) setExamTime(data.hallTicketDefaults.examTime);
          if (data.hallTicketDefaults.venue) setVenue(data.hallTicketDefaults.venue);
          if (data.hallTicketDefaults.instructions) setInstructions(data.hallTicketDefaults.instructions);
        }

        if (locked && data.allocatedBatches?.length > 0) {
          setActiveTab('append');
        } else {
          setActiveTab('initial');
        }
      }
    } catch (e: any) {
      console.error('Error fetching mock roll config:', e);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Compute all available batches from ERP
  const allAvailableBatchNames = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(batches)) {
      batches.forEach((b: any) => {
        const name = typeof b === 'string' ? b : b?.name || b?.batchName;
        if (name) set.add(String(name).trim());
      });
    }
    if (Array.isArray(students)) {
      students.forEach((s: any) => {
        if (s.batch) set.add(String(s.batch).trim());
        if (s.batchName) set.add(String(s.batchName).trim());
        if (Array.isArray(s.batches)) {
          s.batches.forEach((b: any) => {
            const name = typeof b === 'string' ? b : b?.batchName;
            if (name) set.add(String(name).trim());
          });
        }
      });
    }
    return Array.from(set).filter(Boolean).sort();
  }, [batches, students]);

  // Locked/already assigned batch names
  const lockedBatchNames = useMemo(() => {
    return new Set(allocatedBatches.map(a => a.batchName));
  }, [allocatedBatches]);

  // Batches available to append
  const unselectedBatchNames = useMemo(() => {
    return allAvailableBatchNames.filter(b => !lockedBatchNames.has(b));
  }, [allAvailableBatchNames, lockedBatchNames]);

  // Toggle batch selection
  const toggleBatch = (bName: string) => {
    setSelectedBatches(prev => {
      if (prev.includes(bName)) {
        return prev.filter(b => b !== bName);
      }
      return [...prev, bName];
    });
  };

  // Reorder batch sequence
  const moveBatchUp = (index: number) => {
    if (index <= 0) return;
    setSelectedBatches(prev => {
      const arr = [...prev];
      const temp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const moveBatchDown = (index: number) => {
    if (index >= selectedBatches.length - 1) return;
    setSelectedBatches(prev => {
      const arr = [...prev];
      const temp = arr[index + 1];
      arr[index + 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  // Live sequential calculation
  const calculatedAllocations = useMemo(() => {
    const isAppend = isLocked && activeTab === 'append';
    let currentRoll = isAppend
      ? (Number(lastAssignedRollNo || startingRollNo) + 1)
      : (parseInt(startingRollNo, 10) || 182026);

    const norm = (s: string) => String(s || '').trim().toLowerCase();
    const result: { batchName: string; count: number; totalInBatch: number; startRoll: number; endRoll: number }[] = [];
    let totalAssigned = 0;

    selectedBatches.forEach(bName => {
      const normB = norm(bName);
      const allBatchStudents = (students || []).filter(s => {
        const sBatches = [
          s.batch,
          s.batchName,
          ...(Array.isArray(s.batches) ? s.batches.map((b: any) => typeof b === 'string' ? b : b?.batchName) : [])
        ].filter(Boolean).map(norm);
        return sBatches.some(sb => sb === normB || sb.startsWith(normB + " ") || sb.startsWith(normB + "("));
      });

      const batchStudentsToAssign = allBatchStudents.filter(s => {
        if (isAppend && !forceReassignAll && s.mockRollNumber) {
          return false;
        }
        return true;
      });

      const count = batchStudentsToAssign.length;
      const totalInBatch = allBatchStudents.length;
      const startRoll = currentRoll;
      const endRoll = count > 0 ? (currentRoll + count - 1) : currentRoll;

      result.push({
        batchName: bName,
        count,
        totalInBatch,
        startRoll,
        endRoll
      });

      currentRoll += count;
      totalAssigned += count;
    });

    return {
      allocations: result,
      totalAssigned,
      nextRoll: currentRoll
    };
  }, [selectedBatches, startingRollNo, lastAssignedRollNo, students, isLocked, activeTab, forceReassignAll]);

  // Count total students who currently have constant mock roll numbers
  const totalStudentsWithMockRoll = useMemo(() => {
    return (students || []).filter(s => s && s.mockRollNumber).length;
  }, [students]);

  // Execute Generation & Auto Hall Ticket Issuance
  const handleGenerate = async (isAppend: boolean) => {
    if (selectedBatches.length === 0) {
      showNotification('Selection Required', 'Please select at least one batch to generate constant roll numbers.', true);
      return;
    }

    if (!isAppend && !startingRollNo.trim()) {
      showNotification('Input Required', 'Please enter a valid starting roll number (e.g., 182026).', true);
      return;
    }

    const confirmMsg = isAppend
      ? `This will assign continuous roll numbers from ${calculatedAllocations.allocations[0]?.startRoll || 'next'} to ${calculatedAllocations.totalAssigned} candidate(s) in ${selectedBatches.length} batch(es) and automatically issue their hall tickets.\n\nProceed?`
      : `This will fix constant roll numbers starting from ${startingRollNo} for ${calculatedAllocations.totalAssigned} candidate(s) across ${selectedBatches.length} batch(es) and automatically generate their hall tickets.\n\nProceed?`;

    const executeGeneration = async () => {
      setIsSubmitting(true);
      try {
        const payload = {
          startingRollNo: startingRollNo.trim(),
          orderedBatches: selectedBatches,
          isAppendMode: isAppend,
          forceReassignAll: isAppend && forceReassignAll,
          hallTicketData: {
            examName: examName.trim() || 'UPSC Special Mock Examination',
            examDate: examDate.trim(),
            examTime: examTime.trim(),
            venue: venue.trim(),
            instructions: instructions.trim()
          }
        };

        const res = await api.post('/erp/student/mock-roll/generate', payload);
        const successMsg = res?.message || 'Roll numbers locked and hall tickets generated successfully!';
        
        await Promise.all([fetchConfig(), loadStudents()]);
        setSelectedBatches([]);
        showNotification('Success!', successMsg);
      } catch (e: any) {
        console.error('Generation error:', e);
        const errMsg = e.message || 'Failed to generate roll numbers and hall tickets.';
        showNotification('Error', errMsg, true);
      } finally {
        setIsSubmitting(false);
      }
    };

    showConfirm({
      title: isAppend ? 'Append Batches & Generate?' : 'Lock Roll Numbers & Issue Tickets?',
      message: confirmMsg,
      confirmText: 'Generate Now',
      confirmButtonColor: '#16a34a',
      icon: 'ticket',
      iconColor: '#16a34a',
      onConfirm: executeGeneration
    });
  };

  // Handle Backend Unlock / Reconfigure
  const handleUnlockConfig = async () => {
    showConfirm({
      title: 'Unlock & Revert Hall Tickets?',
      message: 'Unlocking will reset locked batches, clear assigned mock roll numbers, and revert the generated hall tickets for all students.\n\nAre you sure you want to proceed?',
      confirmText: 'Unlock & Revert',
      confirmButtonColor: '#dc2626',
      icon: 'lock-open',
      iconColor: '#dc2626',
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          const res = await api.post('/erp/student/mock-roll/unlock', {});
          await Promise.all([fetchConfig(), loadStudents()]);
          setSelectedBatches([]);
          setActiveTab('initial');
          showNotification('Unlocked & Reverted', res?.message || 'Configuration unlocked and hall tickets reverted successfully.');
        } catch (e: any) {
          console.error('Unlock error:', e);
          showNotification('Error', e?.message || 'Failed to unlock roll number configuration.', true);
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  return (
    <ScrollView
      style={[styles.container, darkMode && styles.containerDark]}
      contentContainerStyle={{ padding: isMobile ? 8 : 16, gap: 12 }}
    >
      {/* Top Banner / Hero */}
      <View style={[styles.card, darkMode && styles.cardDark, { borderLeftWidth: 5, borderLeftColor: '#c62828' }]}>
        <View style={{ flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="card" size={20} color="#c62828" />
              </View>
              <Text style={[styles.mainTitle, darkMode && styles.textWhite]}>
                Special Mock Roll Number Management
              </Text>
            </View>
            <Text style={[styles.subText, darkMode && styles.textMuted, { marginTop: 6 }]}>
              Generates a single, constant roll number per student across all Special Mocks. Automatically locks the roll numbers and issues hall tickets in one click.
            </Text>
          </View>

          {/* Quick Metrics */}
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <View style={[styles.statBox, darkMode && styles.statBoxDark]}>
              <Text style={styles.statLabel}>Total Assigned</Text>
              <Text style={[styles.statValue, { color: '#2e7d32' }]}>{totalStudentsWithMockRoll}</Text>
            </View>
            <View style={[styles.statBox, darkMode && styles.statBoxDark]}>
              <Text style={styles.statLabel}>Next Roll No</Text>
              <Text style={[styles.statValue, { color: '#c62828' }]}>
                {lastAssignedRollNo ? Number(lastAssignedRollNo) + 1 : startingRollNo}
              </Text>
            </View>
            <View style={[styles.statBox, darkMode && styles.statBoxDark]}>
              <Text style={styles.statLabel}>Status</Text>
              <Text style={[styles.statValue, { color: isLocked ? '#1565c0' : '#d97706', fontSize: 13 }]}>
                {isLocked ? '🔒 LOCKED' : '⚡ READY'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Controls */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, borderTopWidth: 1, borderColor: darkMode ? '#333' : '#eee', paddingTop: 12, flexWrap: 'wrap' }}>
          {!isLocked && (
            <TouchableOpacity
              onPress={() => { setActiveTab('initial'); setSelectedBatches([]); }}
              style={[styles.tabBtn, activeTab === 'initial' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === 'initial' && styles.tabBtnTextActive]}>
                Initial Roll Number Setup
              </Text>
            </TouchableOpacity>
          )}

          {isLocked && (
            <TouchableOpacity
              onPress={() => { setActiveTab('append'); setSelectedBatches([]); }}
              style={[styles.tabBtn, activeTab === 'append' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === 'append' && styles.tabBtnTextActive]}>
                + Add Batches (Continuous Rolls)
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setActiveTab('history')}
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
              Allocated Batches ({allocatedBatches.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Views */}
      {loadingConfig ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#c62828" />
          <Text style={{ marginTop: 10, color: darkMode ? '#ccc' : '#666', fontSize: 13 }}>Loading configuration...</Text>
        </View>
      ) : activeTab === 'history' ? (
        /* Allocated Batches History */
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.textWhite]}>
            Locked Batch Allocations & Roll Ranges
          </Text>
          <Text style={[styles.subText, darkMode && styles.textMuted, { marginBottom: 15 }]}>
            These batches have already been assigned permanent roll numbers. Roll numbers remain identical for every Special Mock test.
          </Text>

          {allocatedBatches.length === 0 ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Ionicons name="document-text-outline" size={36} color="#9e9e9e" />
              <Text style={{ marginTop: 8, color: '#888', fontSize: 13 }}>No batches have been locked yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {allocatedBatches.map((b, idx) => (
                <View
                  key={`${b.batchName}-${idx}`}
                  style={[styles.historyRow, darkMode && styles.historyRowDark]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 120 }}>
                    <View style={styles.badgeCircle}>
                      <Text style={styles.badgeText}>#{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.batchNameTitle, darkMode && styles.textWhite]}>{b.batchName}</Text>
                      <Text style={{ fontSize: 11, color: '#1565c0', fontWeight: 'bold', marginTop: 2 }}>
                        Roll Range: {b.startRoll} → {b.endRoll} ({b.count} candidates)
                      </Text>
                    </View>
                  </View>
                  <View style={styles.lockedTag}>
                    <Ionicons name="lock-closed" size={12} color="#1565c0" />
                    <Text style={styles.lockedTagText}>Constant</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {isLocked && (
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={handleUnlockConfig}
              style={[styles.secondaryBtn, { marginTop: 15, alignSelf: 'flex-start' }]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#c62828" />
              ) : (
                <Ionicons name="lock-open-outline" size={16} color="#c62828" />
              )}
              <Text style={{ color: '#c62828', fontWeight: 'bold', fontSize: 12 }}>Unlock / Re-configure Base Rolls</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* Create or Append Screen */
        <View style={{ gap: 16 }}>
          {/* Section 1: Starting Roll Number */}
          <View style={[styles.card, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textWhite]}>
              {activeTab === 'append' ? '1. Next Continuous Roll Number' : '1. Starting Roll Number'}
            </Text>
            <Text style={[styles.subText, darkMode && styles.textMuted, { marginBottom: 12 }]}>
              {activeTab === 'append'
                ? `Sequential numbering will seamlessly continue from roll number ${Number(lastAssignedRollNo || startingRollNo) + 1}.`
                : 'Enter the base roll number for the first student. All selected batches will be assigned consecutive numbers starting from here.'}
            </Text>

            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 15, alignItems: isMobile ? 'stretch' : 'center' }}>
              <View style={{ width: isMobile ? '100%' : 260 }}>
                <Text style={[styles.inputLabel, darkMode && styles.textWhite]}>Starting Roll No *</Text>
                <TextInput
                  style={[
                    styles.input,
                    darkMode && styles.inputDark,
                    activeTab === 'append' && { backgroundColor: darkMode ? '#333' : '#f1f5f9', opacity: 0.8 }
                  ]}
                  value={activeTab === 'append' ? String(Number(lastAssignedRollNo || startingRollNo) + 1) : startingRollNo}
                  onChangeText={setStartingRollNo}
                  editable={activeTab !== 'append'}
                  keyboardType="numeric"
                  placeholder="e.g. 182026"
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity
                onPress={() => setShowHallTicketSettings(!showHallTicketSettings)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: darkMode ? '#222' : '#f1f5f9',
                  borderWidth: 1,
                  borderColor: darkMode ? '#333' : '#e2e8f0',
                  marginTop: isMobile ? 0 : 18
                }}
              >
                <Ionicons name="options-outline" size={16} color="#c62828" />
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: darkMode ? '#fff' : '#334155' }}>
                  {showHallTicketSettings ? 'Hide Hall Ticket Template' : 'Edit Hall Ticket Template'}
                </Text>
                <Ionicons name={showHallTicketSettings ? 'chevron-up' : 'chevron-down'} size={14} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Collapsible Hall Ticket Settings */}
            {showHallTicketSettings && (
              <View style={{ marginTop: 15, padding: 14, backgroundColor: darkMode ? '#222' : '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: darkMode ? '#333' : '#e5e7eb', gap: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#c62828' }}>
                  Automatic Hall Ticket Template Details
                </Text>
                <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, darkMode && styles.textWhite]}>Exam Name</Text>
                    <TextInput
                      style={[styles.input, darkMode && styles.inputDark]}
                      value={examName}
                      onChangeText={setExamName}
                      placeholder="e.g. UPSC Special Mock Examination"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, darkMode && styles.textWhite]}>Exam Date</Text>
                    <TextInput
                      style={[styles.input, darkMode && styles.inputDark]}
                      value={examDate}
                      onChangeText={setExamDate}
                      placeholder="e.g. Sunday, 24th October 2026"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
                <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, darkMode && styles.textWhite]}>Venue Address</Text>
                    <TextInput
                      style={[styles.input, darkMode && styles.inputDark]}
                      value={venue}
                      onChangeText={setVenue}
                      placeholder="e.g. NERMAI IAS Academy Main Campus"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, darkMode && styles.textWhite]}>Exam Timing</Text>
                    <TextInput
                      style={[styles.input, darkMode && styles.inputDark]}
                      value={examTime}
                      onChangeText={setExamTime}
                      placeholder="e.g. 10:00 AM - 12:00 PM"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
                <View>
                  <Text style={[styles.inputLabel, darkMode && styles.textWhite]}>Candidate Instructions</Text>
                  <TextInput
                    style={[styles.input, darkMode && styles.inputDark, { height: 60, textAlignVertical: 'top' }]}
                    value={instructions}
                    onChangeText={setInstructions}
                    multiline
                    placeholder="Candidate instructions..."
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Section 2: Batch Selection & Order */}
          <View style={[styles.card, darkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, darkMode && styles.textWhite]}>
              2. Select Batches ({selectedBatches.length} Selected)
            </Text>
            <Text style={[styles.subText, darkMode && styles.textMuted, { marginBottom: 12 }]}>
              {activeTab === 'append'
                ? 'Select newly added or unassigned batches to give them continuous roll numbers.'
                : 'Click batches to select them. Arrange priority order using ▲ Up / ▼ Down so candidates are assigned sequentially.'}
            </Text>

            {/* Overwrite / Force Reassign Toggle for Append Mode */}
            {activeTab === 'append' && (
              <TouchableOpacity
                onPress={() => setForceReassignAll(!forceReassignAll)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14,
                  backgroundColor: forceReassignAll ? (darkMode ? '#372010' : '#fffbeb') : (darkMode ? '#1e293b' : '#f1f5f9'),
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: forceReassignAll ? '#f59e0b' : (darkMode ? '#334155' : '#cbd5e1')
                }}
              >
                <Ionicons
                  name={forceReassignAll ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={forceReassignAll ? '#d97706' : '#64748b'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: forceReassignAll ? '#b45309' : (darkMode ? '#fff' : '#334155') }}>
                    Include all students in selected batches (Reassign even if student already has mock roll)
                  </Text>
                  <Text style={{ fontSize: 11, color: forceReassignAll ? '#b45309' : '#64748b' }}>
                    {forceReassignAll
                      ? 'Enabled: Full batch (e.g., all 208 students in TB18) will receive new consecutive roll numbers.'
                      : 'Default: Only unassigned students with no mock roll number yet will be assigned.'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Batch Chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
              {(activeTab === 'append' ? unselectedBatchNames : allAvailableBatchNames).length === 0 ? (
                <Text style={{ fontSize: 13, color: '#999', fontStyle: 'italic', padding: 8 }}>
                  No available batches to select.
                </Text>
              ) : (
                (activeTab === 'append' ? unselectedBatchNames : allAvailableBatchNames).map(bName => {
                  const isSel = selectedBatches.includes(bName);
                  return (
                    <TouchableOpacity
                      key={bName}
                      onPress={() => toggleBatch(bName)}
                      style={[
                        styles.batchChip,
                        isSel && styles.batchChipSelected,
                        darkMode && !isSel && styles.batchChipDark
                      ]}
                    >
                      <Ionicons
                        name={isSel ? 'checkmark-circle' : 'add-circle-outline'}
                        size={14}
                        color={isSel ? '#fff' : (darkMode ? '#aaa' : '#64748b')}
                      />
                      <Text style={[
                        styles.batchChipText,
                        isSel && styles.batchChipTextSelected,
                        darkMode && !isSel && styles.textWhite
                      ]}>
                        {bName}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Ordered Batch Priority Queue */}
            {selectedBatches.length > 0 && (
              <View style={{ borderTopWidth: 1, borderColor: darkMode ? '#333' : '#eee', paddingTop: 12 }}>
                <Text style={[styles.inputLabel, darkMode && styles.textWhite, { marginBottom: 10 }]}>
                  Batch Sequence Priority (Roll numbers are assigned in this exact order):
                </Text>
                <View style={{ gap: 8 }}>
                  {selectedBatches.map((bName, idx) => {
                    const bAlloc = calculatedAllocations.allocations.find(a => a.batchName === bName);
                    const count = bAlloc ? bAlloc.count : 0;
                    const totalInB = bAlloc ? bAlloc.totalInBatch : count;
                    const startR = bAlloc ? bAlloc.startRoll : '—';
                    const endR = bAlloc ? bAlloc.endRoll : '—';

                    return (
                      <View
                        key={bName}
                        style={[styles.queueRow, darkMode && styles.queueRowDark]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 100 }}>
                          <View style={styles.badgeCircle}>
                            <Text style={styles.badgeText}>#{idx + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.batchNameTitle, darkMode && styles.textWhite]}>{bName}</Text>
                            <Text style={{ fontSize: 11, color: '#1565c0', fontWeight: 'bold' }}>
                              {count} candidates {activeTab === 'append' && !forceReassignAll ? `(${totalInB} total)` : ''} • Roll: {startR}{count > 1 ? `–${endR}` : ''}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <TouchableOpacity
                            disabled={idx === 0}
                            onPress={() => moveBatchUp(idx)}
                            style={[styles.orderBtn, idx === 0 && { opacity: 0.3 }]}
                          >
                            <Text style={styles.orderBtnText}>▲ Up</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={idx === selectedBatches.length - 1}
                            onPress={() => moveBatchDown(idx)}
                            style={[styles.orderBtn, idx === selectedBatches.length - 1 && { opacity: 0.3 }]}
                          >
                            <Text style={styles.orderBtnText}>▼ Down</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => toggleBatch(bName)}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="trash-outline" size={17} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Section 3: Live Preview & One-Click Generation */}
          {selectedBatches.length > 0 && (
            <View style={[styles.card, darkMode && styles.cardDark, { backgroundColor: darkMode ? '#142918' : '#f0fdf4', borderColor: darkMode ? '#22543d' : '#86efac' }]}>
              <View style={{ flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 12, gap: 8 }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: darkMode ? '#86efac' : '#166534' }}>
                    3. Live Allocation Preview & Instant Generation
                  </Text>
                  <Text style={{ fontSize: 12, color: darkMode ? '#a7f3d0' : '#15803d', marginTop: 2 }}>
                    Total: {calculatedAllocations.totalAssigned} candidates will receive locked roll numbers and hall tickets.
                  </Text>
                </View>

                <TouchableOpacity
                  disabled={isSubmitting}
                  onPress={() => handleGenerate(activeTab === 'append')}
                  style={{
                    backgroundColor: '#16a34a',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    alignSelf: isMobile ? 'stretch' : 'auto',
                    justifyContent: 'center',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="ticket" size={18} color="#fff" />
                  )}
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                    {isSubmitting
                      ? 'Generating...'
                      : activeTab === 'append'
                        ? `Append & Auto-Issue (${calculatedAllocations.totalAssigned})`
                        : `Lock Roll Nos & Auto-Issue (${calculatedAllocations.totalAssigned})`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Breakdown Table */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={{ width: '100%', minWidth: isMobile ? 320 : 460 }}>
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: darkMode ? '#22543d' : '#86efac', paddingBottom: 6, marginBottom: 6 }}>
                    <Text style={{ width: 30, fontWeight: 'bold', fontSize: 11, color: darkMode ? '#cbd5e1' : '#475569' }}>#</Text>
                    <Text style={{ flex: 1, minWidth: 100, fontWeight: 'bold', fontSize: 11, color: darkMode ? '#cbd5e1' : '#475569' }}>Batch</Text>
                    <Text style={{ width: 80, textAlign: 'center', fontWeight: 'bold', fontSize: 11, color: darkMode ? '#cbd5e1' : '#475569' }}>Candidates</Text>
                    <Text style={{ width: 110, textAlign: 'right', fontWeight: 'bold', fontSize: 11, color: darkMode ? '#cbd5e1' : '#475569' }}>Range</Text>
                  </View>
                  {calculatedAllocations.allocations.map((a, i) => (
                    <View key={a.batchName} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                      <Text style={{ width: 30, fontSize: 11, fontWeight: 'bold', color: darkMode ? '#fff' : '#1e293b' }}>#{i + 1}</Text>
                      <Text style={{ flex: 1, minWidth: 100, fontSize: 11, color: darkMode ? '#fff' : '#1e293b', fontWeight: '600' }} numberOfLines={1}>{a.batchName}</Text>
                      <Text style={{ width: 80, textAlign: 'center', fontSize: 11, color: '#1565c0', fontWeight: 'bold' }}>{a.count}</Text>
                      <Text style={{ width: 110, textAlign: 'right', fontSize: 11, color: '#2e7d32', fontWeight: 'bold' }}>
                        {a.count > 0 ? `${a.startRoll} → ${a.endRoll}` : '0'}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* Footer Navigation */}
      {onNavigateToMocks && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <TouchableOpacity
            onPress={onNavigateToMocks}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 }}
          >
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#c62828' }}>
              Proceed to Create Special Mock Exam
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#c62828" />
          </TouchableOpacity>
        </View>
      )}

      {/* Branded In-App Modal Dialog (Universal for Web & Native APK) */}
      <Modal
        visible={modalConfig.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalConfig(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${modalConfig.iconColor}15`, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 }}>
              <Ionicons name={modalConfig.icon as any} size={28} color={modalConfig.iconColor} />
            </View>

            <Text style={[styles.modalTitle, darkMode && styles.textWhite]}>
              {modalConfig.title}
            </Text>

            <Text style={[styles.modalMessage, darkMode && styles.textMuted]}>
              {modalConfig.message}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              {Boolean(modalConfig.cancelText) && (
                <TouchableOpacity
                  onPress={() => setModalConfig(prev => ({ ...prev, visible: false }))}
                  style={[styles.modalCancelBtn, darkMode && styles.modalCancelBtnDark]}
                >
                  <Text style={[styles.modalCancelBtnText, darkMode && styles.textWhite]}>
                    {modalConfig.cancelText}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={modalConfig.onConfirm}
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: modalConfig.confirmButtonColor || '#c62828' },
                  !modalConfig.cancelText && { flex: 1 }
                ]}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {modalConfig.confirmText || 'OK'}
                </Text>
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
    backgroundColor: '#f8fafc'
  },
  containerDark: {
    backgroundColor: '#121212'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  cardDark: {
    backgroundColor: '#1e1e1e',
    borderColor: '#333'
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4
  },
  subText: {
    fontSize: 12,
    color: '#64748b'
  },
  textWhite: {
    color: '#f8fafc'
  },
  textMuted: {
    color: '#94a3b8'
  },
  statBox: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80
  },
  statBoxDark: {
    backgroundColor: '#27272a'
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'transparent'
  },
  tabBtnActive: {
    backgroundColor: '#c62828'
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b'
  },
  tabBtnTextActive: {
    color: '#ffffff'
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a'
  },
  inputDark: {
    backgroundColor: '#27272a',
    borderColor: '#444',
    color: '#ffffff'
  },
  batchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  batchChipDark: {
    backgroundColor: '#27272a',
    borderColor: '#444'
  },
  batchChipSelected: {
    backgroundColor: '#c62828',
    borderColor: '#c62828'
  },
  batchChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155'
  },
  batchChipTextSelected: {
    color: '#ffffff'
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6
  },
  queueRowDark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46'
  },
  badgeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#c62828',
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 10
  },
  batchNameTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  orderBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#e0e7ff'
  },
  orderBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#3730a3'
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    flexWrap: 'wrap'
  },
  historyRowDark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46'
  },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'center'
  },
  lockedTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0369a1'
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  modalBoxDark: {
    backgroundColor: '#1e1e1e',
    borderColor: '#333',
    borderWidth: 1
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: 8
  },
  modalMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  modalCancelBtnDark: {
    backgroundColor: '#334155'
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalConfirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold'
  }
});
