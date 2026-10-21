import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect
} from "firebase/auth";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

// Complete auth session if returning from web browser redirect
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {}

// Safely obtain React Native persistence function if running in native mobile bundle
const getRNPersistence = (): any => {
  try {
    const fbAuth = require("@firebase/auth");
    if (fbAuth && typeof fbAuth.getReactNativePersistence === "function") {
      return fbAuth.getReactNativePersistence(AsyncStorage);
    }
  } catch (e) {}
  try {
    const fbAuthMod = require("firebase/auth");
    if (fbAuthMod && typeof fbAuthMod.getReactNativePersistence === "function") {
      return fbAuthMod.getReactNativePersistence(AsyncStorage);
    }
  } catch (e) {}
  return undefined;
};

// Firebase App Configuration for NERMAI IAS ACADEMY — Project: nermaiiasacademy-519c8
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBZ07n1v6D7ZT5O0nIcut6JuSb0GMtM0fo",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "nermaiias.in",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "nermaiiasacademy-519c8",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "nermaiiasacademy-519c8.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "587850155187",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:587850155187:web:0f2c25a69a6b73f4391cc6",
  measurementId: "G-K2L1JCLKP6"
};

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache(
        Platform.OS === "web"
          ? { tabManager: persistentMultipleTabManager() }
          : {}
      )
    });
  } catch (e) {
    try {
      return getFirestore(app);
    } catch (_) {
      return initializeFirestore(app, {});
    }
  }
})();

// Initialize Auth with AsyncStorage persistence for React Native to resolve memory persistence warnings
export const auth = (() => {
  if (Platform.OS === "web") {
    return getAuth(app);
  } else {
    try {
      const persistence = getRNPersistence();
      if (persistence) {
        return initializeAuth(app, { persistence });
      }
      return getAuth(app);
    } catch (e) {
      return getAuth(app);
    }
  }
})();

