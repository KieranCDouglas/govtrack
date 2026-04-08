import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentMembers } from "@/lib/dataService";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { RotateCcw, HelpCircle } from "lucide-react";
import { getQuizResult } from "@/lib/quizStore";
import type { Member } from "@/lib/dataService";
import { useTheme } from "@/components/ThemeProvider";

// ── Design tokens ─────────────────────────────────────────────────────────────

// Quadrant fill colors (your spec)
const QUAD_COLORS = {
  topRight:    "rgba(237,232,245,0.55)",   // #ede8f5 — traditional conservative
  bottomRight: "rgba(201,214,235,0.55)",   // #c9d6eb — libertarian
  bottomLeft:  "rgba(195,227,232,0.55)",   // #c3e3e8 — progressive left
  topLeft:     "rgba(241,232,227,0.55)",   // #f1e8e3 — populist left
};

// Party dot colors
const PARTY_RGB = {
  Democrat:    "79,140,186",    // calm blue
  Republican:  "196,74,58",    // warm red
  Independent: "140,110,170",  // muted purple
};

// ── Policy issue categories ────────────────────────────────────────────────────

const POLICY_FAMILIES = [
  { value: "none",             label: "Party (default)" },
  { value: "immigration",      label: "Immigration" },
  { value: "environment",      label: "Environment" },
  { value: "social_rights",    label: "Abortion & Social Rights" },
  { value: "guns",             label: "Gun Policy" },
  { value: "healthcare",       label: "Healthcare" },
  { value: "fiscal_tax",       label: "Economy & Taxes" },
  { value: "military_defense", label: "Military & Defense" },
  { value: "criminal_justice", label: "Criminal Justice" },
  { value: "elections",        label: "Elections" },
  { value: "trade",            label: "Trade" },
];

interface CompassDot { member: Member; x: number; y: number; }

// ── Heterodoxy helpers ────────────────────────────────────────────────────────

/** Returns heterodoxy 0–1 (0 = always votes with party, 1 = always crosses) */
/**
 * Build a party→{mean, stdev} lookup for a given category across a member list.
 * Used to compute each member's z-score deviation from their party norm.
 */
function buildPartyStats(members: Member[], family: string): Record<string, { mean: number; stdev: number }> {
  const byParty: Record<string, number[]> = {};
  for (const m of members) {
    const val = m.partyAlignmentByCategory?.[family];
    if (typeof val !== "number") continue;
    (byParty[m.party] ??= []).push(val);
  }
  const stats: Record<string, { mean: number; stdev: number }> = {};
  for (const [p, vals] of Object.entries(byParty)) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const stdev = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 0.01;
    stats[p] = { mean, stdev };
  }
  return stats;
}

/**
 * Returns deviation 0–1 for a member on a given category.
 * 0 = at party mean (conformist), 1 = ≥2 stdevs below party mean (most heterodox).
 * "Below mean" means lower alignment = more cross-party voting.
 */
function getDeviation(member: Member, family: string, partyStats: Record<string, { mean: number; stdev: number }>): number | null {
  const val = member.partyAlignmentByCategory?.[family];
  if (typeof val !== "number") return null;
  const stats = partyStats[member.party];
  if (!stats) return null;
  // z = (mean - val) / stdev  → positive when member votes less with party than average
  const z = (stats.mean - val) / stats.stdev;
  return Math.max(0, Math.min(1, z / 2)); // clamp: 2+ stdevs = max heterodoxy
}

/**
 * Dot color based on deviation from party norm.
 * conformist (dev=0) → dim/faded party color
 * heterodox  (dev=1) → vivid, saturated, full opacity
 */
function hetDotColor(party: string, dev: number, alpha: number): string {
  const t = Math.max(0, Math.min(1, dev));
  // Faded at t=0, vivid at t=1
  const fade = 1 - t * 0.7; // opacity factor: 0.3 (faded) → 1.0 (vivid)
  const a = alpha * (0.25 + t * 0.75);
  if (party === "Democrat") {
    const r = Math.round(30  + t * 49);   // 30→79
    const g = Math.round(80  + t * 60);   // 80→140
    const b = Math.round(140 + t * 46);   // 140→186
    return `rgba(${r},${g},${b},${a})`;
  }
  if (party === "Republican") {
    const r = Math.round(160 + t * 36);   // 160→196
    const g = Math.round(40  + t * 34);   // 40→74
    const b = Math.round(30  + t * 28);   // 30→58
    return `rgba(${r},${g},${b},${a})`;
  }
  // Independent
  const r = Math.round(100 + t * 40);
  const g = Math.round(70  + t * 40);
  const b = Math.round(130 + t * 40);
  return `rgba(${r},${g},${b},${a})`;
  void fade; // suppress unused warning
}

