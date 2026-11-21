import { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  HelpCircle,
  MessageCircle,
  Play,
  Settings as SettingsIcon,
  Timer,
  Trophy,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { PAPERS } from '../data/papers';
import { RACERS, STAT_LABELS } from '../data/racers';
import { TRACKS } from '../data/tracks';
import { CHAPTER_STORIES, RACER_QUOTES } from '../data/story';
import type { LobbyStep } from '../types/game';

const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');

const STEPS: { n: LobbyStep; label: string; full: string }[] = [
  { n: 1, label: '1 模式', full: '选择比赛方式' },
  { n: 2, label: '2 纸张克重', full: '选择纸张克重' },
  { n: 3, label: '3 车手', full: '选择出战车手' },
  { n: 4, label: '4 章节', full: '选择赛道关卡' },
];

export default function LobbyOverlay({ onStart }: { onStart: () => void }) {
  const { config, lobbyStep, setConfig, setLobbyStep, setShowHelp, setShowSettings, setBookCover } =
    useGameStore();
  const [quoteIdx, setQuoteIdx] = useState(0);

  const racer = RACERS.find((r) => r.id === config.racerId) ?? RACERS[0];
  const racerQuotes = RACER_QUOTES[racer.id] ?? ['准备出发，冲向折痕终点！'];
  const currentQuote = racerQuotes[quoteIdx % racerQuotes.length];
  const chapterStory = CHAPTER_STORIES[config.trackId] ?? CHAPTER_STORIES.meadow;

  // 切换车手时重置到第一句台词
  useEffect(() => {
    setQuoteIdx(0);
  }, [config.racerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (lobbyStep < 4) {
          e.preventDefault();
          setLobbyStep((lobbyStep + 1) as LobbyStep);
        } else {
          e.preventDefault();
          onStart();
        }
      } else if (e.key === 'Escape') {
        if (lobbyStep > 1) {
          e.preventDefault();
          setLobbyStep((lobbyStep - 1) as LobbyStep);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lobbyStep, onStart, setLobbyStep]);

  const currentStepInfo = STEPS.find((s) => s.n === lobbyStep)!;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* 顶栏左侧：导航 + 章节故事页码 */}
      <div className="absolute left-4 top-4 flex items-center gap-2 pointer-events-auto">
        {lobbyStep > 1 && (
          <button
            onClick={() => setLobbyStep((lobbyStep - 1) as LobbyStep)}
            className="btn-press paper-card origami-border flex h-10 w-10 items-center justify-center rounded-xl shadow-card"
            title="上一步 (Esc)"
          >
            <ChevronLeft size={20} className="text-ink" />
          </button>
        )}
        <div className="paper-card origami-border flex items-center gap-2.5 rounded-xl px-4 py-2 shadow-card">
          <span className="text-[10px] font-bold tracking-widest text-coral uppercase">
            {chapterStory.pageLabel}
          </span>
          <span className="text-ink/30">·</span>
          <span className="font-hand text-base font-bold text-ink">{currentStepInfo.full}</span>
        </div>
      </div>

      {/* 顶栏右侧：重温绘本封面 + 说明 + 设置 */}
      <div className="absolute right-4 top-4 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => setBookCover(true)}
          className="btn-press paper-card origami-border flex h-10 items-center gap-1.5 rounded-xl px-3 shadow-card text-xs font-bold text-ink"
          title="合上绘本重温封面"
        >
          <BookOpen size={16} className="text-coral" />
          <span className="hidden sm:inline font-hand">绘本封面</span>
        </button>
        <button
          onClick={() => setShowHelp(true)}
          className="btn-press paper-card origami-border flex h-10 w-10 items-center justify-center rounded-xl shadow-card"
          title="操作说明"
        >
          <HelpCircle size={18} className="text-ink" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="btn-press paper-card origami-border flex h-10 w-10 items-center justify-center rounded-xl shadow-card"
          title="设置"
        >
          <SettingsIcon size={18} className="text-ink" />
        </button>
      </div>

      {/* 右侧书脊书签栏 */}
      <div className="pointer-events-auto fixed right-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30">
        {STEPS.map((s) => {
          const active = lobbyStep === s.n;
          return (
            <button
              key={s.n}
              onClick={() => setLobbyStep(s.n)}
              className={`btn-press flex items-center justify-center rounded-l-xl border-2 border-r-0 border-ink/40 px-3.5 py-2.5 shadow-card transition-all ${
                active
                  ? 'bg-coral text-white font-bold -translate-x-1 shadow-pop'
                  : 'bg-paper/90 text-ink/70 hover:-translate-x-0.5 hover:bg-paper'
              }`}
            >
              <span className="font-hand text-xs tracking-wider">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* 底部平铺选择区 */}
      <div
        data-testid="lobby-panel"
        className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 flex flex-col items-center gap-3 z-30"
      >
        {/* Step 1: 模式 */}
        {lobbyStep === 1 && (
          <div className="flex w-full max-w-xl gap-3 animate-fade-up">
            {(
              [
                { id: 'grandprix', icon: Trophy, name: '大奖赛', desc: '8 名折纸车手 · 3 圈竞速 · 宿敌对决' },
                { id: 'timetrial', icon: Timer, name: '计时挑战', desc: '单人刷圈 · 与自己的幽灵车同场竞速' },
              ] as const
            ).map((m) => {
              const sel = config.mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setConfig({ mode: m.id });
                    setLobbyStep(2);
                  }}
                  className={`btn-press paper-card origami-border flex flex-1 flex-col items-center justify-center rounded-2xl p-4 text-center shadow-card transition-all ${
                    sel ? 'ring-2 ring-coral bg-white/95 scale-[1.02]' : 'hover:bg-white/80'
                  }`}
                >
                  <m.icon size={32} className={sel ? 'text-coral' : 'text-ink/60'} />
                  <div className="font-hand mt-2 text-lg font-bold text-ink">{m.name}</div>
                  <div className="mt-1 text-[11px] text-ink/60">{m.desc}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: 纸张克重 */}
        {lobbyStep === 2 && (
          <div className="flex w-full max-w-3xl gap-3 animate-fade-up">
            {PAPERS.map((p, idx) => {
              const sel = config.paperId === p.id;
              const stars = idx === 0 ? '■ □ □' : idx === 1 ? '■ ■ □' : '■ ■ ■';
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setConfig({ paperId: p.id });
                    setLobbyStep(3);
                  }}
                  className={`btn-press paper-card origami-border relative flex flex-1 flex-col justify-between rounded-2xl p-4 text-left shadow-card transition-all ${
                    sel ? 'ring-2 ring-coral bg-white/95 scale-[1.03] shadow-pop' : 'hover:bg-white/80'
                  }`}
                >
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="tabular font-hand text-4xl font-extrabold text-ink">{p.weightGrams}</span>
                      <span className="font-hand text-sm font-bold text-ink/60">g</span>
                    </div>
                    <div className="font-hand text-base font-bold text-ink mt-0.5">{p.name}</div>
                    <div className="mt-1 text-[11px] text-ink/60 line-clamp-2 leading-tight">{p.desc}</div>
                  </div>
                  <div className="mt-4 pt-2 border-t border-dashed border-ink/20 flex items-center justify-between text-[11px] font-mono text-ink/70">
                    <span>速度</span>
                    <span className="tracking-widest text-coral">{stars}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 3: 选车手 + 车手性格手账气泡 */}
        {lobbyStep === 3 && (
          <div className="flex w-full max-w-4xl flex-col items-center gap-2.5 animate-fade-up">
            {/* 车手性格对话气泡（点击可换一句台词） */}
            <button
              type="button"
              onClick={() => setQuoteIdx((n) => n + 1)}
              className="btn-press paper-card origami-border flex items-center gap-2.5 rounded-2xl bg-white/95 px-4 py-2 shadow-pop max-w-xl text-left"
              title="点击听车手说下一句"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ background: hx(racer.primaryColor) }}
              >
                <MessageCircle size={14} />
              </span>
              <div className="text-xs leading-snug text-ink">
                <span className="font-hand font-bold mr-1.5">{racer.name}：</span>
                <span className="text-ink/85">“{currentQuote}”</span>
              </div>
            </button>

            <div className="flex w-full gap-2 overflow-x-auto pb-1 justify-center">
              {RACERS.map((r) => {
                const sel = config.racerId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setConfig({ racerId: r.id })}
                    className={`btn-press paper-card origami-border flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 shadow-card ${
                      sel ? 'ring-2 ring-coral bg-white/95' : 'hover:bg-white/70'
                    }`}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border border-ink/40" style={{ background: hx(r.primaryColor) }} />
                    <span className="font-hand text-xs font-bold text-ink">{r.name}</span>
                  </button>
                );
              })}
            </div>

            {/* 当前选中车手五维纸签 */}
            <div className="paper-card origami-border flex items-center gap-4 rounded-xl px-4 py-2 shadow-sm text-xs">
              <span className="font-hand font-bold text-ink">{racer.name} · {racer.title}</span>
              <div className="h-4 w-px bg-ink/20" />
              <div className="flex gap-3">
                {STAT_LABELS.slice(0, 3).map((s) => (
                  <div key={s.key} className="flex items-center gap-1 text-[11px]">
                    <span className="text-ink/60">{s.label}</span>
                    <span className="tabular font-bold text-ink">{racer.stats[s.key]}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setLobbyStep(4)}
                className="btn-press ml-2 rounded-lg bg-coral px-3 py-1 font-hand text-xs font-bold text-white shadow-sm"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step 4: 选章节 + 绘本扉页引语与守关宿敌预告 */}
        {lobbyStep === 4 && (
          <div className="flex w-full max-w-3xl flex-col items-center gap-2.5 animate-fade-up">
            {/* 章节故事扉页与宿敌预告条 */}
            <div className="paper-card origami-border w-full rounded-2xl bg-white/95 px-4 py-2.5 shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-left">
                <div className="text-[10px] font-bold tracking-widest text-coral uppercase">
                  {chapterStory.pageLabel}
                </div>
                <div className="text-xs text-ink/80 mt-0.5">{chapterStory.epigraph}</div>
              </div>
              <div className="shrink-0 flex items-center gap-2 rounded-xl bg-paper/90 border border-dashed border-ink/20 px-3 py-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: chapterStory.rivalColor }}
                />
                <span className="text-[11px] text-ink/85">
                  <strong className="font-hand text-ink">守关 · {chapterStory.rivalName}</strong>
                </span>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 md:grid-cols-4 gap-2.5">
              {TRACKS.map((t, idx) => {
                const sel = config.trackId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setConfig({ trackId: t.id })}
                    className={`btn-press paper-card origami-border flex flex-col justify-between rounded-xl p-3 text-left shadow-card ${
                      sel ? 'ring-2 ring-coral bg-white/95 scale-[1.02]' : 'hover:bg-white/70'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-bold text-ink/50">章节 {idx + 1}</div>
                      <div className="font-hand text-sm font-bold text-ink">{t.name}</div>
                      <div className="text-[10px] text-ink/60 line-clamp-1 mt-0.5">{t.subtitle}</div>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {[t.colors.sky, t.colors.ground, t.colors.road, t.colors.curbA].map((c, k) => (
                        <span key={k} className="h-2 flex-1 rounded-sm" style={{ background: hx(c) }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={onStart}
              data-testid="start-race"
              className="btn-press origami-border flex items-center gap-2 rounded-2xl bg-coral px-8 py-3 text-base font-bold text-white shadow-pop hover:scale-105 active:scale-95"
            >
              <Play size={18} />
              <span className="font-hand text-lg">翻开这一页 · 开始比赛</span>
            </button>
          </div>
        )}
      </div>

      {/* 屏幕右下角快捷键标签 */}
      <div className="pointer-events-none absolute bottom-4 right-4 hidden md:flex items-center gap-2 z-30">
        <div className="paper-card origami-border rounded-lg px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm">
          Enter {lobbyStep === 4 ? '开始' : '下一步'}
        </div>
        <div className="paper-card origami-border rounded-lg px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm">
          Esc {lobbyStep === 1 ? '模式' : '返回'}
        </div>
      </div>
    </div>
  );
}
