import type { ConnectedVehicle } from '@/data/adminCarte'

/* ------------------------------------------------------------------ */
/* Types de base                                                       */
/* ------------------------------------------------------------------ */

export type EventType =
  | 'secousse'
  | 'obstacle'
  | 'freinage'
  | 'virage'
  | 'route_defectueuse'
  | 'exces_vitesse'
  | 'normal'

export const EVENT_PRIORITY: EventType[] = [
  'secousse',
  'obstacle',
  'freinage',
  'virage',
  'route_defectueuse',
  'exces_vitesse',
  'normal',
]

export const EVENT_META: Record<EventType, { label: string; icon: string; color: string; soft: string; alarming: boolean }> = {
  secousse: { label: 'Secousse dangereuse', icon: 'vibration', color: '#dc3a2f', soft: '#fdeeec', alarming: true },
  obstacle: { label: 'Obstacle proche', icon: 'front_hand', color: '#dc3a2f', soft: '#fdeeec', alarming: true },
  freinage: { label: 'Freinage brusque', icon: 'emergency', color: '#e8940c', soft: '#fdf4e6', alarming: true },
  virage: { label: 'Virage', icon: 'turn_slight_right', color: '#2b6cb0', soft: '#e8f0f9', alarming: false },
  route_defectueuse: { label: 'Route défectueuse', icon: 'warning', color: '#7c3aed', soft: '#f1ebfd', alarming: true },
  exces_vitesse: { label: 'Excès de vitesse', icon: 'speed', color: '#dc3a2f', soft: '#fdeeec', alarming: true },
  normal: { label: 'Normal', icon: 'check_circle', color: '#1f9d55', soft: '#e9f6ee', alarming: false },
}

export type Connectivity = 'wifi' | 'gsm' | 'hors_ligne'

export const CONNECTIVITY_META: Record<Connectivity, { label: string; icon: string; color: string; soft: string }> = {
  wifi: { label: 'WiFi', icon: 'wifi', color: '#1f9d55', soft: '#e9f6ee' },
  gsm: { label: 'GSM', icon: 'signal_cellular_alt', color: '#e8940c', soft: '#fdf4e6' },
  hors_ligne: { label: 'Hors ligne', icon: 'wifi_off', color: '#dc3a2f', soft: '#fdeeec' },
}

/* ------------------------------------------------------------------ */
/* Flotte de boîtiers                                                  */
/* ------------------------------------------------------------------ */

export interface BoitierUnit {
  id: string
  vehicleId: string
  matricule: string
  driverName: string
}

/** Les quatre boîtiers de la flotte — cahier des charges §7 : non filtrés par région. */
export const BOITIERS: BoitierUnit[] = [
  { id: 'SR-01', vehicleId: 'v1', matricule: 'DK-2145-AB', driverName: 'Ibrahima Sarr' },
  { id: 'SR-02', vehicleId: 'v2', matricule: 'DK-0932-CD', driverName: 'Aïssatou Ndao' },
  { id: 'SR-05', vehicleId: 'v3', matricule: 'DK-4471-EF', driverName: 'Moussa Diop' },
  { id: 'SR-06', vehicleId: 'v4', matricule: 'DK-1187-GH', driverName: 'Fatou Camara' },
]

/* ------------------------------------------------------------------ */
/* Calibration (Super Admin uniquement)                                */
/* ------------------------------------------------------------------ */

export interface Calibration {
  obstacleDistanceCm: number
  brakingThreshold: number
  jerkThreshold: number
  speedLimitKmh: number
}

export const DEFAULT_CALIBRATION: Calibration = {
  obstacleDistanceCm: 40,
  brakingThreshold: 4.5,
  jerkThreshold: 12,
  speedLimitKmh: 90,
}

export const CALIBRATION_LIMITS: Record<keyof Calibration, { min: number; max: number; step: number; unit: string; label: string }> = {
  obstacleDistanceCm: { min: 15, max: 100, step: 1, unit: 'cm', label: 'Distance obstacle' },
  brakingThreshold: { min: 2, max: 9, step: 0.1, unit: 'm/s²', label: 'Seuil de freinage' },
  jerkThreshold: { min: 6, max: 20, step: 0.5, unit: 'm/s²', label: 'Seuil de secousse' },
  speedLimitKmh: { min: 50, max: 130, step: 1, unit: 'km/h', label: 'Limite de vitesse' },
}

