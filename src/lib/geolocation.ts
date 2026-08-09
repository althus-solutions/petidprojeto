export function getGeolocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Seu navegador não suporta geolocalização.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      // Alta precisão (GPS) — importante no resgate da tag para o tutor ir ao ponto certo
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 15_000,
    })
  })
}
