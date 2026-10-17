const fs = require('fs');
const filePath = 'd:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update native mobile onboarding/session check
const targetPattern1 = /AsyncStorage\.getItem\(ONBOARDING_KEY\)\.then\(val => \{[\s\S]*?\}\)\.catch\(\(\) => \{ \}\);/;

const replacement1 = `Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY),
        AsyncStorage.getItem("nermai_auth_user")
      ]).then(([onboardVal, authVal]) => {
        if (onboardVal === "true" || !!authVal) {
          setOnboardDone(true);
        }
      }).catch(() => { });`;

if (targetPattern1.test(content)) {
  content = content.replace(targetPattern1, replacement1);
  console.log("Edit 1 (Native Onboarding/Session Guard) applied successfully!");
} else {
  console.log("Edit 1 target pattern not matched.");
}

// 2. Add loading screen for website initial session check
const targetStr2 = `    return (\r\n      <SafeAreaView style={[styles.container, darkMode && { backgroundColor: "#121212" }]}>`;
const targetStr2_LF = `    return (\n      <SafeAreaView style={[styles.container, darkMode && { backgroundColor: "#121212" }]}>`;

const loadingScreenCode = `    if (isInitialLoading && !user) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? "#121212" : "#ffffff", justifyContent: "center", alignItems: "center" }]}>
          <StatusBar style={darkMode ? "light" : "dark"} />
          <View style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
            <View style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#c62828",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 18,
              elevation: 10,
              marginBottom: 20
            }}>
              <Image
                source={APP_INSIDE_LOGO}
                style={{ width: 104, height: 104, borderRadius: 52 }}
                resizeMode="cover"
              />
            </View>
            <Text style={{ fontSize: 26, fontWeight: "900", color: "#c62828", letterSpacing: 1.5, textAlign: "center" }}>
              NERMAI
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#b71c1c", letterSpacing: 3, textAlign: "center", marginTop: 2 }}>
              IAS ACADEMY
            </Text>
            <ActivityIndicator size="large" color="#c62828" style={{ marginTop: 24 }} />
          </View>
        </SafeAreaView>
      );
    }

`;

if (content.includes(targetStr2)) {
  content = content.replace(targetStr2, loadingScreenCode + targetStr2);
  console.log("Edit 2 (Web Initial Session Loading Screen) applied successfully!");
} else if (content.includes(targetStr2_LF)) {
  content = content.replace(targetStr2_LF, loadingScreenCode + targetStr2_LF);
  console.log("Edit 2 (Web Initial Session Loading Screen - LF) applied successfully!");
} else {
  console.log("Edit 2 target string not matched.");
}

fs.writeFileSync(filePath, content, 'utf8');
