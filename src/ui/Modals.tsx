import { X, Trophy, RotateCcw, Home, Shield, Send, StickyNote, Undo2, Volume2, VolumeX } from 'lucide-react';
import { useGameStore, formatTime } from '../store/gameStore';
import type { Settings } from '../types/game';

const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');

function Modal({ title, onClose, children, wide, footer }: { title: string; onClose?: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
      <div className={`paper-card origami-border animate-pop-in flex max-h-[86vh] w-full flex-col overflow-hidden rounded-2xl shadow-pop ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="flex items-center justify-between border-b-2 border-dashed border-ink/20 px-5 py-3">
          <h2 className="font-hand text-lg font-bold text-ink">{title}</h2>
          {onClose && (
            <button onClick={onClose} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg bg-ink/10">
              <X size={16} className="text-ink" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t-2 border-dashed border-ink/20 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="btn-press flex w-full items-center justify-between gap-3 rounded-xl bg-white/50 px-3 py-2 text-left">
      <div>
        <div className="text-sm font-bold text-ink">{label}</div>
        <div className="text-[11px] text-ink/60">{desc}</div>
      </div>
      <span className={`relative h-6 w-11 shrink-0 rounded-full border-2 border-ink/40 transition-colors ${value ? 'bg-sage' : 'bg-ink/15'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

const ITEMS = [
  { icon: Shield, name: '透明胶带护盾', desc: '5 秒免疫碰撞与双面胶减速', color: '#4b8ab0' },
  { icon: Send, name: '纸飞机冲刺', desc: '2.4 秒大幅加速 + 纸屑尾迹', color: '#e05a47' },
  { icon: StickyNote, name: '双面胶陷阱', desc: '车后留下粘性纸垫，踩中者减速 2 秒', color: '#d9a520' },
  { icon: Undo2, name: '折纸回旋镖', desc: '向前发射旋转纸镖，击中对手打滑 1.5 秒', color: '#8eb87a' },
];

export default function Modals({ onRestart, onLobby }: { onRestart: () => void; onLobby: () => void }) {
  const { showHelp, showSettings, setShowHelp, setShowSettings, settings, setSettings, results, phase } = useGameStore();
  const set = (p: Partial<Settings>) => setSettings(p);

  return (
    <>
      {showHelp && (
        <Modal title="操作说明" onClose={() => setShowHelp(false)} wide>
          <div className="space-y-4 text-sm text-ink/80">
            <section>
              <h3 className="mb-1 font-bold text-ink">键盘</h3>
              <ul className="space-y-1 text-[13px]">
                <li><b>W / ↑</b> 油门 · <b>S / ↓</b> 刹车/倒车</li>
                <li><b>A / ←</b> 左转 · <b>D / →</b> 右转</li>
                <li><b>Shift / 空格</b> 漂移（按住并转向蓄力）</li>
                <li><b>E / F / Enter</b> 使用道具</li>
              </ul>
            </section>
            <section>
              <h3 className="mb-1 font-bold text-ink">二段蓄力漂移</h3>
              <p className="text-[13px]">高速按住漂移键转向：0.8s 蓝色火花、1.6s 金色火花；松开立即获得小涡轮加速。火花等级越高，加速越久。</p>
            </section>
            <section>
              <h3 className="mb-1 font-bold text-ink">纸艺道具</h3>
              <div className="space-y-2">
                {ITEMS.map((it) => (
                  <div key={it.name} className="flex items-center gap-2 rounded-lg bg-white/50 px-2 py-1.5">
                    <it.icon size={20} style={{ color: it.color }} />
                    <div>
                      <div className="text-[13px] font-bold text-ink">{it.name}</div>
                      <div className="text-[11px] text-ink/60">{it.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-1 font-bold text-ink">触屏</h3>
              <p className="text-[13px]">在设置中开启虚拟按键：左侧转向，右侧油门/刹车/漂移/道具。</p>
            </section>
          </div>
        </Modal>
      )}

      {showSettings && (
        <Modal title="设置" onClose={() => setShowSettings(false)}>
          <div className="space-y-2">
            <Toggle label="软阴影" desc="2048 PCF 软阴影，纸艺接触感" value={settings.shadows} onChange={(b) => set({ shadows: b })} />
            <Toggle label="高画质后处理" desc="N8AO 环境光遮蔽（低配设备可关闭）" value={settings.highQuality} onChange={(b) => set({ highQuality: b })} />
            <Toggle label="触屏虚拟按键" desc="显示移动端方向与油门/漂移/道具按钮" value={settings.touch} onChange={(b) => set({ touch: b })} />
            <Toggle label="相机抖动" desc="碰撞与加速时的镜头反馈" value={settings.cameraShake} onChange={(b) => set({ cameraShake: b })} />
            <Toggle label="幽灵车" desc="计时挑战中回放最佳纪录" value={settings.showGhost} onChange={(b) => set({ showGhost: b })} />
            <div className="rounded-xl bg-white/50 px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-sm font-bold text-ink">
                <span className="flex items-center gap-1">{settings.muted ? <VolumeX size={15} /> : <Volume2 size={15} />} 音量</span>
                <button onClick={() => set({ muted: !settings.muted })} className="btn-press rounded bg-ink/10 px-2 py-0.5 text-[11px]">
                  {settings.muted ? '已静音' : '开启'}
                </button>
              </div>
              <input
                type="range" min={0} max={1} step={0.05} value={settings.volume}
                onChange={(e) => set({ volume: parseFloat(e.target.value) })}
                className="w-full accent-[#e05a47]"
              />
            </div>
          </div>
        </Modal>
      )}

      {phase === 'finished' && results.length > 0 && !showHelp && !showSettings && (
        <Modal title="完赛结算" wide footer={
          <div className="flex gap-2">
            <button onClick={onRestart} className="btn-press origami-border flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-coral text-sm font-bold text-white">
              <RotateCcw size={16} /> 再来一局
            </button>
            <button onClick={onLobby} className="btn-press origami-border flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-paper">
              <Home size={16} /> 返回大厅
            </button>
          </div>
        }>
          <div className="space-y-1.5">
            {results.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.isPlayer ? 'bg-coral/20 ring-2 ring-coral' : 'bg-white/50'}`}
              >
                <span className={`tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold ${r.place === 1 ? 'bg-[#f4d35e] text-ink' : 'bg-ink/10 text-ink/70'}`}>
                  {r.place}
                </span>
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-ink/40" style={{ background: hx(r.color) }} />
                <span className="flex-1 truncate text-sm font-bold text-ink">{r.name}{r.isPlayer && '（你）'}</span>
                <span className="tabular text-[12px] text-ink/70">{r.finished ? formatTime(r.totalTime) : '未完赛'}</span>
                <span className="tabular hidden text-[11px] text-ink/50 sm:block">最佳 {formatTime(r.bestLap)}</span>
                {r.place === 1 && <Trophy size={16} className="text-[#d9a520]" />}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}