const path = require("path");
process.chdir(path.resolve(__dirname, ".."));
require("../backend/dist/config/env");
const { storage } = require("../backend/dist/infrastructure/firebase/index");

async function setCors() {
  try {
    const bucket = storage.bucket("nermaiiasacademy-519c8-resources");
    console.log("Setting CORS on bucket:", bucket.name);
    await bucket.setCorsConfiguration([
      {
        origin: ["*"],
        method: ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
        responseHeader: ["*"],
        maxAgeSeconds: 3600,
      },
    ]);
    console.log("Successfully set CORS on bucket!");
    const [metadata] = await bucket.getMetadata();
    console.log("Current bucket CORS configuration:", JSON.stringify(metadata.cors, null, 2));
  } catch (err) {
    console.error("Error setting CORS:", err);
  }
}

setCors();
