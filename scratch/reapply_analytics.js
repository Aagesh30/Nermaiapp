const fs = require('fs');
const path = require('path');

const appFile = path.resolve('d:\\unistrix\\NERMAI_IAS_ACADEMY\\web_portal\\App.tsx');
let content = fs.readFileSync(appFile, 'utf8');

// 1. Add Dashboard Imports if not already present
if (!content.includes('StudentAnalyticsDashboard')) {
  const targetImport = "import { UniversalTime12Picker } from './lms/components/UniversalTime12Picker';";
  const replacementImport = `import { UniversalTime12Picker } from './lms/components/UniversalTime12Picker';
import { StudentAnalyticsDashboard } from './lms/analytics/StudentAnalyticsDashboard';
import { AdminAnalyticsDashboard } from './lms/analytics/AdminAnalyticsDashboard';`;
  content = content.replace(targetImport, replacementImport);
}

// 2. Replace the analytics block inside erpSub === "analytics"
const searchStart = '                      {erpSub === "analytics" && (() => {';
const startIndex = content.indexOf(searchStart);

if (startIndex === -1) {
  console.error("Could not find erpSub === 'analytics' block in App.tsx");
  process.exit(1);
}

// Find where erpSub === "offline-attendance" begins right after
const searchEnd = '                      {erpSub === "offline-attendance" && isAdmin && (() => {';
const endIndex = content.indexOf(searchEnd, startIndex);

if (endIndex === -1) {
  console.error("Could not find end of erpSub === 'analytics' block");
  process.exit(1);
}

const newAnalyticsBlock = `                      {erpSub === "analytics" && (() => {
                        if (user.role === "student") {
                          const myStudent = getLoggedInStudent(user, students);
                          return (
                            <StudentAnalyticsDashboard
                              user={user}
                              student={myStudent}
                              studentAttempts={studentAttempts}
                              allTests={tests}
                            />
                          );
                        }

                        /* ---- ADMIN / STAFF / FACULTY: institution & academic analytics ---- */
                        return (
                          <AdminAnalyticsDashboard
                            batches={batches}
                            students={students}
                            staff={staff}
                            questions={questions}
                            lmsCourses={lmsCourses}
                            isAdmin={isAdmin}
                          />
                        );
                      })()}

`;

content = content.substring(0, startIndex) + newAnalyticsBlock + content.substring(endIndex);

fs.writeFileSync(appFile, content, 'utf8');
console.log("SUCCESSFULLY_REPLACED_ANALYTICS_IN_APP_TSX");
