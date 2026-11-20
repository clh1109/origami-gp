import { ChevronLeft, ChevronRight, HelpCircle, Play, Settings as SettingsIcon, Timer, Trophy, Sparkles } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { PAPERS } from '../data/papers';
import { RACERS, STAT_LABELS } from '../data/racers';
import { TRACKS } from '../data/tracks';
import type { LobbyStep } from '../types/game';

const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');

const STEPS: { n: LobbyStep; label: string }[] = [
  { n: 1, label: '模式' },
  { n: 2, label: '纸张' },
  { n: 3, label: '车手' },
  { n: 4, label: '赛道' },
];

function StatBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-8 shrink-0 text-ink/70">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="tabular w-7 text-right text-ink/60">{Math.round(value)}</span>
    </div>
  );
}

export default function LobbyOverlay({ onStart }: { onStart: () => void }) {
  const { config, lobbyStep, setConfig, setLobbyStep, setShowHelp, setShowSettings } = useGameStore();
  const racer = RACERS.find((r) => r.id === config.racerId)!;
  const paper = PAPERS.find((p) => p.id === config.paperId)!;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* 顶栏 */}
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between p-4">
        <div className="paper-card origami-border pointer-events-auto rounded-xl px-4 py-2 shadow-card">
          <div className="font-hand text-lg font-bold leading-tight text-ink">折纸奇旅</div>
          <div className="text-[10px] tracking-[0.25em] text-ink/60">ORIGAMI GP</div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="btn-press paper-card origami-border flex h-11 w-11 items-center justify-center rounded-xl shadow-card"
            title="操作说明"
          >
            <HelpCircle size={20} className="text-ink" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-press paper-card origami-border flex h-11 w-11 items-center justify-center rounded-xl shadow-card"
            title="设置"
          >
            <SettingsIcon size={20} className="text-ink" />
          </button>
        </div>
      </div>

      {/* 左侧配置卡片 */}
      <div data-testid="lobby-panel" className="paper-card origami-border pointer-events-auto absolute bottom-4 left-4 top-20 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl shadow-pop">
        {/* 步骤指示 */}
        <div className="flex items-center gap-1 border-b-2 border-dashed border-ink/20 px-4 py-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => setLobbyStep(s.n)}
                className={`btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                  lobbyStep === s.n
                    ? 'border-ink bg-coral text-white'
                    : lobbyStep > s.n
                      ? 'border-ink/40 bg-sage/60 text-ink'
                      : 'border-ink/25 bg-white/50 text-ink/50'
                }`}
              >
                {s.n}
              </button>
              <span className={`text-[11px] ${lobbyStep === s.n ? 'font-bold text-ink' : 'text-ink/50'}`}>{s.label}</span>
              {i < 3 && <div className="mx-1 h-0.5 flex-1 bg-ink/15" />}
            </div>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {lobbyStep === 1 && (
            <div className="space-y-3 animate-fade-up">
              <p className="text-xs text-ink/60">选择你的比赛方式。</p>
              {([
                { id: 'grandprix', icon: Trophy, name: '大奖赛', desc: '8 名折纸车手 · 3 圈竞速 · 道具混战' },
                { id: 'timetrial', icon: Timer, name: '计时挑战', desc: '单人刷圈 · 与自己的幽灵车同场竞速' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setConfig({ mode: m.id })}
                  className={`btn-press origami-border flex w-full items-center gap-3 rounded-xl p-3 text-left ${
                    config.mode === m.id ? 'bg-coral/15 ring-2 ring-coral' : 'bg-white/50'
                  }`}
                >
                  <m.icon size={26} className={config.mode === m.id ? 'text-coral' : 'text-ink/60'} />
                  <div>
                    <div className="font-bold text-ink">{m.name}</div>
                    <div className="text-[11px] text-ink/60">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {lobbyStep === 2 && (
            <div className="space-y-3 animate-fade-up">
              <p className="text-xs text-ink/60">纸张克重直接改变物理手感。</p>
              {PAPERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setConfig({ paperId: p.id })}
                  className={`btn-press origami-border w-full rounded-xl p-3 text-left ${
                    config.paperId === p.id ? 'bg-coral/15 ring-2 ring-coral' : 'bg-white/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded border-2 border-ink/40" style={{ background: hx(p.swatch) }} />
                    <span className="font-bold text-ink">{p.name}</span>
                    <span className="tabular ml-auto rounded bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-ink/70">{p.weightGrams}g</span>
                  </div>
                  <div className="mt-1 text-[11px] text-ink/60">{p.desc}</div>
                  <div className="mt-2 space-y-1">
                    <StatBar label="加速" value={p.accelMul * 60} color="#e05a47" />
                    <StatBar label="极速" value={p.speedMul * 60} color="#4b8ab0" />
                    <StatBar label="转向" value={p.steerMul * 60} color="#8eb87a" />
                    <StatBar label="重量" value={p.weightMul * 60} color="#b08154" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {lobbyStep === 3 && (
            <div className="space-y-3 animate-fade-up">
              <p className="flex items-center gap-1 text-xs text-ink/60">
                <Sparkles size={13} /> 中央展示台正在旋转预览你的折纸赛车。
              </p>
              <div className="grid grid-cols-2 gap-2">
                {RACERS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setConfig({ racerId: r.id })}
                    className={`btn-press origami-border flex items-center gap-2 rounded-lg px-2 py-2 text-left ${
                      config.racerId === r.id ? 'bg-coral/15 ring-2 ring-coral' : 'bg-white/50'
                    }`}
                  >
                    <span className="h-4 w-4 shrink-0 rounded-full border-2 border-ink/40" style={{ background: hx(r.primaryColor) }} />
                    <span className="truncate text-[12px] font-bold text-ink">{r.name}</span>
                  </button>
                ))}
              </div>
              <div className="origami-border rounded-xl bg-white/60 p-3">
                <div className="font-bold text-ink">{racer.name}</div>
                <div className="mb-2 text-[11px] text-ink/60">{racer.title}</div>
                <div className="space-y-1">
                  {STAT_LABELS.map((s) => (
                    <StatBar key={s.key} label={s.label} value={racer.stats[s.key]} color={hx(racer.primaryColor)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {lobbyStep === 4 && (
            <div className="space-y-3 animate-fade-up">
              <p className="text-xs text-ink/60">选择一章纸艺赛道。</p>
              {TRACKS.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setConfig({ trackId: t.id })}
                  className={`btn-press origami-border w-full rounded-xl p-3 text-left ${
                    config.trackId === t.id ? 'bg-coral/15 ring-2 ring-coral' : 'bg-white/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{i + 1}. {t.name}</span>
                  </div>
                  <div className="text-[11px] text-ink/60">{t.subtitle}</div>
                  <div className="mt-2 flex gap-1">
                    {[t.colors.sky, t.colors.ground, t.colors.road, t.colors.curbA, t.colors.mountain].map((c, k) => (
                      <span key={k} className="h-4 flex-1 rounded border border-ink/30" style={{ background: hx(c) }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 底部导航 */}
        <div className="flex items-center gap-2 border-t-2 border-dashed border-ink/20 px-4 py-3">
          <button
            onClick={() => setLobbyStep(Math.max(1, lobbyStep - 1) as LobbyStep)}
            disabled={lobbyStep === 1}
            className="btn-press origami-border flex h-11 items-center gap-1 rounded-xl bg-white/60 px-3 text-sm font-bold text-ink disabled:opacity-40"
          >
            <ChevronLeft size={16} /> 上一步
          </button>
          {lobbyStep < 4 ? (
            <button
              onClick={() => setLobbyStep((lobbyStep + 1) as LobbyStep)}
              className="btn-press origami-border ml-auto flex h-11 items-center gap-1 rounded-xl bg-ink px-4 text-sm font-bold text-paper"
            >
              下一步 <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={onStart}
              data-testid="start-race"
              className="btn-press origami-border ml-auto flex h-11 items-center gap-2 rounded-xl bg-coral px-5 text-sm font-bold text-white shadow-card"
            >
              <Play size={16} /> 开始比赛
            </button>
          )}
        </div>
      </div>

      {/* 当前选择摘要（右下） */}
      <div data-testid="lobby-summary" className="paper-card origami-border pointer-events-auto absolute bottom-4 right-4 hidden rounded-xl px-3 py-2 text-[11px] text-ink/70 shadow-card md:block">
        <span className="font-bold text-ink">{config.mode === 'grandprix' ? '大奖赛' : '计时挑战'}</span>
        {' · '}{paper.name} {paper.weightGrams}g{' · '}{racer.name}
      </div>
    </div>
  );
}