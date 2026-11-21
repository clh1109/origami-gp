import { create } from 'zustand';
import type {
  GamePhase, LobbyStep, Settings, HudSnapshot, RacerResult,
} from '../types/game';
import type { RaceConfig } from '../engine/GameEngine';

const SETTINGS_KEY = 'origami-gp-settings';
// v2：触屏虚拟按键改为全平台默认开启
const SETTINGS_VERSION = 2;

function loadSettings(): Settings {
  const def: Settings = {
    shadows: true, highQuality: true, touch: true, volume: 0.7, muted: false,
    cameraShake: true, showGhost: true,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const { v, ...rest } = JSON.parse(raw) as Partial<Settings> & { v?: number };
      const next: Settings = { ...def, ...rest };
      // 旧版存档没有"虚拟按键默认开"约定，升级时回到新默认；其余偏好保留
      if (v !== SETTINGS_VERSION) next.touch = def.touch;
      return next;
    }
  } catch {
    /* noop */
  }
  return def;
}

export const DEFAULT_HUD: HudSnapshot = {
  phase: 'lobby', countdown: 3, speed: 0, lap: 1, totalLaps: 3, place: 1, totalRacers: 8,
  heldItem: null, roulette: false, driftCharge: 0, driftTier: 0, boost: false, shield: false,
  slow: false, raceTime: 0, currentLapTime: 0, bestLap: 0, lastLap: 0, offroad: false, wrongWay: false,
};

interface GameStore {
  config: RaceConfig;
  lobbyStep: LobbyStep;
  bookCover: boolean;
  phase: GamePhase;
  settings: Settings;
  hud: HudSnapshot;
  results: RacerResult[];
  showHelp: boolean;
  showSettings: boolean;
  setConfig: (p: Partial<RaceConfig>) => void;
  setLobbyStep: (s: LobbyStep) => void;
  setBookCover: (b: boolean) => void;
  setPhase: (p: GamePhase) => void;
  setSettings: (p: Partial<Settings>) => void;
  setHud: (h: HudSnapshot) => void;
  setResults: (r: RacerResult[]) => void;
  setShowHelp: (b: boolean) => void;
  setShowSettings: (b: boolean) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  config: { mode: 'grandprix', paperId: 'medium', racerId: 'fox', trackId: 'meadow' },
  lobbyStep: 1,
  bookCover: false,
  phase: 'lobby',
  settings: loadSettings(),
  hud: DEFAULT_HUD,
  results: [],
  showHelp: false,
  showSettings: false,
  setConfig: (p) => set({ config: { ...get().config, ...p } }),
  setLobbyStep: (s) => set({ lobbyStep: s }),
  setBookCover: (b) => set({ bookCover: b }),
  setPhase: (p) => set({ phase: p }),
  setSettings: (p) => {
    const next = { ...get().settings, ...p };
    set({ settings: next });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...next, v: SETTINGS_VERSION }));
    } catch {
      /* noop */
    }
  },
  setHud: (h) => set({ hud: h }),
  setResults: (r) => set({ results: r }),
  setShowHelp: (b) => set({ showHelp: b }),
  setShowSettings: (b) => set({ showSettings: b }),
}));

export function formatTime(t: number): string {
  if (!t || t <= 0) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}