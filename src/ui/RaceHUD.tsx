import { useEffect, useRef } from 'react';
import { Shield, Send, StickyNote, Undo2, Flag, Timer, AlertTriangle, Gauge } from 'lucide-react';
import { useGameStore, formatTime } from '../store/gameStore';
import { getTrack } from '../data/tracks';
import type { ItemType, MinimapData } from '../types/game';

const ITEM_ICON: Record<ItemType, typeof Shield> = {
  shield: Shield,
  boost: Send,
  trap: StickyNote,
  boomerang: Undo2,
};
const ITEM_NAME: Record<ItemType, string> = {
  shield: '透明胶带护盾',
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
  const config = useGameStore((s) => s.config);
  const currentTrack = getTrack(config.trackId);
  const ItemIcon = hud.heldItem ? ITEM_ICON[hud.heldItem] : null;

  const trackIndex = config.trackId === 'meadow' ? 1 : config.trackId === 'twilight' ? 2 : config.trackId === 'frost' ? 3 : 4;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* 左上角：纸质便签道具槽 (1:1 像素级复刻原视频：左上独立白卡便签 + 黄色五角星/道具 + 白贴纸标签) */}
      <div className="absolute left-4 top-4 flex flex-col items-center">
        <div className="paper-card origami-border relative flex h-[88px] w-[88px] flex-col items-center justify-center overflow-hidden rounded-2xl shadow-card bg-white/95">
          {hud.roulette ? (
            <div className="roulette-strip flex flex-col items-center" style={{ animation: 'roulette-spin 0.35s linear infinite' }}>
              {[...Object.keys(ITEM_ICON), ...Object.keys(ITEM_ICON)].map((k, i) => {
                const Icon = ITEM_ICON[k as ItemType];
                return <Icon key={i} size={36} style={{ color: ITEM_COLOR[k as ItemType] }} className="my-2" />;
              })}
            </div>
          ) : ItemIcon ? (
            <div className="flex flex-col items-center justify-center p-2">
              <ItemIcon size={42} style={{ color: ITEM_COLOR[hud.heldItem!] }} className="drop-shadow-sm transition-transform animate-pop-in" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-ink/20">
              <span className="font-hand text-3xl font-bold">?</span>
            </div>
          )}
          <span className="absolute bottom-1 text-[8px] font-bold text-ink/40">E / Enter</span>
        </div>
        {/* 道具名称白纸标签 (对齐视频白底黑字小标签，如 玻璃纸护盾 / 透明胶带护盾) */}
        {hud.heldItem && (
          <div className="origami-border -mt-2 rounded-md bg-white/95 px-2.5 py-0.5 shadow-sm">
            <span className="font-hand text-[11px] font-bold text-ink">{ITEM_NAME[hud.heldItem]}</span>
          </div>
        )}
      </div>

      {/* 右上角：圈数与计时便签条 (1:1 像素级复刻原视频：右上极简白纸横条 [圈数 1/3] [时间 00:27.16]) */}
      <div className="paper-card origami-border absolute right-4 top-4 flex items-center gap-3.5 rounded-xl px-4 py-2.5 shadow-card bg-white/95">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-ink/60">圈数</span>
          <span className="tabular font-hand text-2xl font-bold leading-none text-ink">
            {hud.lap}<span className="text-sm font-normal text-ink/50">/{hud.totalLaps}</span>
          </span>
        </div>
        <div className="h-6 w-px bg-ink/20" />
        <div className="tabular font-hand text-xl font-bold leading-none text-ink">
          {formatTime(hud.raceTime)}
        </div>
      </div>

      {/* 左下角：手账方格小地图 (比赛进行时显示，1:1 对标原视频) */}
      {phase !== 'countdown' && (
        <div className="paper-card origami-border absolute bottom-4 left-4 rounded-xl p-2 shadow-card max-md:bottom-auto max-md:top-28 bg-white/95 animate-fade-up">
          <Minimap getMinimap={getMinimap} />
        </div>
      )}

      {/* 右下角：纯净打孔名次白卡 (比赛进行时显示，1:1 像素级复刻原视频 '8.') */}
      {phase !== 'countdown' && (
        <div className="absolute bottom-4 right-4 flex items-end animate-fade-up">
          <div className="paper-card origami-border relative flex h-[90px] w-[86px] flex-col items-center justify-center rounded-2xl p-2 shadow-card bg-white/95">
            <div className="tabular font-hand text-6xl font-black leading-none text-ink tracking-tighter">
              {hud.place}<span className="text-4xl text-ink font-bold">.</span>
            </div>
            <span className="tabular text-[10px] font-bold text-ink/40 tracking-wider mt-1">/{hud.totalRacers}</span>
            {/* 打孔小孔效果 */}
            <div className="absolute top-2 left-2 h-2.5 w-2.5 rounded-full border border-ink/20 bg-paper/60" />
          </div>
        </div>
      )}

      {/* 赛道巡航开场便签 (1:1 像素级复刻原视频 0:02 章节手撕便签牌，仅在起跑倒计时显示) */}
      {phase === 'countdown' && (
        <>
          <div className="pointer-events-none absolute bottom-6 left-6 z-30 animate-fade-up max-md:top-20 max-md:left-3 max-md:bottom-auto">
            <div className="paper-card origami-border rounded-2xl p-3.5 shadow-pop bg-white/95 max-w-[260px]">
              <div className="text-[11px] font-bold tracking-widest text-coral uppercase">
                章节 {trackIndex}
              </div>
              <div className="font-hand text-2xl md:text-3xl font-extrabold text-ink mt-0.5">
                {currentTrack.name}
              </div>
              <div className="text-[11px] text-ink/65 mt-0.5 leading-relaxed">
                {currentTrack.subtitle}
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-6 right-6 z-30 hidden md:block animate-fade-up">
            <div className="paper-card origami-border rounded-xl px-4 py-2 shadow-sm text-xs font-bold text-ink/70 bg-white/95">
              Enter 跳过
            </div>
          </div>
        </>
      )}

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