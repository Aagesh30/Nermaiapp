const fs = require('fs');

const filePath = 'd:\\unistrix\\NERMAI_IAS_ACADEMY\\web_portal\\App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the start of the erpSub === "analytics" block
const searchStart = '                      {erpSub === "analytics" && (() => {';
const startIndex = content.indexOf(searchStart);

if (startIndex === -1) {
  console.error("Could not find searchStart");
  process.exit(1);
}

// Find the end: where erpSub === "offline-attendance" starts right after
const searchEnd = '                      {erpSub === "offline-attendance" && isAdmin && (() => {';
const endIndex = content.indexOf(searchEnd, startIndex);

if (endIndex === -1) {
  console.error("Could not find searchEnd");
  process.exit(1);
}

const replacement = `                      {erpSub === "analytics" && (() => {
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

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(filePath, content, 'utf8');
console.log("SUCCESSFULLY_UPDATED_ANALYTICS_BLOCK");