export const handleFirebaseGoogleSignIn = async (fallbackName?: string, fallbackPhone?: string) => {
  console.log("[DEBUG] handleFirebaseGoogleSignIn initiated", { fallbackName, fallbackPhone });
  if (Platform.OS === "web") {
    try {
      await auth.signOut();
    } catch (e) {
      console.log("[DEBUG] signOut prior to Google login error:", e);
    }
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    provider.setCustomParameters({ 
      prompt: 'select_account',
      auth_type: 'rerequest'
    });
    
    console.log("[DEBUG] Platform is web. Triggering signInWithPopup");
    
    // Pre-flight offline check on web
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const netErr: any = new Error("No internet connection detected. Please check your network and try again.");
      netErr.code = "auth/network-request-failed";
      throw netErr;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("[DEBUG] signInWithPopup returned user:", user?.email);
      return {
        email: user.email,
        name: user.displayName || user.email?.split("@")[0] || "Guest Learner",
        photoURL: user.photoURL,
        uid: user.uid
      };
    } catch (error: any) {
      console.error("[DEBUG] Firebase Google Sign-In error:", error);
      const isNetwork =
        error?.code === "auth/network-request-failed" ||
        (typeof navigator !== "undefined" && navigator.onLine === false) ||
        error?.message?.toLowerCase().includes("network") ||
        error?.message?.toLowerCase().includes("unreachable host") ||
        error?.message?.toLowerCase().includes("interrupted connection");

      if (isNetwork) {
        const netErr: any = new Error("Unable to connect to Google authentication. Please check your internet connection and try again.");
        netErr.code = "auth/network-request-failed";
        throw netErr;
      }

      if (
        error?.code === "auth/popup-blocked" || 
        error?.code === "auth/popup-closed-by-user" || 
        (typeof window !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
      ) {
        console.log("[DEBUG] Popup blocked or mobile browser detected. Triggering signInWithRedirect fallback...");
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw error;
    }
  } else {
    // Native Mobile (Android APK & iOS) — Native Google Sign-In via @react-native-google-signin/google-signin
    console.log("[DEBUG] Platform is native mobile. Initiating Google Sign-In.");
    try {
      const { GoogleAuthProvider, signInWithCredential } = require("firebase/auth");
      const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "587850155187-bbs7vnuahanqilrq9tp397phvft5p0r8.apps.googleusercontent.com";

      // Sign out Firebase first — ensures fresh session state
      try { await auth.signOut(); } catch (e) {}

      // 1. Primary Native Path: @react-native-google-signin/google-signin (Works seamlessly in APK)
      let googleSigninModule: any = null;
      try {
        googleSigninModule = require("@react-native-google-signin/google-signin");
      } catch (requireErr) {
        console.log("[DEBUG] Native google-signin module require error:", requireErr);
      }

      if (googleSigninModule?.GoogleSignin) {
        const { GoogleSignin, statusCodes } = googleSigninModule;
        try {
          console.log("[DEBUG] Initializing GoogleSignin native configuration...");
          GoogleSignin.configure({
            webClientId: WEB_CLIENT_ID,
            offlineAccess: false,
          });

          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

          try {
            await GoogleSignin.signOut();
          } catch (e) {}

          console.log("[DEBUG] Triggering GoogleSignin.signIn()");
          const signInResponse = await GoogleSignin.signIn();
          console.log("[DEBUG] GoogleSignin response received");

          const idToken = signInResponse?.data?.idToken || (signInResponse as any)?.idToken;
          const userObj = signInResponse?.data?.user || (signInResponse as any)?.user;

          if (!idToken) {
            throw new Error("Google Sign-In completed but no idToken was received.");
          }

          const credential = GoogleAuthProvider.credential(idToken);
          const firebaseResult = await signInWithCredential(auth, credential);
          const fbUser = firebaseResult.user;
          console.log("[DEBUG] Firebase native signInWithCredential success:", fbUser?.email);

          return {
            email: (fbUser.email || userObj?.email || "").toLowerCase(),
            name: fbUser.displayName || userObj?.name || fbUser.email?.split("@")[0] || fallbackName || "Guest",
            photoURL: fbUser.photoURL || userObj?.photo || "",
            uid: fbUser.uid
          };
        } catch (nativeErr: any) {
          console.warn("[DEBUG] GoogleSignin native error:", nativeErr?.code, nativeErr?.message);
          const isNetwork =
            nativeErr?.code === statusCodes?.NETWORK_ERROR ||
            nativeErr?.code === "7" ||
            nativeErr?.code === 7 ||
            nativeErr?.code === "auth/network-request-failed" ||
            nativeErr?.message?.toLowerCase().includes("network") ||
            nativeErr?.message?.toLowerCase().includes("unreachable host");

          if (isNetwork) {
            throw new Error("Unable to connect to Google authentication. Please check your internet connection and try again.");
          }

          if (
            nativeErr?.code === statusCodes?.SIGN_IN_CANCELLED ||
            nativeErr?.message?.includes("cancelled") ||
            nativeErr?.message?.includes("12501")
          ) {
            throw new Error("Google sign-in was cancelled.");
          } else if (nativeErr?.code === statusCodes?.IN_PROGRESS) {
            throw new Error("Google sign-in is already in progress.");
          } else if (nativeErr?.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
            throw new Error("Google Play Services is not available or needs to be updated.");
          }
          throw new Error(nativeErr?.message || "Google authentication failed. Please try again.");
        }
      }

      // 2. Fallback Path (if native module not available in environment)
      console.log("[DEBUG] Falling back to expo-auth-session OAuth flow");
      const AuthSession = require("expo-auth-session");
      const clientId = WEB_CLIENT_ID;
      const discovery = {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
        revocationEndpoint: "https://oauth2.googleapis.com/revoke",
      };

      const redirectUri = AuthSession.makeRedirectUri({ scheme: "nermaiiasacademy" });
      const request = new AuthSession.AuthRequest({
        clientId,
        scopes: ["openid", "profile", "email"],
        redirectUri,
        usePKCE: true,
        extraParams: { prompt: "select_account" }
      });

      const result = await request.promptAsync(discovery);
      if (result?.type === "cancel" || result?.type === "dismiss") {
        throw new Error("Google sign-in was cancelled.");
      }

      if (result?.type === "success" && result?.params?.code) {
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId,
            code: result.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier ?? "" }
          },
          discovery
        );

        const idToken = tokenResult?.idToken;
        const accessToken = tokenResult?.accessToken;

        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          const firebaseResult = await signInWithCredential(auth, credential);
          const fbUser = firebaseResult.user;
          return {
            email: (fbUser.email || "").toLowerCase(),
            name: fbUser.displayName || fbUser.email?.split("@")[0] || fallbackName || "Guest",
            photoURL: fbUser.photoURL || "",
            uid: fbUser.uid
          };
        }
      }

      throw new Error("Google authentication did not return a valid token. Please try again.");
    } catch (authErr: any) {
      console.warn("[DEBUG] Native Google error:", authErr?.message || authErr);
      throw new Error(authErr?.message || "Google authentication failed. Please try again.");
    }
  }
};
