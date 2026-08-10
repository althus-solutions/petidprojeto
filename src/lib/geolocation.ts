function getPositionOnce(
  options: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Seu navegador não suporta geolocalização.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

/**
 * Obtém GPS com alta precisão e, se falhar/timeout, tenta novamente com
 * precisão reduzida (mais estável em celular / HTTPS / PWA).
 */
export async function getGeolocation(): Promise<GeolocationPosition> {
  try {
    return await getPositionOnce({
      enableHighAccuracy: true,
      timeout: 18_000,
      maximumAge: 10_000,
    })
  } catch {
    return getPositionOnce({
      enableHighAccuracy: false,
      timeout: 20_000,
      maximumAge: 60_000,
    })
  }
}
