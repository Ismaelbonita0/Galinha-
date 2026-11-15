import React, { useRef, useState } from 'react';

interface MobileControlsProps {
  nearVehicle: boolean;
  inVehicle: boolean;
  grenadeCooldown: number;
  onMove: (x: number, y: number) => void;
  onAimDelta: (dx: number, dy: number) => void;
  onFire: (active: boolean) => void;
  onJump: (active: boolean) => void;
  onGrenade: () => void;
  onVehicleToggle: () => void;
  onReload: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  nearVehicle,
  inVehicle,
  grenadeCooldown,
  onMove,
  onAimDelta,
  onFire,
  onJump,
  onGrenade,
  onVehicleToggle,
  onReload,
}) => {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const stickRef = useRef<HTMLDivElement | null>(null);
  const stickPointerId = useRef<number | null>(null);

  const aimPointerId = useRef<number | null>(null);
  const lastAimPos = useRef({ x: 0, y: 0 });

  const updateStick = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.36;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius && dist > 0) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });
    onMove(dx / maxRadius, -dy / maxRadius);
  };

  const resetStick = () => {
    stickPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none" data-testid="mobile-controls">
      {/* Right-half touch drag area for camera aim */}
      <div
        className="fixed top-16 right-0 bottom-0 left-1/2 pointer-events-auto touch-none"
        onPointerDown={(e) => {
          if (aimPointerId.current !== null) return;
          aimPointerId.current = e.pointerId;
          lastAimPos.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (aimPointerId.current !== e.pointerId) return;
          const dx = e.clientX - lastAimPos.current.x;
          const dy = e.clientY - lastAimPos.current.y;
          lastAimPos.current = { x: e.clientX, y: e.clientY };
          onAimDelta(dx, dy);
        }}
        onPointerUp={(e) => {
          if (aimPointerId.current === e.pointerId) {
            aimPointerId.current = null;
          }
        }}
        onPointerCancel={(e) => {
          if (aimPointerId.current === e.pointerId) {
            aimPointerId.current = null;
          }
        }}
      />

      {/* Left Virtual Movement Thumbstick */}
      <div
        ref={stickRef}
        aria-label="Direcional virtual"
        className="fixed left-4 bottom-24 w-28 h-28 rounded-full bg-slate-950/65 border-2 border-slate-400/50 pointer-events-auto touch-none flex items-center justify-center"
        onPointerDown={(e) => {
          e.stopPropagation();
          stickPointerId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (stickPointerId.current !== e.pointerId) return;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (stickPointerId.current === e.pointerId) resetStick();
        }}
        onPointerCancel={(e) => {
          if (stickPointerId.current === e.pointerId) resetStick();
        }}
      >
        <div
          className="w-12 h-12 rounded-full bg-amber-400/90 border-2 border-white shadow-lg"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Right Action Buttons (>=44x44px hitboxes) */}
      <div className="fixed right-4 bottom-24 pointer-events-auto flex flex-col items-end gap-2.5 touch-none">
        <div className="flex items-center gap-2">
          {(nearVehicle || inVehicle) && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onVehicleToggle();
              }}
              className="min-w-[48px] min-h-[48px] px-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold border-2 border-amber-200 shadow-lg"
            >
              {inVehicle ? 'Sair' : 'Buggy'}
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onReload();
            }}
            className="min-w-[48px] min-h-[48px] px-3 rounded-xl bg-slate-900/90 text-slate-100 text-xs font-bold border border-slate-500 shadow-lg"
          >
            Recar.
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onGrenade();
            }}
            className="min-w-[52px] min-h-[48px] px-3 rounded-xl bg-slate-900/90 text-amber-300 text-xs font-bold border border-amber-500/70 shadow-lg"
          >
            {grenadeCooldown > 0 ? `${grenadeCooldown.toFixed(0)}s` : 'Ovo'}
          </button>
        </div>

        <div className="flex items-end gap-3">
          <button
            type="button"
            aria-label="Pular e Jetpack"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onJump(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onJump(false);
            }}
            onPointerCancel={() => onJump(false)}
            className="w-16 h-16 rounded-full bg-sky-500/90 active:bg-sky-400 text-slate-950 text-xs font-extrabold border-2 border-sky-200 shadow-xl"
          >
            PULO
          </button>

          <button
            type="button"
            aria-label="Atirar"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onFire(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onFire(false);
            }}
            onPointerCancel={() => onFire(false)}
            className="w-20 h-20 rounded-full bg-amber-500/95 active:bg-amber-400 text-slate-950 text-sm font-extrabold border-2 border-white shadow-xl"
          >
            ATIRAR
          </button>
        </div>
      </div>
    </div>
  );
};
