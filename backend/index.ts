import { onRequest } from "firebase-functions/v2/https";

/**
 * Main Firebase Cloud Functions Entry Point
 * Exports Express app with v2 Cloud Functions configuration for region asia-south1.
 * App is lazy-loaded on request to ensure instant CLI analysis during deployment (<50ms).
 */
export const api = onRequest(
  { region: "asia-south1", timeoutSeconds: 300, memory: "1GiB", minInstances: 0, concurrency: 80 },
  (req, res) => {
    const app = require("./app").default;
    return app(req, res);
  }
);

