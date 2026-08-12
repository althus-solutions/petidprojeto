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

export type TutorLocalizacaoAtual = {
  latitude: number
  longitude: number
}

interface OcorrenciasMapProps {
  ocorrencias: OcorrenciaAbertaMapa[]
  selectedId?: string | null
  tutorEndereco?: TutorEndereco | null
  /** GPS atual do tutor (só no cliente — privado). */
  tutorAtual?: TutorLocalizacaoAtual | null
}

type PinKind = 'endereco' | 'atual' | 'found'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pinIcon(kind: PinKind, label: string) {
  const cls =
    kind === 'endereco'
      ? 'petid-map-pin petid-map-pin--home'
      : kind === 'atual'
        ? 'petid-map-pin petid-map-pin--atual'
        : 'petid-map-pin petid-map-pin--found'
  const fallback =
    kind === 'found' ? 'Pet' : kind === 'atual' ? 'Você' : 'Casa'
  const raw = (label.trim() || fallback).slice(0, 16)
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
  tutorAtual,
}: {
  ocorrencias: OcorrenciaAbertaMapa[]
  tutorEndereco?: TutorEndereco | null
  tutorAtual?: TutorLocalizacaoAtual | null
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

    if (
      tutorAtual &&
      Number.isFinite(tutorAtual.latitude) &&
      Number.isFinite(tutorAtual.longitude)
    ) {
      points.push([tutorAtual.latitude, tutorAtual.longitude])
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
  }, [map, ocorrencias, tutorEndereco, tutorAtual])

  return null
}

export function OcorrenciasMap({
  ocorrencias,
  selectedId,
  tutorEndereco,
  tutorAtual,
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
    if (tutorAtual) {
      return [tutorAtual.latitude, tutorAtual.longitude]
    }
    if (tutorEndereco) {
      return [tutorEndereco.latitude, tutorEndereco.longitude]
    }
    return DEFAULT_CENTER
  }, [ocorrencias, tutorEndereco, tutorAtual])

  return (
    <MapContainer
      center={center}
      zoom={17}
      className="petid-map z-0 h-[420px] w-full sm:h-[520px]"
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <FitBounds
        ocorrencias={ocorrencias}
        tutorEndereco={tutorEndereco}
        tutorAtual={tutorAtual}
      />

      {tutorEndereco &&
        Number.isFinite(tutorEndereco.latitude) &&
        Number.isFinite(tutorEndereco.longitude) && (
          <Marker
            position={[tutorEndereco.latitude, tutorEndereco.longitude]}
            icon={pinIcon('endereco', 'Casa')}
            zIndexOffset={200}
          >
            <Popup>
              <strong>Residência</strong>
              <br />
              {formatTutorEnderecoLinha(tutorEndereco)}
              <br />
              <span style={{ color: '#6b7280', fontSize: 12 }}>
                Endereço do perfil — só você vê no app.
              </span>
            </Popup>
          </Marker>
        )}

      {tutorAtual &&
        Number.isFinite(tutorAtual.latitude) &&
        Number.isFinite(tutorAtual.longitude) && (
          <Marker
            position={[tutorAtual.latitude, tutorAtual.longitude]}
            icon={pinIcon('atual', 'Você')}
            zIndexOffset={300}
          >
            <Popup>
              <strong>Sua localização atual</strong>
              <br />
              <span style={{ fontSize: 12 }}>
                Onde você está agora (GPS deste aparelho).
              </span>
              <br />
              <span style={{ color: '#6b7280', fontSize: 12 }}>
                Privado — não é compartilhado com quem leu a tag.
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
              <span style={{ fontSize: 12 }}>Lido na tag (QR/NFC)</span>
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
