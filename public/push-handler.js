/* Handler de Web Push — carregado pelo service worker do PWA (vite-plugin-pwa) */

self.addEventListener('push', (event) => {
  let data = { title: 'PetID', body: 'Nova notificação', url: '/tutor' }

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch {
    /* payload inválido — usa defaults */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url ?? '/tutor' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/tutor'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    }),
  )
})
