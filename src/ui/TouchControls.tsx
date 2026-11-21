import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Package, Wind } from 'lucide-react';
import type { PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from 'react';

interface Props {
  setTouch: (t: { throttle?: number; steer?: number; drift?: boolean }) => void;
  requestItem: () => void;
}

function hold(
  down: () => void,
  up: () => void
) {
  return {
    onPointerDown: (e: RPointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      down();
    },
    onPointerUp: (e: RPointerEvent) => {
      e.preventDefault();
      up();
    },
    onPointerCancel: () => up(),
    onPointerLeave: () => up(),
    onContextMenu: (e: RMouseEvent) => e.preventDefault(),
  };
}

const base =
  'touch-btn pointer-events-auto flex items-center justify-center rounded-full border-2 border-ink/50 bg-paper/80 text-ink shadow-card backdrop-blur-sm active:bg-coral/40';

export default function TouchControls({ setTouch, requestItem }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 md:opacity-30 md:hover:opacity-95 transition-opacity duration-200">
      {/* 转向（左）：高于小地图纸卡顶缘，任何视口都不与 HUD 相交 */}
      <div className="absolute bottom-[215px] left-3 flex gap-3">
        <button className={`${base} h-16 w-16`} {...hold(() => setTouch({ steer: 1 }), () => setTouch({ steer: 0 }))}>
          <ChevronLeft size={30} />
        </button>
        <button className={`${base} h-16 w-16`} {...hold(() => setTouch({ steer: -1 }), () => setTouch({ steer: 0 }))}>
          <ChevronRight size={30} />
        </button>
      </div>
      {/* 油门 / 刹车 / 漂移 / 道具（右）：高于右下排位与速度纸卡顶缘 */}
      <div className="absolute bottom-[115px] right-3 flex items-end gap-3">
        <button className={`${base} h-14 w-14`} {...hold(() => setTouch({ throttle: -1 }), () => setTouch({ throttle: 0 }))}>
          <ChevronDown size={26} />
        </button>
        <button
          className={`${base} h-14 w-14 text-[11px] font-bold`}
          {...hold(() => setTouch({ drift: true }), () => setTouch({ drift: false }))}
        >
          <Wind size={22} />
        </button>
        <button className={`${base} h-14 w-14`} onPointerDown={(e) => { e.preventDefault(); requestItem(); }}>
          <Package size={22} />
        </button>
        <button className={`${base} h-20 w-20 bg-coral/75 text-white`} {...hold(() => setTouch({ throttle: 1 }), () => setTouch({ throttle: 0 }))}>
          <ChevronUp size={36} />
        </button>
      </div>
    </div>
  );
}