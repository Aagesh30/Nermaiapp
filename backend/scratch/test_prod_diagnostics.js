const run = async () => {
  console.log("Logging into production...");
  const adminLogin = await fetch('https://nermaiiasacademy-519c8.web.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@nermai.com', password: 'nermaiadmin@unistrix' })
  });
  const adminData = await adminLogin.json();
  if (!adminData.data?.token) {
    console.log("Admin login failed:", adminData);
    return;
  }
  const token = adminData.data.token;
  const adminHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log("Fetching all tests...");
  const testsRes = await fetch('https://nermaiiasacademy-519c8.web.app/api/test-portal/test-creation', { headers: adminHeaders });
  const testsJson = await testsRes.json();
  const tests = testsJson.data || testsJson;

  let targetTest = null;
  if (Array.isArray(tests)) {
    targetTest = tests.find(t => t.title && t.title.includes("18 MOTS - Test 3"));
  }

  if (!targetTest) {
    console.log("Target test '18 MOTS - Test 3' not found in test-creation list! List titles:");
    if (Array.isArray(tests)) {
      tests.slice(0, 10).forEach(t => console.log("- ", t.id, t.title));
    } else {
      console.log(tests);
    }
    return;
  }

  console.log("Found Target Test:");
  console.log("ID:", targetTest.id || targetTest._id);
  console.log("Title:", targetTest.title);
  console.log("subjectSections:", targetTest.subjectSections);

  const testId = targetTest.id || targetTest._id;

  console.log("\nCalling GET /api/test-portal/review/diagnostics/" + testId + "...");
  const diagRes = await fetch(`https://nermaiiasacademy-519c8.web.app/api/test-portal/review/diagnostics/${testId}`, { headers: adminHeaders });
  console.log("Status:", diagRes.status);
  const diagJson = await diagRes.json();
  console.log("Diagnostics Response Summary:");
  console.log("Success:", diagJson.success);
  console.log("Keys in response:", Object.keys(diagJson));
  if (diagJson.data) {
    console.log("Keys in data:", Object.keys(diagJson.data));
    console.log("totalSubmissions:", diagJson.data.totalSubmissions);
    console.log("totalQuestions:", diagJson.data.totalQuestions);
    console.log("subjectAnalytics count:", diagJson.data.subjectAnalytics?.length);
    console.log("subjectAnalytics:", JSON.stringify(diagJson.data.subjectAnalytics, null, 2));
  } else {
    console.log("Full response:", diagJson);
  }
};

run().catch(console.error);