// ── Deterministic jitter ──────────────────────────────────────────────────────

/** Simple integer hash of a string — stable across renders */
function bioHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return h >>> 0; // unsigned
}

/** Returns a tiny deterministic [dx, dy] offset in pixels (up to `radius` px) */
function jitter(id: string, radius: number): [number, number] {
  const h = bioHash(id);
  const angle = (h & 0xFFFF) / 0xFFFF * Math.PI * 2;
  const r     = ((h >>> 16) & 0xFFFF) / 0xFFFF * radius;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompassPage() {
  const [location] = useLocation();
  const highlight = new URLSearchParams(location.split("?")[1] || "").get("highlight") || "";

  const { theme } = useTheme();
  const isLight = theme === "light";
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [chamber,   setChamber]   = useState("all");
  const [party,     setParty]     = useState("all");
  const [colorMode, setColorMode] = useState("none");
  const [hovered,   setHovered]   = useState<Member | null>(null);
  const dotsRef = useRef<CompassDot[]>([]);
  const partyStatsRef = useRef<Record<string, { mean: number; stdev: number }>>({});

  const [userPos] = useState<{ compassX: number; compassY: number } | null>(() => {
    const r = getQuizResult();
    return r ? { compassX: r.dim1, compassY: r.dim2 } : null;
  });

  const { data: allMembers, isLoading } = useQuery({
    queryKey: ["compass-members", chamber],
    queryFn: async () => {
      const all = await getCurrentMembers();
      return chamber === "all" ? all : all.filter(m => m.chamber === chamber);
    },
  });

  const members: Member[] = (allMembers || []).filter((m: Member) => {
    if (m.compassX == null || m.compassY == null) return false;
    if (party === "Democrat")    return m.party === "Democrat";
    if (party === "Republican")  return m.party === "Republican";
    if (party === "Independent") return m.party !== "Democrat" && m.party !== "Republican";
    return true;
  });

  // ── Draw ──────────────────────────────────────────────────────────────────

  // Always-current ref so ResizeObserver never captures a stale closure
  const drawRef = useRef<() => void>(() => {});

  drawRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Read theme directly from DOM at draw time — avoids any stale closure issues
    const isLight = document.documentElement.classList.contains("light");

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const logW = rect.width  || 900;
    const logH = rect.height || 700;
    const physW = Math.round(logW * dpr);
    const physH = Math.round(logH * dpr);
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width  = physW;
      canvas.height = physH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = logW, H = logH;
    const pad = 16;
    const cx = W / 2, cy = H / 2;
    const rw = W / 2 - pad, rh = H / 2 - pad;

    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // Pre-compute party stats for deviation normalization (also stored for hover bar)
    partyStatsRef.current = colorMode !== "none" ? buildPartyStats(members, colorMode) : {};

    // ── Theme-aware colors ─────────────────────────────────────────────────
    const canvasBg  = isLight ? "#fafaf8"              : "#0f1a1c";
    const quadTL    = isLight ? QUAD_COLORS.topLeft     : "rgba(80,55,45,0.45)";
    const quadTR    = isLight ? QUAD_COLORS.topRight    : "rgba(60,50,85,0.45)";
    const quadBL    = isLight ? QUAD_COLORS.bottomLeft  : "rgba(30,75,85,0.45)";
    const quadBR    = isLight ? QUAD_COLORS.bottomRight : "rgba(35,60,90,0.45)";
    const gridCol   = isLight ? "rgba(100,110,120,0.10)" : "rgba(180,200,210,0.08)";
    const axisCol   = isLight ? "rgba(80,90,100,0.30)"  : "rgba(180,200,210,0.25)";
    const labelCol  = isLight ? "rgba(60,70,80,0.55)"   : "rgba(160,180,190,0.55)";
    const borderCol = isLight ? "rgba(0,0,0,0.30)"      : "rgba(255,255,255,0.12)";

    // ── Canvas background ──────────────────────────────────────────────────
    const r = 8;
    ctx.beginPath();
    ctx.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, r);
    ctx.fillStyle = canvasBg;
    ctx.fill();
    ctx.clip();

    // ── Quadrant fills ─────────────────────────────────────────────────────
    // Top-left: populist left
    ctx.fillStyle = quadTL;
    ctx.fillRect(pad, pad, rw, rh);
    // Top-right: traditional conservative
    ctx.fillStyle = quadTR;
    ctx.fillRect(cx, pad, rw, rh);
    // Bottom-left: progressive left
    ctx.fillStyle = quadBL;
    ctx.fillRect(pad, cy, rw, rh);
    // Bottom-right: libertarian
    ctx.fillStyle = quadBR;
    ctx.fillRect(cx, cy, rw, rh);

    // ── Subtle grid ────────────────────────────────────────────────────────
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 0.75;
    for (let i = -0.75; i <= 0.75; i += 0.25) {
      if (Math.abs(i) < 0.01) continue;
      const px = cx + i * rw;
      ctx.beginPath(); ctx.moveTo(px, pad); ctx.lineTo(px, H - pad); ctx.stroke();
      const py = cy + i * rh;
      ctx.beginPath(); ctx.moveTo(pad, py); ctx.lineTo(W - pad, py); ctx.stroke();
    }

    // ── Main axes ──────────────────────────────────────────────────────────
    ctx.strokeStyle = axisCol;
    ctx.lineWidth = 1.0;
    ctx.beginPath(); ctx.moveTo(pad, cy); ctx.lineTo(W - pad, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, pad); ctx.lineTo(cx, H - pad); ctx.stroke();

    // ── Axis labels ────────────────────────────────────────────────────────
    ctx.font = "500 10px 'Inter', 'Helvetica Neue', sans-serif";
    ctx.fillStyle = labelCol;
    ctx.textAlign = "left";
    ctx.fillText("← Economic Left", pad + 6, cy - 6);
    ctx.textAlign = "right";
    ctx.fillText("Economic Right →", W - pad - 6, cy - 6);
    ctx.textAlign = "center";
    ctx.fillText("↑ Social Conservative", cx, pad + 14);
    ctx.fillText("↓ Social Progressive", cx, H - pad - 6);

    // ── Member dots ────────────────────────────────────────────────────────
    const dots: CompassDot[] = [];

    // Draw non-hovered / non-highlighted first, then hovered on top
    const sorted = [...members].sort((a) =>
      (a.bioguideId === highlight || hovered?.bioguideId === a.bioguideId) ? 1 : -1
    );

    for (const m of sorted) {
      if (m.compassX == null || m.compassY == null) continue;
      const [jx, jy] = colorMode === "none" ? jitter(m.bioguideId, 4) : [0, 0];
      const x = cx + m.compassX * rw + jx;
      const y = cy - m.compassY * rh + jy;
      dots.push({ member: m, x, y });

      const isHl  = m.bioguideId === highlight;
      const isHov = hovered?.bioguideId === m.bioguideId;
      const scale = Math.min(1, logW / 600);
      const r     = isHl ? Math.max(4, 8 * scale) : isHov ? Math.max(3, 7 * scale) : Math.max(2, 4 * scale);
      const alpha = isHl || isHov ? 1 : 0.82;

      // Glow for highlighted / hovered
      if (isHl || isHov) {
        const rgb = PARTY_RGB[m.party as keyof typeof PARTY_RGB] || PARTY_RGB.Independent;
        const glowR = Math.max(8, 16 * scale);
        const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        g.addColorStop(0, `rgba(${rgb},0.28)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2); ctx.fill();
      }

      // Dot color
      let dotColor: string;
      if (colorMode !== "none") {
        const dev = getDeviation(m, colorMode, partyStatsRef.current);
        dotColor = dev !== null
          ? hetDotColor(m.party, dev, alpha)
          : `rgba(180,185,190,${alpha * 0.5})`;
      } else {
        const rgb = PARTY_RGB[m.party as keyof typeof PARTY_RGB] || PARTY_RGB.Independent;
        dotColor = `rgba(${rgb},${alpha})`;
      }

      // Crisp dot with thin white stroke for separation
      ctx.fillStyle = dotColor;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = isHov || isHl ? 0 : 0.8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (!isHov && !isHl) ctx.stroke();

      // Name label on hover / highlight
      if (isHl || isHov) {
        const rgb = PARTY_RGB[m.party as keyof typeof PARTY_RGB] || PARTY_RGB.Independent;
        const lastName = m.displayName.split(" ").slice(-1)[0];
        const labelX = x + (x > cx ? -10 : 10);
        const labelY = y - 10;
        const textAlign = x > cx ? "right" : "left";

        // Label pill background
        ctx.font = "600 10px 'Inter', 'Helvetica Neue', sans-serif";
        ctx.textAlign = textAlign;
        const tw = ctx.measureText(lastName).width;
        const px2 = textAlign === "right" ? labelX - tw - 6 : labelX - 4;
        ctx.fillStyle = isLight ? "rgba(255,255,255,0.88)" : "rgba(15,26,28,0.85)";
        ctx.beginPath();
        ctx.roundRect(px2, labelY - 11, tw + 10, 14, 4);
        ctx.fill();

        ctx.fillStyle = `rgba(${rgb},1)`;
        ctx.fillText(lastName, labelX, labelY);
      }
    }
    dotsRef.current = dots;

    // ── User quiz result dot ───────────────────────────────────────────────
    if (userPos) {
      const ux = cx + userPos.compassX * rw;
      const uy = cy - userPos.compassY * rh;
      const scale = Math.min(1, logW / 500);
      const uGlowR = Math.max(10, 20 * scale);
      const uDotR  = Math.max(4, 7 * scale);
      const ug = ctx.createRadialGradient(ux, uy, 0, ux, uy, uGlowR);
      ug.addColorStop(0, "rgba(120,80,180,0.30)");
      ug.addColorStop(1, "rgba(120,80,180,0)");
      ctx.fillStyle = ug;
      ctx.beginPath(); ctx.arc(ux, uy, uGlowR, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "rgb(120,80,180)";
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ux, uy, uDotR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      ctx.font = "700 10px 'Inter', sans-serif";
      ctx.fillStyle = isLight ? "rgb(100,60,160)" : "rgb(180,140,230)";
      ctx.textAlign = ux > cx ? "right" : "left";
      ctx.fillText("You", ux + (ux > cx ? -13 : 13), uy - 12);
    }

    ctx.restore();

    // ── Rounded border drawn on top of all content ──────────────────────────
    ctx.beginPath();
    ctx.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, r);
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // Redraw whenever any dependency changes
  useEffect(() => {
    drawRef.current();
  }, [members, hovered, userPos, highlight, colorMode, isLight]);

  // Redraw at native resolution whenever the canvas container is resized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => drawRef.current());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // ── Interaction ───────────────────────────────────────────────────────────

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;
    const mx   = (e.clientX - rect.left) * (canvasRef.current!.width  / dpr / rect.width);
    const my   = (e.clientY - rect.top)  * (canvasRef.current!.height / dpr / rect.height);
    let closest: Member | null = null, minDist = 12;
    for (const { member, x: dx, y: dy } of dotsRef.current) {
      const d = Math.sqrt((mx - dx) ** 2 + (my - dy) ** 2);
      if (d < minDist) { minDist = d; closest = member; }
    }
    setHovered(closest);
  }

  function resetView() { setChamber("all"); setParty("all"); setColorMode("none"); }

  // ── Counts ────────────────────────────────────────────────────────────────

  const demCount = members.filter(m => m.party === "Democrat").length;
  const repCount = members.filter(m => m.party === "Republican").length;
  const indCount = members.filter(m => m.party !== "Democrat" && m.party !== "Republican").length;
  const familyLabel = POLICY_FAMILIES.find(f => f.value === colorMode)?.label ?? "Party";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Header ── */}
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Political Compass</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Every current member of Congress placed by their{" "}
          <strong className="text-foreground">economic views</strong> (horizontal) and{" "}
          <strong className="text-foreground">social views</strong> (vertical), scored by AI
          analysis of voting records, sponsored legislation, interest-group ratings, and donor
          industries. Use <em>Color by</em> to reveal how much each member breaks with their
          party on a specific issue.
        </p>
      </div>

      {/* ── Legend ── */}
      <div className="mb-2 flex flex-wrap items-center gap-4">

        {colorMode !== "none" ? (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{familyLabel}:</span>
            {[
              { label: "Democrat",    from: "rgb(79,140,186)",  to: "rgb(195,215,230)" },
              { label: "Republican",  from: "rgb(196,74,58)",   to: "rgb(235,185,180)" },
            ].map(({ label, from, to }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  <div className="w-3 h-3 rounded-full border border-white/60" style={{ background: from }} />
                  <div className="w-16 h-1.5 rounded-full" style={{ background: `linear-gradient(to right, ${from}, ${to})` }} />
                  <div className="w-3 h-3 rounded-full border border-white/60" style={{ background: to }} />
                </div>
                <span>{label}: party-line → cross-party</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-300/60" />
              <span>no votes on record</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: "rgb(79,140,186)" }} />
              <span className="text-muted-foreground">Democrat ({demCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: "rgb(196,74,58)" }} />
              <span className="text-muted-foreground">Republican ({repCount})</span>
            </div>
            {indCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: "rgb(140,110,170)" }} />
                <span className="text-muted-foreground">Independent ({indCount})</span>
              </div>
            )}
            {userPos && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: "rgb(120,80,180)" }} />
                <span className="text-foreground font-medium">You (quiz result)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex justify-center mb-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={chamber} onValueChange={setChamber}>
            <SelectTrigger className="w-34 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Both chambers</SelectItem>
              <SelectItem value="House">House only</SelectItem>
              <SelectItem value="Senate">Senate only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={party} onValueChange={setParty}>
            <SelectTrigger className="w-34 h-8 text-xs"><SelectValue placeholder="All parties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All parties</SelectItem>
              <SelectItem value="Democrat">Democrats</SelectItem>
              <SelectItem value="Republican">Republicans</SelectItem>
              <SelectItem value="Independent">Independents</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Color by:</span>
            <Select value={colorMode} onValueChange={setColorMode}>
              <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POLICY_FAMILIES.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={resetView} className="h-8 w-8" title="Reset view">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="flex justify-center">
      <div
        className="rounded-2xl overflow-hidden mb-3 w-full max-w-3xl"
        style={{
          border: "none",
        }}
      >
        {isLoading ? (
          <div className="w-full aspect-[4/3] skeleton" />
        ) : (
          <canvas
            ref={canvasRef}
            width={900}
            height={700}
            className="w-full"
            style={{ cursor: hovered ? "pointer" : "default", display: "block", aspectRatio: "4/3" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { if (hovered) window.location.hash = `#/members/${hovered.bioguideId}`; }}
          />
        )}
      </div>
      </div>

      {/* ── Hover info bar ── */}
      <div className="min-h-9 flex items-center mb-4">
        {hovered ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-foreground">{hovered.displayName}</span>
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                color: hovered.party === "Democrat" ? "rgb(79,140,186)" : hovered.party === "Republican" ? "rgb(196,74,58)" : "rgb(140,110,170)",
                borderColor: "currentColor",
              }}
            >
              {hovered.party}
            </Badge>
            <span className="text-muted-foreground text-xs">{hovered.chamber} · {hovered.state}</span>
            {hovered.compassX != null && (
              <span className="text-muted-foreground tabular-nums text-xs">
                Econ: {(hovered.compassX ?? 0) > 0.1 ? "Right" : (hovered.compassX ?? 0) < -0.1 ? "Left" : "Center"}{" "}
                ({(hovered.compassX ?? 0) > 0 ? "+" : ""}{hovered.compassX?.toFixed(3)})
                {" · "}
                Social: {(hovered.compassY ?? 0) > 0.1 ? "Conservative" : (hovered.compassY ?? 0) < -0.1 ? "Progressive" : "Center"}{" "}
                ({(hovered.compassY ?? 0) > 0 ? "+" : ""}{hovered.compassY?.toFixed(3)})
                {colorMode !== "none" && (() => {
                  const dev = getDeviation(hovered, colorMode, partyStatsRef.current);
                  const rawAlign = hovered.partyAlignmentByCategory?.[colorMode];
                  return dev !== null && rawAlign != null
                    ? <span> · {familyLabel}: {((1 - rawAlign) * 100).toFixed(0)}% cross-party (deviation: {(dev * 100).toFixed(0)}%)</span>
                    : null;
                })()}
              </span>
            )}
            <Link href={`/members/${hovered.bioguideId}`}>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary">View →</Button>
            </Link>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Hover to identify members · click to view profile · drag to pan · scroll to zoom
          </p>
        )}
      </div>

      {/* ── Quadrant legend cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 text-xs">
        {[
          { bg: QUAD_COLORS.topLeft,     darkBg: "#35382e", border: "rgba(196,140,110,0.25)", darkBorder: "rgba(196,140,110,0.20)", label: "Populist",       sub: "Economic left + socially conservative. State nationalism, protectionism, cultural restriction." },
          { bg: QUAD_COLORS.topRight,    darkBg: "#1b3b3d", border: "rgba(140,110,190,0.25)", darkBorder: "rgba(140,110,190,0.20)", label: "American Right", sub: "Economic right + socially conservative. Free markets, traditional values, low taxes." },
          { bg: QUAD_COLORS.bottomLeft,  darkBg: "#103c3f", border: "rgba(79,160,180,0.30)",  darkBorder: "rgba(79,160,180,0.20)",  label: "American Left",  sub: "Economic left + socially progressive. Redistribution, public programs, individual autonomy." },
          { bg: QUAD_COLORS.bottomRight, darkBg: "#174648", border: "rgba(80,120,180,0.25)",  darkBorder: "rgba(80,120,180,0.20)",  label: "Libertarian",    sub: "Economic right + socially progressive. Free markets, open society, minimal government." },
        ].map(q => (
          <div
            key={q.label}
            className="rounded-lg px-3 py-2"
            style={{ background: isLight ? q.bg : q.darkBg, border: `1px solid ${isLight ? q.border : q.darkBorder}` }}
          >
            <div className="font-semibold" style={{ color: isLight ? "#000" : "#cbecf5" }}>{q.label}</div>
            <div className="text-[10px] leading-relaxed mt-0.5" style={{ color: isLight ? "rgba(0,0,0,0.65)" : "rgba(203,236,245,0.65)" }}>{q.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Methodology ── */}
      <div
        className="border border-border/40 rounded-lg p-4 text-xs text-muted-foreground leading-relaxed mb-4"
        style={{ background: "rgba(0,0,0,0.02)" }}
      >
        <span className="font-semibold text-foreground">Methodology: </span>
        Ideology scores are generated by Claude Sonnet 4.6 from a structured prompt containing each
        member's full voting record (congresses 117–119), sponsored and cosponsored legislation,
        committee assignments, interest-group ratings (LCV, Planned Parenthood, NumbersUSA), and
        top PAC donor industries. Scores are calibrated against eight human-defined anchor members
        spanning the full ideological range, then equalized to spread the distribution across the
        complete scale. The <strong className="text-foreground">economic axis</strong> measures
        state intervention vs. free markets; the{" "}
        <strong className="text-foreground">social axis</strong> measures traditional/conservative
        vs. progressive/libertarian social values. <em>Color heterodoxy</em> shows how often a
        member votes against their party's majority on the selected issue area, computed
        deterministically from roll-call votes.
      </div>

      {/* ── Quiz CTA ── */}
      {!userPos && (
        <div
          className="border rounded-xl p-5 flex items-center justify-between gap-4"
          style={{ background: "rgba(120,80,180,0.04)", borderColor: "rgba(120,80,180,0.20)" }}
        >
          <div>
            <div className="font-semibold text-foreground mb-1">See where you land on this compass</div>
            <p className="text-sm text-muted-foreground">
              Take the 30-question quiz to place yourself on the same chart as every member of Congress.
            </p>
          </div>
          <Link href="/quiz">
            <Button className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
              <HelpCircle className="w-4 h-4 mr-1.5" />Take the Quiz
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
