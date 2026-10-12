import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../core/api';

interface AdminAnalyticsProps {
  batches: any[];
  students: any[];
  staff: any[];
  questions: any[];
  lmsCourses: any[];
  isAdmin: boolean;
}

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsProps> = ({
  batches,
  students,
  staff,
  questions,
  lmsCourses,
  isAdmin,
}) => {
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [loadingBatchData, setLoadingBatchData] = useState(false);
  const [batchAnalytics, setBatchAnalytics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'academic' | 'institution'>('academic');

  // Load batch academic analytics from backend
  const loadBatchAnalytics = async (batchName: string) => {
    setLoadingBatchData(true);
    try {
      const res = await api.get(`/test-portal/review/batch-analytics?batchName=${encodeURIComponent(batchName)}`);
      if (res?.data?.success) {
        setBatchAnalytics(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load batch analytics:', err);
    } finally {
      setLoadingBatchData(false);
    }
  };

  useEffect(() => {
    loadBatchAnalytics(selectedBatch);
  }, [selectedBatch]);

  // Tuition metrics
  const totalPaid = students.reduce((sum: number, s: any) => sum + (Number(s.feesPaid) || 0), 0);
  const totalExpected = students.reduce((sum: number, s: any) => sum + (Number(s.totalFees) || 0), 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Top Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'academic' && styles.tabBtnActive]}
          onPress={() => setActiveTab('academic')}
        >
          <Ionicons name="school-outline" size={16} color={activeTab === 'academic' ? '#fff' : '#555'} />
          <Text style={[styles.tabBtnTxt, activeTab === 'academic' && styles.tabBtnTxtActive]}>
            Academic & Test Analytics
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'institution' && styles.tabBtnActive]}
          onPress={() => setActiveTab('institution')}
        >
          <Ionicons name="business-outline" size={16} color={activeTab === 'institution' ? '#fff' : '#555'} />
          <Text style={[styles.tabBtnTxt, activeTab === 'institution' && styles.tabBtnTxtActive]}>
            Academy Overview & Tuition
          </Text>
        </TouchableOpacity>
      </View>

      {/* ================= VIEW 1: ACADEMIC & TEST ANALYTICS ================= */}
      {activeTab === 'academic' && (
        <View style={{ gap: 14 }}>
          {/* Batch Selector Bar */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select Batch Filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedBatch === 'all' && styles.filterChipActive]}
                  onPress={() => setSelectedBatch('all')}
                >
                  <Text style={[styles.filterChipTxt, selectedBatch === 'all' && styles.filterChipTxtActive]}>
                    All Batches ({students.length})
                  </Text>
                </TouchableOpacity>
                {batches.map(b => (
                  <TouchableOpacity
                    key={b.id || b.batchName}
                    style={[styles.filterChip, selectedBatch === b.batchName && styles.filterChipActive]}
                    onPress={() => setSelectedBatch(b.batchName)}
                  >
                    <Text style={[styles.filterChipTxt, selectedBatch === b.batchName && styles.filterChipTxtActive]}>
                      {b.batchName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {loadingBatchData ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#c62828" />
              <Text style={{ marginTop: 8, color: '#666' }}>Computing batch averages & student risk scores...</Text>
            </View>
          ) : (
            <>
              {/* Batch Health: Recent Tests Summary */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Batch Test Trajectory (Last 10 Tests)</Text>
                    <Text style={styles.sectionSub}>Class average, pass rates, and attendance rate</Text>
                  </View>
                  <TouchableOpacity onPress={() => loadBatchAnalytics(selectedBatch)}>
                    <Ionicons name="refresh" size={18} color="#c62828" />
                  </TouchableOpacity>
                </View>

                {(!batchAnalytics?.testOverview || batchAnalytics.testOverview.length === 0) ? (
                  <Text style={styles.emptyText}>No evaluated tests found for this batch selection.</Text>
                ) : (
                  <View style={{ gap: 10, marginTop: 4 }}>
                    {batchAnalytics.testOverview.map((t: any, idx: number) => {
                      const color = t.avgScore >= 60 ? '#2e7d32' : t.avgScore >= 45 ? '#f57f17' : '#c62828';
                      return (
                        <View key={t.testId || idx} style={styles.testOverviewRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.testTitle} numberOfLines={1}>{t.title}</Text>
                            <Text style={styles.testMeta}>
                              {t.totalSubmissions} attempts • {t.passRate}% pass rate • {t.participationRate}% participation
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', minWidth: 65 }}>
                            <Text style={[styles.testAvg, { color }]}>{t.avgScore}%</Text>
                            <Text style={styles.testAvgLbl}>Batch Avg</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Two Column Risk & Improvers Grid */}
              <View style={styles.twoCol}>
                {/* ⚠️ At-Risk Students */}
                <View style={[styles.card, { flex: 1, borderTopWidth: 3, borderTopColor: '#c62828' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="alert-circle" size={18} color="#c62828" />
                    <Text style={styles.sectionTitle}>At-Risk Students</Text>
                  </View>
                  <Text style={styles.sectionSub}>Falling test scores or critically below 35%</Text>

                  {(!batchAnalytics?.atRiskStudents || batchAnalytics.atRiskStudents.length === 0) ? (
                    <Text style={[styles.emptyText, { marginTop: 12 }]}>No high-risk students flagged! 🎉</Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {batchAnalytics.atRiskStudents.map((s: any, idx: number) => (
                        <View key={s.studentId || idx} style={styles.riskCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.studentName}>{s.studentName}</Text>
                            <Text style={styles.riskScore}>{s.latestScore}%</Text>
                          </View>
                          <Text style={styles.riskReason}>{s.reason}</Text>
                          {isAdmin && s.unpaidFees > 0 && (
                            <Text style={styles.feeWarning}>⚠️ Pending Fee: ₹{s.unpaidFees}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 🌟 Top Improvers */}
                <View style={[styles.card, { flex: 1, borderTopWidth: 3, borderTopColor: '#2e7d32' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="trending-up" size={18} color="#2e7d32" />
                    <Text style={styles.sectionTitle}>Top Improvers</Text>
                  </View>
                  <Text style={styles.sectionSub}>Highest jump between recent tests</Text>

                  {(!batchAnalytics?.topImprovers || batchAnalytics.topImprovers.length === 0) ? (
                    <Text style={[styles.emptyText, { marginTop: 12 }]}>Not enough consecutive tests yet.</Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {batchAnalytics.topImprovers.map((s: any, idx: number) => (
                        <View key={s.studentId || idx} style={styles.improverCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.studentName}>{s.studentName}</Text>
                            <Text style={styles.improverDelta}>+{s.delta}%</Text>
                          </View>
                          <Text style={styles.improverSub}>
                            Score moved from {s.previousScore}% ➔ {s.latestScore}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* ================= VIEW 2: INSTITUTION OVERVIEW & TUITION ================= */}
      {activeTab === 'institution' && (
        <View style={{ gap: 14 }}>
          {/* Academy Enrollments Overview */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Academy Enrollments Overview</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 }}>
              <View style={styles.enrollmentBox}>
                <Ionicons name="people" size={24} color="#c62828" />
                <Text style={styles.enrollmentNum}>{students.length}</Text>
                <Text style={styles.enrollmentLbl}>IAS Candidates</Text>
              </View>
              <View style={styles.enrollmentBox}>
                <Ionicons name="briefcase" size={24} color="#c62828" />
                <Text style={styles.enrollmentNum}>{staff.length}</Text>
                <Text style={styles.enrollmentLbl}>Faculty Members</Text>
              </View>
              <View style={styles.enrollmentBox}>
                <Ionicons name="checkbox" size={24} color="#c62828" />
                <Text style={styles.enrollmentNum}>{questions.length}</Text>
                <Text style={styles.enrollmentLbl}>Question Bank</Text>
              </View>
            </View>
          </View>

          {/* Tuition Ledger Metrics */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tuition Ledger Metrics</Text>
            <View style={{ gap: 8, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#212121' }}>Total Collected:</Text>
                <Text style={{ fontWeight: 'bold', color: '#2e7d32' }}>₹{totalPaid}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#212121' }}>Total Outstanding:</Text>
                <Text style={{ fontWeight: 'bold', color: '#c62828' }}>₹{totalExpected - totalPaid}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#212121' }}>Expected Revenue:</Text>
                <Text style={{ fontWeight: 'bold', color: '#212121' }}>₹{totalExpected}</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${collectionRate}%`, backgroundColor: '#2e7d32' }]} />
              </View>
              <Text style={{ fontSize: 11, color: '#757575', textAlign: 'right' }}>
                Collection rate: {collectionRate}%
              </Text>
            </View>
          </View>

          {/* Course Distributions */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Course Distributions</Text>
            {(() => {
              const dbCourseNames = lmsCourses.map(c => c.name || c.title || '').filter(Boolean);
              const studentCourseNames = students.map((s: any) => s.course || '').filter(Boolean);
              const courseList = [...new Set([...dbCourseNames, ...studentCourseNames])].sort();
              const totalCount = students.length || 1;
              if (courseList.length === 0) {
                return <Text style={styles.emptyText}>No courses configured.</Text>;
              }
              return (
                <View style={{ gap: 10, marginTop: 8 }}>
                  {courseList.map(c => {
                    const count = students.filter(
                      (s: any) => String(s.course || '').trim().toLowerCase() === c.trim().toLowerCase()
                    ).length;
                    const pct = Math.round((count / totalCount) * 100);
                    return (
                      <View key={c} style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: '#212121', fontSize: 13, fontWeight: '600' }}>{c}</Text>
                          <Text style={{ color: '#757575', fontSize: 12 }}>{count} ({pct}%)</Text>
                        </View>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: '#c62828' }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 15,
  },
  tabSwitcher: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabBtnActive: {
    backgroundColor: '#c62828',
    borderColor: '#c62828',
  },
  tabBtnTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#424242',
  },
  tabBtnTxtActive: {
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eeeeee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
  },
  sectionSub: {
    fontSize: 11,
    color: '#757575',
    marginTop: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#c62828',
    borderColor: '#c62828',
  },
  filterChipTxt: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTxtActive: {
    color: '#ffffff',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  testOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  testTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  testMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  testAvg: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  testAvgLbl: {
    fontSize: 9,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  riskCard: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#c62828',
  },
  studentName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#212121',
  },
  riskScore: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#c62828',
  },
  riskReason: {
    fontSize: 11,
    color: '#b71c1c',
    marginTop: 2,
  },
  feeWarning: {
    fontSize: 10,
    color: '#c62828',
    marginTop: 3,
    fontWeight: '600',
  },
  improverCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#2e7d32',
  },
  improverDelta: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  improverSub: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
  },
  enrollmentBox: {
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ffebee',
  },
  enrollmentNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#c62828',
    marginTop: 5,
  },
  enrollmentLbl: {
    fontSize: 11,
    color: '#757575',
    marginTop: 2,
  },
  barBg: {
    height: 8,
    backgroundColor: '#eeeeee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
});