/* Seuils internes, non calibrables (aucun curseur du cahier des charges ne les couvre). */
const VIRAGE_LATERAL_THRESHOLD = 4
const VIRAGE_ROTATION_THRESHOLD = 0.5
const ROUTE_Z_THRESHOLD = 6

/* ------------------------------------------------------------------ */
/* Lectures capteurs                                                   */
/* ------------------------------------------------------------------ */

export interface UltrasonReading {
  shots: number[]
  distanceCm: number
  history: number[]
}

export interface MpuAxis {
  raw: number
  dynamic: number
}

export interface MpuReading {
  x: MpuAxis
  y: MpuAxis
  z: MpuAxis
  magnitude: number
  zRotation: number
}

export type GpsQuality = 'excellente' | 'bonne' | 'moyenne' | 'faible' | 'mauvaise'

export interface GpsReading {
  lat: number
  lng: number
  headingDeg: number
  speedKmh: number
  altitudeM: number
  satellites: number
  hdop: number
  quality: GpsQuality
}

export const GPS_QUALITY_META: Record<GpsQuality, { label: string; color: string }> = {
  excellente: { label: 'Excellente', color: '#1f9d55' },
  bonne: { label: 'Bonne', color: '#2b6cb0' },
  moyenne: { label: 'Moyenne', color: '#e8940c' },
  faible: { label: 'Faible', color: '#dc3a2f' },
  mauvaise: { label: 'Mauvaise', color: '#dc3a2f' },
}

export type RadarStatus = 'ok' | 'signal_faible' | 'saturation'

export interface RadarReading {
  speedKmh: number
  frequencyHz: number
  amplitude: number
  status: RadarStatus
  spectrum: number[]
}

export const RADAR_STATUS_META: Record<RadarStatus, { label: string; color: string }> = {
  ok: { label: 'Signal nominal', color: '#1f9d55' },
  signal_faible: { label: 'Signal faible', color: '#e8940c' },
  saturation: { label: 'Saturation', color: '#dc3a2f' },
}

export const RADAR_MAX_HZ = 3000
export const RADAR_BINS = 40
/** Figure du HB100 à 24,125 GHz retenue pour la fiche technique : ~19,4 Hz par km/h. */
export const RADAR_HZ_PER_KMH = 19.4

export interface SensorFrame {
  id: number
  timestampMs: number
  ultrason: UltrasonReading
  mpu: MpuReading
  gps: GpsReading
  radar: RadarReading
  eventType: EventType
  connectivity: Connectivity
  transmission: 'mqtt' | 'csv'
}

export interface SimState {
  boitierId: string
  vehicleId: string
  current: SensorFrame
  log: SensorFrame[]
  ultrasonHistory: number[]
  pendingCsvLines: number
  frameCount: number
  uptimeMs: number
}

/* ------------------------------------------------------------------ */
/* Utilitaires numériques                                              */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function gauss(mean = 0, sd = 1): number {
  const u = Math.random() || 1e-9
  const v = Math.random()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return mean + z * sd
}

