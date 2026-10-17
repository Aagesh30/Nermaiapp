const path = require("path");
process.chdir(path.resolve(__dirname, ".."));
require("../backend/dist/config/env");
const { db, storage } = require("../backend/dist/infrastructure/firebase/index");

async function checkDoc() {
  const doc = await db.collection("dailyContent").doc("309f34c5-1c2b-4091-bdde-c6b299b2c510").get();
  console.log("Doc 309f34c5-1c2b-4091-bdde-c6b299b2c510 exists:", doc.exists);
  if (doc.exists) {
    console.log("Data:", JSON.stringify(doc.data(), null, 2));
  }
}

checkDoc();
