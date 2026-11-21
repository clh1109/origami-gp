import React, { useEffect, useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';

interface TitleOverlayProps {
  onWakeCrane: () => void;
  onSkip: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ onWakeCrane, onSkip }) => {
  const [opening, setOpening] = useState(false);

  const handleStart = () => {
    if (opening) return;
    setOpening(true);
    onWakeCrane();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!opening) handleStart();
        else onSkip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opening, onSkip]);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between px-6 py-10 select-none">
      {/* 顶部唯美留白标题 */}
      <div
        className="flex flex-col items-center text-center transition-all duration-700"
        style={{
          opacity: opening ? 0 : 1,
          transform: opening ? 'translateY(-18px)' : 'translateY(0)',
        }}
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#201812]/35 backdrop-blur-sm border border-[#f5dfa4]/40 px-4 py-1 text-[11px] tracking-[0.28em] text-[#fce8b2] uppercase shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          POP-UP STORYBOOK RACING
        </div>
        <h1 className="font-hand mt-4 text-5xl md:text-6xl font-extrabold tracking-wider text-[#fffdf7] drop-shadow-[0_6px_22px_rgba(32,20,10,0.65)]">
          折纸大奖赛
        </h1>
        <p className="mt-2.5 text-xs md:text-sm tracking-[0.22em] text-[#fff8e6]/90 drop-shadow-[0_2px_10px_rgba(32,20,10,0.7)]">
          午后三点，主人离开书桌的十分钟……
        </p>
      </div>

      {/* 底部极简操作区 */}
      <div className="flex flex-col items-center gap-3">
        {!opening ? (
          <button
            type="button"
            onClick={handleStart}
            className="pointer-events-auto btn-press group inline-flex items-center gap-2.5 rounded-full bg-[#fcf7ea]/95 border-2 border-[#e3c27a] px-8 py-3.5 text-[#2a2018] font-hand text-lg font-extrabold shadow-[0_10px_30px_rgba(24,15,8,0.45)] hover:scale-105 transition-all"
          >
            <BookOpen className="w-5 h-5 text-coral group-hover:rotate-[-8deg] transition-transform" />
            <span>轻唤千纸鹤 · 翻开绘本</span>
          </button>
        ) : (
          <div className="w-full flex items-center justify-between max-w-5xl">
            <div className="text-xs md:text-sm tracking-widest text-[#fffdf7]/90 drop-shadow-[0_2px_10px_rgba(32,20,10,0.75)] animate-fade-up">
              千纸鹤振翅吹开书页，折纸世界正在苏醒……
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="pointer-events-auto paper-card origami-border rounded-full px-4 py-1.5 text-xs font-bold text-ink/80 bg-white/85 shadow-sm hover:bg-white"
            >
              跳过开场
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
