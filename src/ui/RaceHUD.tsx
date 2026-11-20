import { useEffect, useRef } from 'react';
import { Shield, Send, StickyNote, Undo2, Flag, Timer, AlertTriangle, Gauge } from 'lucide-react';
import { useGameStore, formatTime } from '../store/gameStore';
import type { ItemType, MinimapData } from '../types/game';

const ITEM_ICON: Record<ItemType, typeof Shield> = {
  shield: Shield,
  boost: Send,
  trap: StickyNote,
  boomerang: Undo2,
};
const ITEM_NAME: Record<ItemType, string> = {
  shield: '胶带护盾',
  boost: '纸飞机冲刺',
  trap: '双面胶陷阱',
  boomerang: '折纸回旋镖',
};
const ITEM_COLOR: Record<ItemType, string> = {
  shield: '#4b8ab0',
  boost: '#e05a47',
  trap: '#f4d35e',
  boomerang: '#8eb87a',
};
const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');

function Minimap({ getMinimap }: { getMinimap: () => MinimapData | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = ref.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const data = getMinimap();
        if (ctx && data) {
          const S = canvas.width;
          ctx.clearRect(0, 0, S, S);
          const { minX, maxX, minZ, maxZ } = data.bounds;
          const pad = 14;
          const spanX = maxX - minX || 1;
          const spanZ = maxZ - minZ || 1;
          const scale = (S - pad * 2) / Math.max(spanX, spanZ);
          const ox = (S - spanX * scale) / 2;
          const oz = (S - spanZ * scale) / 2;
          const px = (x: number) => ox + (x - minX) * scale;
          const pz = (z: number) => oz + (z - minZ) * scale;
          // 赛道轮廓
          ctx.beginPath();
          data.outline.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))));
          ctx.closePath();
          ctx.strokeStyle = 'rgba(59,47,39,0.55)';
          ctx.lineWidth = 5;
          ctx.lineJoin = 'round';
          ctx.stroke();
          ctx.strokeStyle = 'rgba(250,243,227,0.9)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          // 车辆
          for (const c of data.cars) {
            const x = px(c.x);
            const y = pz(c.z);
            if (c.isPlayer) {
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(Math.PI - c.heading);
              ctx.beginPath();
              ctx.moveTo(0, -6);
              ctx.lineTo(4.5, 5);
              ctx.lineTo(-4.5, 5);
              ctx.closePath();
              ctx.fillStyle = '#e05a47';
              ctx.fill();
              ctx.strokeStyle = '#fffdf8';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.restore();
            } else {
              ctx.beginPath();
              ctx.arc(x, y, c.isGhost ? 3 : 3.4, 0, Math.PI * 2);
              ctx.fillStyle = c.isGhost ? 'rgba(159,212,234,0.6)' : hx(c.color);
              ctx.fill();
              ctx.strokeStyle = 'rgba(59,47,39,0.5)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getMinimap]);
  return <canvas ref={ref} width={160} height={160} className="h-[130px] w-[130px] md:h-[160px] md:w-[160px]" />;
}

export default function RaceHUD({ getMinimap }: { getMinimap: () => MinimapData | null }) {
  const hud = useGameStore((s) => s.hud);
  const phase = useGameStore((s) => s.phase);
  const ItemIcon = hud.heldItem ? ITEM_ICON[hud.heldItem] : null;
  const driftPct = Math.min(1, hud.driftCharge / 1.6) * 100;
  const driftColor = hud.driftTier === 2 ? '#ffd166' : hud.driftTier === 1 ? '#4b8ab0' : '#faf3e3';

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* 左上：圈数 / 名次 */}
      <div className="absolute left-3 top-3 flex gap-2">
        <div className="paper-card origami-border rounded-xl px-3 py-2 shadow-card">
          <div className="flex items-center gap-1 text-[10px] text-ink/60"><Flag size={11} /> 圈数</div>
          <div className="tabular font-hand text-xl font-bold leading-none text-ink">
            {hud.lap}<span className="text-sm text-ink/50">/{hud.totalLaps}</span>
          </div>
        </div>
        <div className="paper-card origami-border rounded-xl px-3 py-2 shadow-card">
          <div className="text-[10px] text-ink/60">名次</div>
          <div className="tabular font-hand text-xl font-bold leading-none text-coral">
            {hud.place}<span className="text-sm text-ink/50">/{hud.totalRacers}</span>
          </div>
        </div>
      </div>

      {/* 右上：计时 */}
      <div className="paper-card origami-border absolute right-3 top-3 rounded-xl px-3 py-2 text-right shadow-card">
        <div className="flex items-center justify-end gap-1 text-[10px] text-ink/60"><Timer size={11} /> 总时间</div>
        <div className="tabular font-hand text-lg font-bold leading-tight text-ink">{formatTime(hud.raceTime)}</div>
        <div className="tabular text-[10px] text-ink/60">最佳 {formatTime(hud.bestLap)}</div>
        <div className="tabular text-[10px] text-ink/60">上圈 {formatTime(hud.lastLap)}</div>
      </div>

      {/* 左下：小地图 */}
      <div className="paper-card origami-border absolute bottom-3 left-3 rounded-xl p-2 shadow-card">
        <Minimap getMinimap={getMinimap} />
      </div>

      {/* 右下：速度 / 漂移 / 道具 */}
      <div className="absolute bottom-3 right-3 flex items-end gap-2">
        {/* 道具槽 */}
        <div className="paper-card origami-border relative flex h-[86px] w-[86px] flex-col items-center justify-center overflow-hidden rounded-xl shadow-card">
          {hud.roulette ? (
            <div className="roulette-strip flex flex-col items-center" style={{ animation: 'roulette-spin 0.35s linear infinite' }}>
              {[...Object.keys(ITEM_ICON), ...Object.keys(ITEM_ICON)].map((k, i) => {
                const Icon = ITEM_ICON[k as ItemType];
                return <Icon key={i} size={30} style={{ color: ITEM_COLOR[k as ItemType] }} className="my-2" />;
              })}
            </div>
          ) : ItemIcon ? (
            <>
              <ItemIcon size={34} style={{ color: ITEM_COLOR[hud.heldItem!] }} />
              <span className="mt-1 text-[9px] font-bold text-ink/70">{ITEM_NAME[hud.heldItem!]}</span>
            </>
          ) : (
            <span className="font-hand text-3xl font-bold text-ink/25">?</span>
          )}
          <span className="absolute bottom-0.5 text-[8px] text-ink/40">道具 E</span>
        </div>
        {/* 速度 + 漂移 */}
        <div className="paper-card origami-border rounded-xl px-3 py-2 shadow-card">
          <div className="flex items-end gap-1">
            <Gauge size={16} className="mb-1 text-ink/60" />
            <span className="tabular font-hand text-3xl font-bold leading-none text-ink">{hud.speed}</span>
            <span className="mb-0.5 text-[10px] text-ink/60">km/h</span>
          </div>
          <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${driftPct}%`, background: driftColor }} />
          </div>
          <div className="mt-1 flex gap-1">
            {hud.boost && <Send size={13} className="text-coral" />}
            {hud.shield && <Shield size={13} className="text-[#4b8ab0]" />}
            {hud.slow && <StickyNote size={13} className="text-[#d9a520]" />}
            {hud.offroad && <AlertTriangle size={13} className="text-[#c86d51]" />}
          </div>
        </div>
      </div>

      {/* 中央倒计时 */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div key={hud.countdown} className="animate-pop-in font-hand text-[120px] font-bold text-coral text-stroke-paper drop-shadow-lg">
            {hud.countdown}
          </div>
        </div>
      )}
      {phase === 'racing' && hud.raceTime < 1 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pop-in font-hand text-[96px] font-bold text-sage text-stroke-paper drop-shadow-lg">GO!</div>
        </div>
      )}
    </div>
  );
}