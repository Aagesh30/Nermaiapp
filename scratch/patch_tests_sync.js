const fs = require('fs');
const file = 'web_portal/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  const loadTests = async (isSilent = false) => {
    if (!user) {
      setTests([]);
      setTestsLoading(false);
      return;
    }
    if (loadTestsInProgressRef.current) return;
    loadTestsInProgressRef.current = true;
    if (!isSilent) {
      setTestsLoading(true);
    }
    try {
      const res = await api.get("/test-portal/test-creation");
      const allTests = res?.data || res || [];
      let newTests: any[] = [];

      if (user?.role === "student") {
        const myStudent = getLoggedInStudent(user, students);
        const studentBatchName = myStudent?.batch || user?.batch || "";
        newTests = allTests.filter((t: any) => {
          if (!t.published) return false;
          if (t.targetAudience === "all" || !t.targetAudience) return true;
          if (t.targetAudience === "paid") return true;
          if (t.targetAudience === "batch") {
            const tBatch = String(t.targetBatch || "").trim().toLowerCase();
            const sBatch = String(studentBatchName).trim().toLowerCase();
            return tBatch !== "" && sBatch !== "" && tBatch === sBatch;
          }
          return false;
        });
      } else if (user?.role === "guest") {
        newTests = allTests.filter((t: any) => t.published && (t.targetAudience === "free" || t.targetAudience === "all"));
      } else {
        newTests = allTests;
        if (isAdmin && !isSilent) {
          loadLmsLookups();
        }
      }

      setTests(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newTests)) {
          return prev;
        }
        return newTests;
      });

      if (user && (user.role === "student" || user.role === "guest")) {
        try {
          const myStudent = getLoggedInStudent(user, students);
          const lookupId = myStudent?.id || user.studentId || user.userId;
          const attemptsRes = await api.get(\`/test-portal/review/history/\${lookupId}\`);
          const newAttempts = attemptsRes?.data || attemptsRes || [];
          setStudentAttempts(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newAttempts)) {
              return prev;
            }
            return newAttempts;
          });
        } catch (err) {
          console.log("Failed to load user attempts:", err);
        }
      }
    } catch (e) {`;

const replacement = `  const loadTests = async (isSilent = false) => {
    if (!user) {
      setTests([]);
      setTestsLoading(false);
      return;
    }
    if (loadTestsInProgressRef.current) return;
    loadTestsInProgressRef.current = true;
    if (!isSilent) {
      setTestsLoading(true);
    }
    try {
      const isStudentOrGuest = user && (user.role === "student" || user.role === "guest");
      const myStudent = isStudentOrGuest ? getLoggedInStudent(user, students) : null;
      const lookupId = myStudent?.id || user?.studentId || user?.userId;

      const [testsRes, attemptsRes] = await Promise.all([
        api.get("/test-portal/test-creation"),
        isStudentOrGuest && lookupId
          ? api.get(\`/test-portal/review/history/\${lookupId}\`).catch(err => {
              console.log("Failed to load user attempts:", err);
              return null;
            })
          : Promise.resolve(null)
      ]);

      const allTests = testsRes?.data || testsRes || [];
      let newTests: any[] = [];

      if (user?.role === "student") {
        const studentBatchName = myStudent?.batch || user?.batch || "";
        newTests = allTests.filter((t: any) => {
          if (!t.published) return false;
          if (t.targetAudience === "all" || !t.targetAudience) return true;
          if (t.targetAudience === "paid") return true;
          if (t.targetAudience === "batch") {
            const tBatch = String(t.targetBatch || "").trim().toLowerCase();
            const sBatch = String(studentBatchName).trim().toLowerCase();
            return tBatch !== "" && sBatch !== "" && tBatch === sBatch;
          }
          return false;
        });
      } else if (user?.role === "guest") {
        newTests = allTests.filter((t: any) => t.published && (t.targetAudience === "free" || t.targetAudience === "all"));
      } else {
        newTests = allTests;
        if (isAdmin && !isSilent) {
          loadLmsLookups();
        }
      }

      if (attemptsRes) {
        const newAttempts = attemptsRes?.data || attemptsRes || [];
        setStudentAttempts(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newAttempts)) return prev;
          return newAttempts;
        });
      }

      setTests(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newTests)) {
          return prev;
        }
        return newTests;
      });
    } catch (e) {`;

const normTarget = target.replace(/\r\n/g, '\n');
const normContent = content.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
    const usesCRLF = content.includes('\r\n');
    let updated = normContent.replace(normTarget, replacement.replace(/\r\n/g, '\n'));
    if (usesCRLF) {
        updated = updated.replace(/\n/g, '\r\n');
    }
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Successfully patched loadTests in web_portal/App.tsx');
} else {
    console.error('Target not found in web_portal/App.tsx');
}
