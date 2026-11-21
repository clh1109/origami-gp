import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import { useGameStore } from './store/gameStore';
import LobbyOverlay from './ui/LobbyOverlay';
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
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-6 sm:p-8 select-none">
          <div className="flex justify-between items-start pointer-events-auto">
            <div className="paper-card origami-border rounded-full px-4 py-1.5 text-xs font-bold text-ink/80 bg-white/85 shadow-sm">
              📖 3D 奇幻立体绘本
            </div>
            <button
              onClick={() => {
                engineRef.current?.skipBookIntro();
                setBookCover(false);
              }}
              className="btn-press paper-card origami-border rounded-full px-4 py-1.5 text-xs font-bold text-ink/80 bg-white/85 shadow-sm hover:bg-white"
            >
              跳过开场 ⏩
            </button>
          </div>
          <div className="flex flex-col items-center text-center animate-fade-up pb-3">
            <div className="font-hand text-base sm:text-lg font-bold text-[#fffdf6] drop-shadow-[0_2px_10px_rgba(35,24,14,0.85)] tracking-widest">
              午后三点，书页悄悄打开，奇幻折纸世界正在苏醒……
            </div>
            <div className="mt-1 text-xs text-[#fffdf6]/80 drop-shadow-[0_1px_4px_rgba(35,24,14,0.8)] tracking-wider">
              ✦ 纯 3D 实时折纸演算 · 涟漪依次弹起 ✦
            </div>
          </div>
        </div>
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