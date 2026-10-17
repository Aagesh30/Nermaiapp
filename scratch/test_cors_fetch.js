const https = require("https");

const url = "https://storage.googleapis.com/nermaiiasacademy-519c8-resources/daily_content/309f34c5-1c2b-4091-bdde-c6b299b2c510/B47%20ANSWER%20KEYS%20-%2016.09.2026.pdf";

const req = https.request(url, {
  method: "GET",
  headers: {
    "Origin": "https://nermaiiasacademy-519c8.web.app"
  }
}, (res) => {
  console.log("Status Code:", res.statusCode);
  console.log("Access-Control-Allow-Origin:", res.headers["access-control-allow-origin"]);
  console.log("Content-Type:", res.headers["content-type"]);
  console.log("Content-Length:", res.headers["content-length"]);
});

req.on("error", (e) => console.error("Request error:", e));
req.end();
