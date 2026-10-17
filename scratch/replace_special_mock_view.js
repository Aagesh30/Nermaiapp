const fs = require('fs');
let s = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

// Target the special-mock block start
const startMarker = '{testSub === "special-mock" && isAdmin && (() => {';
const endMarker = '                      {testSub === "results" && (() => {';

const startIndex = s.indexOf(startMarker);
const endIndex = s.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const replacementContent = `{testSub === "special-mock" && isAdmin && (
                        <React.Suspense fallback={<View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator size="large" color="#c62828" /></View>}>
                          <SpecialMockRollNumberPage
                            api={api}
                            user={user}
                            darkMode={darkMode}
                            batches={batches}
                            students={students}
                            loadStudents={loadStudents}
                          />
                        </React.Suspense>
                      )}

`;

  s = s.substring(0, startIndex) + replacementContent + s.substring(endIndex);
  fs.writeFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', s, 'utf8');
  console.log('Successfully replaced special-mock tab view with SpecialMockRollNumberPage!');
} else {
  console.log('Could not find start or end marker', { startIndex, endIndex });
}
