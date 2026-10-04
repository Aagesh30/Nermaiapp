import { Platform } from "react-native";

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

// Trigger an immediate system status bar notification
export const showPhoneNotification = async (title: string, body: string, data?: Record<string, any>) => {
  if (Platform.OS === "web") return;
  try {
    const Notifications = require("expo-notifications");
    if (!Notifications || !Notifications.scheduleNotificationAsync) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: "default",
        priority: Notifications.AndroidNotificationPriority?.HIGH || "high",
      },
      trigger: null, // null = display immediately
    });
  } catch (e) {
    console.log("[Notifications] Trigger error:", e);
  }
};
