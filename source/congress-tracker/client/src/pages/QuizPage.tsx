import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getCurrentMembers } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, RotateCcw, Map, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveQuizResult, type QuizResult } from "@/lib/quizStore";
import type { Member } from "@/lib/dataService";

/**
 * Axis system — matches the compass exactly:
 *   x (dim1): Economic Left (-1) ←→ Economic Right (+1)
 *             Left  = state control, redistribution, public ownership, protectionism
 *             Right = free markets, deregulation, low taxes, free trade
 *
 *   y (dim2): Social Progressive (-1) ←→ Social Conservative (+1)
 *             Bottom (-1) = progressive, individual autonomy, open society
 *             Top    (+1) = conservative, traditional values, cultural nationalism
 *
 * Scoring: category-weighted, empirically calibrated against member compassX/compassY.
 * Weights derived from Pearson correlations on policyFingerprint data (520 members),
 * blended 60% empirical / 40% conceptual for axis separation.
 * See scripts/calibrate_quiz.py and data/quiz-calibration.json.
 */

// Category weights: 40% empirical (Pearson correlations on 520 members) + 60% conceptual
// Conceptual weights are deliberately sharp to separate axes:
//   X-axis (economic): fiscal_tax, healthcare, environment, trade — near-zero Y contribution
//   Y-axis (social):   guns, social_rights, criminal_justice, immigration — near-zero X contribution
// This ensures libertarian (econ-right, social-prog) and populist (econ-left, social-con)
// users land in the correct off-diagonal quadrants.
const CATEGORY_WEIGHTS: Record<string, { wX: number; wY: number }> = {
  fiscal_tax:       { wX: 0.2498, wY: 0.0479 }, // primary economic signal
  healthcare:       { wX: 0.1837, wY: 0.0538 }, // economic system
  environment:      { wX: 0.1756, wY: 0.0969 }, // regulatory/economic
  trade:            { wX: 0.1182, wY: 0.0079 }, // pure economic (classical liberal)
  immigration:      { wX: 0.1088, wY: 0.2360 }, // mostly social
  guns:             { wX: 0.0669, wY: 0.2448 }, // primary social signal
  criminal_justice: { wX: 0.0545, wY: 0.1277 }, // mostly social
  social_rights:    { wX: 0.0181, wY: 0.1390 }, // pure social
  military_defense: { wX: 0.0243, wY: 0.0460 }, // weak both
};

interface Question {
  id: string;
  text: string;
  topic: string;
  category: keyof typeof CATEGORY_WEIGHTS;
  conservativeDirection: boolean; // true = "Strongly Agree" → more conservative (+X / +Y)
}

