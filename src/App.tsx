import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import { useGameStore } from './store/gameStore';
import LobbyOverlay from './ui/LobbyOverlay';
import { TitleOverlay } from './ui/TitleOverlay';
import RaceHUD from './ui/RaceHUD';
import TouchControls from './ui/TouchControls';
import Modals from './ui/Modals';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const builtTrackRef = useRef<string>('');
  const [initError, setInitError] = useState<string | null>(null);

  const phase = useGameStore((s) => s.phase);
  const config = useGameStore((s) => s.config);
  const lobbyStep = useGameStore((s) => s.lobbyStep);
  const bookCover = useGameStore((s) => s.bookCover);
  const setBookCover = useGameStore((s) => s.setBookCover);
  const settings = useGameStore((s) => s.settings);

  // 初始化引擎
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: GameEngine;
    try {
      engine = new GameEngine(canvas);
      engineRef.current = engine;
      (window as unknown as { __engine: GameEngine }).__engine = engine;
      (window as unknown as { __store: typeof useGameStore }).__store = useGameStore;
      const st = useGameStore.getState();
      engine.events = {
        onHud: (h) => useGameStore.getState().setHud(h),
        onPhase: (p) => useGameStore.getState().setPhase(p),
        onResults: (r) => useGameStore.getState().setResults(r),
        onBookIntroDone: () => useGameStore.getState().setBookCover(false),
      };
      engine.applySettings(st.settings);
      engine.enterLobby(st.config, st.lobbyStep);
      builtTrackRef.current = st.config.trackId;
      engine.start();
    } catch (e) {
      setInitError(e instanceof Error ? e.message : String(e));
      return;
    }
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // 大厅切换赛道 → 重建世界
  useEffect(() => {
    const e = engineRef.current;
    if (!e || phase !== 'lobby') return;
    if (config.trackId !== builtTrackRef.current) {
      e.enterLobby(config, lobbyStep);
      builtTrackRef.current = config.trackId;
    }
  }, [config.trackId, phase, config, lobbyStep]);

  // 大厅切换车手 / 纸张 → 更新展示车
  useEffect(() => {
    const e = engineRef.current;
    if (!e || phase !== 'lobby') return;
    e.setLobbyCar(config.racerId, config.paperId);
  }, [config.racerId, config.paperId, phase]);

  // 大厅步骤 → 相机
  useEffect(() => {
    const e = engineRef.current;
    if (!e || phase !== 'lobby') return;
    e.setLobbyStep(lobbyStep);
  }, [lobbyStep, phase]);

  // 重温 3D 绘本开场
  useEffect(() => {
    const e = engineRef.current;
    if (!e || phase !== 'lobby') return;
    if (bookCover) {
      e.startBookIntro();
    }
  }, [bookCover, phase]);

  // 设置 → 引擎
  useEffect(() => {
    engineRef.current?.applySettings(settings);
  }, [settings]);

  const getMinimap = useCallback(() => engineRef.current?.getMinimapData() ?? null, []);
  const setTouch = useCallback((t: { throttle?: number; steer?: number; drift?: boolean }) => {
    engineRef.current?.setTouch(t);
  }, []);
  const requestItem = useCallback(() => engineRef.current?.requestItem(), []);

  const onStart = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.audio.ensure();
    e.audio.playUIClick();
    useGameStore.getState().setResults([]);
    e.startRace(useGameStore.getState().config);
  }, []);
  const onRestart = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.audio.ensure();
    useGameStore.getState().setResults([]);
    e.restart();
  }, []);
  const onLobby = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    useGameStore.getState().setResults([]);
    useGameStore.getState().setLobbyStep(1);
    useGameStore.getState().setBookCover(false);
    e.enterLobby(useGameStore.getState().config, 1);
    builtTrackRef.current = useGameStore.getState().config.trackId;
  }, []);

  const inRace = phase === 'countdown' || phase === 'racing' || phase === 'finished';

  return (
    <div className="fixed inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="fixed inset-0 h-full w-full" />
      {/* 全屏水彩纸纹细微噪点叠加层（微缩绘本纸质触感） */}
      <div
        className="pointer-events-none fixed inset-0 z-10 opacity-30 mix-blend-multiply"
        style={{
          backgroundImage: `radial-gradient(rgba(59, 47, 39, 0.08) 1px, transparent 0), radial-gradient(rgba(217, 180, 130, 0.08) 1px, transparent 0)`,
          backgroundSize: '12px 12px, 20px 20px',
          backgroundPosition: '0 0, 6px 6px',
        }}
      />
      {initError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-paper p-6">
          <div className="paper-card origami-border max-w-md rounded-2xl p-6 shadow-pop">
            <h2 className="font-hand mb-2 text-lg font-bold text-ink">初始化失败</h2>
            <p className="mb-2 text-sm text-ink/70">
              3D 引擎未能启动（通常是浏览器不支持 WebGL2 或显卡驱动被禁用）。请改用最新版 Chrome / Edge 并确认硬件加速已开启。
            </p>
            <p className="break-all rounded-lg bg-ink/10 px-3 py-2 text-[11px] text-ink/60">{initError}</p>
          </div>
        </div>
      )}
      {phase === 'lobby' && !initError && bookCover && (
        <TitleOverlay
          onWakeCrane={() => {
            engineRef.current?.openBookIntro();
            window.setTimeout(() => setBookCover(false), 5400);
          }}
          onSkip={() => {
            engineRef.current?.skipBookIntro();
            setBookCover(false);
          }}
        />
      )}
      {phase === 'lobby' && !initError && !bookCover && (
        <LobbyOverlay onStart={onStart} />
      )}
      {inRace && <RaceHUD getMinimap={getMinimap} />}
      {settings.touch && (phase === 'countdown' || phase === 'racing') && (
        <TouchControls setTouch={setTouch} requestItem={requestItem} />
      )}
      <Modals onRestart={onRestart} onLobby={onLobby} />
    </div>
  );
}