import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StudentAnalyticsProps {
  user: any;
  student: any;
  studentAttempts: any[];
  allTests: any[];
}

export const StudentAnalyticsDashboard: React.FC<StudentAnalyticsProps> = ({
  user,
  student,
  studentAttempts,
  allTests,
}) => {
  // Compute submitted test attempts sorted chronologically (oldest to newest for trajectory)
  const submittedAttempts = useMemo(() => {
    const list = (studentAttempts || []).filter(
      (a: any) => a.isSubmitted && a.score !== null && a.score !== undefined
    );
    return list.sort((a: any, b: any) => {
      const timeA = a.submittedAt || a.createdAt || a.startTime || 0;
      const timeB = b.submittedAt || b.createdAt || b.startTime || 0;
      const tA = typeof timeA === 'object' && timeA?.seconds ? timeA.seconds * 1000 : new Date(timeA).getTime() || 0;
      const tB = typeof timeB === 'object' && timeB?.seconds ? timeB.seconds * 1000 : new Date(timeB).getTime() || 0;
      return tA - tB;
    });
  }, [studentAttempts]);

  // Derived metrics
  const totalAttempted = submittedAttempts.length;
  const totalAvailable = (allTests || []).length || totalAttempted;
  const latestAttempt = totalAttempted > 0 ? submittedAttempts[totalAttempted - 1] : null;
  const prevAttempt = totalAttempted > 1 ? submittedAttempts[totalAttempted - 2] : null;

  // Latest % vs Prev %
  const getAttemptPct = (a: any) => {
    if (!a) return 0;
    if (a.percentage !== undefined && a.percentage !== null) return Math.round(Number(a.percentage));
    if (a.totalMarks > 0) return Math.round((Number(a.score) / Number(a.totalMarks)) * 100);
    return 0;
  };

  const latestPct = getAttemptPct(latestAttempt);
  const prevPct = getAttemptPct(prevAttempt);
  const scoreDelta = totalAttempted >= 2 ? latestPct - prevPct : null;

  // Rolling 3-test window: Last 3 vs Prev 3
  const rollingWindow = useMemo(() => {
    if (totalAttempted < 4) return null;
    const last3 = submittedAttempts.slice(-3);
    const prev3 = submittedAttempts.slice(-6, -3);
    if (prev3.length === 0) return null;
    const avgLast3 = Math.round(last3.reduce((acc, a) => acc + getAttemptPct(a), 0) / last3.length);
    const avgPrev3 = Math.round(prev3.reduce((acc, a) => acc + getAttemptPct(a), 0) / prev3.length);
    return { avgLast3, avgPrev3, delta: avgLast3 - avgPrev3 };
  }, [submittedAttempts, totalAttempted]);

  // Overall average across all tests
  const overallAvg = useMemo(() => {
    if (totalAttempted === 0) return 0;
    const sum = submittedAttempts.reduce((acc, a) => acc + getAttemptPct(a), 0);
    return Math.round(sum / totalAttempted);
  }, [submittedAttempts, totalAttempted]);

  // Negative marks penalty calculation for the latest attempt (or all attempts sum)
  const accuracyInfo = useMemo(() => {
    if (!latestAttempt) {
      return { correct: 0, wrong: 0, skipped: 0, penalty: 0 };
    }
    const correct = Number(latestAttempt.correctAnswers || latestAttempt.correctCount || 0);
    const wrong = Number(latestAttempt.wrongAnswers || latestAttempt.wrongCount || 0);
    const totalQ = Number(latestAttempt.totalQuestions || correct + wrong);
    const skipped = Math.max(0, totalQ - (correct + wrong));
    // Default standard UPSC negative marking penalty is 0.66 marks or 1/3rd of marks
    const negMarksPerQ = latestAttempt.negativeMarks !== undefined ? Number(latestAttempt.negativeMarks) : 0.66;
    const penalty = Math.round(wrong * negMarksPerQ * 10) / 10;
    return { correct, wrong, skipped, penalty };
  }, [latestAttempt]);

  // Dynamic Rule-Based Plain-Language Insight
  const smartInsight = useMemo(() => {
    if (totalAttempted === 0) {
      return "Welcome to your performance analytics! Complete your first mock test to unlock accuracy insights, rank tracking, and improvement trends.";
    }
    if (totalAttempted === 1) {
      return `First test recorded at ${latestPct}%! Complete your upcoming tests to track your improvement trajectory and batch percentile.`;
    }
    const parts = [];
    if (scoreDelta !== null) {
      if (scoreDelta > 0) {
        parts.push(`Great progress! You are up +${scoreDelta}% compared to your previous mock test.`);
      } else if (scoreDelta < 0) {
        parts.push(`Your score dipped by ${Math.abs(scoreDelta)}% on the latest test.`);
      } else {
        parts.push(`Consistent performance holding steady with your previous test.`);
      }
    }
    if (accuracyInfo.wrong > 8 && accuracyInfo.penalty > 0) {
      parts.push(`You lost −${accuracyInfo.penalty} marks to ${accuracyInfo.wrong} wrong guesses — skipping risky questions will boost your rank!`);
    } else if (accuracyInfo.skipped > 10) {
      parts.push(`You skipped ${accuracyInfo.skipped} questions on the latest test.`);
    }
    return parts.join(' ');
  }, [totalAttempted, latestPct, scoreDelta, accuracyInfo]);

  // Offline attendance rate
  const attendanceRate = useMemo(() => {
    if (!student) return null;
    const attended = student.attendedDays !== undefined ? Number(student.attendedDays) : null;
    const total = student.totalDays !== undefined ? Number(student.totalDays) : null;
    if (attended !== null && total !== null && total > 0) {
      return Math.round((attended / total) * 100);
    }
    return null;
  }, [student]);

  return (
    <View style={styles.container}>
      {/* 💡 Plain-Language Insight Banner */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Ionicons name="bulb-outline" size={18} color="#c62828" />
          <Text style={styles.insightTitle}>Performance Insight</Text>
        </View>
        <Text style={styles.insightBody}>{smartInsight}</Text>
      </View>

      {/* [CARD 1] Test Performance & Progress Trajectory */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Mock Test Trajectory</Text>
            <Text style={styles.sectionSub}>Date-wise performance & improvement curve</Text>
          </View>
          {scoreDelta !== null && (
            <View style={[styles.deltaBadge, { backgroundColor: scoreDelta >= 0 ? '#e8f5e9' : '#ffebee' }]}>
              <Ionicons
                name={scoreDelta >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={scoreDelta >= 0 ? '#2e7d32' : '#c62828'}
              />
              <Text style={[styles.deltaText, { color: scoreDelta >= 0 ? '#2e7d32' : '#c62828' }]}>
                {scoreDelta >= 0 ? `+${scoreDelta}%` : `${scoreDelta}%`} vs Prev
              </Text>
            </View>
          )}
        </View>

        {/* High-level stats row */}
        <View style={styles.statGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{latestPct}%</Text>
            <Text style={styles.statLbl}>Latest Score</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#1565c0' }]}>{overallAvg}%</Text>
            <Text style={styles.statLbl}>Overall Average</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#2e7d32' }]}>
              {latestAttempt?.rank ? `#${latestAttempt.rank}` : (latestAttempt?.percentile ? `${Math.round(latestAttempt.percentile)}%ile` : '—')}
            </Text>
            <Text style={styles.statLbl}>Latest Rank/Standing</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#c62828' }]}>
              {totalAttempted}/{totalAvailable}
            </Text>
            <Text style={styles.statLbl}>Tests Attempted</Text>
          </View>
        </View>

        {/* Rolling 3-Test Window comparison banner if applicable */}
        {rollingWindow && (
          <View style={styles.rollingBanner}>
            <Ionicons name="stats-chart" size={16} color="#455a64" />
            <Text style={styles.rollingText}>
              Last 3 Tests Avg: <Text style={{ fontWeight: '700' }}>{rollingWindow.avgLast3}%</Text> vs Previous 3 Tests: <Text style={{ fontWeight: '700' }}>{rollingWindow.avgPrev3}%</Text>{' '}
              <Text style={{ color: rollingWindow.delta >= 0 ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
                ({rollingWindow.delta >= 0 ? `+${rollingWindow.delta}% overall rise` : `${rollingWindow.delta}% drop`})
              </Text>
            </Text>
          </View>
        )}

        {/* Chronological Test History List */}
        <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 12, marginBottom: 8 }]}>Recent Test History</Text>
        {submittedAttempts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={28} color="#9e9e9e" />
            <Text style={styles.emptyText}>No evaluated tests yet. Attempt a mock test to see your history!</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {submittedAttempts.slice(-5).reverse().map((att, idx) => {
              const pct = getAttemptPct(att);
              const rankStr = att.rank ? `Rank #${att.rank}` : (att.percentile ? `${Math.round(att.percentile)}%ile` : null);
              const color = pct >= 70 ? '#2e7d32' : pct >= 50 ? '#f57f17' : '#c62828';
              return (
                <View key={att.attemptId || idx} style={styles.testRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.testRowTitle} numberOfLines={1}>{att.testTitle || `Mock Test ${submittedAttempts.length - idx}`}</Text>
                    <Text style={styles.testRowSub}>
                      Score: {att.score}/{att.totalMarks || 100} {rankStr ? `• ${rankStr}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                    <Text style={[styles.testRowPct, { color }]}>{pct}%</Text>
                    <View style={styles.miniBarBg}>
                      <View style={[styles.miniBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* [CARD 2] Accuracy Breakdown & Negative Marking Impact */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Accuracy & Negative Marking</Text>
            <Text style={styles.sectionSub}>Impact of wrong guesses on your final score</Text>
          </View>
          <Ionicons name="pie-chart-outline" size={20} color="#c62828" />
        </View>

        {accuracyInfo.wrong > 0 && accuracyInfo.penalty > 0 && (
          <View style={styles.penaltyAlert}>
            <Ionicons name="alert-circle" size={18} color="#c62828" />
            <Text style={styles.penaltyAlertText}>
              <Text style={{ fontWeight: 'bold' }}>−{accuracyInfo.penalty} Marks lost</Text> to wrong guesses on your last test.
            </Text>
          </View>
        )}

        <View style={styles.accuracyGrid}>
          <View style={[styles.accuracyBox, { borderColor: '#c8e6c9', backgroundColor: '#f1f8e9' }]}>
            <Text style={[styles.accuracyNum, { color: '#2e7d32' }]}>{accuracyInfo.correct}</Text>
            <Text style={styles.accuracyLbl}>Correct Answers</Text>
          </View>
          <View style={[styles.accuracyBox, { borderColor: '#ffcdd2', backgroundColor: '#ffebee' }]}>
            <Text style={[styles.accuracyNum, { color: '#c62828' }]}>{accuracyInfo.wrong}</Text>
            <Text style={styles.accuracyLbl}>Incorrect / Guesses</Text>
          </View>
          <View style={[styles.accuracyBox, { borderColor: '#e0e0e0', backgroundColor: '#f5f5f5' }]}>
            <Text style={[styles.accuracyNum, { color: '#616161' }]}>{accuracyInfo.skipped}</Text>
            <Text style={styles.accuracyLbl}>Skipped / Left</Text>
          </View>
        </View>
      </View>

      {/* [CARD 3] Engagement & Consistency */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Consistency & Engagement</Text>
        <Text style={styles.sectionSub}>Attendance & test participation records</Text>

        <View style={{ gap: 12, marginTop: 10 }}>
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.metricLbl}>Test Participation</Text>
              <Text style={styles.metricVal}>
                {totalAttempted} of {totalAvailable} tests ({totalAvailable > 0 ? Math.round((totalAttempted / totalAvailable) * 100) : 0}%)
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${totalAvailable > 0 ? Math.min(100, Math.round((totalAttempted / totalAvailable) * 100)) : 0}%`,
                    backgroundColor: '#1565c0',
                  },
                ]}
              />
            </View>
          </View>

          {attendanceRate !== null && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.metricLbl}>Classroom Attendance</Text>
                <Text style={[styles.metricVal, { color: attendanceRate >= 75 ? '#2e7d32' : '#c62828' }]}>
                  {attendanceRate}%
                </Text>
              </View>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${attendanceRate}%`,
                      backgroundColor: attendanceRate >= 75 ? '#2e7d32' : '#c62828',
                    },
                  ]}
                />
              </View>
              {attendanceRate < 75 && (
                <Text style={{ fontSize: 11, color: '#c62828', marginTop: 2 }}>
                  * Below 75% target threshold. Please maintain regular attendance.
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 15,
  },
  insightCard: {
    backgroundColor: '#fff9f9',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#c62828',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c62828',
  },
  insightBody: {
    fontSize: 12,
    color: '#424242',
    lineHeight: 18,
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
    alignItems: 'flex-start',
    marginBottom: 12,
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
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  statLbl: {
    fontSize: 10,
    color: '#757575',
    marginTop: 2,
    textAlign: 'center',
  },
  rollingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eceff1',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  rollingText: {
    fontSize: 11,
    color: '#37474f',
    flex: 1,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 12,
    color: '#9e9e9e',
    textAlign: 'center',
    marginTop: 6,
  },
  testRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  testRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
  testRowSub: {
    fontSize: 11,
    color: '#757575',
    marginTop: 2,
  },
  testRowPct: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  miniBarBg: {
    width: 60,
    height: 4,
    backgroundColor: '#eeeeee',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
  },
  penaltyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  penaltyAlertText: {
    fontSize: 12,
    color: '#c62828',
    flex: 1,
  },
  accuracyGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  accuracyBox: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  accuracyNum: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  accuracyLbl: {
    fontSize: 10,
    color: '#616161',
    marginTop: 2,
    textAlign: 'center',
  },
  metricLbl: {
    fontSize: 12,
    color: '#616161',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#212121',
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
