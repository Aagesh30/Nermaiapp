import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage key for persistent deduplication across app restarts
const DELIVERED_NOTIFICATIONS_STORAGE_KEY = "nermai_delivered_notifs_cache";
const recentNotificationsCache = new Set<string>();
let isCacheLoaded = false;

// Sliding window rate limiter to guarantee NO notification bombs / bursts
const recentNotificationTimestamps: number[] = [];
const MAX_NOTIFICATIONS_BURST = 10;  // Allow up to 10 notifications per window
const BURST_WINDOW_MS = 30000;

// Load persisted notification IDs on module load
const ensureCacheLoaded = async () => {
  if (isCacheLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(DELIVERED_NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((id: string) => recentNotificationsCache.add(id));
      }
    }
  } catch (_) {}
  isCacheLoaded = true;
};

// Configure notification behavior for when app is in the foreground
export const initNotifications = async () => {
  if (Platform.OS === "web") return;
  try {
    const Constants = require("expo-constants").default || require("expo-constants");
    if (Constants?.appOwnership === "expo" || Constants?.executionEnvironment === "storeClient") {
      console.log("[Notifications] Push notifications are skipped in Expo Go. Use standalone APK.");
      await ensureCacheLoaded();
      return;
    }

    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.setNotificationHandler) {
      console.log("[Notifications] Native notification module not available");
      return;
    }

    // Show notifications even when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Create the Android notification channel (required for Android 8+)
    if (Platform.OS === "android" && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync("default", {
        name: "NERMAI Academy Notifications",
        importance: Notifications.AndroidImportance?.MAX || 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#c62828",
        sound: "default",
        showBadge: true,
      });
    }

    await ensureCacheLoaded();
  } catch (e) {
    console.log("[Notifications] Init error:", e);
  }
};

// Request runtime notification permission (Android 13+ & iOS)
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === "web") return true;
  try {
    const Constants = require("expo-constants").default || require("expo-constants");
    if (Constants?.appOwnership === "expo" || Constants?.executionEnvironment === "storeClient") {
      return false;
    }

    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.getPermissionsAsync) return false;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted" && Notifications.requestPermissionsAsync) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === "granted";
  } catch (e) {
    console.log("[Notifications] Permission error:", e);
    return false;
  }
};

/**
 * Register device for remote push via NATIVE FCM (Android) or Firebase Messaging (Web).
 *
 * APK:  Uses expo-notifications getDevicePushTokenAsync() → returns a raw FCM registration token.
 *       This is the SAME token type as the web. Backend sends it via Firebase Admin SDK directly.
 *       No Expo Push Token / Expo Push API is used anywhere in the stack.
 *
 * Web:  Uses firebase/messaging getToken() with VAPID key and service worker.
 *
 * Token is saved to Firestore collection `device_push_tokens` with role/batch/userId fields.
 */