function normalizeAngle(deg: number): number {
  let d = deg % 360
  if (d < 0) d += 360
  return d
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

/** Formate un nombre en français : virgule décimale et vrai signe moins (−). */
export function formatFr(value: number, decimals = 1): string {
  const s = value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return s.startsWith('-') ? `−${s.slice(1)}` : s
}

/* ------------------------------------------------------------------ */
/* Scénarios de simulation (biais de tirage, pas la classification)    */
/* ------------------------------------------------------------------ */

type Scenario = 'normal' | 'obstacle' | 'freinage' | 'secousse' | 'virage' | 'route' | 'vitesse'

const SCENARIO_WEIGHTS: [Scenario, number][] = [
  ['normal', 38],
  ['obstacle', 10],
  ['freinage', 12],
  ['secousse', 9],
  ['virage', 12],
  ['route', 9],
  ['vitesse', 10],
]

function pickScenario(): Scenario {
  const total = SCENARIO_WEIGHTS.reduce((sum, [, w]) => sum + w, 0)
  let roll = Math.random() * total
  for (const [name, weight] of SCENARIO_WEIGHTS) {
    if (roll < weight) return name
    roll -= weight
  }
  return 'normal'
}

function scenarioTargetSpeed(scenario: Scenario, calib: Calibration, currentSpeed: number): number {
  switch (scenario) {
    case 'vitesse':
      return calib.speedLimitKmh + 15 + Math.random() * 15
    case 'freinage':
      return Math.max(5, currentSpeed - 25)
    case 'obstacle':
      return Math.max(5, currentSpeed - 10)
    default:
      return clamp(currentSpeed + gauss(0, 8), 15, 80)
  }
}

function gpsQualityFromHdop(hdop: number): GpsQuality {
  if (hdop < 1) return 'excellente'
  if (hdop < 2) return 'bonne'
  if (hdop < 4) return 'moyenne'
  if (hdop < 8) return 'faible'
  return 'mauvaise'
}

function buildSpectrum(peakHz: number, amplitude: number, status: RadarStatus): number[] {
  const bins: number[] = []
  for (let i = 0; i < RADAR_BINS; i++) {
    const binHz = (i / RADAR_BINS) * RADAR_MAX_HZ
    const distance = Math.abs(binHz - peakHz)
    const width = 90
    const noise = 4 + Math.random() * 6
    const peak = status === 'signal_faible' ? 0 : amplitude * Math.exp(-(distance * distance) / (2 * width * width))
    bins.push(clamp(Math.round(noise + peak), 0, 100))
  }
  return bins
}

/* ------------------------------------------------------------------ */
/* Classification stricte — ordre de priorité du firmware               */
/* ------------------------------------------------------------------ */

function classify(
  mpu: MpuReading,
  ultrason: UltrasonReading,
  gps: GpsReading,
  radar: RadarReading,
  calib: Calibration,
  prevZDynamic: number,
): EventType {
  if (mpu.magnitude > calib.jerkThreshold) return 'secousse'
  if (ultrason.distanceCm < calib.obstacleDistanceCm) return 'obstacle'
  if (mpu.y.dynamic < -calib.brakingThreshold) return 'freinage'
  if (Math.abs(mpu.x.dynamic) > VIRAGE_LATERAL_THRESHOLD && Math.abs(mpu.zRotation) > VIRAGE_ROTATION_THRESHOLD) return 'virage'
  if (
    Math.abs(mpu.z.dynamic) > ROUTE_Z_THRESHOLD &&
    prevZDynamic !== 0 &&
    Math.sign(mpu.z.dynamic) !== Math.sign(prevZDynamic)
  ) {
    return 'route_defectueuse'
  }
  if (gps.speedKmh > calib.speedLimitKmh && radar.speedKmh > calib.speedLimitKmh) return 'exces_vitesse'
  return 'normal'
}

/* ------------------------------------------------------------------ */
/* Génération de trame                                                 */
/* ------------------------------------------------------------------ */

export function nextFrame(prev: SensorFrame, calib: Calibration, elapsedSec: number): SensorFrame {
  const scenario = pickScenario()

  const targetSpeed = scenarioTargetSpeed(scenario, calib, prev.gps.speedKmh)
  const speedKmh = clamp(prev.gps.speedKmh + (targetSpeed - prev.gps.speedKmh) * 0.5 + gauss(0, 2), 0, 130)

  const headingDeg = normalizeAngle(prev.gps.headingDeg + gauss(0, 3) * clamp(elapsedSec / 10, 0.2, 3))
  const distanceKm = (speedKmh * elapsedSec) / 3600
  const headingRad = (headingDeg * Math.PI) / 180
  const latDelta = (distanceKm / 111) * Math.cos(headingRad)
  const lngDelta = (distanceKm / (111 * Math.cos((prev.gps.lat * Math.PI) / 180) || 1)) * Math.sin(headingRad)
  const hdop = clamp(gauss(1.4, 0.7), 0.5, 9)

  const gps: GpsReading = {
    lat: prev.gps.lat + latDelta,
    lng: prev.gps.lng + lngDelta,
    headingDeg,
    speedKmh,
    altitudeM: clamp(prev.gps.altitudeM + gauss(0, 0.6), 0, 60),
    satellites: Math.max(4, Math.round(12 - hdop)),
    hdop,
    quality: gpsQualityFromHdop(hdop),
  }

  const radarSpeed = clamp(speedKmh + gauss(0, 1.2), 0, 140)
  const frequencyHz = radarSpeed * RADAR_HZ_PER_KMH
  const radarRoll = Math.random()
  const radarStatus: RadarStatus = radarRoll < 0.065 ? 'signal_faible' : radarRoll < 0.13 ? 'saturation' : 'ok'
  const amplitude =
    radarStatus === 'signal_faible'
      ? clamp(gauss(8, 3), 0, 20)
      : radarStatus === 'saturation'
        ? 100
        : clamp(gauss(60, 15), 30, 95)

  const radar: RadarReading = {
    speedKmh: radarSpeed,
    frequencyHz,
    amplitude: Math.round(amplitude),
    status: radarStatus,
    spectrum: buildSpectrum(frequencyHz, amplitude, radarStatus),
  }

  const ultrasonBase = scenario === 'obstacle' ? gauss(calib.obstacleDistanceCm * 0.5, 9) : gauss(180, 45)
  const shots = [0, 1, 2].map(() => Math.max(4, Math.round(ultrasonBase + gauss(0, 6))))
  const distanceCm = Math.min(...shots)
  const ultrason: UltrasonReading = {
    shots,
    distanceCm,
    history: [...prev.ultrason.history.slice(-59), distanceCm],
  }

  const lateral = scenario === 'virage' ? gauss(6, 1.5) * (Math.random() < 0.5 ? 1 : -1) : gauss(0, 0.9)
  const longitudinal =
    scenario === 'freinage'
      ? -gauss(6.5, 1.4)
      : scenario === 'secousse'
        ? gauss(6, 1.6) * (Math.random() < 0.5 ? 1 : -1)
        : gauss(0, 1.1)
  const verticalSign = prev.mpu.z.dynamic >= 0 ? -1 : 1
  const verticalDynamic =
    scenario === 'route'
      ? gauss(8, 1.6) * verticalSign
      : scenario === 'secousse'
        ? gauss(10, 2) * (Math.random() < 0.5 ? 1 : -1)
        : gauss(0, 0.8)
  const zRotation = scenario === 'virage' ? gauss(0.85, 0.2) * Math.sign(lateral || 1) : gauss(0, 0.08)
  const magnitude = Math.sqrt(lateral ** 2 + longitudinal ** 2 + verticalDynamic ** 2)

  const mpu: MpuReading = {
    x: { raw: lateral + gauss(0, 0.15), dynamic: lateral },
    y: { raw: longitudinal + gauss(0, 0.15), dynamic: longitudinal },
    z: { raw: 9.81 + verticalDynamic + gauss(0, 0.15), dynamic: verticalDynamic },
    magnitude,
    zRotation,
  }

  const connRoll = Math.random()
  const connectivity: Connectivity = connRoll < 0.03 ? 'hors_ligne' : connRoll < 0.12 ? 'gsm' : 'wifi'
  const transmission: 'mqtt' | 'csv' = connectivity === 'hors_ligne' ? 'csv' : 'mqtt'

  const eventType = classify(mpu, ultrason, gps, radar, calib, prev.mpu.z.dynamic)

  return {
    id: prev.id + 1,
    timestampMs: prev.timestampMs + Math.round(elapsedSec * 1000),
    ultrason,
    mpu,
    gps,
    radar,
    eventType,
    connectivity,
    transmission,
  }
}

/** Intervalle aléatoire entre deux trames naturelles : 2 à 4 minutes (fiche §5). */
export function randomFrameIntervalSec(): number {
  return 120 + Math.random() * 120
}

export function initialSimState(boitier: BoitierUnit, vehicle: ConnectedVehicle | undefined): SimState {
  const [lat, lng] = vehicle?.path[vehicle.path.length - 1] ?? [14.716, -17.4]
  const baseSpeed = vehicle?.speed && vehicle.speed > 0 ? vehicle.speed : 45
  const baseFrame: SensorFrame = {
    id: 0,
    timestampMs: 0,
    ultrason: { shots: [188, 202, 195], distanceCm: 188, history: Array(60).fill(188) },
    mpu: {
      x: { raw: 0, dynamic: 0 },
      y: { raw: 0, dynamic: 0 },
      z: { raw: 9.81, dynamic: 0 },
      magnitude: 0,
      zRotation: 0,
    },
    gps: { lat, lng, headingDeg: 42, speedKmh: baseSpeed, altitudeM: 18, satellites: 10, hdop: 1.1, quality: 'excellente' },
    radar: {
      speedKmh: baseSpeed,
      frequencyHz: baseSpeed * RADAR_HZ_PER_KMH,
      amplitude: 55,
      status: 'ok',
      spectrum: buildSpectrum(baseSpeed * RADAR_HZ_PER_KMH, 55, 'ok'),
    },
    eventType: 'normal',
    connectivity: 'wifi',
    transmission: 'mqtt',
  }

  return {
    boitierId: boitier.id,
    vehicleId: boitier.vehicleId,
    current: baseFrame,
    log: [baseFrame],
    ultrasonHistory: baseFrame.ultrason.history,
    pendingCsvLines: 0,
    frameCount: 1,
    uptimeMs: 0,
  }
}

export function advanceSimulation(state: SimState, calib: Calibration, elapsedSec: number): SimState {
  const frame = nextFrame(state.current, calib, Math.max(1, elapsedSec))

  let pendingCsvLines = state.pendingCsvLines
  if (frame.connectivity === 'hors_ligne') {
    pendingCsvLines += 1
  } else if (state.current.connectivity === 'hors_ligne') {
    pendingCsvLines = 0
  }

  return {
    ...state,
    current: frame,
    log: [frame, ...state.log].slice(0, 40),
    ultrasonHistory: frame.ultrason.history,
    pendingCsvLines,
    frameCount: state.frameCount + 1,
    uptimeMs: state.uptimeMs + Math.round(elapsedSec * 1000),
  }
}

/** Charge utile MQTT — reconstruite à partir de l'état courant, champ pour champ (fiche §8). */
export function buildMqttPayload(state: SimState, boitier: BoitierUnit): string {
  const f = state.current
  const temperatureC = 26 + 3 * Math.sin(state.uptimeMs / 900000) + gauss(0, 0.2)

  const payload = {
    boitier_id: boitier.id,
    vehicule: boitier.matricule,
    uptime_ms: state.uptimeMs,
    ultrason_cm: round(f.ultrason.distanceCm, 1),
    acceleration: {
      x: { brute: round(f.mpu.x.raw, 2), dynamique: round(f.mpu.x.dynamic, 2) },
      y: { brute: round(f.mpu.y.raw, 2), dynamique: round(f.mpu.y.dynamic, 2) },
      z: { brute: round(f.mpu.z.raw, 2), dynamique: round(f.mpu.z.dynamic, 2) },
      magnitude: round(f.mpu.magnitude, 2),
    },
    rotation_z_rad_s: round(f.mpu.zRotation, 3),
    temperature_c: round(temperatureC, 1),
    position: { lat: round(f.gps.lat, 5), lng: round(f.gps.lng, 5) },
    vitesse_gps_kmh: round(f.gps.speedKmh, 1),
    altitude_m: round(f.gps.altitudeM, 1),
    satellites: f.gps.satellites,
    hdop: round(f.gps.hdop, 2),
    vitesse_radar_kmh: round(f.radar.speedKmh, 1),
    frequence_radar_hz: round(f.radar.frequencyHz, 1),
    evenement: f.eventType,
    connectivite: f.connectivity,
  }

  return JSON.stringify(payload, null, 2)
}
