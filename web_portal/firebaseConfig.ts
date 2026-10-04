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
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "nermaiiasacademy-519c8.firebaseapp.com",
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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = (() => {
  if (Platform.OS === "web") {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (e) {
      return getFirestore(app);
    }
  }
  return getFirestore(app);
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
    // Native APK — Authorization Code + PKCE via expo-auth-session (proper flow)
    console.log("[DEBUG] Platform is native mobile. Initiating expo-auth-session Google OAuth (PKCE).");
    try {
      const AuthSession = require("expo-auth-session");
      const { GoogleAuthProvider, signInWithCredential } = require("firebase/auth");

      // Sign out Firebase first — ensures account picker always appears on every login
      try { await auth.signOut(); } catch (e) {}

      // Android OAuth client (client_type: 1) — validated by SHA-1 fingerprint, not redirect URI.
      // This is the correct client for installed Android APKs. No Google Cloud Console change needed.
      const ANDROID_CLIENT_ID = "587850155187-4at9s3rprcuvshdfhdcjcsglaoc0hqpe.apps.googleusercontent.com";

      const discovery = {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
        revocationEndpoint: "https://oauth2.googleapis.com/revoke",
      };

      // Standard redirect URI for Android installed apps — matches Google's expected format for Android OAuth clients.
      // Android clients validate by SHA-1 cert hash, not redirect URI, so no Cloud Console registration needed.
      const redirectUri = "com.nermai.iasacademy:/oauthredirect";
      console.log("[DEBUG] Redirect URI:", redirectUri);

      const request = new AuthSession.AuthRequest({
        clientId: ANDROID_CLIENT_ID,
        scopes: ["openid", "profile", "email"],
        redirectUri,
        usePKCE: true,
        extraParams: { prompt: "select_account", access_type: "offline" }
      });

      const result = await request.promptAsync(discovery);
      console.log("[DEBUG] AuthSession result type:", result?.type);

      if (result?.type === "cancel" || result?.type === "dismiss") {
        throw new Error("Google sign-in was cancelled.");
      }

      if (result?.type === "success" && result?.params?.code) {
        // Exchange authorization code for tokens using PKCE code_verifier
        // Android public clients (installed apps) use PKCE — no client_secret required.
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: ANDROID_CLIENT_ID,
            code: result.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier ?? "" }
          },
          discovery
        );

        const idToken = tokenResult?.idToken;
        const accessToken = tokenResult?.accessToken;
        console.log("[DEBUG] Token exchange complete. idToken present:", !!idToken);

        if (idToken) {
          // Sign into Firebase with the Google credential — gets real Firebase uid
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          const firebaseResult = await signInWithCredential(auth, credential);
          const fbUser = firebaseResult.user;
          console.log("[DEBUG] Firebase signInWithCredential success:", fbUser?.email);
          return {
            email: (fbUser.email || "").toLowerCase(),
            name: fbUser.displayName || fbUser.email?.split("@")[0] || fallbackName || "Guest",
            photoURL: fbUser.photoURL || "",
            uid: fbUser.uid
          };
        }

        // Fallback: idToken absent — use userinfo endpoint with access token
        if (accessToken) {
          console.log("[DEBUG] idToken absent, fetching userinfo with access token.");
          const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const userInfo = await infoRes.json();
          if (userInfo?.email) {
            return {
              email: userInfo.email.toLowerCase(),
              name: userInfo.name || userInfo.email.split("@")[0],
              photoURL: userInfo.picture || "",
              uid: userInfo.sub || `google_${Date.now()}`
            };
          }
        }
      }

      throw new Error("Google authentication did not return a valid token. Please try again.");
    } catch (authErr: any) {
      console.warn("[DEBUG] expo-auth-session Google error:", authErr?.message || authErr);
      throw new Error(authErr?.message || "Google authentication failed. Please try again.");
    }
  }
};
