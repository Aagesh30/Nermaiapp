import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CourseApi, StaffApi, AccessRulesApi, DashboardApi, LiveClassesApi } from '../core/services';
import api from '../core/api';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';

interface MobileLMSPagesProps {
  lmsSub: string;
  isAdmin: boolean;
  isTeacher?: boolean;
  darkMode?: boolean;
  executeEditOrApproval?: any;
  getFeatureAccess?: (key: string) => string;
  changeLmsSub?: (sub: string) => void;
}

export const MobileLMSPages: React.FC<MobileLMSPagesProps> = ({
  lmsSub,
  isAdmin,
  isTeacher = false,
  darkMode = false,
  executeEditOrApproval,
  getFeatureAccess = () => 'edit_direct',
  changeLmsSub,
}) => {
  // Theme colors
  const bgCard = darkMode ? '#1a1a2e' : '#ffffff';
  const textPrimary = darkMode ? '#ffffff' : '#111827';
  const textSecondary = darkMode ? '#9ca3af' : '#6b7280';
  const borderColor = darkMode ? 'rgba(139,0,0,0.35)' : '#e5e7eb';
  const inputBg = darkMode ? '#0f0f1a' : '#f9fafb';
  const themeRed = '#8B0000';

  // Common State
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Course & Curriculum State
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subtopics, setSubtopics] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all');

  // Zoom Accounts State
  const [zoomAccounts, setZoomAccounts] = useState<any[]>([]);

  // SACS Access Control State
  const [sacsRequests, setSacsRequests] = useState<any[]>([]);
  const [sacsSubTab, setSacsSubTab] = useState<'requests' | 'history' | 'permanent'>('requests');

  // Student Courses State
  const [studentCourses, setStudentCourses] = useState<any[]>([]);
  const [studentLiveClasses, setStudentLiveClasses] = useState<any[]>([]);

  // Live Classes state & attendance modal
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedAttendanceTitle, setSelectedAttendanceTitle] = useState('');
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [liveFilterTab, setLiveFilterTab] = useState<'all' | 'live' | 'upcoming' | 'ended'>('all');
  const [joiningClassId, setJoiningClassId] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form Data
  const [courseForm, setCourseForm] = useState({ name: '', description: '', visibility: 'private', price: '0', tags: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '', courseId: '', order: '0' });
  const [topicForm, setTopicForm] = useState({ name: '', description: '', subjectId: '', order: '0' });
  const [subtopicForm, setSubtopicForm] = useState({ name: '', description: '', topicId: '', order: '0' });
  const [teacherForm, setTeacherForm] = useState({ firstName: '', lastName: '', email: '', phone: '', loginUsername: '', loginPassword: '' });
  const [zoomForm, setZoomForm] = useState({ name: '', meetingSdkKey: '', meetingSdkSecret: '', s2sAccountId: '', s2sClientId: '', s2sClientSecret: '' });

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchCurriculum = async () => {
    setLoading(true);
    try {
      const [cRes, sRes, tRes, subRes, staffRes] = await Promise.all([
        CourseApi.listCourses().catch(() => ({ data: { data: [] } })),
        CourseApi.listAllSubjects().catch(() => ({ data: { data: [] } })),
        CourseApi.listAllTopics().catch(() => ({ data: { data: [] } })),
        CourseApi.listAllSubtopics().catch(() => ({ data: { data: [] } })),
        api.get('/erp/staff').catch(() => ({ data: { data: [] } })),
      ]);

      const cList = cRes.data?.data || [];
      const sList = sRes.data?.data || [];
      const tList = tRes.data?.data || [];
      const subList = subRes.data?.data || [];
      const staffList = staffRes.data?.data || staffRes.data || [];

      setCourses(cList);
      setSubjects(sList);
      setTopics(tList);
      setSubtopics(subList);
      setTeachers(staffList.filter((s: any) => s.role === 'teacher' && !s.isDeleted));
    } catch (err) {
      console.error('[MobileLMSPages] Curriculum fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchZoomAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/zoom-accounts');
      setZoomAccounts(res.data?.data || []);
    } catch (err) {
      console.error('[MobileLMSPages] Zoom fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSacs = async () => {
    setLoading(true);
    try {
      const res = await AccessRulesApi.listAccessRequests().catch(() => ({ data: { data: [] } }));
      const list = res?.data?.data || res?.data || [];
      setSacsRequests(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('[MobileLMSPages] SACS fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const [cRes, liveRes] = await Promise.all([
        DashboardApi.getStudentOverview().catch(() => ({ data: { data: {} } })),
        LiveClassesApi.getStudentLiveSessions().catch(() => ({ data: { data: [] } })),
      ]);
      setStudentCourses(cRes.data?.data?.myCourses || []);
      const liveList = liveRes.data?.data || liveRes.data || [];
      setStudentLiveClasses(Array.isArray(liveList) ? liveList : []);
    } catch (err) {
      console.error('[MobileLMSPages] Student data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery('');
    if (['lms-courses', 'lms-subjects', 'lms-topics', 'lms-subtopics', 'lms-syllabus'].includes(lmsSub)) {
      fetchCurriculum();
    } else if (lmsSub === 'lms-teachers') {
      fetchCurriculum();
    } else if (lmsSub === 'lms-zoom-accounts') {
      fetchZoomAccounts();
    } else if (lmsSub === 'lms-access') {
      fetchSacs();
    } else if (lmsSub === 'my-courses' || lmsSub === 'my-live') {
      fetchStudentData();
    } else {
      setLoading(false);
    }
  }, [lmsSub]);

  // Real-time Firestore sync for courses & subjects
  useEffect(() => {
    let unsubC: any;
    let unsubS: any;
    let unsubA: any;
    try {
      if (['lms-courses', 'lms-subjects', 'lms-topics', 'lms-subtopics'].includes(lmsSub)) {
        unsubC = onSnapshot(collection(db, 'courses'), (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c: any) => !c.isDeleted);
            setCourses(list);
          }
        });
        unsubS = onSnapshot(collection(db, 'subjects'), (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s: any) => !s.isDeleted);
            setSubjects(list);
          }
        });
      } else if (lmsSub === 'lms-access') {
        unsubA = onSnapshot(collection(db, 'access_requests'), (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r: any) => !r.isDeleted);
            setSacsRequests(list);
          }
        });
      }
    } catch {}

    return () => {
      if (unsubC) unsubC();
      if (unsubS) unsubS();
      if (unsubA) unsubA();
    };
  }, [lmsSub]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDeleteCourse = (course: any) => {
    Alert.alert('Delete Course', `Are you sure you want to delete "${course.name || course.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await CourseApi.deleteCourse(course.id);
            Alert.alert('Success', 'Course deleted.');
            fetchCurriculum();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete course');
          }
        },
      },
    ]);
  };

  const handleSaveCourse = async () => {
    if (!courseForm.name.trim()) return Alert.alert('Error', 'Please enter course title.');
    setSaving(true);
    try {
      const payload = {
        name: courseForm.name.trim(),
        title: courseForm.name.trim(),
        description: courseForm.description.trim(),
        visibility: courseForm.visibility,
        price: parseFloat(courseForm.price) || 0,
        tags: courseForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (editingItem) {
        await CourseApi.updateCourse(editingItem.id, payload);
        Alert.alert('Success', 'Course updated successfully!');
      } else {
        await CourseApi.createCourse(payload);
        Alert.alert('Success', 'Course created successfully!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = (subj: any) => {
    Alert.alert('Delete Subject', `Delete "${subj.name || subj.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await CourseApi.deleteSubject(subj.id);
            Alert.alert('Success', 'Subject deleted.');
            fetchCurriculum();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleSaveSubject = async () => {
    if (!subjectForm.name.trim()) return Alert.alert('Error', 'Please enter subject name.');
    if (!subjectForm.courseId) return Alert.alert('Error', 'Please select a course.');
    setSaving(true);
    try {
      const payload = {
        name: subjectForm.name.trim(),
        title: subjectForm.name.trim(),
        description: subjectForm.description.trim(),
        courseId: subjectForm.courseId,
        order: parseInt(subjectForm.order) || 0,
      };
      if (editingItem) {
        await CourseApi.updateSubject(editingItem.id, payload);
        Alert.alert('Success', 'Subject updated!');
      } else {
        await CourseApi.createSubject(subjectForm.courseId, payload);
        Alert.alert('Success', 'Subject created!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = (topic: any) => {
    Alert.alert('Delete Topic', `Delete "${topic.name || topic.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await CourseApi.deleteTopic(topic.id);
            Alert.alert('Success', 'Topic deleted.');
            fetchCurriculum();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleSaveTopic = async () => {
    if (!topicForm.name.trim()) return Alert.alert('Error', 'Please enter topic name.');
    if (!topicForm.subjectId) return Alert.alert('Error', 'Please select a subject.');
    setSaving(true);
    try {
      const payload = {
        name: topicForm.name.trim(),
        title: topicForm.name.trim(),
        description: topicForm.description.trim(),
        subjectId: topicForm.subjectId,
        order: parseInt(topicForm.order) || 0,
      };
      if (editingItem) {
        await CourseApi.updateTopic(editingItem.id, payload);
        Alert.alert('Success', 'Topic updated!');
      } else {
        await CourseApi.createTopic(topicForm.subjectId, payload);
        Alert.alert('Success', 'Topic created!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save topic');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubtopic = (subtopic: any) => {
    Alert.alert('Delete Subtopic', `Delete "${subtopic.name || subtopic.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await CourseApi.deleteSubtopic(subtopic.id);
            Alert.alert('Success', 'Subtopic deleted.');
            fetchCurriculum();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleSaveSubtopic = async () => {
    if (!subtopicForm.name.trim()) return Alert.alert('Error', 'Please enter subtopic name.');
    if (!subtopicForm.topicId) return Alert.alert('Error', 'Please select a topic.');
    setSaving(true);
    try {
      const payload = {
        name: subtopicForm.name.trim(),
        title: subtopicForm.name.trim(),
        description: subtopicForm.description.trim(),
        topicId: subtopicForm.topicId,
        order: parseInt(subtopicForm.order) || 0,
      };
      if (editingItem) {
        await CourseApi.updateSubtopic(editingItem.id, payload);
        Alert.alert('Success', 'Subtopic updated!');
      } else {
        await CourseApi.createSubtopic(subtopicForm.topicId, payload);
        Alert.alert('Success', 'Subtopic created!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save subtopic');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = (t: any) => {
    Alert.alert('Remove Teacher', `Remove "${t.name || t.firstName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/erp/staff/${t.id}`);
            Alert.alert('Success', 'Teacher removed.');
            fetchCurriculum();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to remove');
          }
        },
      },
    ]);
  };

  const handleSaveTeacher = async () => {
    if (!teacherForm.firstName.trim() || !teacherForm.email.trim()) {
      return Alert.alert('Error', 'Name and Email are required.');
    }
    setSaving(true);
    try {
      const payload = {
        firstName: teacherForm.firstName.trim(),
        lastName: teacherForm.lastName.trim(),
        name: `${teacherForm.firstName.trim()} ${teacherForm.lastName.trim()}`.trim(),
        email: teacherForm.email.trim(),
        phone: teacherForm.phone.trim(),
        loginUsername: teacherForm.loginUsername.trim(),
        loginPassword: teacherForm.loginPassword,
        role: 'teacher',
      };
      if (editingItem) {
        await api.put(`/erp/staff/${editingItem.id}`, payload);
        Alert.alert('Success', 'Teacher updated!');
      } else {
        await StaffApi.createStaff(payload);
        Alert.alert('Success', 'Teacher created!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save teacher');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveZoom = async () => {
    if (!zoomForm.name.trim()) return Alert.alert('Error', 'Account name is required.');
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/zoom-accounts/${editingItem.id}`, zoomForm);
        Alert.alert('Success', 'Zoom account updated!');
      } else {
        await api.post('/zoom-accounts', zoomForm);
        Alert.alert('Success', 'Zoom account added!');
      }
      setIsModalOpen(false);
      fetchZoomAccounts();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveSacs = async (req: any, days: number) => {
    Alert.alert('Approve Access', `Approve ${req.studentName || 'student'} for ${days === 0 ? 'Permanent' : `${days} days`}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            const expiresAt = days === 0 ? undefined : new Date(Date.now() + days * 86400000).toISOString();
            await AccessRulesApi.approveRequest(req.id, expiresAt);
            Alert.alert('Success', 'Request approved!');
            fetchSacs();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Approval failed');
          }
        },
      },
    ]);
  };

  const handleRejectSacs = async (req: any) => {
    Alert.alert('Reject Request', `Reject access request for ${req.studentName || 'this student'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await AccessRulesApi.rejectRequest(req.id, 'Rejected by admin');
            Alert.alert('Success', 'Request rejected.');
            fetchSacs();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Reject failed');
          }
        },
      },
    ]);
  };

  // ── Render Page Contents ──────────────────────────────────────────────────
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 16 }}>
      {/* ─── 1. COURSES PAGE ────────────────────────────────────────── */}
      {lmsSub === 'lms-courses' && (
        <View style={{ gap: 14 }}>
          {/* Header */}
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.pageTitle, { color: textPrimary }]}>Course Management</Text>
                <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                  {courses.length} active courses published.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setCourseForm({ name: '', description: '', visibility: 'private', price: '0', tags: '' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 12, height: 36 }]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Add Course</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor, marginTop: 12 }]}>
              <Ionicons name="search" size={14} color={textSecondary} />
              <TextInput
                placeholder="Search courses..."
                placeholderTextColor={textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: textPrimary }]}
              />
            </View>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : (
            courses
              .filter((c) => (c.name || c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
              .map((c) => (
                <View key={c.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary }}>{c.name || c.title}</Text>
                      {c.description ? (
                        <Text style={{ fontSize: 12, color: textSecondary, marginTop: 4 }} numberOfLines={2}>
                          {c.description}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
                        <View style={[styles.pill, { backgroundColor: c.visibility === 'public' ? '#dcfce7' : '#f3f4f6' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: c.visibility === 'public' ? '#16a34a' : '#6b7280' }}>
                            {(c.visibility || 'private').toUpperCase()}
                          </Text>
                        </View>
                        {c.price ? (
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#b45309' }}>₹{c.price}</Text>
                        ) : (
                          <Text style={{ fontSize: 11, color: textSecondary }}>Free</Text>
                        )}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingItem(c);
                          setCourseForm({
                            name: c.name || c.title || '',
                            description: c.description || '',
                            visibility: c.visibility || 'private',
                            price: String(c.price || '0'),
                            tags: Array.isArray(c.tags) ? c.tags.join(', ') : '',
                          });
                          setIsModalOpen(true);
                        }}
                        style={[styles.smallBtn, { backgroundColor: inputBg, borderColor, borderWidth: 1 }]}
                      >
                        <Ionicons name="pencil" size={13} color={textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteCourse(c)}
                        style={[styles.smallBtn, { backgroundColor: '#fee2e2' }]}
                      >
                        <Ionicons name="trash" size={13} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
          )}
        </View>
      )}

      {/* ─── 2. SUBJECTS PAGE ───────────────────────────────────────── */}
      {lmsSub === 'lms-subjects' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.pageTitle, { color: textPrimary }]}>Subject Management</Text>
                <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                  {subjects.length} subjects configured.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setSubjectForm({ name: '', description: '', courseId: courses[0]?.id || '', order: '0' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 12, height: 36 }]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Add Subject</Text>
              </TouchableOpacity>
            </View>

            {/* Course Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setSelectedCourseFilter('all')}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: selectedCourseFilter === 'all' ? themeRed : inputBg,
                    borderColor: selectedCourseFilter === 'all' ? themeRed : borderColor,
                  },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: selectedCourseFilter === 'all' ? '#fff' : textSecondary }}>
                  All Courses
                </Text>
              </TouchableOpacity>
              {courses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCourseFilter(c.id)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: selectedCourseFilter === c.id ? themeRed : inputBg,
                      borderColor: selectedCourseFilter === c.id ? themeRed : borderColor,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selectedCourseFilter === c.id ? '#fff' : textSecondary }}>
                    {c.name || c.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : (
            subjects
              .filter((s) => selectedCourseFilter === 'all' || s.courseId === selectedCourseFilter)
              .map((s) => {
                const cMatch = courses.find((c) => c.id === s.courseId);
                return (
                  <View key={s.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: textPrimary }}>{s.name || s.title}</Text>
                        <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                          Course: <Text style={{ fontWeight: '700', color: textPrimary }}>{cMatch?.name || cMatch?.title || 'General'}</Text>
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingItem(s);
                            setSubjectForm({
                              name: s.name || s.title || '',
                              description: s.description || '',
                              courseId: s.courseId || '',
                              order: String(s.order || '0'),
                            });
                            setIsModalOpen(true);
                          }}
                          style={[styles.smallBtn, { backgroundColor: inputBg, borderColor, borderWidth: 1 }]}
                        >
                          <Ionicons name="pencil" size={13} color={textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteSubject(s)}
                          style={[styles.smallBtn, { backgroundColor: '#fee2e2' }]}
                        >
                          <Ionicons name="trash" size={13} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
          )}
        </View>
      )}

      {/* ─── 3. TOPICS PAGE ─────────────────────────────────────────── */}
      {lmsSub === 'lms-topics' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.pageTitle, { color: textPrimary }]}>Topic Management</Text>
                <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                  {topics.length} topics configured.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setTopicForm({ name: '', description: '', subjectId: subjects[0]?.id || '', order: '0' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 12, height: 36 }]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Add Topic</Text>
              </TouchableOpacity>
            </View>

            {/* Subject Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setSelectedSubjectFilter('all')}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: selectedSubjectFilter === 'all' ? themeRed : inputBg,
                    borderColor: selectedSubjectFilter === 'all' ? themeRed : borderColor,
                  },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: selectedSubjectFilter === 'all' ? '#fff' : textSecondary }}>
                  All Subjects
                </Text>
              </TouchableOpacity>
              {subjects.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelectedSubjectFilter(s.id)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: selectedSubjectFilter === s.id ? themeRed : inputBg,
                      borderColor: selectedSubjectFilter === s.id ? themeRed : borderColor,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selectedSubjectFilter === s.id ? '#fff' : textSecondary }}>
                    {s.name || s.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : (
            topics
              .filter((t) => selectedSubjectFilter === 'all' || t.subjectId === selectedSubjectFilter)
              .map((t) => {
                const sMatch = subjects.find((s) => s.id === t.subjectId);
                return (
                  <View key={t.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: textPrimary }}>{t.name || t.title}</Text>
                        <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                          Subject: <Text style={{ fontWeight: '700', color: textPrimary }}>{sMatch?.name || sMatch?.title || '—'}</Text>
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingItem(t);
                            setTopicForm({
                              name: t.name || t.title || '',
                              description: t.description || '',
                              subjectId: t.subjectId || '',
                              order: String(t.order || '0'),
                            });
                            setIsModalOpen(true);
                          }}
                          style={[styles.smallBtn, { backgroundColor: inputBg, borderColor, borderWidth: 1 }]}
                        >
                          <Ionicons name="pencil" size={13} color={textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteTopic(t)}
                          style={[styles.smallBtn, { backgroundColor: '#fee2e2' }]}
                        >
                          <Ionicons name="trash" size={13} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
          )}
        </View>
      )}

      {/* ─── 4. SUBTOPICS PAGE ──────────────────────────────────────── */}
      {lmsSub === 'lms-subtopics' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.pageTitle, { color: textPrimary }]}>Subtopic Management</Text>
                <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                  {subtopics.length} subtopics configured.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setSubtopicForm({ name: '', description: '', topicId: topics[0]?.id || '', order: '0' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 12, height: 36 }]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Add Subtopic</Text>
              </TouchableOpacity>
            </View>

            {/* Filter by Topic */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setSelectedTopicFilter('all')}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: selectedTopicFilter === 'all' ? themeRed : inputBg,
                    borderColor: selectedTopicFilter === 'all' ? themeRed : borderColor,
                  },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: selectedTopicFilter === 'all' ? '#fff' : textSecondary }}>
                  All Topics
                </Text>
              </TouchableOpacity>
              {topics.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setSelectedTopicFilter(t.id)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: selectedTopicFilter === t.id ? themeRed : inputBg,
                      borderColor: selectedTopicFilter === t.id ? themeRed : borderColor,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selectedTopicFilter === t.id ? '#fff' : textSecondary }}>
                    {t.name || t.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : (
            subtopics
              .filter((st) => selectedTopicFilter === 'all' || st.topicId === selectedTopicFilter)
              .map((st) => {
                const tMatch = topics.find((t) => t.id === st.topicId);
                return (
                  <View key={st.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: textPrimary }}>{st.name || st.title}</Text>
                        <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                          Topic: <Text style={{ fontWeight: '700', color: textPrimary }}>{tMatch?.name || tMatch?.title || '—'}</Text>
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingItem(st);
                            setSubtopicForm({
                              name: st.name || st.title || '',
                              description: st.description || '',
                              topicId: st.topicId || '',
                              order: String(st.order || '0'),
                            });
                            setIsModalOpen(true);
                          }}
                          style={[styles.smallBtn, { backgroundColor: inputBg, borderColor, borderWidth: 1 }]}
                        >
                          <Ionicons name="pencil" size={13} color={textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteSubtopic(st)}
                          style={[styles.smallBtn, { backgroundColor: '#fee2e2' }]}
                        >
                          <Ionicons name="trash" size={13} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
          )}
        </View>
      )}

      {/* ─── 5. TEACHERS PAGE ───────────────────────────────────────── */}
      {lmsSub === 'lms-teachers' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.pageTitle, { color: textPrimary }]}>Teachers & Staffs</Text>
                <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                  {teachers.length} faculty members registered.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setTeacherForm({ firstName: '', lastName: '', email: '', phone: '', loginUsername: '', loginPassword: '' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 12, height: 36 }]}
              >
                <Ionicons name="person-add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Add Teacher</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor, marginTop: 12 }]}>
              <Ionicons name="search" size={14} color={textSecondary} />
              <TextInput
                placeholder="Search teachers..."
                placeholderTextColor={textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: textPrimary }]}
              />
            </View>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : (
            teachers
              .filter((t) => (t.name || t.firstName || t.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
              .map((t) => (
                <View key={t.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: textPrimary }}>
                        {t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}
                      </Text>
                      <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>{t.email}</Text>
                      {t.phone ? <Text style={{ fontSize: 11, color: textSecondary }}>{t.phone}</Text> : null}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingItem(t);
                          setTeacherForm({
                            firstName: t.firstName || t.name || '',
                            lastName: t.lastName || '',
                            email: t.email || '',
                            phone: t.phone || '',
                            loginUsername: t.loginUsername || '',
                            loginPassword: '',
                          });
                          setIsModalOpen(true);
                        }}
                        style={[styles.smallBtn, { backgroundColor: inputBg, borderColor, borderWidth: 1 }]}
                      >
                        <Ionicons name="pencil" size={13} color={textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteTeacher(t)}
                        style={[styles.smallBtn, { backgroundColor: '#fee2e2' }]}
                      >
                        <Ionicons name="trash" size={13} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
          )}
        </View>
      )}

      {/* ─── 6. ZOOM ACCOUNTS PAGE ─────────────────────────────────── */}
      {lmsSub === 'lms-zoom-accounts' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[styles.pageTitle, { color: textPrimary }]}>Zoom SDK Accounts</Text>
                <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                  {zoomAccounts.length} API credentials configured.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setZoomForm({ name: '', meetingSdkKey: '', meetingSdkSecret: '', s2sAccountId: '', s2sClientId: '', s2sClientSecret: '' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 12, height: 36 }]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Add Account</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : zoomAccounts.length === 0 ? (
            <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 30, alignItems: 'center' }]}>
              <Ionicons name="videocam-outline" size={32} color={textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginTop: 8 }}>
                No Zoom accounts configured.
              </Text>
            </View>
          ) : (
            zoomAccounts.map((za) => (
              <View key={za.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: textPrimary }}>{za.name}</Text>
                    <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                      Key: {za.meetingSdkKey || '—'}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: '#dcfce7', alignSelf: 'flex-start', marginTop: 6 }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#16a34a' }}>ACTIVE</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingItem(za);
                        setZoomForm({
                          name: za.name || '',
                          meetingSdkKey: za.meetingSdkKey || '',
                          meetingSdkSecret: za.meetingSdkSecret || '',
                          s2sAccountId: za.s2sAccountId || '',
                          s2sClientId: za.s2sClientId || '',
                          s2sClientSecret: za.s2sClientSecret || '',
                        });
                        setIsModalOpen(true);
                      }}
                      style={[styles.smallBtn, { backgroundColor: inputBg, borderColor, borderWidth: 1 }]}
                    >
                      <Ionicons name="pencil" size={13} color={textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ─── 7. ACCESS CONTROL (SACS) ───────────────────────────────── */}
      {lmsSub === 'lms-access' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <Text style={[styles.pageTitle, { color: textPrimary }]}>Smart Access Control (SACS)</Text>
            <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
              Manage access requests and permissions.
            </Text>

            {/* Sub-tabs */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => setSacsSubTab('requests')}
                style={[
                  styles.tabBtn,
                  { backgroundColor: sacsSubTab === 'requests' ? themeRed : inputBg, borderColor },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: sacsSubTab === 'requests' ? '#fff' : textSecondary }}>
                  Pending ({sacsRequests.filter((r) => (r.status || '').toLowerCase() === 'pending').length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSacsSubTab('history')}
                style={[
                  styles.tabBtn,
                  { backgroundColor: sacsSubTab === 'history' ? themeRed : inputBg, borderColor },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: sacsSubTab === 'history' ? '#fff' : textSecondary }}>
                  All Requests ({sacsRequests.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : sacsRequests.length === 0 ? (
            <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 32, alignItems: 'center' }]}>
              <Ionicons name="shield-checkmark-outline" size={44} color={textSecondary} />
              <Text style={{ color: textPrimary, fontWeight: 'bold', fontSize: 14, marginTop: 10 }}>No Access Requests</Text>
              <Text style={{ color: textSecondary, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                When students request permission to access locked materials, their requests will appear here.
              </Text>
            </View>
          ) : (
            sacsRequests
              .filter((r) => sacsSubTab === 'history' || (r.status || '').toLowerCase() === 'pending')
              .map((r) => {
                const statusLower = (r.status || 'pending').toLowerCase();
                const isPending = statusLower === 'pending';
                const isApproved = statusLower === 'approved';
                return (
                  <View key={r.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: textPrimary }}>{r.studentName || 'Student'}</Text>
                        <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                          Roll: {r.rollNumber || '—'} • Content: {r.resourceName || r.entityName || r.type || 'LMS Content'}
                        </Text>
                        {r.reason ? (
                          <Text style={{ fontSize: 11, color: textSecondary, marginTop: 4, fontStyle: 'italic' }}>
                            "{r.reason}"
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.pill, { backgroundColor: isApproved ? '#dcfce7' : isPending ? '#fef3c7' : '#fee2e2' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isApproved ? '#16a34a' : isPending ? '#b45309' : '#dc2626' }}>
                          {statusLower.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {isPending && (
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          onPress={() => handleRejectSacs(r)}
                          style={[styles.smallBtn, { backgroundColor: '#fee2e2' }]}
                        >
                          <Ionicons name="close" size={13} color="#dc2626" />
                          <Text style={[styles.smallBtnText, { color: '#dc2626' }]}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleApproveSacs(r, 7)}
                          style={[styles.smallBtn, { backgroundColor: '#16a34a' }]}
                        >
                          <Ionicons name="checkmark" size={13} color="#fff" />
                          <Text style={styles.smallBtnText}>7 Days</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleApproveSacs(r, 0)}
                          style={[styles.smallBtn, { backgroundColor: themeRed }]}
                        >
                          <Ionicons name="lock-open" size={13} color="#fff" />
                          <Text style={styles.smallBtnText}>Permanent</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
          )}
        </View>
      )}

      {/* ─── 8. SYLLABUS TRACKER ────────────────────────────────────── */}
      {lmsSub === 'lms-syllabus' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <Text style={[styles.pageTitle, { color: textPrimary }]}>Syllabus Tracker</Text>
            <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
              Track course coverage and completion status.
            </Text>

            {/* Course Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
              {courses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCourseFilter(c.id)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: selectedCourseFilter === c.id ? themeRed : inputBg,
                      borderColor: selectedCourseFilter === c.id ? themeRed : borderColor,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selectedCourseFilter === c.id ? '#fff' : textSecondary }}>
                    {c.name || c.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Subjects & Topics list */}
          {subjects
            .filter((s) => selectedCourseFilter === 'all' || s.courseId === selectedCourseFilter)
            .map((s) => (
              <View key={s.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="book-outline" size={18} color={themeRed} />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary, flex: 1 }}>{s.name || s.title}</Text>
                </View>
                <View style={{ marginTop: 10, gap: 6 }}>
                  {topics
                    .filter((t) => t.subjectId === s.id)
                    .map((t) => (
                      <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10 }}>
                        <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: textPrimary }}>{t.name || t.title}</Text>
                      </View>
                    ))}
                </View>
              </View>
            ))}
        </View>
      )}

      {/* ─── 9. NERMAI AI STUDIO ────────────────────────────────────── */}
      {lmsSub === 'lms-chatbot' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles" size={20} color="#b45309" />
              <Text style={[styles.pageTitle, { color: textPrimary }]}>NERMAI AI Studio</Text>
            </View>
            <Text style={{ fontSize: 12, color: textSecondary, marginTop: 6, lineHeight: 18 }}>
              AI Studio powers UPSC automated answer grading, student chatbot guidance, and smart question generation.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <View style={[styles.subCard, { flex: 1, backgroundColor: inputBg, borderColor }]}>
                <Text style={{ fontSize: 10, color: textSecondary, fontWeight: '700' }}>AI ENGINE</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#16a34a', marginTop: 2 }}>ONLINE</Text>
              </View>
              <View style={[styles.subCard, { flex: 1, backgroundColor: inputBg, borderColor }]}>
                <Text style={{ fontSize: 10, color: textSecondary, fontWeight: '700' }}>ASSISTANT</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: themeRed, marginTop: 2 }}>READY</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ─── 10. STUDENT: MY COURSES ────────────────────────────────── */}
      {lmsSub === 'my-courses' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <Text style={[styles.pageTitle, { color: textPrimary }]}>My Enrolled Courses</Text>
            <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
              Access your learning materials and video sessions.
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : studentCourses.length === 0 ? (
            <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 30, alignItems: 'center' }]}>
              <Ionicons name="school-outline" size={36} color={textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginTop: 8 }}>
                No active courses enrolled.
              </Text>
            </View>
          ) : (
            studentCourses.map((c: any) => (
              <View key={c.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary }}>{c.name || c.title}</Text>
                  <View style={[styles.pill, { backgroundColor: '#dcfce7' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#16a34a' }}>ENROLLED</Text>
                  </View>
                </View>
                {c.description ? (
                  <Text style={{ fontSize: 12, color: textSecondary, marginTop: 6 }}>{c.description}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}

      {/* ─── 11. STUDENT & ADMIN: LIVE CLASSES ──────────────────────────────── */}
      {lmsSub === 'my-live' && (() => {
        const categorizedClasses = studentLiveClasses.map((cls: any) => {
          const clsStatus = cls.status || 'scheduled';
          const scheduledTimeObj = cls.scheduledStartTime
            ? new Date(cls.scheduledStartTime._seconds ? cls.scheduledStartTime._seconds * 1000 : cls.scheduledStartTime)
            : (cls.scheduledAt ? new Date(cls.scheduledAt) : null);
          const startTimeMs = scheduledTimeObj ? scheduledTimeObj.getTime() : 0;
          const durationMins = cls.expectedDurationMinutes || cls.liveSession?.expectedDurationMinutes || 60;
          const endTimeMs = startTimeMs + durationMins * 60 * 1000;
          const isExpired = startTimeMs > 0 && Date.now() > endTimeMs;

          const isEnded = clsStatus === 'ENDED' || clsStatus === 'CANCELLED' || clsStatus === 'EXPIRED' || clsStatus === 'ARCHIVED' || clsStatus === 'ended' || isExpired;
          const isLive = !isEnded && (clsStatus === 'live' || clsStatus === 'active' || clsStatus === 'in_progress' || clsStatus === 'LIVE' || clsStatus === 'JOINING' || clsStatus === 'HOST_CONNECTED' || clsStatus === 'ATTENDANCE_RUNNING');
          const isUpcoming = !isEnded && !isLive;

          const statusColor = isLive ? '#2e7d32' : isEnded ? '#c62828' : '#f59e0b';
          const statusLabel = isLive ? '🟢 LIVE NOW' : isEnded ? '🔴 ENDED' : '🟡 UPCOMING';
          const scheduledTime = scheduledTimeObj
            ? scheduledTimeObj.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
            : (cls.scheduledAt || 'Time not set');

          return {
            ...cls,
            isLive,
            isEnded,
            isUpcoming,
            statusColor,
            statusLabel,
            scheduledTime,
          };
        });

        const liveCount = categorizedClasses.filter((c: any) => c.isLive).length;
        const upcomingCount = categorizedClasses.filter((c: any) => c.isUpcoming).length;
        const endedCount = categorizedClasses.filter((c: any) => c.isEnded).length;

        const filteredClasses = categorizedClasses.filter((c: any) => {
          if (liveFilterTab === 'live') return c.isLive;
          if (liveFilterTab === 'upcoming') return c.isUpcoming;
          if (liveFilterTab === 'ended') return c.isEnded;
          return true;
        });

        return (
          <View style={{ gap: 14 }}>
            {/* Page Header */}
            <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.pageTitle, { color: textPrimary }]}>Live Classes</Text>
                  <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                    Scheduled live lectures, real-time sessions, and recordings.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={fetchStudentData}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: themeRed,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    gap: 4
                  }}
                >
                  <Ionicons name="refresh-outline" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {/* Status Segment Filters */}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: `All (${categorizedClasses.length})` },
                  { key: 'live', label: `🟢 Live (${liveCount})` },
                  { key: 'upcoming', label: `🟡 Upcoming (${upcomingCount})` },
                  { key: 'ended', label: `🔴 Ended (${endedCount})` },
                ].map(tab => {
                  const isActive = liveFilterTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setLiveFilterTab(tab.key as any)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: isActive ? themeRed : (darkMode ? '#222238' : '#f3f4f6'),
                        borderWidth: 1,
                        borderColor: isActive ? themeRed : borderColor
                      }}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: isActive ? '#fff' : (darkMode ? '#aaa' : '#555')
                      }}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {loading ? (
              <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
            ) : filteredClasses.length === 0 ? (
              <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 30, alignItems: 'center' }]}>
                <Ionicons name="videocam-outline" size={36} color={textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginTop: 8 }}>
                  {liveFilterTab === 'live'
                    ? 'No classes are currently live.'
                    : liveFilterTab === 'upcoming'
                    ? 'No upcoming classes scheduled.'
                    : liveFilterTab === 'ended'
                    ? 'No ended classes found.'
                    : 'No live classes found.'}
                </Text>
              </View>
            ) : (
              filteredClasses.map((cls: any) => {
                const isJoining = joiningClassId === (cls.id || cls._id);
                const faculty = cls.instructorName || cls.teacherName || cls.staffName || '';
                const courseName = cls.courseName || cls.courseTitle || '';
                const batchName = cls.batchName || cls.targetBatchName || (cls.accessLevel === 'batch' ? 'Specific Batch' : (cls.accessLevel === 'free' ? 'All Students' : 'Enrolled Students'));
                const recUrl = cls.recordedUrl || cls.recordingUrl || cls.playbackUrl || cls.youtubeUrl || (cls.videoId ? `https://www.youtube.com/watch?v=${cls.videoId}` : null);

                return (
                  <View
                    key={cls.id || cls._id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: bgCard,
                        borderColor,
                        borderLeftWidth: 4,
                        borderLeftColor: cls.statusColor,
                        gap: 10
                      }
                    ]}
                  >
                    {/* Top Row: Status badge & scheduled time */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {cls.isLive && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00e676' }} />
                        )}
                        <View style={{ backgroundColor: cls.statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, color: cls.statusColor, fontWeight: 'bold' }}>
                            {cls.statusLabel}
                          </Text>
                        </View>
                        {cls.provider ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: darkMode ? '#222238' : '#f0f0f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Ionicons name="videocam-outline" size={11} color={textSecondary} />
                            <Text style={{ fontSize: 10, color: textSecondary, textTransform: 'capitalize' }}>
                              {cls.provider}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 11, color: textSecondary }}>{cls.scheduledTime}</Text>
                    </View>

                    {/* Title */}
                    <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary }}>
                      {cls.title || cls.className || 'Live Session'}
                    </Text>

                    {/* Metadata tags */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {courseName ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: darkMode ? '#1a2a3a' : '#f0f4f8', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 }}>
                          <Ionicons name="book-outline" size={11} color="#1976d2" />
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1976d2' }}>{courseName}</Text>
                        </View>
                      ) : null}
                      {batchName ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: darkMode ? '#1c3320' : '#e8f5e9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 }}>
                          <Ionicons name="people-outline" size={11} color="#2e7d32" />
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#2e7d32' }}>{batchName}</Text>
                        </View>
                      ) : null}
                    </View>

                    {faculty ? (
                      <Text style={{ fontSize: 11, color: textSecondary }}>
                        Faculty: <Text style={{ color: textPrimary, fontWeight: '600' }}>{faculty}</Text>
                      </Text>
                    ) : null}

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {isAdmin ? (
                        <>
                          {/* Admin: Start Class */}
                          {!cls.isEnded && (
                            <TouchableOpacity
                              onPress={async () => {
                                try {
                                  Alert.alert('Starting Class', 'Initializing meeting...');
                                  const sessionId = cls.id || cls._id;
                                  await api.post(`/live-sessions/${sessionId}/start`, {});
                                  let launched = false;
                                  if (cls.provider !== 'youtube') {
                                    try {
                                      const tokenRes = await api.post(`/live-sessions/${sessionId}/join-token`, {});
                                      const token = tokenRes.data?.token || tokenRes.token;
                                      if (token) {
                                        const popupUrl = `https://nermaiiasacademy-519c8.web.app/meeting-hosts/zoom-client-launch.html?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}&apiUrl=https://nermaiiasacademy-519c8.web.app`;
                                        await Linking.openURL(popupUrl);
                                        launched = true;
                                      }
                                    } catch (e) {}
                                  }
                                  if (!launched) {
                                    const fresh = cls.liveSession || cls;
                                    const launchUrl = fresh?.hostUrl || fresh?.launchPayload?.start_url || fresh?.launchPayload?.hostUrl || fresh?.participantUrl || cls.meetingUrl || null;
                                    if (launchUrl) {
                                      await Linking.openURL(launchUrl);
                                    }
                                  }
                                  fetchStudentData();
                                } catch (err: any) {
                                  Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to start session.');
                                }
                              }}
                              style={{
                                backgroundColor: '#2e7d32',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Ionicons name="play-circle-outline" size={15} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Start Class</Text>
                            </TouchableOpacity>
                          )}

                          {/* Admin: End Class */}
                          {!cls.isEnded && (
                            <TouchableOpacity
                              onPress={() => {
                                const sessionId = cls.id || cls._id;
                                Alert.alert(
                                  'End Live Class',
                                  `Are you sure you want to end "${cls.title || 'this session'}"?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'End Class',
                                      style: 'destructive',
                                      onPress: async () => {
                                        try {
                                          await api.post(`/live-sessions/${sessionId}/end-with-conversion`, {});
                                          Alert.alert('Ended', 'Live session ended successfully.');
                                          fetchStudentData();
                                        } catch (err: any) {
                                          Alert.alert('Error', err?.response?.data?.message || 'Failed to end session');
                                        }
                                      }
                                    }
                                  ]
                                );
                              }}
                              style={{
                                backgroundColor: '#c62828',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Ionicons name="stop-circle-outline" size={15} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>End Class</Text>
                            </TouchableOpacity>
                          )}

                          {/* Admin: View Attendance */}
                          <TouchableOpacity
                            onPress={async () => {
                              const sessionId = cls.id || cls._id;
                              setSelectedAttendanceTitle(cls.title || 'Live Session');
                              setAttendanceLoading(true);
                              setShowAttendanceModal(true);
                              try {
                                const res = await api.get(`/live-sessions/${sessionId}/attendance`);
                                const raw = res?.data;
                                let attList: any[] = [];
                                if (Array.isArray(raw)) {
                                  attList = raw;
                                } else if (raw && Array.isArray(raw.data)) {
                                  attList = raw.data;
                                } else if (raw && Array.isArray(raw.records)) {
                                  attList = raw.records;
                                } else if (raw && Array.isArray(raw.attendance)) {
                                  attList = raw.attendance;
                                } else if (Array.isArray(res)) {
                                  attList = res;
                                }
                                setAttendanceList(attList);
                              } catch (err: any) {
                                Alert.alert('Error', err?.response?.data?.message || 'Failed to fetch attendance');
                                setAttendanceList([]);
                              } finally {
                                setAttendanceLoading(false);
                              }
                            }}
                            style={{
                              backgroundColor: '#1976d2',
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 6,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Ionicons name="people-outline" size={15} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>View Attendance</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          {/* Student: Join Live Class */}
                          {!cls.isEnded ? (
                            <TouchableOpacity
                              disabled={isJoining}
                              onPress={async () => {
                                const sessionId = cls.id || cls._id;
                                const classId = cls.classId || cls.id || cls._id;
                                setJoiningClassId(sessionId);

                                // 1. Silently record attendance
                                api.post('/lms-attendance/join', {
                                  classId,
                                  className: cls.title || cls.name || 'Live Class',
                                  courseId: cls.courseId || '',
                                  courseName: cls.courseName || '',
                                  batchName: cls.batchName || ''
                                }).catch(err => console.error('Silent attendance error:', err));

                                // 2. Register real-time live attendance
                                api.post(`/live-attendance/student/${sessionId}/join`).catch(err => console.error('Live attendance error:', err));

                                // 3. Try token launch
                                let launched = false;
                                if (cls.provider !== 'youtube') {
                                  try {
                                    const tokenRes = await api.post(`/live-sessions/${sessionId}/join-token`, {});
                                    const token = tokenRes.data?.token || tokenRes.token;
                                    if (token) {
                                      const popupUrl = `https://nermaiiasacademy-519c8.web.app/meeting-hosts/zoom-client-launch.html?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}&apiUrl=https://nermaiiasacademy-519c8.web.app`;
                                      await Linking.openURL(popupUrl);
                                      launched = true;
                                    }
                                  } catch (e) {
                                    console.warn('Token error:', e);
                                  }
                                }

                                if (!launched) {
                                  try {
                                    const res = await api.get(`/live-sessions/${sessionId}/join`);
                                    const payload = res?.data?.data || res?.data || res;
                                    if (payload?.waiting) {
                                      Alert.alert('Class Scheduled', 'The instructor has not started this live session yet. Please try again once the class starts.');
                                      setJoiningClassId(null);
                                      return;
                                    }
                                    const launchUrl = payload?.joinUrl || payload?.join_url || payload?.meetUrl || payload?.url || payload?.sdk?.joinUrl || payload?.sdk?.join_url || (payload?.videoId ? `https://www.youtube.com/watch?v=${payload.videoId}` : null) || cls.participantUrl || cls.joinUrl || cls.meetingUrl;
                                    if (launchUrl) {
                                      await Linking.openURL(launchUrl);
                                    } else {
                                      Alert.alert('Notice', 'Meeting link is not available yet. Please check back shortly.');
                                    }
                                  } catch (err: any) {
                                    const fallbackUrl = cls.participantUrl || cls.joinUrl || cls.meetingUrl;
                                    if (fallbackUrl) {
                                      await Linking.openURL(fallbackUrl);
                                    } else {
                                      Alert.alert('Error', err?.response?.data?.message || 'Unable to join session at this time.');
                                    }
                                  }
                                }
                                setJoiningClassId(null);
                              }}
                              style={{
                                backgroundColor: '#2e7d32',
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                opacity: isJoining ? 0.7 : 1
                              }}
                            >
                              {isJoining ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Ionicons name="play-outline" size={15} color="#fff" />
                              )}
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                {isJoining ? 'Joining...' : 'Join Live Class'}
                              </Text>
                            </TouchableOpacity>
                          ) : null}

                          {/* Student: Watch Recording */}
                          {cls.isEnded && recUrl ? (
                            <TouchableOpacity
                              onPress={async () => {
                                try {
                                  await Linking.openURL(recUrl);
                                } catch (e) {
                                  Alert.alert('Notice', 'Unable to open recording URL.');
                                }
                              }}
                              style={{
                                backgroundColor: '#c62828',
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6
                              }}
                            >
                              <Ionicons name="logo-youtube" size={15} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Watch Recording</Text>
                            </TouchableOpacity>
                          ) : cls.isEnded ? (
                            <View style={{ backgroundColor: darkMode ? '#222238' : '#f5f5f5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}>
                              <Text style={{ fontSize: 11, color: textSecondary }}>Class Ended</Text>
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            {/* Attendance Modal (Admin) */}
            {showAttendanceModal && (
              <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowAttendanceModal(false)}>
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalBox, { backgroundColor: bgCard, borderColor, maxHeight: '80%' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 8 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary }}>Session Attendance</Text>
                        <Text style={{ fontSize: 11, color: textSecondary }} numberOfLines={1}>{selectedAttendanceTitle}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowAttendanceModal(false)} style={{ padding: 4 }}>
                        <Ionicons name="close" size={20} color={textSecondary} />
                      </TouchableOpacity>
                    </View>

                    {(() => {
                      const safeList = Array.isArray(attendanceList) ? attendanceList : [];
                      if (attendanceLoading) {
                        return <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 20 }} />;
                      }
                      if (safeList.length === 0) {
                        return (
                          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={32} color={textSecondary} />
                            <Text style={{ fontSize: 12, color: textSecondary, marginTop: 8 }}>No attendance recorded yet for this session.</Text>
                          </View>
                        );
                      }
                      return (
                        <ScrollView style={{ maxHeight: 300 }}>
                          {safeList.map((att: any, idx: number) => {
                            const name = att.studentName || att.userName || att.name || att.studentId || `Student ${idx + 1}`;
                            const email = att.studentEmail || att.email || att.regNo || '';
                            const joinTime = att.joinedAt ? new Date(att.joinedAt).toLocaleTimeString() : (att.timestamp ? new Date(att.timestamp).toLocaleTimeString() : '');
                            const status = att.status || (att.joinedAt || att.timestamp ? 'PRESENT' : 'ABSENT');
                            const isPresent = String(status).toUpperCase() === 'PRESENT';

                            return (
                              <View
                                key={att.id || att._id || att.studentId || idx}
                                style={{
                                  flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  paddingVertical: 8,
                                  borderBottomWidth: 1,
                                  borderBottomColor: borderColor
                                }}
                              >
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: textPrimary }}>{name}</Text>
                                  {email ? <Text style={{ fontSize: 10, color: textSecondary }}>{email}</Text> : null}
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                  <View style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    backgroundColor: isPresent ? '#e8f5e9' : '#ffebee'
                                  }}>
                                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: isPresent ? '#2e7d32' : '#c62828' }}>
                                      {status}
                                    </Text>
                                  </View>
                                  {joinTime ? (
                                    <Text style={{ fontSize: 9, color: textSecondary }}>{joinTime}</Text>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })}
                        </ScrollView>
                      );
                    })()}
                  </View>
                </View>
              </Modal>
            )}
          </View>
        );
      })()}

      {/* ─── MODAL (Add / Edit) ─────────────────────────────────────── */}
      <Modal visible={isModalOpen} transparent animationType="fade" onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>
                {editingItem ? 'Edit Item' : 'Create New'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Courses Form */}
            {lmsSub === 'lms-courses' && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.label, { color: textSecondary }]}>Course Title</Text>
                <TextInput
                  value={courseForm.name}
                  onChangeText={(t) => setCourseForm({ ...courseForm, name: t })}
                  placeholder="e.g. UPSC Prelims Foundation"
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                />
                <Text style={[styles.label, { color: textSecondary }]}>Description</Text>
                <TextInput
                  value={courseForm.description}
                  onChangeText={(t) => setCourseForm({ ...courseForm, description: t })}
                  placeholder="Course summary..."
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary, height: 60 }]}
                  multiline
                />
                <TouchableOpacity
                  onPress={handleSaveCourse}
                  disabled={saving}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Course</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Subjects Form */}
            {lmsSub === 'lms-subjects' && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.label, { color: textSecondary }]}>Subject Name</Text>
                <TextInput
                  value={subjectForm.name}
                  onChangeText={(t) => setSubjectForm({ ...subjectForm, name: t })}
                  placeholder="e.g. Indian Polity"
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                />
                <TouchableOpacity
                  onPress={handleSaveSubject}
                  disabled={saving}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Subject</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Topics Form */}
            {lmsSub === 'lms-topics' && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.label, { color: textSecondary }]}>Topic Name</Text>
                <TextInput
                  value={topicForm.name}
                  onChangeText={(t) => setTopicForm({ ...topicForm, name: t })}
                  placeholder="e.g. Fundamental Rights"
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                />
                <TouchableOpacity
                  onPress={handleSaveTopic}
                  disabled={saving}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Topic</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Subtopics Form */}
            {lmsSub === 'lms-subtopics' && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.label, { color: textSecondary }]}>Subtopic Name</Text>
                <TextInput
                  value={subtopicForm.name}
                  onChangeText={(t) => setSubtopicForm({ ...subtopicForm, name: t })}
                  placeholder="e.g. Article 19 Freedoms"
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                />
                <TouchableOpacity
                  onPress={handleSaveSubtopic}
                  disabled={saving}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Subtopic</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Teachers Form */}
            {lmsSub === 'lms-teachers' && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.label, { color: textSecondary }]}>First Name</Text>
                <TextInput
                  value={teacherForm.firstName}
                  onChangeText={(t) => setTeacherForm({ ...teacherForm, firstName: t })}
                  placeholder="Dr. Rajesh"
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                />
                <Text style={[styles.label, { color: textSecondary }]}>Email</Text>
                <TextInput
                  value={teacherForm.email}
                  onChangeText={(t) => setTeacherForm({ ...teacherForm, email: t })}
                  placeholder="rajesh@nermai.com"
                  placeholderTextColor={textSecondary}
                  keyboardType="email-address"
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                />
                <TouchableOpacity
                  onPress={handleSaveTeacher}
                  disabled={saving}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Teacher</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Zoom Form */}
            {lmsSub === 'lms-zoom-accounts' && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.label, { color: textSecondary }]}>Account Name</Text>
                <TextInput
                  value={zoomForm.name}
                  onChangeText={(t) => setZoomForm({ ...zoomForm, name: t })}
                  placeholder="e.g. UPSC Zoom Primary"
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                />
                <Text style={[styles.label, { color: textSecondary }]}>SDK Key</Text>
                <TextInput
                  value={zoomForm.meetingSdkKey}
                  onChangeText={(t) => setZoomForm({ ...zoomForm, meetingSdkKey: t })}
                  placeholder="Zoom Meeting SDK Key"
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                />
                <TouchableOpacity
                  onPress={handleSaveZoom}
                  disabled={saving}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Account</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  subCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  primaryBtn: {
    height: 40,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  smallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  searchBar: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
});