const QUESTIONS: Question[] = [
  // ── FISCAL & TAX (4) ──────────────────────────────────────────────────────
  {
    id: "f01",
    text: "The federal government should balance the budget primarily through spending cuts rather than tax increases.",
    topic: "Federal Spending",
    category: "fiscal_tax",
    conservativeDirection: true,
  },
  {
    id: "f02",
    text: "High-income earners and large corporations should pay more in federal taxes to fund social programs.",
    topic: "Progressive Taxation",
    category: "fiscal_tax",
    conservativeDirection: false,
  },
  {
    id: "f03",
    text: "Tax cuts for businesses and high earners are an effective way to stimulate lasting economic growth.",
    topic: "Tax Policy",
    category: "fiscal_tax",
    conservativeDirection: true,
  },
  {
    id: "f04",
    text: "The government should reduce spending on safety-net programs like Medicaid and food assistance rather than raising taxes to address the deficit.",
    topic: "Entitlement Spending",
    category: "fiscal_tax",
    conservativeDirection: true,
  },
  // ── HEALTHCARE (3) ────────────────────────────────────────────────────────
  {
    id: "h01",
    text: "The federal government should guarantee healthcare coverage for all Americans.",
    topic: "Universal Healthcare",
    category: "healthcare",
    conservativeDirection: false,
  },
  {
    id: "h02",
    text: "A competitive private health insurance market is preferable to a government-run healthcare system.",
    topic: "Private Insurance",
    category: "healthcare",
    conservativeDirection: true,
  },
  {
    id: "h03",
    text: "Government healthcare programs like Medicaid should be expanded to cover more low-income residents, including undocumented immigrants.",
    topic: "Medicaid Expansion",
    category: "healthcare",
    conservativeDirection: false,
  },
  // ── IMMIGRATION (5) ───────────────────────────────────────────────────────
  {
    id: "i01",
    text: "The United States should reduce overall levels of legal immigration.",
    topic: "Legal Immigration",
    category: "immigration",
    conservativeDirection: true,
  },
  {
    id: "i02",
    text: "Undocumented immigrants who commit crimes should be deported without the full due process protections afforded to citizens.",
    topic: "Deportation",
    category: "immigration",
    conservativeDirection: true,
  },
  {
    id: "i03",
    text: "Long-term undocumented residents who pay taxes and have no criminal record deserve a path to citizenship.",
    topic: "Path to Citizenship",
    category: "immigration",
    conservativeDirection: false,
  },
  {
    id: "i04",
    text: "State and local governments should be required to cooperate fully with federal immigration enforcement.",
    topic: "Sanctuary Cities",
    category: "immigration",
    conservativeDirection: true,
  },
  {
    id: "i05",
    text: "The US government should prioritize securing the border over interior enforcement against long-established undocumented residents.",
    topic: "Border vs. Interior",
    category: "immigration",
    conservativeDirection: false,
  },
  // ── ENVIRONMENT (5) ───────────────────────────────────────────────────────
  {
    id: "v01",
    text: "The government should set a strict cap on the total level of greenhouse gas emissions corporations are allowed to produce.",
    topic: "Emissions Cap",
    category: "environment",
    conservativeDirection: false,
  },
  {
    id: "v02",
    text: "Some environmental regulations should be cut in the interest of sustained economic growth and domestic energy production.",
    topic: "Deregulation",
    category: "environment",
    conservativeDirection: true,
  },
  {
    id: "v03",
    text: "The US should invest more in renewable energy and transition away from fossil fuels.",
    topic: "Renewable Energy",
    category: "environment",
    conservativeDirection: false,
  },
  {
    id: "v04",
    text: "The scientific evidence for human-caused climate change is overstated and does not justify major economic disruption.",
    topic: "Climate Skepticism",
    category: "environment",
    conservativeDirection: true,
  },
  // ── GUNS (3) ──────────────────────────────────────────────────────────────
  {
    id: "g02",
    text: "Law-abiding Americans have a fundamental constitutional right to own firearms without excessive government restriction.",
    topic: "2nd Amendment",
    category: "guns",
    conservativeDirection: true,
  },
  {
    id: "g03",
    text: "High-capacity magazines and military-style assault weapons should be banned for civilian use.",
    topic: "Assault Weapons",
    category: "guns",
    conservativeDirection: false,
  },
  {
    id: "g04",
    text: "Courts should be able to temporarily remove firearms from individuals deemed an imminent danger before they commit a crime.",
    topic: "Red Flag Laws",
    category: "guns",
    conservativeDirection: false,
  },
  // ── CRIMINAL JUSTICE (4) ──────────────────────────────────────────────────
  {
    id: "c01",
    text: "Recreational drug use should not be criminalized as long as it does not put others in danger.",
    topic: "Drug Decriminalization",
    category: "criminal_justice",
    conservativeDirection: false,
  },
  {
    id: "c02",
    text: "Law enforcement should receive increased funding to address violent crime.",
    topic: "Police Funding",
    category: "criminal_justice",
    conservativeDirection: true,
  },
  {
    id: "c03",
    text: "Tougher sentencing and stricter enforcement are the most effective tools for reducing violent crime.",
    topic: "Tough on Crime",
    category: "criminal_justice",
    conservativeDirection: true,
  },
  // ── SOCIAL RIGHTS (5) ─────────────────────────────────────────────────────
  {
    id: "r01",
    text: "Abortion access should be federally protected rather than left to individual states to decide.",
    topic: "Abortion",
    category: "social_rights",
    conservativeDirection: false,
  },
  {
    id: "r02",
    text: "Federal law should prohibit biological males from competing in women's sports at any level.",
    topic: "Women's Sports",
    category: "social_rights",
    conservativeDirection: true,
  },
  {
    id: "r03a",
    text: "Hormone therapy and puberty blockers for gender-dysphoric minors should be restricted by federal law.",
    topic: "Youth Gender Care — Hormones",
    category: "social_rights",
    conservativeDirection: true,
  },
  {
    id: "r04",
    text: "LGBTQ+ non-discrimination protections should be permanently enshrined in federal civil rights law.",
    topic: "LGBTQ+ Rights",
    category: "social_rights",
    conservativeDirection: false,
  },
  // ── MILITARY & DEFENSE (3) ────────────────────────────────────────────────
  {
    id: "m01",
    text: "The United States should maintain or increase its current level of military spending.",
    topic: "Defense Spending",
    category: "military_defense",
    conservativeDirection: true,
  },
  {
    id: "m02",
    text: "Supporting allies with military and financial aid is a core responsibility of US foreign policy.",
    topic: "Foreign Alliances",
    category: "military_defense",
    conservativeDirection: true,
  },
  {
    id: "m03",
    text: "Congress should continue providing substantial financial and military support to Ukraine.",
    topic: "Ukraine Aid",
    category: "military_defense",
    conservativeDirection: false,
  },
  // ── TRADE (3) ─────────────────────────────────────────────────────────────
  // Classical liberal framing: free trade = economic right (+X)
  {
    id: "t01",
    text: "The US should pursue free trade agreements that reduce tariffs and open international markets.",
    topic: "Free Trade",
    category: "trade",
    conservativeDirection: true,
  },
  {
    id: "t02",
    text: "The government should impose broad tariffs on imports — including from allied countries — to protect American jobs and industries.",
    topic: "Tariffs",
    category: "trade",
    conservativeDirection: false,
  },
  {
    id: "t03",
    text: "The government should use industrial policy and subsidies to build up strategic domestic industries rather than relying on global markets.",
    topic: "Industrial Policy",
    category: "trade",
    conservativeDirection: false,
  },
];

const OPTIONS = [
  { value: 2,  label: "Strongly Agree" },
  { value: 1,  label: "Agree" },
  { value: 0,  label: "Neutral / No opinion" },
  { value: -1, label: "Disagree" },
  { value: -2, label: "Strongly Disagree" },
];

