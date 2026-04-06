import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQuizResult, type QuizResult } from "@/lib/quizStore";
import { Button } from "@/components/ui/button";
import { ScrollText, HelpCircle, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Matches the category weights from QuizPage.tsx — dominant axis determines lean label
const CATEGORY_AXIS: Record<string, "economic" | "social"> = {
  fiscal_tax:       "economic",
  healthcare:       "economic",
  environment:      "economic",
  trade:            "economic",
  immigration:      "social",
  guns:             "social",
  criminal_justice: "social",
  social_rights:    "social",
  military_defense: "social",
};

const CATEGORY_LABELS: Record<string, string> = {
  fiscal_tax:       "Fiscal & Tax",
  healthcare:       "Healthcare",
  environment:      "Environment",
  trade:            "Trade",
  immigration:      "Immigration",
  guns:             "Guns",
  criminal_justice: "Criminal Justice",
  social_rights:    "Social Rights",
  military_defense: "Military & Defense",
};

interface BallotMeasure {
  id: string;
  state: string;
  stateCode: string;
  year: number;
  title: string;
  summary: string;
  category: string;
  partisan: boolean;
  conservativeDirection: boolean;
  type: string;
  status: string;
  electionDate: string;
  // Enrichment fields (added by enrich_ballot_measures.py)
  econScore?: number | null;
  socialScore?: number | null;
  econReasoning?: string | null;
  socialReasoning?: string | null;
  framingFlag?: string | null;
  framingNote?: string | null;
}

function getDataBase(): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return base || "";
}

function getLeanLabel(measure: BallotMeasure): { label: string; conservative: boolean; nonpartisan: boolean } {
  if (!measure.partisan) {
    return { label: "Nonpartisan", conservative: false, nonpartisan: true };
  }

  // Use actual scores when available — pick the axis with the stronger signal
  if (measure.econScore != null && measure.socialScore != null) {
    const econAbs   = Math.abs(measure.econScore);
    const socialAbs = Math.abs(measure.socialScore);
    if (socialAbs >= econAbs) {
      const conservative = measure.socialScore > 0;
      return { label: conservative ? "Socially Conservative" : "Socially Progressive", conservative, nonpartisan: false };
    } else {
      const conservative = measure.econScore > 0;
      return { label: conservative ? "Fiscally Conservative" : "Fiscally Progressive", conservative, nonpartisan: false };
    }
  }

  // Fallback: original category-axis + conservativeDirection logic
  const axis = CATEGORY_AXIS[measure.category] ?? "social";
  const conservative = measure.conservativeDirection;
  if (axis === "economic") {
    return { label: conservative ? "Fiscally Conservative" : "Fiscally Progressive", conservative, nonpartisan: false };
  }
  return { label: conservative ? "Socially Conservative" : "Socially Progressive", conservative, nonpartisan: false };
}

const PRIORITY_THRESHOLD = 0.3; // strong opinion on this category

function getAlignment(
  measure: BallotMeasure,
  quizResult: QuizResult | null
): { label: string; match: boolean | null } | null {
  if (!quizResult) return null;

  // Use two-axis ideology scores when available
  if (measure.econScore != null && measure.socialScore != null) {
    const econDiff   = quizResult.dim1 - measure.econScore;
    const socialDiff = quizResult.dim2 - measure.socialScore;

    // Weight the primary axis for this category more heavily
    const econWeight   = CATEGORY_AXIS[measure.category] === "economic" ? 1.0 : 0.4;
    const socialWeight = CATEGORY_AXIS[measure.category] === "social"   ? 1.0 : 0.4;

    // Weighted Euclidean distance, normalized so max possible = 1.0
    const raw = Math.sqrt(
      (econDiff * econWeight) ** 2 + (socialDiff * socialWeight) ** 2
    );
    const maxRaw = Math.sqrt(
      (2 * econWeight) ** 2 + (2 * socialWeight) ** 2
    );
    const distance = raw / maxRaw; // 0 = perfect match, 1 = max opposition

    if (!measure.partisan) {
      // For nonpartisan measures use category priority logic as before
      const categoryScore = quizResult.categoryScores?.[measure.category];
      const axisScore = CATEGORY_AXIS[measure.category] === "economic"
        ? quizResult.dim1 : quizResult.dim2;
      const score = categoryScore !== undefined ? categoryScore : axisScore;
      if (Math.abs(score) >= PRIORITY_THRESHOLD) {
        return { label: "Aligns with your priorities", match: true };
      }
      return { label: "Outside your core priorities", match: null };
    }

    if (distance < 0.15) return { label: "Based on your views: YES", match: true };
    if (distance > 0.35) return { label: "Based on your views: NO",  match: false };
    return { label: "You may be split on this", match: null };
  }

  // Fallback: original binary logic for measures not yet enriched
  const categoryScore = quizResult.categoryScores?.[measure.category];
  const axisScore = CATEGORY_AXIS[measure.category] === "economic"
    ? quizResult.dim1
    : quizResult.dim2;
  const score = categoryScore !== undefined ? categoryScore : axisScore;

  if (!measure.partisan) {
    if (Math.abs(score) >= PRIORITY_THRESHOLD) {
      return { label: "Aligns with your priorities", match: true };
    }
    return { label: "Outside your core priorities", match: null };
  }

  const THRESHOLD = 0.15;
  if (Math.abs(score) < THRESHOLD) {
    return { label: "You may be split on this", match: null };
  }
  const userConservative = score > 0;
  const match = userConservative === measure.conservativeDirection;
  return { label: match ? "Aligns with your views" : "Opposes your views", match };
}

