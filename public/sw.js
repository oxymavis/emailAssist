// Service Worker for Email Assist Notifications
const CACHE_NAME = 'email-assist-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith('http')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Return cached version or fetch from network
          return response || fetch(event.request);
        })
        .catch(() => {
          // Return a fallback page for navigation requests
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        })
    );
  }
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  let notificationData = {
    title: 'Email Assist',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'default',
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss.png'
      }
    ],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: {
          ...notificationData.data,
          ...data.data
        }
      };
    } catch (error) {
      console.error('Failed to parse push data:', error);
      notificationData.body = event.data.text();
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        console.log('Notification shown successfully');

        // Send analytics data
        return sendNotificationAnalytics({
          type: 'notification_shown',
          title: notificationData.title,
          timestamp: Date.now()
        });
      })
      .catch((error) => {
        console.error('Failed to show notification:', error);
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  const notification = event.notification;
  const action = event.action;

  // Close the notification
  notification.close();

  // Handle different actions
  if (action === 'dismiss') {
    return;
  }

  // Get the URL to open
  const urlToOpen = action === 'view' && notification.data.url
    ? notification.data.url
    : '/';

  // Send analytics
  sendNotificationAnalytics({
    type: 'notification_clicked',
    action: action || 'default',
    title: notification.title,
    timestamp: Date.now()
  });

  // Open or focus the app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') {
              client.postMessage({
                type: 'NAVIGATE',
                url: urlToOpen
              });
            }
            return;
          }
        }

        // Open a new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch((error) => {
        console.error('Failed to handle notification click:', error);
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);

  sendNotificationAnalytics({
    type: 'notification_closed',
    title: event.notification.title,
    timestamp: Date.now()
  });
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event);

  if (event.tag === 'background-sync') {
    event.waitUntil(
      syncNotifications()
        .then(() => {
          console.log('Background sync completed');
        })
        .catch((error) => {
          console.error('Background sync failed:', error);
        })
    );
  }
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Message received:', event);

  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;

    case 'CACHE_RESOURCES':
      event.waitUntil(
        caches.open(CACHE_NAME)
          .then((cache) => cache.addAll(data.urls))
      );
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.delete(CACHE_NAME)
      );
      break;

    default:
      console.warn('Unknown message type:', type);
  }
});

// Helper function to send analytics data
function sendNotificationAnalytics(data) {
  return fetch('/api/analytics/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }).catch((error) => {
    console.error('Failed to send analytics:', error);
  });
}

// Helper function to sync notifications in background
async function syncNotifications() {
  try {
    // Get offline stored notifications
    const cache = await caches.open('notifications-offline');
    const requests = await cache.keys();

    // Process offline notifications
    for (const request of requests) {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          await cache.delete(request);
        }
      } catch (error) {
        console.error('Failed to sync notification:', error);
      }
    }

    // Fetch new notifications
    const newNotifications = await fetch('/api/notifications/sync', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await getStoredToken()}`
      }
    });

    if (newNotifications.ok) {
      const notifications = await newNotifications.json();

      // Show new notifications
      for (const notification of notifications) {
        await self.registration.showNotification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id,
          data: notification.data,
          requireInteraction: notification.priority === 'critical'
        });
      }
    }
  } catch (error) {
    console.error('Sync notifications failed:', error);
    throw error;
  }
}

// Helper function to get stored auth token
async function getStoredToken() {
  // In a real implementation, you'd securely store and retrieve the auth token
  return 'stored-auth-token';
}

// Error handler
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event);
});

console.log('Email Assist Service Worker loaded successfully');