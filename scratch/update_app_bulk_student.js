const fs = require('fs');
let code = fs.readFileSync('web_portal/App.tsx', 'utf8');

const isCRLF = code.includes('\r\n');
if (isCRLF) code = code.replace(/\r\n/g, '\n');

// 1. Add lazy import for MobileBulkStudentUploadModal
const oldImport = `const BulkStudentUploadModal = React.lazy(() => import('./lms/components/BulkStudentUploadModal').then(m => ({ default: m.BulkStudentUploadModal })));`;
const newImport = `const BulkStudentUploadModal = React.lazy(() => import('./lms/components/BulkStudentUploadModal').then(m => ({ default: m.BulkStudentUploadModal })));
const MobileBulkStudentUploadModal = React.lazy(() => import('./lms/components/MobileBulkStudentUploadModal').then(m => ({ default: m.MobileBulkStudentUploadModal })));`;

if (!code.includes(oldImport)) {
  console.error('Could not find oldImport');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Render MobileBulkStudentUploadModal on Mobile or Native APK, and BulkStudentUploadModal on Desktop Web
const oldRender = `                            {/* Bulk Student Upload Modal */}
                            {showBulkStudentModal && BulkStudentUploadModal && (
                              <Suspense fallback={null}>
                                <BulkStudentUploadModal
                                  isOpen={showBulkStudentModal}
                                  onClose={() => setShowBulkStudentModal(false)}
                                  batches={batches}
                                  onSuccess={() => {
                                    loadStudents(true);
                                  }}
                                />
                              </Suspense>
                            )}`;

const newRender = `                            {/* Bulk Student Upload Modal (Adaptive: Mobile/Native vs Desktop Web) */}
                            {showBulkStudentModal && (
                              <Suspense fallback={null}>
                                {(isMobile || Platform.OS !== 'web') ? (
                                  <MobileBulkStudentUploadModal
                                    isOpen={showBulkStudentModal}
                                    onClose={() => setShowBulkStudentModal(false)}
                                    batches={batches}
                                    darkMode={darkMode}
                                    onSuccess={() => {
                                      loadStudents(true);
                                    }}
                                  />
                                ) : (
                                  <BulkStudentUploadModal
                                    isOpen={showBulkStudentModal}
                                    onClose={() => setShowBulkStudentModal(false)}
                                    batches={batches}
                                    onSuccess={() => {
                                      loadStudents(true);
                                    }}
                                  />
                                )}
                              </Suspense>
                            )}`;

if (!code.includes(oldRender)) {
  console.error('Could not find oldRender');
  process.exit(1);
}
code = code.replace(oldRender, newRender);

if (isCRLF) code = code.replace(/\n/g, '\r\n');

fs.writeFileSync('web_portal/App.tsx', code, 'utf8');
console.log('Successfully wired MobileBulkStudentUploadModal in App.tsx!');
