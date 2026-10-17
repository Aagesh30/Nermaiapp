const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../web_portal/App.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const isCrlf = content.includes('\r\n');
const eol = isCrlf ? '\r\n' : '\n';

// Normalize to LF for easy replacement
if (isCrlf) {
  content = content.replace(/\r\n/g, '\n');
}

console.log('Original content length:', content.length);

// ==========================================
// FIX 4 (Part 2): My Profile Details Card
// Add Course, Batch, Class Mode
// ==========================================
const profileTarget = `                                    {[
                                      { label: "Full Name", value: myStudent?.name || myProfileRequest.name },
                                      { label: "Initial", value: myStudent?.initial || myProfileRequest.initial || "—" },
                                      { label: "Date of Birth", value: formatDobForDisplay(myStudent?.dateOfBirth || myStudent?.dob || myProfileRequest.dob) },`;

const profileReplacement = `                                    {[
                                      { label: "Full Name", value: myStudent?.name || myProfileRequest.name },
                                      { label: "Initial", value: myStudent?.initial || myProfileRequest.initial || "—" },
                                      { label: "Course", value: myStudent?.course || user.course || myProfileRequest.course || "—" },
                                      { label: "Batch", value: myStudent?.batch || user.batch || myProfileRequest.batch || "—" },
                                      {
                                        label: "Class Mode",
                                        value: (() => {
                                          const m = myStudent?.type || myStudent?.mode || user.type || user.mode || myProfileRequest.type || myProfileRequest.mode || "Online";
                                          return String(m).charAt(0).toUpperCase() + String(m).slice(1);
                                        })()
                                      },
                                      { label: "Date of Birth", value: formatDobForDisplay(myStudent?.dateOfBirth || myStudent?.dob || myProfileRequest.dob) },`;

if (!content.includes(profileTarget)) {
  console.error('ERROR: profileTarget not found!');
} else {
  content = content.replace(profileTarget, profileReplacement);
  console.log('SUCCESS: Fix 4 Profile Details replaced.');
}

// ==========================================
// STATE VARIABLES FOR FIX 5 & 6
// ==========================================
const stateTarget = `  // LMS Lookup states (caching)
  const [lmsSubjects, setLmsSubjects] = useState<any[]>([]);
  const [lmsTopics, setLmsTopics] = useState<any[]>([]);
  const [lmsClassesList, setLmsClassesList] = useState<any[]>([]);`;

const stateReplacement = `  // LMS Lookup states (caching)
  const [lmsSubjects, setLmsSubjects] = useState<any[]>([]);
  const [lmsTopics, setLmsTopics] = useState<any[]>([]);
  const [lmsSubtopics, setLmsSubtopics] = useState<any[]>([]);
  const [lmsClassesList, setLmsClassesList] = useState<any[]>([]);

  // Fix 5: Daily Content Date Filters (Year, Month, Date)
  const [dailyFilterYear, setDailyFilterYear] = useState<string>("");
  const [dailyFilterMonth, setDailyFilterMonth] = useState<string>("");
  const [dailyFilterDate, setDailyFilterDate] = useState<string>("");

  // Fix 6: Recorded Classes Cascading Filters (Subject, Topic, Subtopic)
  const [recFilterSubject, setRecFilterSubject] = useState<string>("all");
  const [recFilterTopic, setRecFilterTopic] = useState<string>("all");
  const [recFilterSubtopic, setRecFilterSubtopic] = useState<string>("all");`;

if (!content.includes(stateTarget)) {
  console.error('ERROR: stateTarget not found!');
} else {
  content = content.replace(stateTarget, stateReplacement);
  console.log('SUCCESS: State variables added.');
}

// ==========================================
// LOAD LMS LOOKUPS: Fetch Subtopics too
// ==========================================
const lookupsTarget = `      // Students need courses, subjects, topics to render hierarchy. Admins need everything.
      const promises = [
        api.get("/courses").catch((err) => { console.error("[loadLmsLookups] /courses failed:", err); return []; }),
        api.get("/subjects").catch((err) => { console.error("[loadLmsLookups] /subjects failed:", err); return []; }),
        api.get("/topics").catch((err) => { console.error("[loadLmsLookups] /topics failed:", err); return []; })
      ];

      if (isAdmin) {
        promises.push(api.get("/classes").catch((err) => { console.error("[loadLmsLookups] /classes failed:", err); return []; }));
        promises.push(api.get("/erp/batch").catch((err) => { console.error("[loadLmsLookups] /erp/batch failed:", err); return []; }));
        promises.push(api.get("/staff/live-session-candidates").catch((err) => { console.error("[loadLmsLookups] candidates failed:", err); return []; }));
      }

      const results = await Promise.all(promises);

      const courseRes = results[0];
      const subjRes = results[1];
      const topicRes = results[2];

      setLmsCourses(courseRes?.data || courseRes || []);
      setLmsSubjects(subjRes?.data || subjRes || []);
      setLmsTopics(topicRes?.data || topicRes || []);

      if (isAdmin) {
        const classRes = results[3];
        const batchRes = results[4];
        const candRes = results[5];`;

const lookupsReplacement = `      // Students need courses, subjects, topics, subtopics to render hierarchy. Admins need everything.
      const promises = [
        api.get("/courses").catch((err) => { console.error("[loadLmsLookups] /courses failed:", err); return []; }),
        api.get("/subjects").catch((err) => { console.error("[loadLmsLookups] /subjects failed:", err); return []; }),
        api.get("/topics").catch((err) => { console.error("[loadLmsLookups] /topics failed:", err); return []; }),
        api.get("/subtopics").catch((err) => { console.error("[loadLmsLookups] /subtopics failed:", err); return []; })
      ];

      if (isAdmin) {
        promises.push(api.get("/classes").catch((err) => { console.error("[loadLmsLookups] /classes failed:", err); return []; }));
        promises.push(api.get("/erp/batch").catch((err) => { console.error("[loadLmsLookups] /erp/batch failed:", err); return []; }));
        promises.push(api.get("/staff/live-session-candidates").catch((err) => { console.error("[loadLmsLookups] candidates failed:", err); return []; }));
      }

      const results = await Promise.all(promises);

      const courseRes = results[0];
      const subjRes = results[1];
      const topicRes = results[2];
      const subtopicRes = results[3];

      setLmsCourses(courseRes?.data || courseRes || []);
      setLmsSubjects(subjRes?.data || subjRes || []);
      setLmsTopics(topicRes?.data || topicRes || []);
      setLmsSubtopics(subtopicRes?.data?.data || subtopicRes?.data || subtopicRes || []);

      if (isAdmin) {
        const classRes = results[4];
        const batchRes = results[5];
        const candRes = results[6];`;

if (!content.includes(lookupsTarget)) {
  console.error('ERROR: lookupsTarget not found!');
} else {
  content = content.replace(lookupsTarget, lookupsReplacement);
  console.log('SUCCESS: loadLmsLookups updated with subtopics.');
}

// Convert back to original CRLF
if (isCrlf) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Saved preliminary updates to App.tsx.');
