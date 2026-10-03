import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as L from "leaflet"
import "leaflet/dist/leaflet.css"
import { apiFetch } from "../api"
import { useAuth } from "../auth"
import { Empty, Status, useApi } from "../lib"
import "./locations.css"

export type SavedLocation = {
    id: number
    name: string | null
    track_id: number | null
    sequence: number | null
    recorded_at: string | null
    altitude: number | null
    accuracy: number | null
    track: { id: number; name: string } | null
    notes: string | null
    latitude: number
    longitude: number
    added_by: number
    added_by_user: { id: number; name: string }
}

type Track = { id: number; name: string; activity_type: string | null; added_by: number; _count: { points: number } }
type TrackDetail = Track & { points: SavedLocation[] }

const pointName = (point: SavedLocation) => point.name ?? (point.track ? `${point.track.name} · Point ${point.sequence}` : `Point ${point.id}`)

const NO_LOCATIONS: SavedLocation[] = []
const pinIcon = L.divIcon({ className: "location-pin", html: "", iconSize: [20, 20], iconAnchor: [10, 10] })

const LocationMap = ({ locations, selected, latitude, longitude, onPick, onSelect }: {
    locations: SavedLocation[]
    selected: number | null
    latitude: string
    longitude: string
    onPick: (latitude: number, longitude: number) => void
    onSelect: (location: SavedLocation) => void
}) => {
    const container = useRef<HTMLDivElement>(null)
    const map = useRef<L.Map | null>(null)
    const pick = useRef(onPick)
    pick.current = onPick
    const [tileError, setTileError] = useState(false)

    useEffect(() => {
        if (!container.current) return
        const instance = L.map(container.current, { worldCopyJump: true }).setView([20, 0], 2)
        map.current = instance
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(instance)
        tiles.on("tileerror", () => setTileError(true))
        instance.on("click", (event: L.LeafletMouseEvent) => {
            const lat = Math.max(-90, Math.min(90, event.latlng.lat))
            const lng = ((event.latlng.lng + 180) % 360 + 360) % 360 - 180
            pick.current(lat, lng)
        })
        const observer = new ResizeObserver(() => instance.invalidateSize())
        observer.observe(container.current)
        return () => {
            observer.disconnect()
            instance.remove()
            map.current = null
        }
    }, [])

    useEffect(() => {
        const instance = map.current
        if (!instance) return
        const markers = L.featureGroup().addTo(instance)
        for (const location of locations) {
            const title = document.createElement("span")
            title.textContent = pointName(location)
            L.marker([location.latitude, location.longitude], { icon: pinIcon, title: pointName(location), alt: pointName(location) })
                .bindTooltip(title).on("click", () => onSelect(location)).addTo(markers)
        }
        const paths = new Map<number, SavedLocation[]>()
        for (const point of locations) {
            if (point.track_id === null) continue
            const points = paths.get(point.track_id) ?? []
            points.push(point)
            paths.set(point.track_id, points)
        }
        for (const points of paths.values()) {
            points.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
            L.polyline(points.map(point => [point.latitude, point.longitude] as L.LatLngTuple), { color: "#2d7c6f", weight: 4 }).addTo(markers)
        }
        if (locations.length && selected === null) instance.fitBounds(markers.getBounds(), { padding: [30, 30], maxZoom: 14 })
        return () => { markers.remove() }
    }, [locations, onSelect, selected])

    useEffect(() => {
        const instance = map.current
        const lat = Number(latitude)
        const lng = Number(longitude)
        if (!instance || !latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return
        const marker = L.circleMarker([lat, lng], { radius: 12, color: "#c45c24", fillOpacity: 0.3 }).addTo(instance)
        instance.panTo([lat, lng])
        return () => { marker.remove() }
    }, [latitude, longitude])

    return <>
        <div className="locations-map" ref={container} aria-label="Locations map. Click to choose coordinates." />
        {tileError ? <Status message="Map tiles could not load. You can still enter coordinates and manage locations below." error /> : null}
    </>
}

export const LocationsPage = () => {
    const { user } = useAuth()
    const [filter, setFilter] = useState("places")
    const { data, loading, error, reload } = useApi<SavedLocation[]>(`/api/location-points?kind=${filter}`)
    const { data: tracksData, error: tracksError, reload: reloadTracks } = useApi<Track[]>("/api/tracks")
    const tracks = tracksData ?? []
    const [trackId, setTrackId] = useState("")
    const [sequence, setSequence] = useState("")
    const [recordedAt, setRecordedAt] = useState("")
    const [altitude, setAltitude] = useState("")
    const [accuracy, setAccuracy] = useState("")
    const [trackName, setTrackName] = useState("")
    const [activity, setActivity] = useState("")
    const { data: trackDetail, reload: reloadTrackDetail } = useApi<TrackDetail>(trackId ? `/api/tracks/${trackId}` : null)
    const locations = useMemo(() => (data ?? NO_LOCATIONS).filter(point => filter === "all" || (filter === "places" ? point.track_id === null : point.track_id !== null)), [data, filter])
    const [selected, setSelected] = useState<SavedLocation | null>(null)
    const [name, setName] = useState("")
    const [notes, setNotes] = useState("")
    const [latitude, setLatitude] = useState("")
    const [longitude, setLongitude] = useState("")
    const [status, setStatus] = useState("")
    const [statusError, setStatusError] = useState(false)
    const [busy, setBusy] = useState(false)
    const canEdit = !selected || !!user?.is_admin || (selected.added_by === user?.id && (!selected.track_id || tracks.some(track => track.id === selected.track_id && track.added_by === user?.id)))

    const select = useCallback((location: SavedLocation) => {
        setSelected(location)
        setName(location.name ?? "")
        setTrackId(location.track_id === null ? "" : String(location.track_id))
        setSequence(location.sequence === null ? "" : String(location.sequence))
        setRecordedAt(location.recorded_at ?? "")
        setAltitude(location.altitude === null ? "" : String(location.altitude))
        setAccuracy(location.accuracy === null ? "" : String(location.accuracy))
        setNotes(location.notes ?? "")
        setLatitude(String(location.latitude))
        setLongitude(String(location.longitude))
        setStatus("")
    }, [])

    const clear = () => {
        setSelected(null)
        setTrackId("")
        setSequence("")
        setRecordedAt("")
        setAltitude("")
        setAccuracy("")
        setName("")
        setNotes("")
        setLatitude("")
        setLongitude("")
    }

    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!canEdit || busy) return
        setBusy(true)
        try {
            await apiFetch(selected ? `/api/location-points/${selected.id}` : "/api/location-points", {
                method: selected ? "PATCH" : "POST",
                body: JSON.stringify({ name: name.trim() || null, notes: notes.trim() || null, latitude: Number(latitude), longitude: Number(longitude),
                    track_id: trackId ? Number(trackId) : null, sequence: trackId ? Number(sequence) : null,
                    recorded_at: recordedAt.trim() || null, altitude: altitude.trim() ? Number(altitude) : null, accuracy: accuracy.trim() ? Number(accuracy) : null,
                }),
            })
            setStatus(selected ? "Location saved." : "Location added.")
            setStatusError(false)
            clear()
            if (!selected && trackId) {
                setTrackId(trackId)
                setSequence(String(Number(sequence) + 1))
            }
            reload()
            reloadTracks()
            reloadTrackDetail()
        } catch (err) {
            setStatus(err instanceof Error ? err.message : "Could not save location.")
            setStatusError(true)
        } finally { setBusy(false) }
    }

    const remove = async () => {
        if (!selected || !canEdit || busy || !window.confirm(`Delete point “${pointName(selected)}”?`)) return
        setBusy(true)
        try {
            await apiFetch(`/api/location-points/${selected.id}`, { method: "DELETE" })
            clear()
            reload()
            reloadTracks()
            setStatus("Location deleted.")
            setStatusError(false)
        } catch (err) {
            setStatus(err instanceof Error ? err.message : "Could not delete location.")
            setStatusError(true)
        } finally { setBusy(false) }
    }

    const createTrack = async (event: React.FormEvent) => {
        event.preventDefault()
        if (busy) return
        setBusy(true)
        try {
            const track = await apiFetch<Track>("/api/tracks", { method: "POST", body: JSON.stringify({ name: trackName.trim(), activity_type: activity.trim() || null }) })
            clear()
            setTrackId(String(track.id))
            setSequence("0")
            setTrackName("")
            setActivity("")
            reloadTracks()
            setFilter("tracks")
            setStatus("Track created. Click the map to add its first point.")
            setStatusError(false)
        } catch (err) {
            setStatus(err instanceof Error ? err.message : "Could not create track.")
            setStatusError(true)
        } finally { setBusy(false) }
    }

    return <section className="workspace workspace--single">
        <div className="card panel">
            <div className="section-header"><h2>Locations</h2><label>Show<select value={filter} disabled={busy} onChange={event => { setFilter(event.target.value); clear() }}>
                <option value="places">Places</option><option value="tracks">Tracks</option><option value="all">All</option>
            </select></label></div>
            <p className="section-copy">Save places with a note. Click the map to choose coordinates, or enter them below.</p>
            <LocationMap locations={locations} selected={selected?.id ?? null} latitude={latitude} longitude={longitude} onPick={(lat, lng) => {
                if (!canEdit || busy) return
                setLatitude(lat.toFixed(6))
                setLongitude(lng.toFixed(6))
            }} onSelect={select} />
            <div className="locations-details">
                <div>
                    <div className="section-header"><h3>{selected ? "Location details" : "Add location"}</h3><button type="button" className="secondary" disabled={busy} onClick={clear}>New location</button></div>
                    {selected ? <p className="section-copy">Added by {selected.added_by_user.name}</p> : null}
                    {!canEdit ? <p className="section-copy">Only the creator or an administrator can edit this location.</p> : null}
                    <form onSubmit={save}>
                        <fieldset className="locations-fields" disabled={!canEdit || busy}>
                            <label>Name (optional)<input value={name} onChange={event => setName(event.target.value)} /></label>
                            <div className="row">
                                <label>Latitude<input required type="number" step="any" min="-90" max="90" value={latitude} onChange={event => setLatitude(event.target.value)} placeholder="60.1699" /></label>
                                <label>Longitude<input required type="number" step="any" min="-180" max="180" value={longitude} onChange={event => setLongitude(event.target.value)} placeholder="24.9384" /></label>
                            </div>
                            <label>Track<select value={trackId} onChange={event => { setTrackId(event.target.value); setSequence("") }}>
                                <option value="">Standalone place</option>
                                {tracks.filter(track => track.added_by === user?.id || user?.is_admin || track.id === selected?.track_id).map(track => <option key={track.id} value={track.id}>{track.name}</option>)}
                            </select></label>
                            {trackId ? <div className="row"><label>Sequence<input required type="number" min="0" step="1" value={sequence} onChange={event => setSequence(event.target.value)} /></label>
                                <button type="button" className="secondary" disabled={!trackDetail || trackDetail.id !== Number(trackId)} onClick={() => setSequence(String((trackDetail?.points ?? []).reduce((last, point) => Math.max(last, point.sequence ?? -1), -1) + 1))}>Use next sequence</button></div> : null}
                            <details><summary>Recording details (optional)</summary>
                                <label>Recorded at<input value={recordedAt} onChange={event => setRecordedAt(event.target.value)} placeholder="2026-10-03T12:00:00Z" /></label>
                                <div className="row"><label>Altitude (m)<input type="number" step="any" value={altitude} onChange={event => setAltitude(event.target.value)} /></label>
                                <label>GPS accuracy (m)<input type="number" min="0" step="any" value={accuracy} onChange={event => setAccuracy(event.target.value)} /></label></div>
                            </details>
                            <label>Note<textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="What is this place?" /></label>
                            <div className="actions"><button className="primary" type="submit">{busy ? "Saving…" : selected ? "Save location" : "Add location"}</button>{selected ? <button className="secondary" type="button" onClick={() => void remove()}>Delete</button> : null}</div>
                        </fieldset>
                    </form>
                    <details className="locations-track-create"><summary>Create track</summary>
                        <form onSubmit={createTrack}><label>Track name<input required value={trackName} onChange={event => setTrackName(event.target.value)} /></label>
                            <label>Activity type<input value={activity} onChange={event => setActivity(event.target.value)} placeholder="Walking, running, cycling…" /></label>
                            <button type="submit" className="primary" disabled={busy}>Create track</button>
                        </form>
                    </details>
                    <Status message={tracksError ?? status} error={!!tracksError || statusError} />
                </div>
                <div>
                    <h3>Location points ({locations.length})</h3>
                    <Status message={loading ? "Loading locations…" : error ?? ""} error={!!error} />
                    {!loading && !error && !locations.length ? <Empty message="No points in this view." /> : null}
                    <div className="locations-list">{locations.map(location => <button key={location.id} type="button" className="location-row" disabled={busy} aria-pressed={selected?.id === location.id} onClick={() => select(location)}>
                        <strong>{pointName(location)}</strong>
                        {location.track ? <span className="section-copy">Track: {location.track.name} · Sequence {location.sequence}</span> : null}
                        {location.notes ? <span>{location.notes}</span> : null}
                        <span className="section-copy">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} · Added by {location.added_by_user.name}</span>
                    </button>)}</div>
                </div>
            </div>
        </div>
    </section>
}
