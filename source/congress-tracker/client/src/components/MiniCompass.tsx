import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  compassX: number;
  compassY: number;
  name: string;
  party: string;
  userX?: number | null;
  userY?: number | null;
}

const PARTY_RGB = {
  Democrat:    "79,140,186",
  Republican:  "196,74,58",
  Independent: "140,110,170",
};

export default function MiniCompass({ compassX, compassY, name, party, userX, userY }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLight, setIsLight] = useState(() => document.documentElement.classList.contains("light"));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.classList.contains("light")));
    obs.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const logW = rect.width  || 900;
    const logH = rect.height || 675;
    canvas.width  = Math.round(logW * dpr);
    canvas.height = Math.round(logH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = logW, H = logH;
    const pad = 16, cx = W / 2, cy = H / 2;
    const rw = W / 2 - pad, rh = H / 2 - pad;

    ctx.clearRect(0, 0, W, H);

    // ── Theme-aware colors ───────────────────────────────────────────────────
    const bg       = isLight ? "#fafaf8"              : "#0f1a1c";
    const quadTL   = isLight ? "rgba(241,232,227,0.55)" : "rgba(80,55,45,0.45)";
    const quadTR   = isLight ? "rgba(237,232,245,0.55)" : "rgba(60,50,85,0.45)";
    const quadBL   = isLight ? "rgba(195,227,232,0.55)" : "rgba(30,75,85,0.45)";
    const quadBR   = isLight ? "rgba(201,214,235,0.55)" : "rgba(35,60,90,0.45)";
    const gridCol  = isLight ? "rgba(100,110,120,0.10)" : "rgba(180,200,210,0.08)";
    const axisCol  = isLight ? "rgba(80,90,100,0.30)"  : "rgba(180,200,210,0.25)";
    const labelCol = isLight ? "rgba(60,70,80,0.50)"   : "rgba(160,180,190,0.55)";
    const borderCol= isLight ? "rgba(0,0,0,0.30)"      : "rgba(255,255,255,0.12)";

    // ── Background (rounded rect, clipped — matches full compass) ────────────
    const r = 8;
    ctx.beginPath();
    ctx.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, r);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, r);
    ctx.clip();

    // ── Quadrant fills (same palette as main compass) ────────────────────────
    const quads = [
      { x: pad, y: pad, fill: quadTL },  // TL: populist
      { x: cx,  y: pad, fill: quadTR },  // TR: traditional right
      { x: pad, y: cy,  fill: quadBL },  // BL: progressive
      { x: cx,  y: cy,  fill: quadBR },  // BR: libertarian
    ];
    quads.forEach(q => {
      ctx.fillStyle = q.fill;
      ctx.fillRect(q.x, q.y, rw, rh);
    });

    // ── Subtle grid ──────────────────────────────────────────────────────────
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 0.5;
    for (let i = -0.5; i <= 0.5; i += 0.5) {
      if (Math.abs(i) < 0.01) continue;
      const px = cx + i * rw;
      ctx.beginPath(); ctx.moveTo(px, pad); ctx.lineTo(px, H - pad); ctx.stroke();
      const py = cy + i * rh;
      ctx.beginPath(); ctx.moveTo(pad, py); ctx.lineTo(W - pad, py); ctx.stroke();
    }

    // ── Main axes ────────────────────────────────────────────────────────────
    ctx.strokeStyle = axisCol;
    ctx.lineWidth = 1.0;
    ctx.beginPath(); ctx.moveTo(pad, cy); ctx.lineTo(W - pad, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, pad); ctx.lineTo(cx, H - pad); ctx.stroke();

    // ── Axis labels ──────────────────────────────────────────────────────────
    ctx.font = "500 7px 'Inter', 'Helvetica Neue', sans-serif";
    ctx.fillStyle = labelCol;
    ctx.textAlign = "left";  ctx.fillText("← Econ Left",  pad + 3, cy - 4);
    ctx.textAlign = "right"; ctx.fillText("Econ Right →", W - pad - 3, cy - 4);
    ctx.textAlign = "center";
    ctx.fillText("↑ Conservative", cx, pad + 9);
    ctx.fillText("↓ Progressive",  cx, H - pad - 3);

    // ── Member dot ───────────────────────────────────────────────────────────
    const dotX = cx + compassX * rw;
    const dotY = cy - compassY * rh;
    const rgb = PARTY_RGB[party as keyof typeof PARTY_RGB] || PARTY_RGB.Independent;

    // Glow
    const grd = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 14);
    grd.addColorStop(0, `rgba(${rgb},0.25)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(dotX, dotY, 14, 0, Math.PI * 2); ctx.fill();

    // Dot
    ctx.fillStyle   = `rgb(${rgb})`;
    ctx.strokeStyle = "rgba(255,255,255,0.90)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Name label
    const lastName = name.split(" ").slice(-1)[0];
    ctx.font = "600 9px 'Inter', 'Helvetica Neue', sans-serif";
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.textAlign = dotX > cx ? "right" : "left";
    ctx.fillText(lastName, dotX + (dotX > cx ? -11 : 11), dotY - 9);

    // ── User dot ─────────────────────────────────────────────────────────────
    if (userX != null && userY != null) {
      const ux = cx + userX * rw;
      const uy = cy - userY * rh;
      const ug = ctx.createRadialGradient(ux, uy, 0, ux, uy, 12);
      ug.addColorStop(0, "rgba(120,80,180,0.25)");
      ug.addColorStop(1, "rgba(120,80,180,0)");
      ctx.fillStyle = ug;
      ctx.beginPath(); ctx.arc(ux, uy, 12, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle   = "rgb(120,80,180)";
      ctx.strokeStyle = "rgba(255,255,255,0.90)";
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.arc(ux, uy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      ctx.font = "600 8px 'Inter', sans-serif";
      ctx.fillStyle = isLight ? "rgb(100,60,160)" : "rgb(180,140,230)";
      ctx.textAlign = ux > cx ? "right" : "left";
      ctx.fillText("You", ux + (ux > cx ? -9 : 9), uy - 8);
    }

    ctx.restore();

    // ── Border stroke drawn on top (matches full compass) ─────────────────
    ctx.beginPath();
    ctx.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, r);
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [compassX, compassY, name, party, userX, userY, isLight]);

  useEffect(() => { draw(); }, [draw]);

  // Redraw at native resolution whenever the canvas is resized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={675}
      className="w-full"
      style={{ display: "block", aspectRatio: "4/3" }}
      aria-label={`Political compass showing ${name}`}
    />
  );
}