function computeScores(answers: Record<string, number>): QuizResult {
  // Accumulate oriented responses per category
  const catSums: Record<string, number> = {};
  const catCounts: Record<string, number> = {};
  for (const q of QUESTIONS) {
    const ans = answers[q.id];
    if (ans === undefined) continue;
    // Orient: conservativeDirection=true → agree pushes +; false → agree pushes −
    const oriented = q.conservativeDirection ? ans : -ans;
    catSums[q.category]   = (catSums[q.category]   ?? 0) + oriented;
    catCounts[q.category] = (catCounts[q.category] ?? 0) + 1;
  }
  // Weighted sum: catScore = sum / (2 * n) normalises to [-1, +1]
  const categoryScores: Record<string, number> = {};
  let x = 0, y = 0;
  for (const [cat, sum] of Object.entries(catSums)) {
    const n = catCounts[cat];
    const catScore = sum / (2 * n); // [-1, +1]
    categoryScores[cat] = catScore;
    const w = CATEGORY_WEIGHTS[cat];
    if (!w) continue;
    x += w.wX * catScore;
    y += w.wY * catScore;
  }
  return {
    dim1: Math.max(-1, Math.min(1, x)), // economic left(-) / right(+)
    dim2: Math.max(-1, Math.min(1, y)), // social progressive(-) / conservative(+)
    categoryScores,
  };
}

function getQuadrantLabel(x: number, y: number): string {
  if (x < -0.15 && y >  0.15) return "Communitarian Conservative";
  if (x >  0.15 && y >  0.15) return "American Right";
  if (x < -0.15 && y < -0.15) return "American Left";
  if (x >  0.15 && y < -0.15) return "Libertarian";
  if (Math.abs(x) < 0.15 && Math.abs(y) < 0.15) return "Centrist";
  if (x < -0.15) return "Economic Left";
  if (x >  0.15) return "Economic Right";
  if (y >  0.15) return "Social Conservative";
  return "Socially Progressive";
}

function getQuadrantDescription(x: number, y: number): string {
  if (x < -0.15 && y >  0.15)
    return "You sit in the Communitarian Conservative quadrant: state-directed economics combined with socially conservative or nationalist values. This maps to economic nationalism — tariffs, industrial policy, strict immigration controls — alongside traditional or majoritarian social views.";
  if (x >  0.15 && y >  0.15)
    return "You sit in the American Right quadrant: free market economics alongside socially conservative values. This is the classic conservative position — lower taxes, less regulation, free trade, and traditional social norms including religion in public life.";
  if (x < -0.15 && y < -0.15)
    return "You sit in the American Left quadrant: state-directed economics alongside progressive social values. This maps to social democratic or democratic socialist politics — universal public services, redistribution, and a strongly open, inclusive society.";
  if (x >  0.15 && y < -0.15)
    return "You sit in the libertarian quadrant: free market economics alongside progressive social views. You see government's role as protecting individual rights from both state overreach and private coercion — open markets, open society, minimal state interference in personal life.";
  return "Your views span multiple dimensions — you may be a pragmatic centrist, or your positions cut across the standard left-right divides in ways that don't fit neatly into any quadrant.";
}

