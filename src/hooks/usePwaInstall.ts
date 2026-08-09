import { useCallback, useEffect, useState } from 'react'
import {
  isAndroidDevice,
  isIosDevice,
  isStandaloneDisplay,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa-install'

export type PwaInstallStatus =
  | 'installed'
  | 'can_install'
  | 'ios_manual'
  | 'android_manual'
  | 'desktop_hint'

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(() => isStandaloneDisplay())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onBeforeInstall(e: BeforeInstallPromptEvent) {
      e.preventDefault()
      setDeferred(e)
    }

    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    const mq = window.matchMedia('(display-mode: standalone)')
    const onDisplayChange = () => setInstalled(isStandaloneDisplay())
    mq.addEventListener?.('change', onDisplayChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      mq.removeEventListener?.('change', onDisplayChange)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return false
    setBusy(true)
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      setDeferred(null)
      if (choice.outcome === 'accepted') {
        setInstalled(true)
        return true
      }
      return false
    } finally {
      setBusy(false)
    }
  }, [deferred])

  let status: PwaInstallStatus
  if (installed) status = 'installed'
  else if (deferred) status = 'can_install'
  else if (isIosDevice()) status = 'ios_manual'
  else if (isAndroidDevice()) status = 'android_manual'
  else status = 'desktop_hint'

  return {
    status,
    busy,
    canPrompt: Boolean(deferred) && !installed,
    promptInstall,
  }
}
