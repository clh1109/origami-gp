import React, { useEffect, useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { CHAPTER_STORIES } from '../data/story';

interface StoryBookIntroProps {
  onOpenBook: () => void;
}

export const StoryBookIntro: React.FC<StoryBookIntroProps> = ({ onOpenBook }) => {
  const [opening, setOpening] = useState(false);

  const handleOpen = () => {
    if (opening) return;
    setOpening(true);
    // 等待 3D 封面翻开动画基本完成后进入 3D 大厅
    window.setTimeout(() => {
      onOpenBook();
    }, 1050);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opening]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-4 select-none transition-opacity duration-700"
      style={{
        background: 'radial-gradient(circle at 50% 42%, rgba(42, 30, 22, 0.42) 0%, rgba(22, 16, 12, 0.78) 100%)',
        backdropFilter: opening ? 'blur(0px)' : 'blur(6px)',
        opacity: opening ? 0 : 1,
        pointerEvents: opening ? 'none' : 'auto',
      }}
    >
      {/* 3D 透视舞台 */}
      <div
        onClick={handleOpen}
        className="relative cursor-pointer group"
        style={{
          width: 'min(440px, 88vw)',
          height: 'min(580px, 82vh)',
          perspective: '1800px',
        }}
      >
        {/* 翻开后露出的米白内扉页 */}
        <div
          className="absolute inset-0 rounded-r-2xl rounded-l-md shadow-2xl flex flex-col justify-between p-8 border border-[#dfd3bc]"
          style={{
            background: 'linear-gradient(135deg, #fcf8ee 0%, #f3ead6 100%)',
          }}
        >
          <div>
            <div className="text-xs tracking-[0.25em] text-[#8d7658] uppercase mb-2">
              {CHAPTER_STORIES.meadow.pageLabel}
            </div>
            <h2 className="text-2xl font-bold text-[#2f241c] mb-3">折纸大奖赛 · 故事启程</h2>
            <p className="text-sm leading-relaxed text-[#5c4a38]">
              {CHAPTER_STORIES.meadow.epigraph}
            </p>
          </div>

          <div className="space-y-2 border-t border-dashed border-[#d6c6a9] pt-4 text-xs text-[#6e5a45]">
            <div>Chapter 01 · 雏菊草甸</div>
            <div>Chapter 02 · 暮色纸镇</div>
            <div>Chapter 03 · 冰霜信封峡谷</div>
            <div>Chapter 04 · 午后木质书桌</div>
          </div>
        </div>

        {/* 精装硬壳立体书封面（绕左侧书脊 3D 翻转） */}
        <div
          className="absolute inset-0 rounded-r-2xl rounded-l-md shadow-2xl overflow-hidden flex flex-col justify-between p-8"
          style={{
            background: 'linear-gradient(145deg, #2b415e 0%, #1e2d42 60%, #162233 100%)',
            transformOrigin: 'left center',
            transform: opening ? 'rotateY(-155deg)' : 'rotateY(0deg)',
            transition: 'transform 1.05s cubic-bezier(0.22, 1, 0.36, 1)',
            backfaceVisibility: 'hidden',
            boxShadow: '14px 20px 45px rgba(10, 8, 6, 0.55), inset 10px 0 18px rgba(0,0,0,0.35)',
          }}
        >
          {/* 左侧精装书脊压痕线 */}
          <div
            className="absolute top-0 bottom-0 left-0 w-7"
            style={{
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(0,0,0,0.28) 70%, rgba(255,245,220,0.12) 100%)',
            }}
          />

          {/* 烫金手账内框 */}
          <div className="absolute inset-4 left-9 rounded-xl border border-[#e8c882]/45 pointer-events-none" />

          {/* 顶部红色丝带书签 */}
          <div
            className="absolute top-0 right-10 w-7 h-16 shadow-md"
            style={{
              background: 'linear-gradient(180deg, #d94e3f 0%, #b8382c 100%)',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
            }}
          />

          {/* 顶部副标 */}
          <div className="relative pl-5 pt-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.26em] text-[#e8c882]/90 uppercase">
              <Sparkles className="w-3.5 h-3.5" /> POP-UP STORYBOOK EDITION
            </div>
          </div>

          {/* 中央书名与故事序言 */}
          <div className="relative pl-5 my-auto text-left">
            <div className="inline-block px-3 py-1 rounded-full bg-[#e8c882]/15 border border-[#e8c882]/35 text-[#f4d896] text-xs mb-4">
              第 1 卷 · 书桌上的秘密竞速
            </div>
            <h1 className="text-4xl font-extrabold tracking-wide text-[#fcf6e8] drop-shadow-sm mb-2">
              折纸大奖赛
            </h1>
            <div className="text-sm tracking-[0.3em] text-[#e8c882]/85 font-semibold mb-6">
              ORIGAMI GRAND PRIX
            </div>
            <p className="text-sm leading-relaxed text-[#dbe5f2]/85 max-w-[300px]">
              午后三点，主人去泡茶的十分钟里，书桌上的精装绘本微微颤动——八位折纸小车手从书页里苏醒，即将展开一场冲出纸面的奇幻竞速。
            </p>
          </div>

          {/* 底部翻书按钮 */}
          <div className="relative pl-5 pb-1 flex items-center justify-between">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpen();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#e8c882] text-[#231b14] font-bold text-sm shadow-lg group-hover:scale-105 transition-transform"
            >
              <BookOpen className="w-4 h-4" /> 翻开立体书
            </button>
            <span className="text-[11px] text-[#cfd9e8]/60 tracking-wider">点击封面 / Enter</span>
          </div>
        </div>
      </div>
    </div>
  );
};