function ResultCompassSVG({ x, y, allMembers }: { x: number; y: number; allMembers: Member[] }) {
  // viewBox 300×225 (4:3), center at (150, 112)
  // x: economic left(-) to right(+) → horizontal
  // y: social progressive(-) to conservative(+) → conservative = TOP
  const W = 300, H = 225, cx = 150, cy = 112;
  const scaleX = 120, scaleY = 90;
  const toCanvasX = (v: number) => Math.max(8, Math.min(W - 8, cx + v * scaleX));
  const toCanvasY = (v: number) => Math.max(8, Math.min(H - 8, cy - v * scaleY));
  const ux = toCanvasX(x);
  const uy = toCanvasY(y);

  return (
    <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ display: "block" }}>
        {/* Quadrant backgrounds */}
        <rect x="0"   y="0"   width={cx} height={cy} fill="rgba(239,123,69,0.10)" />
        <rect x={cx}  y="0"   width={cx} height={cy} fill="rgba(205,237,246,0.06)" />
        <rect x="0"   y={cy}  width={cx} height={H - cy} fill="rgba(94,177,191,0.10)" />
        <rect x={cx}  y={cy}  width={cx} height={H - cy} fill="rgba(94,177,191,0.14)" />
        {/* Grid */}
        {[-0.75, -0.5, -0.25, 0.25, 0.5, 0.75].map((v) => (
          <g key={v}>
            <line x1={cx + v * scaleX} y1="6" x2={cx + v * scaleX} y2={H - 6} stroke="rgba(94,177,191,0.15)" strokeWidth="0.5" />
            <line x1="6" y1={cy - v * scaleY} x2={W - 6} y2={cy - v * scaleY} stroke="rgba(94,177,191,0.15)" strokeWidth="0.5" />
          </g>
        ))}
        {/* Axes */}
        <line x1="8" y1={cy} x2={W - 8} y2={cy} stroke="rgba(94,177,191,0.55)" strokeWidth="1.5" />
        <line x1={cx} y1="8" x2={cx} y2={H - 8} stroke="rgba(94,177,191,0.55)" strokeWidth="1.5" />
        {/* Corner labels */}
        <text x="8"     y="11"    fontSize="5.5" fill="rgba(239,123,69,0.7)"  fontFamily="Cabinet Grotesk,Satoshi,sans-serif" fontWeight="bold">POPULIST LEFT</text>
        <text x={W - 8} y="11"    fontSize="5.5" fill="rgba(205,237,246,0.5)" fontFamily="Cabinet Grotesk,Satoshi,sans-serif" fontWeight="bold" textAnchor="end">TRAD. RIGHT</text>
        <text x="8"     y={H - 4} fontSize="5.5" fill="rgba(94,177,191,0.7)"  fontFamily="Cabinet Grotesk,Satoshi,sans-serif" fontWeight="bold">PROGRESSIVE LEFT</text>
        <text x={W - 8} y={H - 4} fontSize="5.5" fill="rgba(94,177,191,0.7)"  fontFamily="Cabinet Grotesk,Satoshi,sans-serif" fontWeight="bold" textAnchor="end">LIBERTARIAN</text>
        {/* Axis labels */}
        <text x="10"    y={cy - 3} fontSize="6" fill="rgba(205,237,246,0.55)" fontFamily="Satoshi,sans-serif">← Econ Left</text>
        <text x={W - 10} y={cy - 3} fontSize="6" fill="rgba(205,237,246,0.55)" fontFamily="Satoshi,sans-serif" textAnchor="end">Econ Right →</text>
        <text x={cx} y="20" fontSize="6" fill="rgba(205,237,246,0.55)" fontFamily="Satoshi,sans-serif" textAnchor="middle">↑ Conservative</text>
        <text x={cx} y={H - 6} fontSize="6" fill="rgba(205,237,246,0.55)" fontFamily="Satoshi,sans-serif" textAnchor="middle">↓ Progressive</text>
        {/* Congress member dots */}
        {allMembers.slice(0, 60).map((m) => {
          if (m.compassX == null || m.compassY == null) return null;
          const rgb = m.party === "Democrat" ? "94,177,191" : m.party === "Republican" ? "216,71,39" : "239,123,69";
          return <circle key={m.bioguideId} cx={toCanvasX(m.compassX)} cy={toCanvasY(m.compassY)} r="2.5" fill={`rgba(${rgb},0.40)`} />;
        })}
        {/* User dot */}
        <circle cx={ux} cy={uy} r="14" fill="rgba(239,123,69,0.18)" />
        <circle cx={ux} cy={uy} r="6"  fill="#ef7b45" stroke="rgba(205,237,246,0.8)" strokeWidth="2" />
        <text
          x={ux + (ux > cx ? -10 : 10)}
          y={uy - 9}
          fontSize="7" fontWeight="bold" fill="#ef7b45"
          fontFamily="Cabinet Grotesk, Satoshi, sans-serif"
          textAnchor={ux > cx ? "end" : "start"}
        >You</text>
      </svg>
    </div>
  );
}