export const registerForPushNotificationsAsync = async (user?: any, forcePrompt: boolean = false): Promise<string | null> => {
  // ─── WEB ───────────────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
        console.warn("[WebNotifications] Push registration skipped: Service Worker or Notification API not supported.");
        return null;
      }

      let currentPermission = Notification.permission;
      if (currentPermission === "denied") {
        console.warn("[WebNotifications] Notification permission is DENIED. Unblock in browser site settings.");
        return null;
      }

      if (currentPermission === "default") {
        try {
          const requestRes = await Notification.requestPermission();
          currentPermission = requestRes;
        } catch (permErr: any) {
          console.warn("[WebNotifications] Permission request note:", permErr?.message);
          return null;
        }
        if (currentPermission !== "granted") {
          console.warn("[WebNotifications] Permission denied or dismissed.");
          return null;
        }
      }

      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        await navigator.serviceWorker.ready;
      } catch (swErr: any) {
        console.error("[WebNotifications] Service Worker registration failed:", swErr?.message || swErr);
        return null;
      }

      const { getMessaging, getToken } = require("firebase/messaging");
      const { app, db } = require("./firebaseConfig");
      const { doc, setDoc, serverTimestamp } = require("firebase/firestore");

      const messaging = getMessaging(app);
      const vapidKey = (globalThis as any).process?.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY || undefined;

      if (!vapidKey) {
        console.warn("[WebNotifications] Missing VAPID Key: EXPO_PUBLIC_FIREBASE_VAPID_KEY not set.");
      }

      let webToken: string | null = null;
      try {
        webToken = await getToken(messaging, {
          serviceWorkerRegistration: reg,
          ...(vapidKey ? { vapidKey } : {})
        });
      } catch (tokenErr: any) {
        console.error("[WebNotifications] Failed to obtain FCM web token:", tokenErr?.message || tokenErr);
        return null;
      }

      if (!webToken) {
        console.warn("[WebNotifications] No FCM token returned from Firebase Messaging.");
        return null;
      }

      // Cache locally for unregister on logout
      try { await AsyncStorage.setItem("nermai_device_push_token", webToken); } catch (_) {}

      const cleanDocId = "web_" + webToken.slice(-24).replace(/[^a-zA-Z0-9_-]/g, "_");
      const docRef = doc(db, "device_push_tokens", cleanDocId);

      const userId = user?.userId || user?.studentId || user?.id || user?.leadId ||
        ((user?.role === "guest" || !user) ? `guest_${cleanDocId.slice(-6)}` : "anonymous");
      const studentId = user?.studentId || user?.id || user?.userId || null;
      const role = user?.role || "guest";
      const batch = user?.batch || (Array.isArray(user?.batches) ? user.batches[0] : null) || null;

      // Build all student batch values so batch-targeted notices reach this device
      const studentBatchesArr: string[] = [];
      if (user?.batch) studentBatchesArr.push(String(user.batch));
      if (Array.isArray(user?.batches)) {
        user.batches.forEach((b: any) => { if (b && !studentBatchesArr.includes(String(b))) studentBatchesArr.push(String(b)); });
      }

      await setDoc(docRef, {
        token: webToken,
        userId: String(userId),
        studentId: studentId ? String(studentId) : null,
        role: String(role),
        batch: batch ? String(batch) : null,
        // batches array — used by backend push filter to match multi-batch students
        batches: role === "student" ? studentBatchesArr : [],
        platform: "web",
        updatedAt: serverTimestamp(),
        // assignedBatches: for admin users, which batches they manage.
        // Empty array = super admin (receives all batch notifications).
        assignedBatches: Array.isArray(user?.assignedBatches)
          ? user.assignedBatches.map(String)
          : (Array.isArray(user?.batches) ? user.batches.map(String) : []),
      }, { merge: true });

      // Attach foreground FCM listener (shows notification when tab is open & focused)
      try {
        const { onMessage } = require("firebase/messaging");
        if (typeof window !== "undefined" && !(window as any).__nermai_fcm_listener_attached) {
          (window as any).__nermai_fcm_listener_attached = true;
          onMessage(messaging, (payload: any) => {
            const title = payload?.notification?.title || payload?.data?.title || "NERMAI IAS ACADEMY";
            const body  = payload?.notification?.body  || payload?.data?.body  || "New notification available.";
            const notifData = payload?.data || {};
            if (reg && reg.showNotification) {
              reg.showNotification(title, {
                body, icon: "/favicon.png", badge: "/favicon.png",
                data: notifData, tag: notifData.dedupeId || `nermai_fg_${Date.now()}`
              });
            } else if ("Notification" in window && Notification.permission === "granted") {
              new Notification(title, { body, icon: "/favicon.png", badge: "/favicon.png", data: notifData });
            }
          });
        }
      } catch (fgErr: any) {
        console.warn("[WebNotifications] Foreground FCM listener note:", fgErr?.message);
      }

      return webToken;
    } catch (e: any) {
      console.error("[WebNotifications] Unexpected error during push registration:", e?.message || e);
      return null;
    }
  }

  // ─── ANDROID APK — Native FCM via expo-notifications ─────────────────────
  try {
    const Constants = require("expo-constants").default || require("expo-constants");
    if (Constants?.appOwnership === "expo" || Constants?.executionEnvironment === "storeClient") {
      console.log("[Notifications] Remote push token skipped in Expo Go. Use standalone APK.");
      return null;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const Notifications = require("expo-notifications");
    if (!Notifications) return null;

    // Get native FCM device token (same token type as web — sent via Firebase Admin SDK)
    // This works for background AND killed-app delivery without going through Expo's relay servers.
    let pushToken: string | null = null;
    if (!Notifications.getDevicePushTokenAsync) {
      console.warn("[Notifications] getDevicePushTokenAsync not available in this build.");
      return null;
    }

    try {
      const deviceTokenObj = await Notifications.getDevicePushTokenAsync();
      if (deviceTokenObj?.data && typeof deviceTokenObj.data === "string") {
        pushToken = deviceTokenObj.data;
        console.log("[Notifications] Native FCM token acquired successfully.");
      } else {
        console.warn("[Notifications] getDevicePushTokenAsync returned empty data.");
      }
    } catch (fcmErr: any) {
      console.warn("[Notifications] Native FCM token fetch failed:", fcmErr?.message || fcmErr);
    }

    if (!pushToken) return null;

    // Cache locally for unregister on logout
    await AsyncStorage.setItem("nermai_device_push_token", pushToken);

    // Save to Firestore device_push_tokens so backend can target this device
    try {
      const { doc, setDoc, serverTimestamp } = require("firebase/firestore");
      const { db } = require("./firebaseConfig");

      const cleanDocId = pushToken.replace(/[^a-zA-Z0-9_-]/g, "_");
      const docRef = doc(db, "device_push_tokens", cleanDocId);

      const userId = user?.userId || user?.studentId || user?.id || user?.leadId ||
        ((user?.role === "guest" || !user) ? `guest_${cleanDocId.slice(-6)}` : "anonymous");
      const studentId = user?.studentId || user?.id || user?.userId || null;
      const role = user?.role || "guest";
      const batch = user?.batch || (Array.isArray(user?.batches) ? user.batches[0] : null) || null;

      // Build all student batch values so batch-targeted notices reach this device
      const studentBatchesArr: string[] = [];
      if (user?.batch) studentBatchesArr.push(String(user.batch));
      if (Array.isArray(user?.batches)) {
        user.batches.forEach((b: any) => { if (b && !studentBatchesArr.includes(String(b))) studentBatchesArr.push(String(b)); });
      }

      await setDoc(docRef, {
        token: pushToken,
        userId: String(userId),
        studentId: studentId ? String(studentId) : null,
        role: String(role),
        batch: batch ? String(batch) : null,
        // batches array — used by backend push filter to match multi-batch students
        batches: role === "student" ? studentBatchesArr : [],
        platform: Platform.OS,  // "android" or "ios"
        updatedAt: serverTimestamp(),
        // assignedBatches: for admin users, which batches they manage.
        // Empty array = super admin / manages all batches.
        assignedBatches: Array.isArray(user?.assignedBatches)
          ? user.assignedBatches.map(String)
          : (Array.isArray(user?.batches) && role !== "student"
              ? user.batches.map(String)
              : []),
      }, { merge: true });
    } catch (dbErr) {
      console.log("[Notifications] Failed saving FCM token to Firestore:", dbErr);
    }

    return pushToken;
  } catch (e) {
    console.log("[Notifications] registerForPushNotifications error:", e);
    return null;
  }
};

