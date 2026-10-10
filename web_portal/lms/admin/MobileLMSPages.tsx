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
import { CourseApi, StaffApi, AccessRulesApi, DashboardApi, LiveClassesApi, ProviderAccountsApi } from '../core/services';
import api from '../core/api';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';
import { MobileExcelSyllabusModal } from './MobileExcelSyllabusModal';

const showUniversalAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title ? title + ': ' : ''}${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const showUniversalConfirm = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title ? title + '\n\n' : ''}${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

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

  // Excel Syllabus Modal
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [selectedCourseForExcel, setSelectedCourseForExcel] = useState<string>('');

  // Syllabus Tracker Expandable Accordion & Status
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [syllabusStatusFilter, setSyllabusStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'pending'>('all');

  // Zoom Accounts State
  const [zoomAccounts, setZoomAccounts] = useState<any[]>([]);

  // SACS Access Control State
  const [sacsRequests, setSacsRequests] = useState<any[]>([]);
  const [sacsHistory, setSacsHistory] = useState<any[]>([]);
  const [sacsPermanent, setSacsPermanent] = useState<any[]>([]);
  const [sacsSubTab, setSacsSubTab] = useState<'requests' | 'history' | 'permanent' | 'permissions'>('requests');
  const [sacsDurationDays, setSacsDurationDays] = useState<number>(7);
  const [sacsProcessingId, setSacsProcessingId] = useState<string | null>(null);
  const [sacsConfirmModal, setSacsConfirmModal] = useState<{
    type: 'reject' | 'revert';
    item: any;
  } | null>(null);
  const [sacsModalReason, setSacsModalReason] = useState<string>('');

  // Knowledge Studio & AI CMS State
  const [kbSubTab, setKbSubTab] = useState<'articles' | 'playground' | 'settings'>('articles');
  const [kbArticles, setKbArticles] = useState<any[]>([]);
  const [kbCollections, setKbCollections] = useState<any[]>([]);
  const [kbSettings, setKbSettings] = useState<any>({
    enableLLMFallback: false,
    llmProvider: 'openai',
    llmDailyLimit: 1000,
    llmMonthlyBudgetInr: 500,
    enableSlashCommands: true,
    enableContext: true,
    enableSuggestions: true,
    defaultLanguage: 'en',
  });
  const [kbPlaygroundQuery, setKbPlaygroundQuery] = useState('');
  const [kbPlaygroundAnswer, setKbPlaygroundAnswer] = useState<string | null>(null);
  const [kbQueryLoading, setKbQueryLoading] = useState(false);
  const [isKbArticleModalOpen, setIsKbArticleModalOpen] = useState(false);
  const [kbArticleForm, setKbArticleForm] = useState({ title: '', content: '', collectionId: '' });

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
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Data
  const [courseForm, setCourseForm] = useState({ name: '', description: '', visibility: 'private', price: '0', tags: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '', courseId: '', order: '0' });
  const [topicForm, setTopicForm] = useState({ name: '', description: '', subjectId: '', order: '0' });
  const [subtopicForm, setSubtopicForm] = useState({ name: '', description: '', topicId: '', order: '0' });
  const [teacherForm, setTeacherForm] = useState({ firstName: '', lastName: '', email: '', phone: '', loginUsername: '', loginPassword: '' });
  const [zoomForm, setZoomForm] = useState({ name: '', meetingSdkKey: '', meetingSdkSecret: '', s2sAccountId: '', s2sClientId: '', s2sClientSecret: '', priority: '1' });

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
      const res = await ProviderAccountsApi.listAccounts().catch(() => ({ data: { data: [] } }));
      const list = res.data?.data || res.data || [];
      setZoomAccounts(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('[MobileLMSPages] Zoom fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledgeStudio = async () => {
    setLoading(true);
    try {
      const [artRes, colRes, setRes] = await Promise.all([
        api.get('/kb/articles').catch(() => ({ data: { data: [] } })),
        api.get('/kb/collections').catch(() => ({ data: { data: [] } })),
        api.get('/kb/settings').catch(() => ({ data: { data: {} } })),
      ]);
      setKbArticles(artRes.data?.data || artRes.data || []);
      setKbCollections(colRes.data?.data || colRes.data || []);
      if (setRes.data?.data) {
        setKbSettings((prev: any) => ({ ...prev, ...setRes.data.data }));
      }
    } catch (err) {
      console.error('[MobileLMSPages] KB fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSacs = async () => {
    setLoading(true);
    try {
      const [reqRes, histRes, permRes] = await Promise.all([
        AccessRulesApi.listAccessRequests().catch(() => ({ data: { data: [] } })),
        AccessRulesApi.listAccessHistory().catch(() => ({ data: { data: [] } })),
        AccessRulesApi.listPermanentGrants().catch(() => ({ data: { data: [] } })),
      ]);
      const reqList = reqRes?.data?.data || reqRes?.data || [];
      const histList = histRes?.data?.data || histRes?.data || [];
      const permList = permRes?.data?.data || permRes?.data || [];
      setSacsRequests(Array.isArray(reqList) ? reqList : []);
      setSacsHistory(Array.isArray(histList) ? histList : []);
      setSacsPermanent(Array.isArray(permList) ? permList : []);
    } catch (err) {
      console.error('[MobileLMSPages] SACS fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const [cRes, liveRes, reqRes] = await Promise.all([
        DashboardApi.getStudentOverview().catch(() => ({ data: { data: {} } })),
        LiveClassesApi.getStudentLiveSessions().catch(() => ({ data: { data: [] } })),
        api.get('/access-requests/student/my').catch(() => ({ data: { data: [] } })),
      ]);
      setStudentCourses(cRes.data?.data?.myCourses || []);
      const liveList = liveRes.data?.data || liveRes.data || [];
      const rawReqs = reqRes.data?.data || reqRes.data || [];
      const reqList = Array.isArray(rawReqs) ? rawReqs : [];
      const pendingClassIds = new Set(
        reqList
          .filter((r: any) => r && (r.status === 'PENDING' || r.status === 'pending'))
          .map((r: any) => r.contentId || r.classId)
      );
      const approvedClassIds = new Set(
        reqList
          .filter((r: any) => r && (r.status === 'APPROVED' || r.status === 'approved' || r.status === 'GRANT' || r.status === 'GRANTED'))
          .map((r: any) => r.contentId || r.classId)
      );

      const enriched = (Array.isArray(liveList) ? liveList : []).map((cls: any) => {
        const cid = cls.classId || cls.id || cls._id;
        const isSacsApproved = approvedClassIds.has(cid);
        return {
          ...cls,
          accessRequestPending: pendingClassIds.has(cid) && !isSacsApproved,
          joinAllowed: cls.joinAllowed || isSacsApproved,
          accessDenied: isSacsApproved ? false : cls.accessDenied
        };
      });
      setStudentLiveClasses(enriched);
    } catch (err) {
      console.error('[MobileLMSPages] Student data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isModalOpen) setModalError(null);
  }, [isModalOpen]);

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
    } else if (lmsSub === 'lms-chatbot') {
      fetchKnowledgeStudio();
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
    let unsubReq: any;
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
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r: any) => !r.isDeleted && r.status === 'PENDING');
            if (list.length > 0) setSacsRequests(list);
          }
        });
        unsubS = onSnapshot(collection(db, 'access_history'), (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((h: any) => !h.isDeleted);
            if (list.length > 0) setSacsHistory(list);
          }
        });
      } else if (lmsSub === 'my-live' || lmsSub === 'my-courses') {
        unsubA = onSnapshot(collection(db, 'live_sessions'), () => {
          fetchStudentData();
        });
        // Real-time access requests sync: immediately reloads live class permissions when approved
        unsubReq = onSnapshot(collection(db, 'access_requests'), () => {
          fetchStudentData();
        });
      }
    } catch {}

    return () => {
      if (unsubC) unsubC();
      if (unsubS) unsubS();
      if (unsubA) unsubA();
      if (unsubReq) unsubReq();
    };
  }, [lmsSub]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDeleteCourse = (course: any) => {
    showUniversalConfirm(
      'Delete Course',
      `Are you sure you want to delete "${course.name || course.title}"?`,
      async () => {
        try {
          await CourseApi.deleteCourse(course.id);
          showUniversalAlert('Success', 'Course deleted.');
          fetchCurriculum();
        } catch (err: any) {
          showUniversalAlert('Error', err.response?.data?.message || err.message || 'Failed to delete course');
        }
      }
    );
  };

  const handleSaveCourse = async () => {
    setModalError(null);
    if (!courseForm.name.trim()) {
      const msg = 'Please enter course title.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
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
        showUniversalAlert('Success', 'Course updated successfully!');
      } else {
        await CourseApi.createCourse(payload);
        showUniversalAlert('Success', 'Course created successfully!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save course';
      setModalError(msg);
      showUniversalAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = (subj: any) => {
    showUniversalConfirm(
      'Delete Subject',
      `Delete "${subj.name || subj.title}"?`,
      async () => {
        try {
          await CourseApi.deleteSubject(subj.id);
          showUniversalAlert('Success', 'Subject deleted.');
          fetchCurriculum();
        } catch (err: any) {
          showUniversalAlert('Error', err.response?.data?.message || err.message || 'Failed to delete');
        }
      }
    );
  };

  const handleSaveSubject = async () => {
    setModalError(null);
    if (!subjectForm.name.trim()) {
      const msg = 'Please enter subject name.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
    if (!subjectForm.courseId) {
      const msg = 'Please select a course.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
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
        showUniversalAlert('Success', 'Subject updated!');
      } else {
        await CourseApi.createSubject(subjectForm.courseId, payload);
        showUniversalAlert('Success', 'Subject created!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save subject';
      setModalError(msg);
      showUniversalAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = (topic: any) => {
    showUniversalConfirm(
      'Delete Topic',
      `Delete "${topic.name || topic.title}"?`,
      async () => {
        try {
          await CourseApi.deleteTopic(topic.id);
          showUniversalAlert('Success', 'Topic deleted.');
          fetchCurriculum();
        } catch (err: any) {
          showUniversalAlert('Error', err.response?.data?.message || err.message || 'Failed to delete');
        }
      }
    );
  };

  const handleSaveTopic = async () => {
    setModalError(null);
    if (!topicForm.name.trim()) {
      const msg = 'Please enter topic name.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
    if (!topicForm.subjectId) {
      const msg = 'Please select a subject.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
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
        showUniversalAlert('Success', 'Topic updated!');
      } else {
        await CourseApi.createTopic(topicForm.subjectId, payload);
        showUniversalAlert('Success', 'Topic created!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save topic';
      setModalError(msg);
      showUniversalAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubtopic = (subtopic: any) => {
    showUniversalConfirm(
      'Delete Subtopic',
      `Delete "${subtopic.name || subtopic.title}"?`,
      async () => {
        try {
          await CourseApi.deleteSubtopic(subtopic.id);
          showUniversalAlert('Success', 'Subtopic deleted.');
          fetchCurriculum();
        } catch (err: any) {
          showUniversalAlert('Error', err.response?.data?.message || err.message || 'Failed to delete');
        }
      }
    );
  };

  const handleSaveSubtopic = async () => {
    setModalError(null);
    if (!subtopicForm.name.trim()) {
      const msg = 'Please enter subtopic name.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
    if (!subtopicForm.topicId) {
      const msg = 'Please select a topic.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
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
        showUniversalAlert('Success', 'Subtopic updated!');
      } else {
        await CourseApi.createSubtopic(subtopicForm.topicId, payload);
        showUniversalAlert('Success', 'Subtopic created!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save subtopic';
      setModalError(msg);
      showUniversalAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = (t: any) => {
    showUniversalConfirm(
      'Remove Teacher',
      `Remove "${t.name || t.firstName}"?`,
      async () => {
        try {
          await api.delete(`/erp/staff/${t.id}`);
          showUniversalAlert('Success', 'Teacher removed.');
          fetchCurriculum();
        } catch (err: any) {
          showUniversalAlert('Error', err.response?.data?.message || err.message || 'Failed to remove');
        }
      }
    );
  };

  const handleSaveTeacher = async () => {
    setModalError(null);
    const fName = teacherForm.firstName.trim();
    const lName = teacherForm.lastName.trim();
    const email = teacherForm.email.trim();

    if (!fName) {
      const msg = 'First Name is required.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
    if (!lName) {
      const msg = 'Last Name is required.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
    if (!email) {
      const msg = 'Email address is required.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
    if (!editingItem && (!teacherForm.loginUsername.trim() || !teacherForm.loginPassword)) {
      const msg = 'Login Username and Password are required for new teachers.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        firstName: fName,
        lastName: lName,
        name: `${fName} ${lName}`.trim(),
        email: email,
        phone: teacherForm.phone.trim(),
        designation: 'Teacher',
        department: 'Academics',
        role: 'teacher',
      };
      if (teacherForm.loginUsername.trim()) {
        payload.loginUsername = teacherForm.loginUsername.trim();
      }
      if (teacherForm.loginPassword) {
        payload.loginPassword = teacherForm.loginPassword;
      }

      if (editingItem) {
        await api.put(`/erp/staff/${editingItem.id}`, payload);
        showUniversalAlert('Success', 'Teacher updated successfully!');
      } else {
        await api.post('/erp/staff', payload);
        showUniversalAlert('Success', 'Teacher created successfully!');
      }
      setIsModalOpen(false);
      fetchCurriculum();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save teacher';
      setModalError(msg);
      showUniversalAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveZoom = async () => {
    setModalError(null);
    if (!zoomForm.name.trim()) {
      const msg = 'Account name is required.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: zoomForm.name.trim(),
        displayName: zoomForm.name.trim(),
        provider: 'zoom',
        credentials: {
          sdkKey: zoomForm.meetingSdkKey.trim(),
          sdkSecret: zoomForm.meetingSdkSecret.trim(),
          accountId: zoomForm.s2sAccountId.trim(),
          clientId: zoomForm.s2sClientId.trim(),
          clientSecret: zoomForm.s2sClientSecret.trim(),
        },
        priority: parseInt(zoomForm.priority) || 1,
        status: 'healthy',
        isActive: true,
      };
      if (editingItem) {
        await ProviderAccountsApi.updateAccount(editingItem.id, payload);
        showUniversalAlert('Success', 'Zoom account updated!');
      } else {
        await ProviderAccountsApi.createAccount(payload);
        showUniversalAlert('Success', 'Zoom account created!');
      }
      setIsModalOpen(false);
      fetchZoomAccounts();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save';
      setModalError(msg);
      showUniversalAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZoom = (za: any) => {
    showUniversalConfirm(
      'Delete Account',
      `Delete Zoom account "${za.displayName || za.name}"?`,
      async () => {
        try {
          await ProviderAccountsApi.deleteAccount(za.id);
          showUniversalAlert('Success', 'Zoom account deleted.');
          fetchZoomAccounts();
        } catch (err: any) {
          showUniversalAlert('Error', err.response?.data?.message || err.message || 'Failed to delete');
        }
      }
    );
  };

  const handleCycleSubtopicStatus = async (sub: any) => {
    const current = (sub.coverageStatus || 'pending').toLowerCase();
    const nextStatus = current === 'pending' ? 'in_progress' : current === 'in_progress' ? 'completed' : 'pending';
    const displayLabel = nextStatus === 'completed' ? 'Completed' : nextStatus === 'in_progress' ? 'In Progress' : 'Pending';

    // Optimistically update
    setSubtopics((prev) =>
      prev.map((s) => (s.id === sub.id ? { ...s, coverageStatus: displayLabel } : s))
    );

    try {
      await CourseApi.updateSubtopic(sub.id, { coverageStatus: displayLabel });
    } catch (err) {
      console.warn('Failed to update subtopic status on server', err);
    }
  };

  const handleSaveKbArticle = async () => {
    setModalError(null);
    if (!kbArticleForm.title.trim()) {
      const msg = 'Please enter article title.';
      setModalError(msg);
      showUniversalAlert('Validation Error', msg);
      return;
    }
    setSaving(true);
    try {
      await api.post('/kb/articles', {
        title: kbArticleForm.title.trim(),
        content: kbArticleForm.content.trim(),
        collectionId: kbArticleForm.collectionId || undefined,
      });
      showUniversalAlert('Success', 'Article published!');
      setIsKbArticleModalOpen(false);
      setKbArticleForm({ title: '', content: '', collectionId: '' });
      fetchKnowledgeStudio();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save article';
      setModalError(msg);
      showUniversalAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKbArticle = (art: any) => {
    showUniversalConfirm(
      'Delete Article',
      `Delete "${art.title}"?`,
      async () => {
        try {
          await api.delete(`/kb/articles/${art.id}`);
          showUniversalAlert('Success', 'Article deleted.');
          fetchKnowledgeStudio();
        } catch (err: any) {
          showUniversalAlert('Error', err.response?.data?.message || err.message || 'Failed to delete article');
        }
      }
    );
  };

  const handleTestKbQuery = async () => {
    if (!kbPlaygroundQuery.trim()) return;
    setKbQueryLoading(true);
    setKbPlaygroundAnswer(null);
    try {
      const res = await api.post('/assistant/query', { query: kbPlaygroundQuery.trim() });
      setKbPlaygroundAnswer(res.data?.answer || res.data?.data?.answer || res.data?.response || 'Assistant responded successfully.');
    } catch (err: any) {
      setKbPlaygroundAnswer('Assistant error: ' + (err.response?.data?.message || err.message || 'Could not query assistant.'));
    } finally {
      setKbQueryLoading(false);
    }
  };

  const handleSaveKbSettings = async () => {
    setSaving(true);
    try {
      await api.post('/kb/settings', kbSettings);
      showUniversalAlert('Success', 'Assistant settings updated!');
    } catch (err: any) {
      showUniversalAlert('Error', err.response?.data?.message || err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveSacs = async (req: any, days: number) => {
    setSacsProcessingId(req.id);
    try {
      const daysNum = Number(days);
      const durationHours = daysNum === 0 ? null : daysNum * 24;
      const res = await AccessRulesApi.bulkApprove({
        requestIds: [req.id],
        grantType: daysNum === 0 ? 'PERMANENT' : 'TEMPORARY',
        durationHours,
        consumeMonthlyUnits: true,
        respectMonthlyLimit: false,
        presetId: null,
        overrideLimit: true,
      });
      const data = res?.data?.data || res?.data;
      if (data?.failed > 0) {
        Alert.alert('Approval Note', data.errors?.join(', ') || 'Failed to approve');
      } else {
        setSacsRequests((prev) => prev.filter((r) => r.id !== req.id));
        fetchSacs();
      }
    } catch (err: any) {
      console.error('[MobileLMSPages] Approve error:', err);
      Alert.alert('Approval Error', err.response?.data?.message || err.message || 'Approval failed');
    } finally {
      setSacsProcessingId(null);
    }
  };

  const handleRejectSacs = async (req: any, reason: string) => {
    setSacsProcessingId(req.id);
    try {
      await AccessRulesApi.rejectRequest(req.id, reason || 'Rejected by admin');
      setSacsRequests((prev) => prev.filter((r) => r.id !== req.id));
      fetchSacs();
    } catch (err: any) {
      console.error('[MobileLMSPages] Reject error:', err);
      Alert.alert('Reject Error', err.response?.data?.message || err.message || 'Reject failed');
    } finally {
      setSacsProcessingId(null);
      setSacsConfirmModal(null);
    }
  };

  const handleRevertSacs = async (grantId: string, reason: string) => {
    setSacsProcessingId(grantId);
    try {
      await AccessRulesApi.revokeGrant(grantId, reason || 'Permission reverted by admin');
      setSacsHistory((prev) => prev.filter((h) => h.id !== grantId));
      setSacsPermanent((prev) => prev.filter((p) => p.id !== grantId));
      fetchSacs();
    } catch (err: any) {
      console.error('[MobileLMSPages] Revert error:', err);
      Alert.alert('Revert Error', err.response?.data?.message || err.message || 'Revert failed');
    } finally {
      setSacsProcessingId(null);
      setSacsConfirmModal(null);
    }
  };

  // ── Render Page Contents ──────────────────────────────────────────────────
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 80, gap: 16 }}>
      {/* ─── 1. COURSES PAGE ────────────────────────────────────────── */}
      {lmsSub === 'lms-courses' && (
        <View style={{ gap: 14 }}>
          {/* Header */}
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ gap: 10 }}>
              <View>
                <Text style={[styles.pageTitle, { color: textPrimary }]}>Course Management</Text>
                <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                  {courses.length} active courses published.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCourseForExcel(courses[0]?.id || '');
                    setIsExcelModalOpen(true);
                  }}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: darkMode ? '#1e293b' : '#f0fdf4',
                      borderColor: '#22c55e',
                      borderWidth: 1,
                      paddingHorizontal: 14,
                      height: 36,
                      flex: 1,
                    },
                  ]}
                >
                  <Ionicons name="document-text-outline" size={15} color="#16a34a" />
                  <Text style={[styles.primaryBtnText, { color: '#16a34a' }]}>Upload Syllabus Excel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setEditingItem(null);
                    setCourseForm({ name: '', description: '', visibility: 'private', price: '0', tags: '' });
                    setIsModalOpen(true);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 14, height: 40, flex: 1 }]}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>Add Course</Text>
                </TouchableOpacity>
              </View>
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
                      <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary }}>{c.name || c.title}</Text>
                      {c.description ? (
                        <Text style={{ fontSize: 14, color: textSecondary, marginTop: 4 }} numberOfLines={2}>
                          {c.description}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <View style={[styles.pill, { backgroundColor: c.visibility === 'public' ? '#dcfce7' : '#f3f4f6' }]}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: c.visibility === 'public' ? '#16a34a' : '#6b7280' }}>
                            {(c.visibility || 'private').toUpperCase()}
                          </Text>
                        </View>
                        {c.price ? (
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#b45309' }}>₹{c.price}</Text>
                        ) : (
                          <Text style={{ fontSize: 13, color: textSecondary }}>Free</Text>
                        )}
                        {Array.isArray(c.tags) && c.tags.length > 0 && (
                          <Text style={{ fontSize: 12, color: textSecondary, fontStyle: 'italic' }}>
                            • {c.tags.slice(0, 3).join(', ')}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedCourseForExcel(c.id);
                          setIsExcelModalOpen(true);
                        }}
                        style={[
                          styles.smallBtn,
                          {
                            backgroundColor: darkMode ? '#14301d' : '#ecfdf5',
                            borderColor: '#86efac',
                            borderWidth: 1,
                            flexDirection: 'row',
                            gap: 4,
                            paddingHorizontal: 10,
                          },
                        ]}
                      >
                        <Ionicons name="sync-outline" size={13} color="#16a34a" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#16a34a' }}>Sync Syllabus</Text>
                      </TouchableOpacity>
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
                <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                  {subjects.length} subjects configured.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setSubjectForm({ name: '', description: '', courseId: courses[0]?.id || '', order: '0' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 14, height: 40 }]}
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
                <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCourseFilter === 'all' ? '#fff' : textSecondary }}>
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
                  <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCourseFilter === c.id ? '#fff' : textSecondary }}>
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
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{s.name || s.title}</Text>
                        <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
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
                <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                  {topics.length} topics configured.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setTopicForm({ name: '', description: '', subjectId: subjects[0]?.id || '', order: '0' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 14, height: 40 }]}
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
                <Text style={{ fontSize: 13, fontWeight: '700', color: selectedSubjectFilter === 'all' ? '#fff' : textSecondary }}>
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
                  <Text style={{ fontSize: 13, fontWeight: '700', color: selectedSubjectFilter === s.id ? '#fff' : textSecondary }}>
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
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{t.name || t.title}</Text>
                        <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
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
                <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                  {subtopics.length} subtopics configured.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setSubtopicForm({ name: '', description: '', topicId: topics[0]?.id || '', order: '0' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 14, height: 40 }]}
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
                <Text style={{ fontSize: 13, fontWeight: '700', color: selectedTopicFilter === 'all' ? '#fff' : textSecondary }}>
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
                  <Text style={{ fontSize: 13, fontWeight: '700', color: selectedTopicFilter === t.id ? '#fff' : textSecondary }}>
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
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{st.name || st.title}</Text>
                        <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
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
                <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                  {teachers.length} faculty members registered.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setTeacherForm({ firstName: '', lastName: '', email: '', phone: '', loginUsername: '', loginPassword: '' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 14, height: 40 }]}
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
                      <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>
                        {t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}
                      </Text>
                      <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>{t.email}</Text>
                      {t.phone ? <Text style={{ fontSize: 13, color: textSecondary }}>{t.phone}</Text> : null}
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
                <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                  {zoomAccounts.length} API credentials configured.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingItem(null);
                  setZoomForm({ name: '', meetingSdkKey: '', meetingSdkSecret: '', s2sAccountId: '', s2sClientId: '', s2sClientSecret: '', priority: '1' });
                  setIsModalOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 14, height: 40 }]}
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
            <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 32, alignItems: 'center' }]}>
              <Ionicons name="videocam-outline" size={32} color={textSecondary} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: textSecondary, marginTop: 8 }}>
                No Zoom accounts configured.
              </Text>
            </View>
          ) : (
            zoomAccounts.map((za) => {
              const sdkKey = za.credentials?.sdkKey || za.meetingSdkKey || '—';
              const status = za.status || (za.isActive ? 'healthy' : 'disconnected');
              const isHealthy = status === 'healthy' || status === 'active';
              return (
                <View key={za.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>
                        {za.displayName || za.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                        Key: {sdkKey}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
                        <View style={[styles.pill, { backgroundColor: isHealthy ? '#dcfce7' : '#fee2e2' }]}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: isHealthy ? '#16a34a' : '#dc2626' }}>
                            {status.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, color: textSecondary }}>
                          Priority: {za.priority || 1}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingItem(za);
                          setZoomForm({
                            name: za.displayName || za.name || '',
                            meetingSdkKey: za.credentials?.sdkKey || za.meetingSdkKey || '',
                            meetingSdkSecret: za.credentials?.sdkSecret || za.meetingSdkSecret || '',
                            s2sAccountId: za.credentials?.accountId || za.s2sAccountId || '',
                            s2sClientId: za.credentials?.clientId || za.s2sClientId || '',
                            s2sClientSecret: za.credentials?.clientSecret || za.s2sClientSecret || '',
                            priority: String(za.priority || '1'),
                          });
                          setIsModalOpen(true);
                        }}
                        style={[styles.smallBtn, { backgroundColor: inputBg, borderColor, borderWidth: 1 }]}
                      >
                        <Ionicons name="pencil" size={13} color={textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteZoom(za)}
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

      {/* ─── 7. ACCESS CONTROL (SACS) ───────────────────────────────── */}
      {lmsSub === 'lms-access' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <Text style={[styles.pageTitle, { color: textPrimary }]}>Smart Access Control (SACS)</Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
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
                <Text style={{ fontSize: 13, fontWeight: '700', color: sacsSubTab === 'requests' ? '#fff' : textSecondary }}>
                  Requests ({sacsRequests.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSacsSubTab('history')}
                style={[
                  styles.tabBtn,
                  { backgroundColor: sacsSubTab === 'history' ? themeRed : inputBg, borderColor },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: sacsSubTab === 'history' ? '#fff' : textSecondary }}>
                  History ({sacsHistory.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSacsSubTab('permanent')}
                style={[
                  styles.tabBtn,
                  { backgroundColor: sacsSubTab === 'permanent' ? themeRed : inputBg, borderColor },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: sacsSubTab === 'permanent' ? '#fff' : textSecondary }}>
                  Permanent ({sacsPermanent.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSacsSubTab('permissions')}
                style={[
                  styles.tabBtn,
                  { backgroundColor: sacsSubTab === 'permissions' ? themeRed : inputBg, borderColor },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: sacsSubTab === 'permissions' ? '#fff' : textSecondary }}>
                  Rules
                </Text>
              </TouchableOpacity>
            </View>

            {/* Duration Selector for Requests */}
            {sacsSubTab === 'requests' && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={[styles.label, { color: textSecondary }]}>Default Approval Duration</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[
                    { label: '1 Day', days: 1 },
                    { label: '3 Days', days: 3 },
                    { label: '7 Days', days: 7 },
                    { label: '14 Days', days: 14 },
                    { label: '30 Days', days: 30 },
                    { label: 'Perm.', days: 0 },
                  ].map((preset) => {
                    const isSelected = sacsDurationDays === preset.days;
                    return (
                      <TouchableOpacity
                        key={preset.days}
                        onPress={() => setSacsDurationDays(preset.days)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? themeRed : inputBg,
                            borderColor: isSelected ? themeRed : borderColor,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? '#fff' : textPrimary }}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* List Content */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : sacsSubTab === 'permissions' ? (
            <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 22 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={20} color={themeRed} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>Access Control Policies</Text>
              </View>
              <Text style={{ fontSize: 14, color: textSecondary, marginTop: 8, lineHeight: 18 }}>
                Content is locked by default for non-enrolled students. When students request access, admins can approve temporary or permanent access grants.
              </Text>
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={{ fontSize: 13, color: textPrimary, fontWeight: '700' }}>• Batch Level Rules: Active</Text>
                <Text style={{ fontSize: 13, color: textPrimary, fontWeight: '700' }}>• Individual Content Locks: Active</Text>
                <Text style={{ fontSize: 13, color: textPrimary, fontWeight: '700' }}>• Auto-Expiry Timers: Active</Text>
              </View>
            </View>
          ) : sacsSubTab === 'requests' ? (
            sacsRequests.length === 0 ? (
              <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 34, alignItems: 'center' }]}>
                <Ionicons name="shield-checkmark-outline" size={44} color={textSecondary} />
                <Text style={{ color: textPrimary, fontWeight: 'bold', fontSize: 16, marginTop: 10 }}>No Pending Requests</Text>
                <Text style={{ color: textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                  All access requests have been processed.
                </Text>
              </View>
            ) : (
              sacsRequests.map((r) => {
                const studentName = r.studentName || r.studentId || 'Unknown Student';
                const contentName = r.contentName || r.entityName || r.resourceName || r.contentId || 'LMS Content';
                const studentReason = r.customReason || r.reason || '';
                const reqType = (r.requestType || r.entityType || 'CLASS').toUpperCase();
                const isProcessing = sacsProcessingId === r.id;

                return (
                  <View key={r.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{studentName}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: textSecondary, marginTop: 2 }}>{contentName}</Text>
                        {r.batchName ? (
                          <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '700', marginTop: 2 }}>Batch: {r.batchName}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.pill, { backgroundColor: '#fef3c7' }]}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#b45309' }}>PENDING</Text>
                      </View>
                    </View>

                    {/* Reason container */}
                    {studentReason ? (
                      <View style={{ backgroundColor: darkMode ? '#222' : '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor, padding: 10, marginTop: 8 }}>
                        <Text style={{ fontSize: 13, color: textSecondary }}>
                          <Text style={{ fontWeight: '700', color: textPrimary }}>Reason: </Text>
                          {studentReason}
                        </Text>
                      </View>
                    ) : null}

                    {/* Tags row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <View style={[styles.pill, { backgroundColor: reqType === 'LIVE_SESSION' ? '#dcfce7' : '#fee2e2' }]}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: reqType === 'LIVE_SESSION' ? '#16a34a' : themeRed }}>
                          {reqType === 'LIVE_SESSION' ? '📹 LIVE' : '📹 CLASS'}
                        </Text>
                      </View>
                      {(r.requestedAt || r.createdAt) ? (
                        <Text style={{ fontSize: 12, color: textSecondary }}>
                          {new Date(r.requestedAt || r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      ) : null}
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                      <TouchableOpacity
                        disabled={isProcessing}
                        onPress={() => {
                          setSacsModalReason('Rejected by admin');
                          setSacsConfirmModal({ type: 'reject', item: r });
                        }}
                        style={[styles.smallBtn, { backgroundColor: '#fee2e2', paddingHorizontal: 14, height: 36 }]}
                      >
                        <Ionicons name="close" size={13} color="#dc2626" />
                        <Text style={[styles.smallBtnText, { color: '#dc2626' }]}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        disabled={isProcessing}
                        onPress={() => handleApproveSacs(r, sacsDurationDays)}
                        style={[styles.smallBtn, { backgroundColor: '#16a34a', paddingHorizontal: 14, height: 36 }]}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={13} color="#fff" />
                            <Text style={styles.smallBtnText}>
                              Approve ({sacsDurationDays === 0 ? 'Perm.' : `${sacsDurationDays}d`})
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )
          ) : sacsSubTab === 'history' ? (
            sacsHistory.length === 0 ? (
              <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 34, alignItems: 'center' }]}>
                <Ionicons name="time-outline" size={44} color={textSecondary} />
                <Text style={{ color: textPrimary, fontWeight: 'bold', fontSize: 16, marginTop: 10 }}>No History Records</Text>
                <Text style={{ color: textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                  Approved and rejected access history will appear here.
                </Text>
              </View>
            ) : (
              sacsHistory.map((h, i) => {
                const studentName = h.studentName || h.studentId || 'Unknown Student';
                const contentName = h.contentName || h.entityName || h.resourceName || 'LMS Content';
                const isApproved = (h.status || '').toUpperCase() === 'APPROVED';
                const isProcessing = sacsProcessingId === h.id;

                return (
                  <View key={h.id || i} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{studentName}</Text>
                        <Text style={{ fontSize: 14, color: textSecondary, marginTop: 2 }}>{contentName}</Text>
                        {h.reason ? (
                          <Text style={{ fontSize: 13, color: textSecondary, marginTop: 4, fontStyle: 'italic' }}>
                            "{h.reason}"
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.pill, { backgroundColor: isApproved ? '#dcfce7' : '#fee2e2' }]}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: isApproved ? '#16a34a' : '#dc2626' }}>
                          {isApproved ? 'APPROVED' : 'REJECTED'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.pill, { backgroundColor: '#fee2e2' }]}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: themeRed }}>📹 CLASS</Text>
                        </View>
                        {(h.requestedAt || h.createdAt || h.updatedAt) ? (
                          <Text style={{ fontSize: 12, color: textSecondary }}>
                            {new Date(h.requestedAt || h.createdAt || h.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        ) : null}
                      </View>

                      {isApproved && (
                        <TouchableOpacity
                          disabled={isProcessing}
                          onPress={() => {
                            setSacsModalReason('Permission reverted by admin');
                            setSacsConfirmModal({ type: 'revert', item: h });
                          }}
                          style={[styles.smallBtn, { backgroundColor: '#ffedd5', borderColor: '#fdba74', borderWidth: 1 }]}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#ea580c" />
                          ) : (
                            <>
                              <Ionicons name="refresh" size={12} color="#ea580c" />
                              <Text style={[styles.smallBtnText, { color: '#ea580c' }]}>Revert</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )
          ) : sacsSubTab === 'permanent' ? (
            sacsPermanent.length === 0 ? (
              <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 34, alignItems: 'center' }]}>
                <Ionicons name="lock-closed-outline" size={44} color={textSecondary} />
                <Text style={{ color: textPrimary, fontWeight: 'bold', fontSize: 16, marginTop: 10 }}>No Permanent Grants</Text>
                <Text style={{ color: textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                  Permanent content permissions granted to students will appear here.
                </Text>
              </View>
            ) : (
              sacsPermanent.map((p, i) => {
                const studentName = p.studentName || p.studentId || 'Unknown Student';
                const contentName = p.contentName || p.entityName || p.resourceName || 'LMS Content';
                const isProcessing = sacsProcessingId === p.id;

                return (
                  <View key={p.id || i} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{studentName}</Text>
                        <Text style={{ fontSize: 14, color: textSecondary, marginTop: 2 }}>{contentName}</Text>
                      </View>
                      <View style={[styles.pill, { backgroundColor: '#e0e7ff' }]}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#4338ca' }}>PERMANENT</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                      <TouchableOpacity
                        disabled={isProcessing}
                        onPress={() => {
                          setSacsModalReason('Permission revoked by admin');
                          setSacsConfirmModal({ type: 'revert', item: p });
                        }}
                        style={[styles.smallBtn, { backgroundColor: '#fee2e2' }]}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                          <>
                            <Ionicons name="trash-outline" size={12} color="#dc2626" />
                            <Text style={[styles.smallBtnText, { color: '#dc2626' }]}>Revoke</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )
          ) : null}
        </View>
      )}

      {/* ─── 8. SYLLABUS TRACKER ────────────────────────────────────── */}
      {lmsSub === 'lms-syllabus' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <Text style={[styles.pageTitle, { color: textPrimary }]}>Syllabus Tracker</Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
              Track course coverage and completion status.
            </Text>

            {/* Course Selector */}
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
                <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCourseFilter === 'all' ? '#fff' : textSecondary }}>
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
                  <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCourseFilter === c.id ? '#fff' : textSecondary }}>
                    {c.name || c.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Status Filter */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: 'All Statuses' },
                { key: 'completed', label: 'Completed' },
                { key: 'in_progress', label: 'In Progress' },
                { key: 'pending', label: 'Pending' },
              ].map((sf) => {
                const isSelected = syllabusStatusFilter === sf.key;
                return (
                  <TouchableOpacity
                    key={sf.key}
                    onPress={() => setSyllabusStatusFilter(sf.key as any)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? themeRed : inputBg,
                        borderColor: isSelected ? themeRed : borderColor,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#fff' : textSecondary }}>
                      {sf.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Subjects & Topics Accordion list */}
          {subjects
            .filter((s) => selectedCourseFilter === 'all' || s.courseId === selectedCourseFilter)
            .map((s) => {
              const subjectTopics = topics.filter((t) => t.subjectId === s.id);
              const subjectSubtopics = subtopics.filter((st) => subjectTopics.some((t) => t.id === st.topicId));
              const completedCount = subjectSubtopics.filter((st) => (st.coverageStatus || '').toLowerCase() === 'completed').length;
              const percent = subjectSubtopics.length > 0 ? Math.round((completedCount / subjectSubtopics.length) * 100) : 0;
              const isExpanded = !!expandedSubjects[s.id];

              return (
                <View key={s.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                  {/* Subject Accordion Header */}
                  <TouchableOpacity
                    onPress={() => setExpandedSubjects({ ...expandedSubjects, [s.id]: !isExpanded })}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 }}>
                      <Ionicons name="book-outline" size={18} color={themeRed} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{s.name || s.title}</Text>
                        <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                          {subjectTopics.length} Topics • {subjectSubtopics.length} Subtopics • {percent}% Covered
                        </Text>
                      </View>
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={textSecondary} />
                  </TouchableOpacity>

                  {/* Progress Bar */}
                  <View style={{ height: 4, backgroundColor: inputBg, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                    <View style={{ width: `${percent}%`, height: '100%', backgroundColor: percent === 100 ? '#16a34a' : themeRed }} />
                  </View>

                  {/* Expanded Topics & Subtopics */}
                  {isExpanded && (
                    <View style={{ marginTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 10 }}>
                      {subjectTopics.length === 0 ? (
                        <Text style={{ fontSize: 14, color: textSecondary, fontStyle: 'italic' }}>No topics configured in this subject.</Text>
                      ) : (
                        subjectTopics.map((t) => {
                          const topicSubs = subtopics.filter((st) => st.topicId === t.id);
                          const filteredSubs = topicSubs.filter((st) => {
                            if (syllabusStatusFilter === 'all') return true;
                            const stStat = (st.coverageStatus || 'pending').toLowerCase().replace(' ', '_');
                            return stStat === syllabusStatusFilter;
                          });

                          return (
                            <View key={t.id} style={[styles.subCard, { backgroundColor: inputBg, borderColor }]}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }}>{t.name || t.title}</Text>
                              <View style={{ marginTop: 6, gap: 6 }}>
                                {filteredSubs.length === 0 ? (
                                  <Text style={{ fontSize: 13, color: textSecondary, fontStyle: 'italic' }}>No subtopics.</Text>
                                ) : (
                                  filteredSubs.map((sub) => {
                                    const statusStr = (sub.coverageStatus || 'Pending').toLowerCase();
                                    const isDone = statusStr === 'completed';
                                    const isInProg = statusStr === 'in_progress' || statusStr === 'in progress';
                                    const statusColor = isDone ? '#16a34a' : isInProg ? '#b45309' : '#6b7280';
                                    const statusBg = isDone ? '#dcfce7' : isInProg ? '#fef3c7' : '#f3f4f6';

                                    return (
                                      <View
                                        key={sub.id}
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          paddingVertical: 6,
                                        }}
                                      >
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                          <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>
                                            {sub.name || sub.title}
                                          </Text>
                                          {sub.facultyName ? (
                                            <Text style={{ fontSize: 12, color: textSecondary }}>Faculty: {sub.facultyName}</Text>
                                          ) : null}
                                        </View>
                                        <TouchableOpacity
                                          onPress={() => handleCycleSubtopicStatus(sub)}
                                          style={[styles.pill, { backgroundColor: statusBg }]}
                                        >
                                          <Text style={{ fontSize: 11, fontWeight: '800', color: statusColor }}>
                                            {(sub.coverageStatus || 'PENDING').toUpperCase()}
                                          </Text>
                                        </TouchableOpacity>
                                      </View>
                                    );
                                  })
                                )}
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })}
        </View>
      )}

      {/* ─── 9. NERMAI AI STUDIO & ASSISTANT CMS ─────────────────────── */}
      {lmsSub === 'lms-chatbot' && (
        <View style={{ gap: 14 }}>
          {/* Header */}
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="sparkles" size={20} color="#b45309" />
                <View>
                  <Text style={[styles.pageTitle, { color: textPrimary }]}>Knowledge Studio & AI CMS</Text>
                  <Text style={{ fontSize: 13, color: textSecondary }}>Configure AI assistant, knowledge base & rules</Text>
                </View>
              </View>
              {kbSubTab === 'articles' && (
                <TouchableOpacity
                  onPress={() => setIsKbArticleModalOpen(true)}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 14, height: 40 }]}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>Add Article</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Sub-tabs */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => setKbSubTab('articles')}
                style={[
                  styles.tabBtn,
                  { backgroundColor: kbSubTab === 'articles' ? themeRed : inputBg, borderColor },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: kbSubTab === 'articles' ? '#fff' : textSecondary }}>
                  Articles ({kbArticles.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setKbSubTab('playground')}
                style={[
                  styles.tabBtn,
                  { backgroundColor: kbSubTab === 'playground' ? themeRed : inputBg, borderColor },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: kbSubTab === 'playground' ? '#fff' : textSecondary }}>
                  Playground & Health
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setKbSubTab('settings')}
                style={[
                  styles.tabBtn,
                  { backgroundColor: kbSubTab === 'settings' ? themeRed : inputBg, borderColor },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: kbSubTab === 'settings' ? '#fff' : textSecondary }}>
                  Model Settings
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sub-tab 1: Articles */}
          {kbSubTab === 'articles' && (
            <View style={{ gap: 10 }}>
              {loading ? (
                <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
              ) : kbArticles.length === 0 ? (
                <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 32, alignItems: 'center' }]}>
                  <Ionicons name="document-text-outline" size={36} color={textSecondary} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: textSecondary, marginTop: 8 }}>
                    No Knowledge Articles Published.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsKbArticleModalOpen(true)}
                    style={[styles.primaryBtn, { backgroundColor: themeRed, paddingHorizontal: 16, height: 40, marginTop: 12 }]}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>Create First Article</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                kbArticles.map((art) => (
                  <View key={art.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{art.title}</Text>
                        {art.collectionId ? (
                          <View style={[styles.pill, { backgroundColor: darkMode ? '#1a2a3a' : '#e0f2fe', alignSelf: 'flex-start', marginTop: 4 }]}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0284c7' }}>{art.collectionId}</Text>
                          </View>
                        ) : null}
                        {art.content ? (
                          <Text style={{ fontSize: 13, color: textSecondary, marginTop: 6 }} numberOfLines={2}>
                            {art.content}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteKbArticle(art)}
                        style={[styles.smallBtn, { backgroundColor: '#fee2e2' }]}
                      >
                        <Ionicons name="trash" size={13} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Sub-tab 2: Playground & Health */}
          {kbSubTab === 'playground' && (
            <View style={{ gap: 12 }}>
              <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary }}>Engine Diagnostics</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <View style={[styles.subCard, { flex: 1, backgroundColor: inputBg, borderColor }]}>
                    <Text style={{ fontSize: 12, color: textSecondary, fontWeight: '700' }}>AI ENGINE</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#16a34a', marginTop: 2 }}>ONLINE</Text>
                  </View>
                  <View style={[styles.subCard, { flex: 1, backgroundColor: inputBg, borderColor }]}>
                    <Text style={{ fontSize: 12, color: textSecondary, fontWeight: '700' }}>ASSISTANT</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: themeRed, marginTop: 2 }}>READY</Text>
                  </View>
                  <View style={[styles.subCard, { flex: 1, backgroundColor: inputBg, borderColor }]}>
                    <Text style={{ fontSize: 12, color: textSecondary, fontWeight: '700' }}>KB ARTICLES</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0284c7', marginTop: 2 }}>{kbArticles.length}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: textPrimary }}>Test Assistant Response</Text>
                <TextInput
                  value={kbPlaygroundQuery}
                  onChangeText={setKbPlaygroundQuery}
                  placeholder="Ask a question to test assistant guidance..."
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary, marginTop: 8 }]}
                />
                <TouchableOpacity
                  onPress={handleTestKbQuery}
                  disabled={kbQueryLoading}
                  style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
                >
                  {kbQueryLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={14} color="#fff" />
                      <Text style={styles.primaryBtnText}>Ask Assistant</Text>
                    </>
                  )}
                </TouchableOpacity>

                {kbPlaygroundAnswer && (
                  <View style={[styles.subCard, { backgroundColor: inputBg, borderColor, marginTop: 12 }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary }}>Assistant Output:</Text>
                    <Text style={{ fontSize: 14, color: textPrimary, marginTop: 4, lineHeight: 18 }}>
                      {kbPlaygroundAnswer}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Sub-tab 3: Settings */}
          {kbSubTab === 'settings' && (
            <View style={[styles.card, { backgroundColor: bgCard, borderColor, gap: 12 }]}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>Assistant Configuration</Text>

              <View>
                <Text style={[styles.label, { color: textSecondary }]}>LLM Fallback Engine</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  {['openai', 'gemini', 'anthropic'].map((prov) => {
                    const isSelected = kbSettings.llmProvider === prov;
                    return (
                      <TouchableOpacity
                        key={prov}
                        onPress={() => setKbSettings({ ...kbSettings, llmProvider: prov })}
                        style={[
                          styles.chip,
                          {
                            flex: 1,
                            alignItems: 'center',
                            backgroundColor: isSelected ? themeRed : inputBg,
                            borderColor: isSelected ? themeRed : borderColor,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? '#fff' : textPrimary, textTransform: 'capitalize' }}>
                          {prov}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={[styles.label, { color: textSecondary }]}>Daily Query Limit</Text>
                <TextInput
                  value={String(kbSettings.llmDailyLimit || 1000)}
                  onChangeText={(t) => setKbSettings({ ...kbSettings, llmDailyLimit: parseInt(t) || 1000 })}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary, marginTop: 6 }]}
                />
              </View>

              <View>
                <Text style={[styles.label, { color: textSecondary }]}>Monthly Budget (INR ₹)</Text>
                <TextInput
                  value={String(kbSettings.llmMonthlyBudgetInr || 500)}
                  onChangeText={(t) => setKbSettings({ ...kbSettings, llmMonthlyBudgetInr: parseInt(t) || 500 })}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary, marginTop: 6 }]}
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveKbSettings}
                disabled={saving}
                style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 8 }]}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Settings</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ─── 10. STUDENT: MY COURSES ────────────────────────────────── */}
      {lmsSub === 'my-courses' && (
        <View style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
            <Text style={[styles.pageTitle, { color: textPrimary }]}>My Enrolled Courses</Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
              Access your learning materials and video sessions.
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : studentCourses.length === 0 ? (
            <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 32, alignItems: 'center' }]}>
              <Ionicons name="school-outline" size={36} color={textSecondary} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: textSecondary, marginTop: 8 }}>
                No active courses enrolled.
              </Text>
            </View>
          ) : (
            studentCourses.map((c: any) => (
              <View key={c.id} style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary }}>{c.name || c.title}</Text>
                  <View style={[styles.pill, { backgroundColor: '#dcfce7' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#16a34a' }}>ENROLLED</Text>
                  </View>
                </View>
                {c.description ? (
                  <Text style={{ fontSize: 14, color: textSecondary, marginTop: 6 }}>{c.description}</Text>
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
                  <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                    Scheduled live lectures, real-time sessions, and recordings.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={fetchStudentData}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: themeRed,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 8,
                    gap: 4
                  }}
                >
                  <Ionicons name="refresh-outline" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Refresh</Text>
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
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        backgroundColor: isActive ? themeRed : (darkMode ? '#222238' : '#f3f4f6'),
                        borderWidth: 1,
                        borderColor: isActive ? themeRed : borderColor
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
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
              <View style={[styles.card, { backgroundColor: bgCard, borderColor, padding: 32, alignItems: 'center' }]}>
                <Ionicons name="videocam-outline" size={36} color={textSecondary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: textSecondary, marginTop: 8 }}>
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
                        <View style={{ backgroundColor: cls.statusColor + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 }}>
                          <Text style={{ fontSize: 12, color: cls.statusColor, fontWeight: 'bold' }}>
                            {cls.statusLabel}
                          </Text>
                        </View>
                        {cls.provider ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: darkMode ? '#222238' : '#f0f0f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                            <Ionicons name="videocam-outline" size={11} color={textSecondary} />
                            <Text style={{ fontSize: 12, color: textSecondary, textTransform: 'capitalize' }}>
                              {cls.provider}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 13, color: textSecondary }}>{cls.scheduledTime}</Text>
                    </View>

                    {/* Title */}
                    <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary }}>
                      {cls.title || cls.className || 'Live Session'}
                    </Text>

                    {/* Metadata tags */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {courseName ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: darkMode ? '#1a2a3a' : '#f0f4f8', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 4 }}>
                          <Ionicons name="book-outline" size={11} color="#1976d2" />
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1976d2' }}>{courseName}</Text>
                        </View>
                      ) : null}
                      {batchName ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: darkMode ? '#1c3320' : '#e8f5e9', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 4 }}>
                          <Ionicons name="people-outline" size={11} color="#2e7d32" />
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2e7d32' }}>{batchName}</Text>
                        </View>
                      ) : null}
                      {cls.accessDenied ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: darkMode ? '#3b1717' : '#ffebee', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 4 }}>
                          <Ionicons name="lock-closed-outline" size={11} color="#c62828" />
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#c62828' }}>Access Restricted</Text>
                        </View>
                      ) : null}
                    </View>

                    {faculty ? (
                      <Text style={{ fontSize: 13, color: textSecondary }}>
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
                                      const token = tokenRes.data?.token || (tokenRes as any).token;
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
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Ionicons name="play-circle-outline" size={15} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Start Class</Text>
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
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Ionicons name="stop-circle-outline" size={15} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>End Class</Text>
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
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 6,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Ionicons name="people-outline" size={15} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>View Attendance</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          {/* Student: Join Live Class */}
                          {!cls.isEnded ? (
                            (cls.accessDenied && !cls.joinAllowed) ? (
                              <TouchableOpacity
                                onPress={async () => {
                                  try {
                                    const classId = cls.classId || cls.id || cls._id;
                                    const title = cls.title || cls.name || 'Live Class';
                                    await LiveClassesApi.requestLiveClassAccess(classId, title, 'Offline student requested live access from Mobile APK');
                                    showUniversalAlert('Access Requested', 'Your request to join this live class has been submitted to the admin for review.');
                                    fetchStudentData();
                                  } catch (err: any) {
                                    showUniversalAlert('Notice', err?.response?.data?.message || 'Request submitted or already pending review.');
                                  }
                                }}
                                style={{
                                  backgroundColor: '#ed6c02',
                                  paddingHorizontal: 16,
                                  paddingVertical: 10,
                                  borderRadius: 6,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Ionicons name="lock-closed-outline" size={15} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                                  {cls.accessRequestPending ? '⏳ Request Pending' : '🔒 Request Live Class Access'}
                                </Text>
                              </TouchableOpacity>
                            ) : (
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
                                      const token = tokenRes.data?.token || (tokenRes as any).token;
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
                                  paddingHorizontal: 16,
                                  paddingVertical: 10,
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
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                                  {isJoining ? 'Joining...' : 'Join Live Class'}
                                </Text>
                              </TouchableOpacity>
                            )
                          ) : null}

                          {/* Student: Watch Recording */}
                          {cls.isEnded && recUrl ? (
                            (cls.hasRecordedAccess === false || (cls.accessDenied && !cls.joinAllowed)) ? (
                              <TouchableOpacity
                                onPress={async () => {
                                  try {
                                    const classId = cls.classId || cls.id || cls._id;
                                    const title = cls.title || cls.name || 'Live Class Recording';
                                    await LiveClassesApi.requestLiveClassAccess(classId, title, 'Offline student requested recording access from Mobile APK');
                                    showUniversalAlert('Access Requested', 'Your request for recording access has been submitted to the admin for review.');
                                    fetchStudentData();
                                  } catch (err: any) {
                                    showUniversalAlert('Notice', err?.response?.data?.message || 'Request submitted or already pending review.');
                                  }
                                }}
                                style={{
                                  backgroundColor: '#ed6c02',
                                  paddingHorizontal: 16,
                                  paddingVertical: 10,
                                  borderRadius: 6,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Ionicons name="lock-closed-outline" size={15} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                                  {cls.accessRequestPending ? '⏳ Request Pending' : '🔒 Request Recording Access'}
                                </Text>
                              </TouchableOpacity>
                            ) : (
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
                                  paddingHorizontal: 16,
                                  paddingVertical: 10,
                                  borderRadius: 6,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Ionicons name="logo-youtube" size={15} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Watch Recording</Text>
                              </TouchableOpacity>
                            )
                          ) : cls.isEnded ? (
                            <View style={{ backgroundColor: darkMode ? '#222238' : '#f5f5f5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 }}>
                              <Text style={{ fontSize: 13, color: textSecondary }}>Class Ended</Text>
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
                        <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary }}>Session Attendance</Text>
                        <Text style={{ fontSize: 13, color: textSecondary }} numberOfLines={1}>{selectedAttendanceTitle}</Text>
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
                          <View style={{ paddingVertical: 22, alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={32} color={textSecondary} />
                            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 8 }}>No attendance recorded yet for this session.</Text>
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
                                  paddingVertical: 10,
                                  borderBottomWidth: 1,
                                  borderBottomColor: borderColor
                                }}
                              >
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: textPrimary }}>{name}</Text>
                                  {email ? <Text style={{ fontSize: 12, color: textSecondary }}>{email}</Text> : null}
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                  <View style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    backgroundColor: isPresent ? '#e8f5e9' : '#ffebee'
                                  }}>
                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: isPresent ? '#2e7d32' : '#c62828' }}>
                                      {status}
                                    </Text>
                                  </View>
                                  {joinTime ? (
                                    <Text style={{ fontSize: 11, color: textSecondary }}>{joinTime}</Text>
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
              <Text style={{ fontSize: 18, fontWeight: '800', color: textPrimary }}>
                {editingItem ? 'Edit Item' : 'Create New'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
              {modalError ? (
                <View style={{ backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 4 }}>
                  <Text style={{ color: '#b91c1c', fontSize: 14, fontWeight: '700' }}>⚠️ {modalError}</Text>
                </View>
              ) : null}
              {/* 1. Courses Form */}
              {lmsSub === 'lms-courses' && (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.label, { color: textSecondary }]}>Course Name</Text>
                  <TextInput
                    value={courseForm.name}
                    onChangeText={(t) => setCourseForm({ ...courseForm, name: t })}
                    placeholder="e.g. UDC / LDC / TNPSC Group 2"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Description</Text>
                  <TextInput
                    value={courseForm.description}
                    onChangeText={(t) => setCourseForm({ ...courseForm, description: t })}
                    placeholder="Brief overview of course curriculum..."
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary, height: 60 }]}
                    multiline
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Visibility</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setCourseForm({ ...courseForm, visibility: 'private' })}
                      style={[
                        styles.chip,
                        {
                          flex: 1,
                          alignItems: 'center',
                          backgroundColor: courseForm.visibility === 'private' ? themeRed : inputBg,
                          borderColor: courseForm.visibility === 'private' ? themeRed : borderColor,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: courseForm.visibility === 'private' ? '#fff' : textPrimary }}>
                        Private (Enrolled only)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setCourseForm({ ...courseForm, visibility: 'public' })}
                      style={[
                        styles.chip,
                        {
                          flex: 1,
                          alignItems: 'center',
                          backgroundColor: courseForm.visibility === 'public' ? themeRed : inputBg,
                          borderColor: courseForm.visibility === 'public' ? themeRed : borderColor,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: courseForm.visibility === 'public' ? '#fff' : textPrimary }}>
                        Public
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.label, { color: textSecondary }]}>Price (₹)</Text>
                  <TextInput
                    value={courseForm.price}
                    onChangeText={(t) => setCourseForm({ ...courseForm, price: t })}
                    placeholder="0"
                    placeholderTextColor={textSecondary}
                    keyboardType="numeric"
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Tags (Comma Separated)</Text>
                  <TextInput
                    value={courseForm.tags}
                    onChangeText={(t) => setCourseForm({ ...courseForm, tags: t })}
                    placeholder="e.g. prelims, mains, general studies"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
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

              {/* 2. Subjects Form */}
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

                  <Text style={[styles.label, { color: textSecondary }]}>Associated Course</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {courses.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setSubjectForm({ ...subjectForm, courseId: c.id })}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: subjectForm.courseId === c.id ? themeRed : inputBg,
                            borderColor: subjectForm.courseId === c.id ? themeRed : borderColor,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: subjectForm.courseId === c.id ? '#fff' : textPrimary }}>
                          {c.name || c.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={[styles.label, { color: textSecondary }]}>Description (Optional)</Text>
                  <TextInput
                    value={subjectForm.description}
                    onChangeText={(t) => setSubjectForm({ ...subjectForm, description: t })}
                    placeholder="Brief description..."
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Order Index</Text>
                  <TextInput
                    value={subjectForm.order}
                    onChangeText={(t) => setSubjectForm({ ...subjectForm, order: t })}
                    placeholder="0"
                    placeholderTextColor={textSecondary}
                    keyboardType="numeric"
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

              {/* 3. Topics Form */}
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

                  <Text style={[styles.label, { color: textSecondary }]}>Select Subject</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {subjects.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setTopicForm({ ...topicForm, subjectId: s.id })}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: topicForm.subjectId === s.id ? themeRed : inputBg,
                            borderColor: topicForm.subjectId === s.id ? themeRed : borderColor,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: topicForm.subjectId === s.id ? '#fff' : textPrimary }}>
                          {s.name || s.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={[styles.label, { color: textSecondary }]}>Description (Optional)</Text>
                  <TextInput
                    value={topicForm.description}
                    onChangeText={(t) => setTopicForm({ ...topicForm, description: t })}
                    placeholder="Topic overview..."
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Order Index</Text>
                  <TextInput
                    value={topicForm.order}
                    onChangeText={(t) => setTopicForm({ ...topicForm, order: t })}
                    placeholder="0"
                    placeholderTextColor={textSecondary}
                    keyboardType="numeric"
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

              {/* 4. Subtopics Form */}
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

                  <Text style={[styles.label, { color: textSecondary }]}>Select Topic</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {topics.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setSubtopicForm({ ...subtopicForm, topicId: t.id })}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: subtopicForm.topicId === t.id ? themeRed : inputBg,
                            borderColor: subtopicForm.topicId === t.id ? themeRed : borderColor,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: subtopicForm.topicId === t.id ? '#fff' : textPrimary }}>
                          {t.name || t.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={[styles.label, { color: textSecondary }]}>Description (Optional)</Text>
                  <TextInput
                    value={subtopicForm.description}
                    onChangeText={(t) => setSubtopicForm({ ...subtopicForm, description: t })}
                    placeholder="Subtopic details..."
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Order Index</Text>
                  <TextInput
                    value={subtopicForm.order}
                    onChangeText={(t) => setSubtopicForm({ ...subtopicForm, order: t })}
                    placeholder="0"
                    placeholderTextColor={textSecondary}
                    keyboardType="numeric"
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

              {/* 5. Teachers Form */}
              {lmsSub === 'lms-teachers' && (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.label, { color: textSecondary }]}>First Name *</Text>
                  <TextInput
                    value={teacherForm.firstName}
                    onChangeText={(t) => {
                      setModalError(null);
                      setTeacherForm({ ...teacherForm, firstName: t });
                    }}
                    placeholder="e.g. Rajesh"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Last Name *</Text>
                  <TextInput
                    value={teacherForm.lastName}
                    onChangeText={(t) => {
                      setModalError(null);
                      setTeacherForm({ ...teacherForm, lastName: t });
                    }}
                    placeholder="e.g. Kumar"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Email *</Text>
                  <TextInput
                    value={teacherForm.email}
                    onChangeText={(t) => {
                      setModalError(null);
                      setTeacherForm({ ...teacherForm, email: t });
                    }}
                    placeholder="rajesh@nermai.com"
                    placeholderTextColor={textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Phone Number</Text>
                  <TextInput
                    value={teacherForm.phone}
                    onChangeText={(t) => setTeacherForm({ ...teacherForm, phone: t })}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor={textSecondary}
                    keyboardType="phone-pad"
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Login Username {editingItem ? '' : '*'}</Text>
                  <TextInput
                    value={teacherForm.loginUsername}
                    onChangeText={(t) => {
                      setModalError(null);
                      setTeacherForm({ ...teacherForm, loginUsername: t });
                    }}
                    placeholder="e.g. faculty_rajesh"
                    placeholderTextColor={textSecondary}
                    autoCapitalize="none"
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Login Password {editingItem ? '(Leave blank to keep current)' : '*'}</Text>
                  <TextInput
                    value={teacherForm.loginPassword}
                    onChangeText={(t) => {
                      setModalError(null);
                      setTeacherForm({ ...teacherForm, loginPassword: t })}
                    }
                    placeholder="••••••••"
                    placeholderTextColor={textSecondary}
                    secureTextEntry
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

              {/* 6. Zoom SDK Accounts Form */}
              {lmsSub === 'lms-zoom-accounts' && (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.label, { color: textSecondary }]}>Account Display Name</Text>
                  <TextInput
                    value={zoomForm.name}
                    onChangeText={(t) => setZoomForm({ ...zoomForm, name: t })}
                    placeholder="e.g. UPSC Zoom Primary"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Meeting SDK Key</Text>
                  <TextInput
                    value={zoomForm.meetingSdkKey}
                    onChangeText={(t) => setZoomForm({ ...zoomForm, meetingSdkKey: t })}
                    placeholder="Meeting SDK Key"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Meeting SDK Secret</Text>
                  <TextInput
                    value={zoomForm.meetingSdkSecret}
                    onChangeText={(t) => setZoomForm({ ...zoomForm, meetingSdkSecret: t })}
                    placeholder="Meeting SDK Secret"
                    placeholderTextColor={textSecondary}
                    secureTextEntry
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>Server-to-Server Account ID</Text>
                  <TextInput
                    value={zoomForm.s2sAccountId}
                    onChangeText={(t) => setZoomForm({ ...zoomForm, s2sAccountId: t })}
                    placeholder="S2S Account ID"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>S2S Client ID</Text>
                  <TextInput
                    value={zoomForm.s2sClientId}
                    onChangeText={(t) => setZoomForm({ ...zoomForm, s2sClientId: t })}
                    placeholder="S2S Client ID"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <Text style={[styles.label, { color: textSecondary }]}>S2S Client Secret</Text>
                  <TextInput
                    value={zoomForm.s2sClientSecret}
                    onChangeText={(t) => setZoomForm({ ...zoomForm, s2sClientSecret: t })}
                    placeholder="S2S Client Secret"
                    placeholderTextColor={textSecondary}
                    secureTextEntry
                    style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  />

                  <TouchableOpacity
                    onPress={handleSaveZoom}
                    disabled={saving}
                    style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
                  >
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Zoom Account</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── EXCEL SYLLABUS MODAL ─────────────────────────────────────── */}
      <MobileExcelSyllabusModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        courses={courses}
        defaultCourseId={selectedCourseForExcel}
        onSyncSuccess={() => fetchCurriculum()}
        darkMode={darkMode}
      />

      {/* ─── KNOWLEDGE STUDIO ARTICLE MODAL ───────────────────────────── */}
      <Modal visible={isKbArticleModalOpen} transparent animationType="fade" onRequestClose={() => setIsKbArticleModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: textPrimary }}>Create Knowledge Article</Text>
              <TouchableOpacity onPress={() => setIsKbArticleModalOpen(false)}>
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10 }}>
              <Text style={[styles.label, { color: textSecondary }]}>Article Title</Text>
              <TextInput
                value={kbArticleForm.title}
                onChangeText={(t) => setKbArticleForm({ ...kbArticleForm, title: t })}
                placeholder="e.g. UPSC Prelims Scoring Rules"
                placeholderTextColor={textSecondary}
                style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
              />

              <Text style={[styles.label, { color: textSecondary }]}>Collection / Category (Optional)</Text>
              <TextInput
                value={kbArticleForm.collectionId}
                onChangeText={(t) => setKbArticleForm({ ...kbArticleForm, collectionId: t })}
                placeholder="e.g. Examination Guidelines"
                placeholderTextColor={textSecondary}
                style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
              />

              <Text style={[styles.label, { color: textSecondary }]}>Content / Knowledge Text</Text>
              <TextInput
                value={kbArticleForm.content}
                onChangeText={(t) => setKbArticleForm({ ...kbArticleForm, content: t })}
                placeholder="Detailed knowledge text for AI guidance..."
                placeholderTextColor={textSecondary}
                multiline
                style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary, height: 100 }]}
              />

              <TouchableOpacity
                onPress={handleSaveKbArticle}
                disabled={saving}
                style={[styles.primaryBtn, { backgroundColor: themeRed, marginTop: 10 }]}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Publish Article</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── SACS REJECT / REVERT MODAL ──────────────────────────────── */}
      <Modal visible={!!sacsConfirmModal} transparent animationType="fade" onRequestClose={() => setSacsConfirmModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: bgCard, borderColor }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary }}>
                {sacsConfirmModal?.type === 'reject' ? 'Reject Request' : 'Revert Permission'}
              </Text>
              <TouchableOpacity onPress={() => setSacsConfirmModal(null)}>
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 10 }}>
              {sacsConfirmModal?.type === 'reject'
                ? `Reject access for ${sacsConfirmModal?.item?.studentName || sacsConfirmModal?.item?.studentId || 'this student'}?`
                : `Cancel/revert granted access for ${sacsConfirmModal?.item?.studentName || sacsConfirmModal?.item?.studentId || 'this student'}?`}
            </Text>

            <Text style={[styles.label, { color: textSecondary }]}>Reason</Text>
            <TextInput
              value={sacsModalReason}
              onChangeText={setSacsModalReason}
              placeholder="Provide a reason..."
              placeholderTextColor={textSecondary}
              style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary, marginTop: 4 }]}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setSacsConfirmModal(null)}
                style={[styles.smallBtn, { backgroundColor: inputBg, borderColor, borderWidth: 1, flex: 1, height: 42 }]}
              >
                <Text style={[styles.smallBtnText, { color: textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={!sacsModalReason.trim() || !!sacsProcessingId}
                onPress={() => {
                  if (sacsConfirmModal?.type === 'reject') {
                    handleRejectSacs(sacsConfirmModal.item, sacsModalReason);
                  } else if (sacsConfirmModal?.type === 'revert') {
                    handleRevertSacs(sacsConfirmModal.item.id || sacsConfirmModal.item.grantId, sacsModalReason);
                  }
                }}
                style={[
                  styles.smallBtn,
                  {
                    backgroundColor: sacsConfirmModal?.type === 'reject' ? '#dc2626' : '#ea580c',
                    flex: 1.5,
                    height: 38,
                  },
                ]}
              >
                {sacsProcessingId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.smallBtnText}>
                    {sacsConfirmModal?.type === 'reject' ? 'Confirm Reject' : 'Confirm Revert'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  subCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
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
    fontSize: 14,
    fontWeight: '800',
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
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
    paddingHorizontal: 10,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
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
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
});