export default function QuizPage() {
  const [isLight, setIsLight] = useState(() => document.documentElement.classList.contains("light"));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.classList.contains("light")));
    obs.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const panelBg = isLight ? "#f2fafd" : "rgba(4,42,43,0.6)";

  const [step, setStep]       = useState<"intro" | "quiz" | "result">("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result,  setResult]  = useState<{ dim1: number; dim2: number } | null>(null);

  const { data: allMembers } = useQuery({
    queryKey: ["compass-members", "all"],
    queryFn: () => getCurrentMembers(),
    enabled: step === "result",
  });

  function answer(value: number) {
    const q = QUESTIONS[current];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (current < QUESTIONS.length - 1) setCurrent(c => c + 1);
    else finishQuiz(next);
  }

  function finishQuiz(final: Record<string, number>) {
    const scores = computeScores(final);
    setResult(scores);
    setStep("result");
    saveQuizResult(scores);
    window.umami?.track("quiz_completed", {
      quadrant: getQuadrantLabel(scores.dim1, scores.dim2),
      economic: scores.dim1 > 0.1 ? "right" : scores.dim1 < -0.1 ? "left" : "center",
      social: scores.dim2 > 0.1 ? "conservative" : scores.dim2 < -0.1 ? "progressive" : "center",
    });
  }

  function restart() {
    setStep("intro"); setCurrent(0); setAnswers({}); setResult(null);
  }

  const [downloaded, setDownloaded] = useState(false);
  const sharingRef = useRef(false);

  async function buildShareImage(): Promise<Blob> {
    // Canvas is 2× for sharpness on retina screens
    const W = 1200, H = 560;
    const canvas = document.createElement("canvas");
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    // ── Palette ───────────────────────────────────────────────────────
    const bg        = isLight ? "#cdedf6"              : "#083f41";
    const panelBg   = isLight ? "#f2fafd"              : "rgba(4,42,43,0.85)";
    const panelBdr  = isLight ? "rgba(9,91,93,0.18)"   : "rgba(94,177,191,0.22)";
    const fg        = isLight ? "#083f41"              : "#cdedf6";
    const fgMuted   = isLight ? "rgba(8,63,65,0.55)"   : "rgba(205,237,246,0.55)";
    const fgDim     = isLight ? "rgba(8,63,65,0.35)"   : "rgba(205,237,246,0.35)";
    const axisColor = isLight ? "rgba(9,91,93,0.5)"    : "rgba(94,177,191,0.6)";
    const gridColor = isLight ? "rgba(9,91,93,0.1)"    : "rgba(94,177,191,0.13)";
    const rowBg     = isLight ? "rgba(9,91,93,0.05)"   : "rgba(94,177,191,0.07)";
    const divider   = isLight ? "rgba(9,91,93,0.15)"   : "rgba(94,177,191,0.25)";
    const brand     = isLight ? "rgba(9,91,93,0.3)"    : "rgba(94,177,191,0.4)";

    function roundRect(x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      if (fill)   { ctx.fillStyle = fill;     ctx.fill();   }
      if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Header bar
    const HDR = 44;
    ctx.fillStyle = isLight ? "rgba(9,91,93,0.06)" : "rgba(4,42,43,0.5)";
    ctx.fillRect(0, 0, W, HDR);
    ctx.font = "bold 12px sans-serif"; ctx.fillStyle = brand; ctx.textAlign = "left";
    ctx.fillText("CIVICISM  ·  POLITICAL PLACEMENT QUIZ", 24, 27);
    ctx.textAlign = "right"; ctx.fillText("civicism.us", W - 24, 27);

    // Thin header bottom border
    ctx.strokeStyle = divider; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, HDR); ctx.lineTo(W, HDR); ctx.stroke();

    // ── Layout: two panels side by side ───────────────────────────────
    const PAD = 20;           // outer padding
    const GAP = 16;           // gap between panels
    const PY  = HDR + PAD;   // panel top y
    const PH  = H - PY - PAD; // panel height
    const PW  = (W - PAD * 2 - GAP) / 2; // each panel width
    const LX  = PAD;          // left panel x
    const RX  = PAD + PW + GAP; // right panel x
    const R   = 10;           // corner radius

    // Panel backgrounds
    roundRect(LX, PY, PW, PH, R, panelBg, panelBdr);
    roundRect(RX, PY, PW, PH, R, panelBg, panelBdr);

    // ── LEFT PANEL: Compass ───────────────────────────────────────────
    const INNER_PAD = 16;
    const CX = LX + INNER_PAD, CY = PY + INNER_PAD;
    const CW = PW - INNER_PAD * 2, CH = PH - INNER_PAD * 2;
    const ccx = CX + CW / 2, ccy = CY + CH / 2;
    const scaleX = CW / 2 * 0.86, scaleY = CH / 2 * 0.86;
    const toX = (v: number) => Math.max(CX + 6, Math.min(CX + CW - 6, ccx + v * scaleX));
    const toY = (v: number) => Math.max(CY + 6, Math.min(CY + CH - 6, ccy - v * scaleY));

    // Clip compass drawing to panel
    ctx.save();
    ctx.beginPath(); ctx.roundRect(LX + 1, PY + 1, PW - 2, PH - 2, R - 1); ctx.clip();

    // Quadrant fills
    const qa = isLight ? 0.16 : 0.12;
    ctx.fillStyle = `rgba(239,123,69,${qa})`;   ctx.fillRect(CX, CY, CW/2, CH/2);
    ctx.fillStyle = isLight ? "rgba(9,91,93,0.07)" : "rgba(205,237,246,0.06)";
                                                 ctx.fillRect(ccx, CY, CW/2, CH/2);
    ctx.fillStyle = `rgba(94,177,191,${qa})`;   ctx.fillRect(CX, ccy, CW/2, CH/2);
    ctx.fillStyle = isLight ? "rgba(94,177,191,0.2)" : "rgba(94,177,191,0.16)";
                                                 ctx.fillRect(ccx, ccy, CW/2, CH/2);

    // Grid
    ctx.strokeStyle = gridColor; ctx.lineWidth = 0.6;
    [-0.75,-0.5,-0.25,0.25,0.5,0.75].forEach(v => {
      ctx.beginPath(); ctx.moveTo(toX(v), CY+4); ctx.lineTo(toX(v), CY+CH-4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX+4, toY(v)); ctx.lineTo(CX+CW-4, toY(v)); ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = axisColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(CX+6, ccy); ctx.lineTo(CX+CW-6, ccy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ccx, CY+6); ctx.lineTo(ccx, CY+CH-6); ctx.stroke();

    // Corner labels
    const quadLabelColor = isLight ? "rgba(9,91,93,0.65)" : "rgba(94,177,191,0.7)";
    ctx.font = "bold 8px sans-serif";
    ctx.fillStyle = "rgba(239,123,69,0.8)"; ctx.textAlign = "left";  ctx.fillText("POPULIST LEFT",  CX+6, CY+12);
    ctx.fillStyle = fgMuted;                ctx.textAlign = "right"; ctx.fillText("TRAD. RIGHT",    CX+CW-6, CY+12);
    ctx.fillStyle = quadLabelColor;         ctx.textAlign = "left";  ctx.fillText("PROG. LEFT",     CX+6, CY+CH-4);
    ctx.fillStyle = quadLabelColor;         ctx.textAlign = "right"; ctx.fillText("LIBERTARIAN",    CX+CW-6, CY+CH-4);

    // Axis labels
    ctx.font = "8px sans-serif"; ctx.fillStyle = fgMuted;
    ctx.textAlign = "left";   ctx.fillText("← Econ Left",    CX+8,    ccy-3);
    ctx.textAlign = "right";  ctx.fillText("Econ Right →",   CX+CW-8, ccy-3);
    ctx.textAlign = "center"; ctx.fillText("↑ Conservative", ccx,     CY+22);
    ctx.textAlign = "center"; ctx.fillText("↓ Progressive",  ccx,     CY+CH-6);

    // Member dots
    if (allMembers) {
      allMembers.slice(0, 100).forEach(m => {
        if (m.compassX == null || m.compassY == null) return;
        const rgb = m.party === "Democrat" ? "94,177,191" : m.party === "Republican" ? "216,71,39" : "239,123,69";
        ctx.beginPath(); ctx.arc(toX(m.compassX), toY(m.compassY), 2.5, 0, Math.PI*2);
        ctx.fillStyle = `rgba(${rgb},0.42)`; ctx.fill();
      });
    }

    // User dot
    const ux = toX(result!.dim1), uy = toY(result!.dim2);
    ctx.beginPath(); ctx.arc(ux, uy, 14, 0, Math.PI*2);
    ctx.fillStyle = "rgba(239,123,69,0.2)"; ctx.fill();
    ctx.beginPath(); ctx.arc(ux, uy, 6, 0, Math.PI*2);
    ctx.fillStyle = "#ef7b45"; ctx.fill();
    ctx.strokeStyle = isLight ? "rgba(8,63,65,0.75)" : "rgba(205,237,246,0.9)";
    ctx.lineWidth = 2; ctx.stroke();
    ctx.font = "bold 10px sans-serif"; ctx.fillStyle = "#ef7b45";
    ctx.textAlign = ux > ccx ? "right" : "left";
    ctx.fillText("You", ux + (ux > ccx ? -10 : 10), uy - 10);

    ctx.restore(); // end compass clip

    // Left panel title
    ctx.font = "bold 11px sans-serif"; ctx.fillStyle = fgDim; ctx.textAlign = "left";
    ctx.fillText("YOUR POSITION", LX + INNER_PAD, PY + PH - 10);

    // ── RIGHT PANEL: Results ──────────────────────────────────────────
    const quadrant  = getQuadrantLabel(result!.dim1, result!.dim2);
    const econDir   = result!.dim1 > 0.1 ? "Right" : result!.dim1 < -0.1 ? "Left" : "Center";
    const socialDir = result!.dim2 > 0.1 ? "Conservative" : result!.dim2 < -0.1 ? "Progressive" : "Center";
    const econVal   = `${result!.dim1 > 0 ? "+" : ""}${result!.dim1.toFixed(2)}`;
    const socialVal = `${result!.dim2 > 0 ? "+" : ""}${result!.dim2.toFixed(2)}`;

    let ry = PY + INNER_PAD + 16;

    // Quadrant label
    ctx.font = "bold 26px sans-serif"; ctx.fillStyle = fg; ctx.textAlign = "left";
    ctx.fillText(quadrant, RX + INNER_PAD, ry);
    ry += 8;

    // Score pills
    const pills = [
      { label: "Econ", dir: econDir, val: econVal },
      { label: "Social", dir: socialDir, val: socialVal },
    ];
    pills.forEach(({ label, dir, val }) => {
      ry += 26;
      ctx.font = "11px sans-serif"; ctx.fillStyle = fgDim; ctx.textAlign = "left";
      ctx.fillText(label, RX + INNER_PAD, ry);
      ctx.font = "bold 11px sans-serif"; ctx.fillStyle = fg;
      ctx.fillText(`${dir}  `, RX + INNER_PAD + 42, ry);
      ctx.font = "11px sans-serif"; ctx.fillStyle = fgMuted;
      const dirW = ctx.measureText(`${dir}  `).width;
      ctx.fillText(val, RX + INNER_PAD + 42 + dirW, ry);
    });

    ry += 20;
    ctx.strokeStyle = divider; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(RX + INNER_PAD, ry); ctx.lineTo(RX + PW - INNER_PAD, ry); ctx.stroke();
    ry += 18;

    // Section header
    ctx.font = "bold 10px sans-serif"; ctx.fillStyle = fgDim; ctx.textAlign = "left";
    ctx.fillText("CLOSEST MEMBERS OF CONGRESS", RX + INNER_PAD, ry);
    ry += 14;

    // Member rows
    closestMembers.slice(0, 5).forEach((m, i) => {
      const rowH = 36;
      const rowY = ry + i * rowH;
      const partyColor = m.party === "Democrat" ? "#5eb1bf" : m.party === "Republican" ? "#d84727" : "#ef7b45";
      const partyLetter = m.party === "Democrat" ? "D" : m.party === "Republican" ? "R" : "I";
      const dist = Math.sqrt((m.compassX! - result!.dim1)**2 + (m.compassY! - result!.dim2)**2).toFixed(3);

      // Row bg
      roundRect(RX + INNER_PAD - 4, rowY + 2, PW - INNER_PAD * 2 + 8, rowH - 4, 5, rowBg);

      // Index
      ctx.font = "11px sans-serif"; ctx.fillStyle = fgDim; ctx.textAlign = "right";
      ctx.fillText(`${i+1}.`, RX + INNER_PAD + 14, rowY + 22);

      // Party badge
      roundRect(RX + INNER_PAD + 18, rowY + 9, 18, 18, 3, partyColor + "33");
      ctx.font = "bold 10px sans-serif"; ctx.fillStyle = partyColor; ctx.textAlign = "center";
      ctx.fillText(partyLetter, RX + INNER_PAD + 27, rowY + 22);

      // Name + state
      ctx.font = "bold 12px sans-serif"; ctx.fillStyle = fg; ctx.textAlign = "left";
      ctx.fillText(m.displayName, RX + INNER_PAD + 42, rowY + 19);
      ctx.font = "10px sans-serif"; ctx.fillStyle = fgMuted;
      ctx.fillText(m.state, RX + INNER_PAD + 42, rowY + 31);

      // Distance
      ctx.font = "10px sans-serif"; ctx.fillStyle = fgDim; ctx.textAlign = "right";
      ctx.fillText(dist, RX + PW - INNER_PAD, rowY + 22);
    });

    return new Promise(resolve => canvas.toBlob(b => resolve(b!), "image/png"));
  }

  async function handleShare() {
    if (!result || sharingRef.current) return;
    sharingRef.current = true;
    const quadrant = getQuadrantLabel(result.dim1, result.dim2);
    let method = "download";
    try {
      const blob = await buildShareImage();
      // Only use native share on mobile where it works well with image files.
      // navigator.canShare returns true on desktop Chrome but the UX is poor there.
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      const file = new File([blob], "civicism-quiz-result.png", { type: "image/png" });
      if (isMobile && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Civicism Quiz Result", text: `I landed in the ${quadrant} quadrant — civicism.us` });
        method = "native_share";
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "civicism-quiz-result.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 2500);
      }
    } catch {
      // share dismissed or failed — no-op
    } finally {
      sharingRef.current = false;
    }
    window.umami?.track("quiz_shared", { quadrant, method });
  }

  function getRankedMembers(): { closest: Member[]; furthest: Member[] } {
    if (!result || !allMembers) return { closest: [], furthest: [] };
    const sorted = [...allMembers]
      .filter((m: Member) => m.compassX != null && m.compassY != null)
      .sort((a: Member, b: Member) => {
        const da = Math.sqrt((a.compassX! - result.dim1) ** 2 + (a.compassY! - result.dim2) ** 2);
        const db = Math.sqrt((b.compassX! - result.dim1) ** 2 + (b.compassY! - result.dim2) ** 2);
        return da - db;
      });
    return { closest: sorted.slice(0, 5), furthest: sorted.slice(-5).reverse() };
  }

  const { closest: closestMembers, furthest: furthestMembers } = getRankedMembers();
  const q = QUESTIONS[current];
  const progress = Math.round((current / QUESTIONS.length) * 100);

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (step === "intro") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(94,177,191,0.15)" }}>
          <Map className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">Political Placement Quiz</h1>
        <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
          {QUESTIONS.length} questions across 9 policy areas. Your results will be plotted on the same two-axis compass as every member of Congress.
        </p>
        <div className="border border-border rounded-xl p-5 mb-8 text-left text-sm space-y-4" style={{ background: panelBg }}>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                axis: "↔\uFE0E Economic Axis",
                left: "Left: state ownership, redistribution, industrial policy, public services",
                right: "Right: free markets, deregulation, free trade, low taxes",
              },
              {
                axis: "↕\uFE0E Social Axis",
                left: "Bottom: individual autonomy, LGBTQ+ rights, open society, secularism",
                right: "Top: traditional values, cultural nationalism, religion in public life",
              },
            ].map(({ axis, left, right }) => (
              <div key={axis} className="border border-border/60 rounded-lg p-3">
                <div className="font-semibold text-foreground mb-2">{axis}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{left}</p>
                  <p>{right}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { q: "Top-Left",  label: "Communitarian Conservative", c: "rgba(239,123,69,0.15)",                   lc: "rgba(239,123,69,0.15)",  b: "rgba(239,123,69,0.4)",  lb: "rgba(239,123,69,0.4)" },
              { q: "Top-Right", label: "American Right",       c: "rgba(205,237,246,0.08)",                  lc: "#eff0f9",                b: "rgba(205,237,246,0.3)", lb: "#d7d1ea" },
              { q: "Bot-Left",  label: "American Left",        c: "rgba(94,177,191,0.12)",                   lc: "#d9eef2",                b: "rgba(94,177,191,0.5)",  lb: "#b3d7df" },
              { q: "Bot-Right", label: "Libertarian",         c: "rgba(94,177,191,0.18)",                   lc: "#dce6f4",                b: "rgba(94,177,191,0.6)",  lb: "#bbcce4" },
            ].map(({ q: pos, label, c, lc, b, lb }) => (
              <div key={pos} className="rounded-md p-2" style={{ background: isLight ? lc : c, border: `1px solid ${isLight ? lb : b}` }}>
                <div className="text-[10px] text-muted-foreground">{pos}</div>
                <div className="font-semibold text-foreground text-[11px]">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground italic border-t border-border/60 pt-3">
            Your result places you on the same compass as every current member of Congress so you can see who shares your combination of economic and social views.
          </p>
        </div>
        <Button
          className="text-base px-8 py-3 h-auto bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setStep("quiz")}
        >
          Start
        </Button>
      </div>
    );
  }

  // ─── RESULT ───────────────────────────────────────────────────────────────
  if (step === "result" && result) {
    const label = getQuadrantLabel(result.dim1, result.dim2);
    const description = getQuadrantDescription(result.dim1, result.dim2);
    const econDir  = result.dim1 > 0.1 ? "Right" : result.dim1 < -0.1 ? "Left" : "Center";
    const socialDir = result.dim2 > 0.1 ? "Conservative" : result.dim2 < -0.1 ? "Progressive" : "Center";

    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-center">Your Result</h1>
        <p className="text-muted-foreground text-center mb-8 text-sm">Based on {Object.keys(answers).length} answers</p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="border border-border rounded-xl p-5" style={{ background: panelBg }}>
            <h2 className="font-bold mb-4 text-foreground">Your Position</h2>
            <ResultCompassSVG x={result.dim1} y={result.dim2} allMembers={allMembers || []} />
            <div className="text-center mt-4">
              <div className="text-xl font-extrabold text-foreground">{label}</div>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Econ: <span className="text-foreground font-medium">{econDir}</span> ({result.dim1 > 0 ? "+" : ""}{result.dim1.toFixed(3)})</span>
                <span>Social: <span className="text-foreground font-medium">{socialDir}</span> ({result.dim2 > 0 ? "+" : ""}{result.dim2.toFixed(3)})</span>
              </div>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed px-2">{description}</p>
            </div>
          </div>

          <div className="border border-border rounded-xl p-5" style={{ background: panelBg }}>
            {closestMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading matches…</p>
            ) : (
              <>
                {/* Closest */}
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-foreground text-sm">Closest Members</h2>
                  <span className="text-xs text-muted-foreground">Distance</span>
                </div>
                <div className="space-y-0.5 mb-4">
                  {closestMembers.map((m, i) => {
                    const dist = Math.sqrt((m.compassX! - result.dim1) ** 2 + (m.compassY! - result.dim2) ** 2).toFixed(3);
                    const partyColor = m.party === "Democrat" ? "rgb(94,177,191)" : m.party === "Republican" ? "rgb(216,71,39)" : "rgb(239,123,69)";
                    return (
                      <Link key={m.bioguideId} href={`/members/${m.bioguideId}`}>
                        <div className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-primary/10 cursor-pointer transition-colors">
                          <span className="text-xs text-muted-foreground w-4 text-right tabular-nums">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground">{m.displayName}</span>
                            <span className="text-xs ml-1.5 font-semibold" style={{ color: partyColor }}>
                              {m.party === "Democrat" ? "D" : m.party === "Republican" ? "R" : "I"}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">· {m.state}</span>
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{dist}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {/* Furthest */}
                <div className="flex items-center justify-between mb-2 border-t border-border/40 pt-3">
                  <h2 className="font-bold text-foreground text-sm">Furthest Members</h2>
                  <span className="text-xs text-muted-foreground">Distance</span>
                </div>
                <div className="space-y-0.5">
                  {furthestMembers.map((m, i) => {
                    const dist = Math.sqrt((m.compassX! - result.dim1) ** 2 + (m.compassY! - result.dim2) ** 2).toFixed(3);
                    const partyColor = m.party === "Democrat" ? "rgb(94,177,191)" : m.party === "Republican" ? "rgb(216,71,39)" : "rgb(239,123,69)";
                    return (
                      <Link key={m.bioguideId} href={`/members/${m.bioguideId}`}>
                        <div className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-primary/10 cursor-pointer transition-colors">
                          <span className="text-xs text-muted-foreground w-4 text-right tabular-nums">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground">{m.displayName}</span>
                            <span className="text-xs ml-1.5 font-semibold" style={{ color: partyColor }}>
                              {m.party === "Democrat" ? "D" : m.party === "Republican" ? "R" : "I"}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">· {m.state}</span>
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{dist}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/compass">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Map className="w-4 h-4 mr-1.5" /> See on Full Compass
            </Button>
          </Link>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-1.5" /> {downloaded ? "Saved!" : "Share Result"}
          </Button>
          <Button variant="outline" onClick={restart}>
            <RotateCcw className="w-4 h-4 mr-1.5" /> Retake
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Your result is active for this browser session. Visit{" "}
          <Link href="/compass" className="underline underline-offset-2">the compass</Link>{" "}
          to see your orange dot alongside all 538 members.
        </p>
      </div>
    );
  }

  // ─── QUIZ QUESTION ────────────────────────────────────────────────────────
  const ECONOMIC_CATS = new Set(["fiscal_tax", "healthcare", "environment", "trade"]);
  const isEconomic = ECONOMIC_CATS.has(q.category);
  const sectionLabel = isEconomic ? "Economic" : "Social";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Question {current + 1} <span className="text-muted-foreground">of {QUESTIONS.length}</span>
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: isEconomic ? "rgba(239,123,69,0.15)" : "rgba(94,177,191,0.15)",
                     color: isEconomic ? "#ef7b45" : "#5eb1bf" }}>
            {sectionLabel} · {q.topic}
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="border border-border rounded-xl p-8 mb-6" style={{ background: panelBg }}>
        <p className="text-lg font-bold text-foreground leading-relaxed text-center mb-8">
          "{q.text}"
        </p>
        <div className="grid grid-cols-1 gap-2">
          {OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="outline"
              className={cn(
                "h-12 text-sm justify-start px-5 transition-all",
                "hover:border-primary/50 hover:bg-primary/5",
                answers[q.id] === opt.value && "border-primary bg-primary/10 text-primary"
              )}
              onClick={() => answer(opt.value)}
              data-testid={`button-answer-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost" size="sm"
          disabled={current === 0}
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        {answers[q.id] !== undefined && (
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              if (current < QUESTIONS.length - 1) setCurrent(c => c + 1);
              else finishQuiz(answers);
            }}
            className="text-muted-foreground"
          >
            {current === QUESTIONS.length - 1 ? "Finish" : "Skip"} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
