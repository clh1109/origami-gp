import { create } from 'zustand';
import type {
  GamePhase, LobbyStep, Settings, HudSnapshot, RacerResult,
} from '../types/game';
import type { RaceConfig } from '../engine/GameEngine';

const SETTINGS_KEY = 'origami-gp-settings';

function loadSettings(): Settings {
  const def: Settings = {
    shadows: true, highQuality: true, touch: false, volume: 0.7, muted: false,
    cameraShake: true, showGhost: true,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  // 触屏设备默认开启虚拟按键
  if (typeof window !== 'undefined' && 'ontouchstart' in window) def.touch = true;
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
  phase: GamePhase;
  settings: Settings;
  hud: HudSnapshot;
  results: RacerResult[];
  showHelp: boolean;
  showSettings: boolean;
  setConfig: (p: Partial<RaceConfig>) => void;
  setLobbyStep: (s: LobbyStep) => void;
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
  phase: 'lobby',
  settings: loadSettings(),
  hud: DEFAULT_HUD,
  results: [],
  showHelp: false,
  showSettings: false,
  setConfig: (p) => set({ config: { ...get().config, ...p } }),
  setLobbyStep: (s) => set({ lobbyStep: s }),
  setPhase: (p) => set({ phase: p }),
  setSettings: (p) => {
    const next = { ...get().settings, ...p };
    set({ settings: next });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
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