export const unregisterPushTokenAsync = async (token?: string | null): Promise<void> => {
  try {
    const savedToken = token || (await AsyncStorage.getItem("nermai_device_push_token"));
    if (!savedToken) return;
    const { doc, deleteDoc } = require("firebase/firestore");
    const { db } = require("./firebaseConfig");
    const cleanDocId = savedToken.replace(/[^a-zA-Z0-9_-]/g, "_");
    await deleteDoc(doc(db, "device_push_tokens", cleanDocId)).catch(() => {});
    // Also try the web-prefixed doc ID format (in case user switched platforms)
    const webCleanDocId = "web_" + savedToken.slice(-24).replace(/[^a-zA-Z0-9_-]/g, "_");
    await deleteDoc(doc(db, "device_push_tokens", webCleanDocId)).catch(() => {});
    await AsyncStorage.removeItem("nermai_device_push_token");
  } catch (err: any) {
    console.log("[Notifications] Token unregister note:", err?.message);
  }
};

// Trigger an immediate system status bar notification on the device.
// data.targetTab / data.targetSub are used for in-app navigation on tap.
// Note: This is for LOCAL (foreground-trigger) notifications only.
// Remote push notifications (killed app delivery) are sent from the backend via Firebase Admin SDK.
export const showPhoneNotification = async (title: string, body: string, data?: Record<string, any>) => {
  // ─── WEB ───────────────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    try {
      await ensureCacheLoaded();
      const dedupeKey = data?.dedupeId || data?.id || `${title}::${body}`;
      if (dedupeKey) {
        if (recentNotificationsCache.has(dedupeKey)) return;
        recentNotificationsCache.add(dedupeKey);
        if (recentNotificationsCache.size > 500) {
          const oldest = recentNotificationsCache.values().next().value;
          if (oldest) recentNotificationsCache.delete(oldest);
        }
        AsyncStorage.setItem(
          DELIVERED_NOTIFICATIONS_STORAGE_KEY,
          JSON.stringify(Array.from(recentNotificationsCache))
        ).catch(() => {});
      }

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const notifTag = data?.dedupeId || (dedupeKey || `nermai_fg_${Date.now()}`);
        const notif = new Notification(title, {
          body, icon: "/favicon.png", badge: "/favicon.png", tag: notifTag, data: data || {}
        });
        notif.onclick = () => {
          window.focus();
          if (data && typeof window !== "undefined") {
            try { window.dispatchEvent(new CustomEvent("nermai_notification_click", { detail: data })); } catch (_) {}
          }
          if (data?.targetTab && typeof window.location !== "undefined") {
            const sub = data.targetSub ? `/${data.targetSub}` : "";
            window.location.hash = `#${data.targetTab}${sub}`;
          }
          notif.close();
        };
      }
    } catch (_) {}
    return;
  }

  // ─── ANDROID APK ───────────────────────────────────────────────────────────
  try {
    await ensureCacheLoaded();

    // 1. Persistent Deduplication Check
    const dedupeKey = data?.dedupeId || data?.id || `${title}::${body}`;
    if (dedupeKey) {
      if (recentNotificationsCache.has(dedupeKey)) return;
      recentNotificationsCache.add(dedupeKey);
      if (recentNotificationsCache.size > 500) {
        const oldest = recentNotificationsCache.values().next().value;
        if (oldest) recentNotificationsCache.delete(oldest);
      }
      AsyncStorage.setItem(
        DELIVERED_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(Array.from(recentNotificationsCache))
      ).catch(() => {});
    }

    // 2. Anti-Bomb Rate Limiter
    const now = Date.now();
    while (recentNotificationTimestamps.length > 0 && now - recentNotificationTimestamps[0] > BURST_WINDOW_MS) {
      recentNotificationTimestamps.shift();
    }
    if (recentNotificationTimestamps.length >= MAX_NOTIFICATIONS_BURST) {
      console.log(`[Notifications] Flood throttle: skipped notification "${title}"`);
      return;
    }
    recentNotificationTimestamps.push(now);

    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.scheduleNotificationAsync) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          ...data,
          targetTab: data?.targetTab || data?.screen || "dashboard",
          targetSub: data?.targetSub || data?.subTab || "",
          screen: data?.screen || data?.targetTab || "dashboard",
          subTab: data?.subTab || data?.targetSub || "",
        },
        sound: "default",
        priority: Notifications.AndroidNotificationPriority?.HIGH || "high",
      },
      trigger: null, // display immediately
    });
  } catch (e) {
    console.log("[Notifications] Trigger error:", e);
  }
};

