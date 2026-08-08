import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function subscribeToPushNotifications(): Promise<{ ok: boolean; error?: string }> {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  if (!isPushSupported()) {
    return { ok: false, error: 'Seu navegador não suporta notificações push.' }
  }

  if (!vapidPublicKey) {
    return { ok: false, error: 'Push não configurado no servidor (VAPID).' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: 'Permissão de notificação negada.' }
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  const { error } = await supabase.rpc('salvar_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
    p_auth: arrayBufferToBase64(subscription.getKey('auth')),
    p_user_agent: navigator.userAgent,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
