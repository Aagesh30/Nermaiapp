// Native-only stub for Web builds.
// Packages that depend on native Android/iOS APIs (like Google Play Services)
// are redirected here during web compilation.
module.exports = {
  GoogleSignin: {
    configure: () => {},
    hasPlayServices: async () => false,
    signIn: async () => {
      throw new Error("GoogleSignin is only supported on native mobile platforms.");
    },
    signOut: async () => {},
    isSignedIn: async () => false,
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
};