// Set up a listener that reacts when the user taps a notification.
// onNavigate receives { targetTab, targetSub?, screen?, subTab? } and routes
// to the app's target tab/sub-tab safely without showing a white page.
export const setupNotificationClickListener = (
  onNavigate: (data: Record<string, any>) => void
): (() => void) => {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return () => {};
    const handleWebClick = (event: any) => {
      const detail = event?.detail || event?.data;
      if (detail) onNavigate(detail);
    };
    const handleSwMessage = (event: any) => {
      if (event?.data?.type === "NOTIFICATION_CLICK" && event?.data?.data) {
        onNavigate(event.data.data);
      }
    };
    window.addEventListener("nermai_notification_click", handleWebClick);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
    }
    return () => {
      window.removeEventListener("nermai_notification_click", handleWebClick);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
    };
  }
  try {
    const Constants = require("expo-constants").default || require("expo-constants");
    if (Constants?.appOwnership === "expo" || Constants?.executionEnvironment === "storeClient") {
      return () => {};
    }

    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.addNotificationResponseReceivedListener) return () => {};

    // Handle tap when app is foregrounded or backgrounded (but not killed).
    // FCM delivers the notification to the OS. When user taps it, expo-notifications
    // fires this listener with the FCM data payload.
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      try {
        const data = response?.notification?.request?.content?.data;
        if (data) onNavigate(data);
      } catch (e) {
        console.log("[Notifications] Click handler error:", e);
      }
    });

    // Cold-start navigation is intentionally NOT handled here.
    // It is handled by App.tsx via getLastNotificationData() in a useEffect([user]) hook,
    // which ensures navigation only fires AFTER user auth resolves (preventing white screen).

    return () => {
      try {
        if (subscription && subscription.remove) subscription.remove();
      } catch (e) {}
    };
  } catch (e) {
    console.log("[Notifications] Click listener setup error:", e);
    return () => {};
  }
};

/**
 * Returns the FCM notification data from the last tap that launched the app from a killed state.
 * Call this from a useEffect([user]) hook AFTER user auth resolves to avoid white-screen navigation.
 * Returns null if there is no pending cold-start notification.
 */
export const getLastNotificationData = async (): Promise<Record<string, any> | null> => {
  if (Platform.OS === "web") return null;
  try {
    const Constants = require("expo-constants").default || require("expo-constants");
    if (Constants?.appOwnership === "expo" || Constants?.executionEnvironment === "storeClient") {
      return null;
    }
    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.getLastNotificationResponseAsync) return null;
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response?.notification) {
      return response.notification.request?.content?.data || null;
    }
    return null;
  } catch (e) {
    console.log("[Notifications] getLastNotificationData error:", e);
    return null;
  }
};
