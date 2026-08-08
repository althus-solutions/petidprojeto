import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { OcorrenciaAbertaMapa } from '@/types/ocorrencia'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Ícones padrão do Leaflet quebram no bundler — redefinir
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333]

interface OcorrenciasMapProps {
  ocorrencias: OcorrenciaAbertaMapa[]
  selectedId?: string | null
}

function FitBounds({ ocorrencias }: { ocorrencias: OcorrenciaAbertaMapa[] }) {
  const map = useMap()

  useEffect(() => {
    const points: [number, number][] = []
    for (const o of ocorrencias) {
      if (Number.isFinite(o.latitude) && Number.isFinite(o.longitude)) {
        points.push([o.latitude, o.longitude])
      }
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
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36] })
  }, [map, ocorrencias])

  return null
}

export function OcorrenciasMap({ ocorrencias, selectedId }: OcorrenciasMapProps) {
  const center = useMemo((): [number, number] => {
    const first = ocorrencias[0]
    if (first && Number.isFinite(first.latitude)) {
      return [first.latitude, first.longitude]
    }
    return DEFAULT_CENTER
  }, [ocorrencias])

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-[280px] w-full rounded-[14px] z-0 sm:h-[340px]"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds ocorrencias={ocorrencias} />
      {ocorrencias.map((o) => (
        <Marker
          key={o.id}
          position={[o.latitude, o.longitude]}
          opacity={selectedId && selectedId !== o.id ? 0.45 : 1}
        >
          <Popup>
            <strong>{o.animal_nome}</strong>
            <br />
            Perda: {new Date(o.data_perda + 'T12:00:00').toLocaleDateString('pt-BR')}
            <br />
            {o.localizado ? 'Localizado (leitura da tag)' : 'Ainda não localizado'}
          </Popup>
        </Marker>
      ))}
      {ocorrencias
        .filter(
          (o) =>
            o.localizado &&
            o.ultima_leitura_lat != null &&
            o.ultima_leitura_lng != null,
        )
        .map((o) => (
          <CircleMarker
            key={`loc-${o.id}`}
            center={[o.ultima_leitura_lat!, o.ultima_leitura_lng!]}
            radius={10}
            pathOptions={{
              color: '#1F9D55',
              fillColor: '#1F9D55',
              fillOpacity: 0.55,
            }}
          >
            <Popup>
              Última localização de <strong>{o.animal_nome}</strong> (tag)
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  )
}
