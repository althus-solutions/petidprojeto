import { useEffect, useMemo } from 'react'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { OcorrenciaAbertaMapa } from '@/types/ocorrencia'
import type { TutorEndereco } from '@/types/tutor-endereco'
import { formatTutorEnderecoLinha } from '@/types/tutor-endereco'

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333]

interface OcorrenciasMapProps {
  ocorrencias: OcorrenciaAbertaMapa[]
  selectedId?: string | null
  tutorEndereco?: TutorEndereco | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pinIcon(kind: 'endereco' | 'found', label: string) {
  const cls =
    kind === 'endereco'
      ? 'petid-map-pin petid-map-pin--home'
      : 'petid-map-pin petid-map-pin--found'
  const raw = (label.trim() || (kind === 'found' ? 'Pet' : 'Você')).slice(0, 16)
  const safe = escapeHtml(raw)

  return L.divIcon({
    className: 'petid-map-pin-wrap',
    html: `<div class="${cls}" aria-hidden="true"><span class="petid-map-pin__dot"></span><span class="petid-map-pin__label">${safe}</span></div>`,
    iconSize: [80, 56],
    iconAnchor: [40, 48],
    popupAnchor: [0, -42],
  })
}

function FitBounds({
  ocorrencias,
  tutorEndereco,
}: {
  ocorrencias: OcorrenciaAbertaMapa[]
  tutorEndereco?: TutorEndereco | null
}) {
  const map = useMap()

  useEffect(() => {
    const points: [number, number][] = []

    if (
      tutorEndereco &&
      Number.isFinite(tutorEndereco.latitude) &&
      Number.isFinite(tutorEndereco.longitude)
    ) {
      points.push([tutorEndereco.latitude, tutorEndereco.longitude])
    }

    for (const o of ocorrencias) {
      if (
        o.localizado &&
        o.ultima_leitura_lat != null &&
        o.ultima_leitura_lng != null
      ) {
        points.push([o.ultima_leitura_lat, o.ultima_leitura_lng])
      }
    }

    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, 11)
      return
    }
    if (points.length === 1) {
      map.setView(points[0], 17)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 18 })
  }, [map, ocorrencias, tutorEndereco])

  return null
}

export function OcorrenciasMap({
  ocorrencias,
  selectedId,
  tutorEndereco,
}: OcorrenciasMapProps) {
  const center = useMemo((): [number, number] => {
    const found = ocorrencias.find(
      (o) =>
        o.localizado &&
        o.ultima_leitura_lat != null &&
        o.ultima_leitura_lng != null,
    )
    if (found) {
      return [found.ultima_leitura_lat!, found.ultima_leitura_lng!]
    }
    if (tutorEndereco) {
      return [tutorEndereco.latitude, tutorEndereco.longitude]
    }
    return DEFAULT_CENTER
  }, [ocorrencias, tutorEndereco])

  return (
    <MapContainer
      center={center}
      zoom={17}
      className="petid-map h-[300px] w-full z-0 sm:h-[380px]"
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <FitBounds ocorrencias={ocorrencias} tutorEndereco={tutorEndereco} />

      {tutorEndereco &&
        Number.isFinite(tutorEndereco.latitude) &&
        Number.isFinite(tutorEndereco.longitude) && (
          <Marker
            position={[tutorEndereco.latitude, tutorEndereco.longitude]}
            icon={pinIcon('endereco', 'Você')}
            zIndexOffset={200}
          >
            <Popup>
              <strong>Seu endereço</strong>
              <br />
              {formatTutorEnderecoLinha(tutorEndereco)}
              <br />
              <span style={{ color: '#6b7280', fontSize: 12 }}>
                Privado — só você vê no app.
              </span>
            </Popup>
          </Marker>
        )}

      {ocorrencias
        .filter(
          (o) =>
            o.localizado &&
            o.ultima_leitura_lat != null &&
            o.ultima_leitura_lng != null,
        )
        .map((o) => (
          <Marker
            key={`found-${o.id}`}
            position={[o.ultima_leitura_lat!, o.ultima_leitura_lng!]}
            icon={pinIcon('found', o.animal_nome)}
            opacity={selectedId && selectedId !== o.id ? 0.55 : 1}
            zIndexOffset={400}
          >
            <Popup>
              <strong>{o.animal_nome}</strong>
              <br />
              <span style={{ fontSize: 12 }}>Lido na tag</span>
              <br />
              {o.ultima_leitura_endereco ? (
                <>
                  {o.ultima_leitura_endereco}
                  <br />
                </>
              ) : (
                <>
                  Localização compartilhada na leitura da tag
                  <br />
                </>
              )}
              {o.ultima_leitura_em && (
                <span style={{ color: '#6b7280', fontSize: 12 }}>
                  {new Date(o.ultima_leitura_em).toLocaleString('pt-BR')}
                </span>
              )}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  )
}
