import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage key for persistent deduplication across app restarts
const DELIVERED_NOTIFICATIONS_STORAGE_KEY = "nermai_delivered_notifs_cache";
const recentNotificationsCache = new Set<string>();
let isCacheLoaded = false;

// Sliding window rate limiter to guarantee NO notification bombs / bursts
const recentNotificationTimestamps: number[] = [];
const MAX_NOTIFICATIONS_BURST = 2;
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
    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.setNotificationHandler) {
      console.log("[Notifications] Native notification module not available (e.g. running in Expo Go)");
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

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

// Register device for remote push notifications (Expo Push API / FCM)
// Saves token to Firestore so notifications reach the user even when app is closed / killed
export const registerForPushNotificationsAsync = async (user?: any, forcePrompt: boolean = false): Promise<string | null> => {
  if (Platform.OS === "web") {
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
        console.warn("[WebNotifications] Push registration skipped: Service Worker or Notification API not supported by browser.");
        return null;
      }

      let currentPermission = Notification.permission;
      if (currentPermission === "denied") {
        console.warn("[WebNotifications] Notification permission is DENIED by user. Unblock notifications in browser site settings.");
        return null;
      }

      if (currentPermission === "default") {
        if (!forcePrompt) {
          console.log("[WebNotifications] Notification permission is DEFAULT. Awaiting explicit user click to request permission.");
          return null;
        }
        const requestRes = await Notification.requestPermission();
        currentPermission = requestRes;
        if (requestRes !== "granted") {
          console.warn("[WebNotifications] Notification permission request DENIED or dismissed by user.");
          return null;
        }
      }

      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        await navigator.serviceWorker.ready;
      } catch (swErr: any) {
        console.error("[WebNotifications] Service Worker registration failed for /firebase-messaging-sw.js:", swErr?.message || swErr);
        return null;
      }

      const { getMessaging, getToken } = require("firebase/messaging");
      const { app, db } = require("./firebaseConfig");
      const { doc, setDoc, serverTimestamp } = require("firebase/firestore");

      const messaging = getMessaging(app);
      const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || undefined;

      if (!vapidKey) {
        console.warn("[WebNotifications] Missing VAPID Key: EXPO_PUBLIC_FIREBASE_VAPID_KEY is not set in build environment. Web push token generation may fail.");
      }

      let webToken: string | null = null;
      try {
        webToken = await getToken(messaging, {
          serviceWorkerRegistration: reg,
          ...(vapidKey ? { vapidKey } : {})
        });
      } catch (tokenErr: any) {
        console.error("[WebNotifications] Failed to obtain FCM web push token from Firebase:", tokenErr?.message || tokenErr);
        return null;
      }

      if (!webToken) {
        console.warn("[WebNotifications] No FCM token returned from Firebase Messaging.");
        return null;
      }

      // Store local reference for unregistering on logout
      try {
        await AsyncStorage.setItem("nermai_device_push_token", webToken);
      } catch (_) {}

      const cleanDocId = "web_" + webToken.slice(-24).replace(/[^a-zA-Z0-9_-]/g, "_");
      const docRef = doc(db, "device_push_tokens", cleanDocId);

      const userId = user?.userId || user?.studentId || user?.id || user?.leadId || (user?.role === "guest" ? `guest_${cleanDocId.slice(-6)}` : "anonymous");
      const studentId = user?.studentId || user?.id || user?.userId || null;
      const role = user?.role || "guest";
      const batch = user?.batch || (Array.isArray(user?.batches) ? user.batches[0] : null) || null;

      // Rewrite ownership fields on every login
      await setDoc(docRef, {
        token: webToken,
        userId: String(userId),
        studentId: studentId ? String(studentId) : null,
        role: String(role),
        batch: batch ? String(batch) : null,
        platform: "web",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      return webToken;
    } catch (e: any) {
      console.error("[WebNotifications] Unexpected error during push registration:", e?.message || e);
      return null;
    }
  }
  try {
    const Constants = require("expo-constants").default || require("expo-constants");
    if (Constants?.appOwnership === "expo" || Constants?.executionEnvironment === "storeClient") {
      console.log("[Notifications] Remote push token skipped (running in Expo Go SDK 53). Use Standalone APK for remote push.");
      return null;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.getExpoPushTokenAsync) return null;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId || "7b9009b2-f209-4d9b-8e24-21f04e78de96";
    const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenObj?.data;
    if (!pushToken) return null;

    // Cache push token locally
    await AsyncStorage.setItem("nermai_device_push_token", pushToken);

    // Persist to Firestore device_push_tokens collection
    try {
      const { doc, setDoc, serverTimestamp } = require("firebase/firestore");
      const { db } = require("./firebaseConfig");

      const cleanDocId = pushToken.replace(/[^a-zA-Z0-9_-]/g, "_");
      const docRef = doc(db, "device_push_tokens", cleanDocId);
      
      const userId = user?.userId || user?.studentId || user?.id || user?.leadId || (user?.role === "guest" ? `guest_${cleanDocId.slice(-6)}` : "anonymous");
      const studentId = user?.studentId || user?.id || user?.userId || null;
      const role = user?.role || "guest";
      const batch = user?.batch || (Array.isArray(user?.batches) ? user.batches[0] : null) || null;

      await setDoc(docRef, {
        token: pushToken,
        userId: String(userId),
        studentId: studentId ? String(studentId) : null,
        role: String(role),
        batch: batch ? String(batch) : null,
        platform: Platform.OS,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (dbErr) {
      console.log("[Notifications] Failed saving push token to Firestore:", dbErr);
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
    const webCleanDocId = "web_" + savedToken.slice(-24).replace(/[^a-zA-Z0-9_-]/g, "_");
    await deleteDoc(doc(db, "device_push_tokens", webCleanDocId)).catch(() => {});
    await AsyncStorage.removeItem("nermai_device_push_token");
  } catch (err: any) {
    console.log("[Notifications] Token unregister notice:", err?.message);
  }
};

export interface RemotePushPayload {
  title: string;
  body: string;
  targetRole?: "all" | "student" | "admin" | "super_admin" | "guest";
  targetUserId?: string;
  targetBatch?: string;
  data?: Record<string, any>;
}

// Dispatches a remote push notification via Expo Push API
// This reaches physical Android devices EVEN WHEN THE APK IS KILLED / CLOSED!
export const sendRemotePushNotification = async (payload: RemotePushPayload): Promise<void> => {
  try {
    const { collection, getDocs, query, where } = require("firebase/firestore");
    const { db } = require("./firebaseConfig");

    let q = query(collection(db, "device_push_tokens"));
    if (payload.targetUserId) {
      q = query(collection(db, "device_push_tokens"), where("userId", "==", String(payload.targetUserId)));
    } else if (payload.targetRole && payload.targetRole !== "all") {
      if (payload.targetRole === "admin") {
        q = query(collection(db, "device_push_tokens"), where("role", "in", ["admin", "super_admin", "staff", "developer"]));
      } else if (payload.targetRole === "super_admin") {
        q = query(collection(db, "device_push_tokens"), where("role", "in", ["super_admin", "developer"]));
      } else {
        q = query(collection(db, "device_push_tokens"), where("role", "==", payload.targetRole));
      }
    }

    const snap = await getDocs(q);
    if (snap.empty) return;

    const tokens: string[] = [];
    snap.forEach((d: any) => {
      const data = d.data();
      if (data?.token) {
        if (payload.targetBatch && data.role === "student" && data.batch && data.batch.toLowerCase() !== payload.targetBatch.toLowerCase()) {
          return;
        }
        tokens.push(data.token);
      }
    });

    const uniqueTokens = Array.from(new Set(tokens));
    if (uniqueTokens.length === 0) return;

    const cleanData = {
      ...payload.data,
      targetTab: payload.data?.targetTab || payload.data?.screen || "dashboard",
      targetSub: payload.data?.targetSub || payload.data?.subTab || "",
      screen: payload.data?.screen || payload.data?.targetTab || "dashboard",
      subTab: payload.data?.subTab || payload.data?.targetSub || "",
    };

    const messages = uniqueTokens.map(to => ({
      to,
      sound: "default",
      title: payload.title,
      body: payload.body,
      priority: "high",
      channelId: "default",
      data: cleanData,
    }));

    // Send in chunks of 100
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      }).catch(err => console.log("[PushSend] Chunk delivery error:", err));
    }
  } catch (e) {
    console.log("[PushSend] Failed to dispatch remote push notification:", e);
  }
};

// Trigger an immediate system status bar notification
// data.targetTab / data.targetSub are used for in-app navigation on tap
export const showPhoneNotification = async (title: string, body: string, data?: Record<string, any>) => {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const notif = new Notification(title, {
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          data: data || {}
        });
        notif.onclick = () => {
          window.focus();
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
  try {
    await ensureCacheLoaded();

    // 1. Persistent Deduplication Check
    const dedupeKey = data?.dedupeId || data?.id || `${title}::${body}`;
    if (dedupeKey) {
      if (recentNotificationsCache.has(dedupeKey)) return;
      recentNotificationsCache.add(dedupeKey);

      // Keep cache size bounded to last 500 items
      if (recentNotificationsCache.size > 500) {
        const oldest = recentNotificationsCache.values().next().value;
        if (oldest) recentNotificationsCache.delete(oldest);
      }

      // Async write-back to persistent storage
      AsyncStorage.setItem(
        DELIVERED_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(Array.from(recentNotificationsCache))
      ).catch(() => {});
    }

    // 2. Anti-Bomb Rate Limiter: Drop bursts exceeding MAX_NOTIFICATIONS_BURST within window
    const now = Date.now();
    // Prune old timestamps
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
  if (Platform.OS === "web") return () => {};
  try {
    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.addNotificationResponseReceivedListener) return () => {};

    // Handle tap when app is foregrounded or backgrounded (but not killed)
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      try {
        const data = response?.notification?.request?.content?.data;
        if (data) {
          onNavigate(data);
        }
      } catch (e) {
        console.log("[Notifications] Click handler error:", e);
      }
    });

    // Handle tap when app was completely killed and relaunched via notification
    Notifications.getLastNotificationResponseAsync().then((response: any) => {
      try {
        if (response && response.notification) {
          const data = response.notification.request?.content?.data;
          if (data) {
            onNavigate(data);
          }
        }
      } catch (e) {
        console.log("[Notifications] Cold-start click handler error:", e);
      }
    }).catch(() => {});

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