function FramingDisclosure({ measure }: { measure: BallotMeasure }) {
  const [open, setOpen] = useState(false);

  // Pick the reasoning text most relevant to this measure's primary axis
  const reasoning = CATEGORY_AXIS[measure.category] === "economic"
    ? (measure.econReasoning || measure.socialReasoning)
    : (measure.socialReasoning || measure.econReasoning);

  if (!reasoning) return null;

  const hasGap = !!measure.framingFlag;

  return (
    <div className="mt-2 mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors group"
        aria-expanded={open}
      >
        {hasGap ? (
          <Info className="w-3 h-3 text-amber-500/70 group-hover:text-amber-500 flex-shrink-0 transition-colors" />
        ) : (
          <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform", open && "rotate-180")} />
        )}
        <span className={cn("transition-colors", hasGap && "text-amber-500/80 group-hover:text-amber-500")}>
          {hasGap ? "Note on framing" : "What this changes"}
        </span>
        {hasGap && (
          <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <div className="mt-1.5 pl-4 border-l border-border space-y-1.5">
          <p className="text-[12px] text-muted-foreground leading-relaxed">{reasoning}</p>
          {measure.framingNote && (
            <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed">{measure.framingNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BallotPage() {
  const [selectedState, setSelectedState] = useState<string>("All");
  const [quizResult, setQuizResult] = useState<QuizResult | null>(() => getQuizResult());

  // Re-read quiz result on window focus (user may have just taken quiz in another tab)
  useEffect(() => {
    const onFocus = () => setQuizResult(getQuizResult());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const { data: measures, isLoading } = useQuery<BallotMeasure[]>({
    queryKey: ["ballot-measures"],
    queryFn: () =>
      fetch(`${getDataBase()}/data/ballot-measures.json`).then((r) => {
        if (!r.ok) throw new Error("Failed to load ballot measures");
        return r.json();
      }),
  });

  const states = measures
    ? ["All", ...Array.from(new Set(measures.map((m) => m.state))).sort()]
    : ["All"];

  const filtered = measures
    ? measures.filter((m) => selectedState === "All" || m.state === selectedState)
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs text-primary font-semibold tracking-widest uppercase mb-3 bg-primary/10 px-3 py-1.5 rounded-full">
          <ScrollText className="w-3.5 h-3.5" />
          2026 Elections
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
          Ballot Measures
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          Upcoming statewide ballot initiatives for 2026. Each measure is tagged with its ideological lean —
          and if you've taken the quiz, you'll see how it aligns with your own political profile.
        </p>
      </div>

      {/* Quiz CTA if no score */}
      {!quizResult && (
        <div className="flex items-start gap-3 bg-primary/8 border border-primary/20 rounded-xl p-4 mb-6">
          <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-foreground font-medium mb-1">See your personal alignment</p>
            <p className="text-xs text-muted-foreground mb-2">
              Take the ideology quiz to see whether each measure aligns with or opposes your political views.
            </p>
            <Link href="/quiz">
              <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                Take the Quiz →
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* State filter */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm text-muted-foreground font-medium flex-shrink-0">Filter by state:</label>
        <div className="relative">
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="appearance-none bg-card border border-border rounded-md px-3 py-1.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} measure{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Measures list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No measures found for {selectedState}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((measure) => {
            const lean = getLeanLabel(measure);
            const alignment = getAlignment(measure, quizResult);
            const electionDateStr = new Date(measure.electionDate + "T12:00:00").toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric",
            });

            return (
              <div
                key={measure.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] font-bold bg-muted/60 px-2 py-0.5 rounded text-muted-foreground">
                        {measure.stateCode}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{measure.type}</span>
                      <span className="text-[11px] text-muted-foreground">· {measure.status}</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground leading-snug">{measure.title}</h3>
                  </div>

                  {/* Alignment badge */}
                  {alignment && (
                    <div
                      className={cn(
                        "flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap",
                        alignment.match === true
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : alignment.match === false
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-muted/40 border-border text-muted-foreground"
                      )}
                    >
                      {alignment.match === true ? "✓ " : alignment.match === false ? "✗ " : "~ "}
                      {alignment.label}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{measure.summary}</p>

                {/* Framing / mechanical effect disclosure */}
                <FramingDisclosure measure={measure} />

                {/* Footer row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Lean tag */}
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded border",
                      lean.nonpartisan
                        ? "bg-muted/40 border-border text-muted-foreground"
                        : lean.conservative
                        ? "bg-[rgba(239,123,69,0.12)] border-[rgba(239,123,69,0.35)] text-[#ef7b45]"
                        : "bg-[rgba(94,177,191,0.12)] border-[rgba(94,177,191,0.35)] text-[#5eb1bf]"
                    )}
                  >
                    {lean.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {CATEGORY_LABELS[measure.category] ?? measure.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground">· {electionDateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-8 text-center">
        Data sourced from{" "}
        <a
          href="https://ballotpedia.org/2026_ballot_measures"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Ballotpedia
        </a>
        . Ideological leans are editorial assessments based on policy category and measure direction.
      </p>
    </div>
  );
}
