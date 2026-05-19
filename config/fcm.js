/**
 * Firebase Cloud Messaging HTTP v1 (Legacy API is disabled in Firebase Console).
 *
 * Set FIREBASE_PROJECT_ID and either:
 *   - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   - FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  (single line, for Render)
 */
const fs = require('fs');
const path = require('path');

let adminApp = null;

const getProjectId = () =>
  process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'mood-studios-3172f';

const loadServiceAccount = () => {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    return JSON.parse(jsonEnv);
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const resolved = path.isAbsolute(credPath)
      ? credPath
      : path.resolve(process.cwd(), credPath);
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }

  return null;
};

const isFcmConfigured = () => {
  try {
    return Boolean(loadServiceAccount());
  } catch {
    return false;
  }
};

const getMessaging = () => {
  if (adminApp) return adminApp.messaging();

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      'FCM not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.',
    );
  }

  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: getProjectId(),
    });
  }
  adminApp = admin.app();
  return admin.messaging();
};

module.exports = { getMessaging, getProjectId, isFcmConfigured };
