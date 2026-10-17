const fs = require('fs');

let code = fs.readFileSync('web_portal/lms/admin/MobileLMSPages.tsx', 'utf8');
const isCRLF = code.includes('\r\n');
if (isCRLF) code = code.replace(/\r\n/g, '\n');

// 1. Improve fetchCurriculum to timeout gracefully and set individual states as soon as available
const oldFetch = `  const fetchCurriculum = async () => {
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
  };`;

const newFetch = `  const fetchCurriculum = async () => {
    setLoading(true);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
    try {
      // 1. Fetch courses immediately
      CourseApi.listCourses()
        .then((res) => {
          const list = res.data?.data || [];
          if (Array.isArray(list) && list.length > 0) setCourses(list);
        })
        .catch(() => {});

      // 2. Fetch other sections with safety timeout
      await Promise.race([
        Promise.allSettled([
          CourseApi.listCourses().then((r) => setCourses(r.data?.data || [])).catch(() => {}),
          CourseApi.listAllSubjects().then((r) => setSubjects(r.data?.data || [])).catch(() => {}),
          CourseApi.listAllTopics().then((r) => setTopics(r.data?.data || [])).catch(() => {}),
          CourseApi.listAllSubtopics().then((r) => setSubtopics(r.data?.data || [])).catch(() => {}),
          api.get('/erp/staff').then((r) => {
            const list = r.data?.data || r.data || [];
            if (Array.isArray(list)) {
              setTeachers(list.filter((s: any) => s.role === 'teacher' && !s.isDeleted));
            }
          }).catch(() => {}),
        ]),
        timeoutPromise,
      ]);
    } catch (err) {
      console.error('[MobileLMSPages] Curriculum fetch error:', err);
    } finally {
      setLoading(false);
    }
  };`;

if (!code.includes(oldFetch)) {
  console.error('Could not find oldFetch in MobileLMSPages.tsx');
  process.exit(1);
}
code = code.replace(oldFetch, newFetch);

// 2. Add empty courses UI when courses is empty
const oldCourseList = `          {/* List */}
          {loading ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : (
            courses
              .filter((c) => (c.name || c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
              .map((c) => (`;

const newCourseList = `          {/* List */}
          {loading && courses.length === 0 ? (
            <ActivityIndicator color={themeRed} size="large" style={{ marginVertical: 30 }} />
          ) : courses.filter((c) => (c.name || c.title || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center', backgroundColor: bgCard, borderRadius: 12, borderWidth: 1, borderColor }}>
              <Ionicons name="school-outline" size={36} color={textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary, marginTop: 8 }}>No Courses Found</Text>
              <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2, textAlign: 'center' }}>
                Tap "+ Add Course" or "Upload Syllabus Excel" to publish courses.
              </Text>
            </View>
          ) : (
            courses
              .filter((c) => (c.name || c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
              .map((c) => (`;

if (!code.includes(oldCourseList)) {
  console.error('Could not find oldCourseList in MobileLMSPages.tsx');
  process.exit(1);
}
code = code.replace(oldCourseList, newCourseList);

// 3. Make onSnapshot stop loading immediately when courses/subjects arrive
const oldSnapshot = `        unsubC = onSnapshot(collection(db, 'courses'), (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c: any) => !c.isDeleted);
            setCourses(list);
          }
        });`;

const newSnapshot = `        unsubC = onSnapshot(collection(db, 'courses'), (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c: any) => !c.isDeleted);
            setCourses(list);
            setLoading(false);
          }
        });`;

if (code.includes(oldSnapshot)) {
  code = code.replace(oldSnapshot, newSnapshot);
}

if (isCRLF) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync('web_portal/lms/admin/MobileLMSPages.tsx', code, 'utf8');
console.log('Successfully optimized MobileLMSPages.tsx loading and fallback!');
