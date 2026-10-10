// Firebase Messaging Service Worker for NERMAI IAS ACADEMY Web Push Notifications
// Works on Chrome, Edge, Firefox, Brave, and Opera

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBZ07n1v6D7ZT5O0nIcut6JuSb0GMtM0fo",
  authDomain: "nermaiiasacademy-519c8.firebaseapp.com",
  projectId: "nermaiiasacademy-519c8",
  storageBucket: "nermaiiasacademy-519c8.firebasestorage.app",
  messagingSenderId: "587850155187",
  appId: "1:587850155187:web:0f2c25a69a6b73f4391cc6"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background push message:', payload);

  // If payload already contains a top-level notification object, FCM browser agent automatically displays it.
  // Skip calling self.registration.showNotification() to prevent duplicate popups.
  if (payload.notification) {
    console.log('[firebase-messaging-sw.js] Background notification already auto-handled by FCM notification payload.');
    return;
  }

  const title = payload.data?.title || 'NERMAI IAS ACADEMY';
  const options = {
    body: payload.data?.body || payload.data?.message || 'New announcement available.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    tag: payload.data?.dedupeId || payload.data?.id || `nermai_${Date.now()}`
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetTab = data.targetTab || data.screen || 'dashboard';
  const targetSub = data.targetSub || data.subTab || '';
  const urlToOpen = new URL(self.location.origin);
  if (targetTab) {
    urlToOpen.hash = targetSub ? `#${targetTab}/${targetSub}` : `#${targetTab}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if (targetTab && client.navigate) {
            client.navigate(urlToOpen.href);
          }
          return client.focus();
        }
      }
      // If no tab is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen.href);
      }
    })
  );
});
