import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getStats, getRecentVotes, getCongressVoteCounts, getCurrentMembers } from "@/lib/dataService";
import { Badge } from "@/components/ui/badge";
import { Users, Map, HelpCircle, ArrowRight, Vote, ExternalLink, ScrollText } from "lucide-react";

// 119th Congress: Jan 3, 2025 → Jan 3, 2027
const CONGRESS_START = new Date("2025-01-03").getTime();
const CONGRESS_END   = new Date("2027-01-03").getTime();
const CONGRESS_NUM   = 119;

export default function HomePage() {
  const { data: voteCounts } = useQuery({
    queryKey: ["congress-vote-counts", CONGRESS_NUM],
    queryFn: () => getCongressVoteCounts(CONGRESS_NUM),
  });

  const { data: allMembers } = useQuery({
    queryKey: ["compass-members", "all"],
    queryFn: () => getCurrentMembers(),
  });

  // Compute per-chamber party breakdown
  const chamberCounts = allMembers ? (() => {
    const hd = allMembers.filter(m => m.chamber === "House"   && m.party === "Democrat").length;
    const hr = allMembers.filter(m => m.chamber === "House"   && m.party === "Republican").length;
    const sd = allMembers.filter(m => m.chamber === "Senate"  && m.party === "Democrat").length;
    const sr = allMembers.filter(m => m.chamber === "Senate"  && m.party === "Republican").length;
    return { hd, hr, sd, sr };
  })() : null;

  // Congress progress (0–100)
  const now = Date.now();
  const congressPct = Math.min(100, Math.max(0,
    Math.round(((now - CONGRESS_START) / (CONGRESS_END - CONGRESS_START)) * 100)
  ));
  const congressYear = now < new Date("2026-01-03").getTime() ? 1 : 2;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-4 text-foreground">
          A Civic Engagement Tool
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg leading-relaxed">
          Explore the ideological landscape of every current and historical member of the U.S. Congress. Discover where you fit on the American political spectrum, track your representatives' voting records, and see how your views align with local ballot initiatives.
        </p>
      </div>

      {/* Stats row — 3 panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
        {/* Panel 1: Congress progress */}
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-base md:text-xl font-extrabold text-foreground mb-1">{CONGRESS_NUM}th Congress</div>
          <div className="text-xs text-muted-foreground mb-3">Year {congressYear} of 2 · 2025–2027</div>
          <div className="w-full bg-muted/40 rounded-full h-2 mb-1.5">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${congressPct}%` }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground">{congressPct}% complete</div>
        </div>

        {/* Panel 2: House votes + party split */}
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">House</div>
          <div className="text-lg md:text-2xl font-extrabold text-foreground mb-1">
            {voteCounts ? voteCounts.house.toLocaleString() : "—"}
          </div>
          <div className="text-xs text-muted-foreground mb-3">Roll call votes this Congress</div>
          {chamberCounts && (
            <div className="flex items-center justify-center gap-3 text-xs">
              <span className="font-semibold" style={{ color: "rgb(94,177,191)" }}>{chamberCounts.hd} Dem</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-semibold" style={{ color: "rgb(216,71,39)" }}>{chamberCounts.hr} Rep</span>
            </div>
          )}
        </div>

        {/* Panel 3: Senate votes + party split */}
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Senate</div>
          <div className="text-lg md:text-2xl font-extrabold text-foreground mb-1">
            {voteCounts ? voteCounts.senate.toLocaleString() : "—"}
          </div>
          <div className="text-xs text-muted-foreground mb-3">Roll call votes this Congress</div>
          {chamberCounts && (
            <div className="flex items-center justify-center gap-3 text-xs">
              <span className="font-semibold" style={{ color: "rgb(94,177,191)" }}>{chamberCounts.sd} Dem</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-semibold" style={{ color: "rgb(216,71,39)" }}>{chamberCounts.sr} Rep</span>
            </div>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        <Link href="/members">
          <div className="group bg-card border border-border rounded-xl p-4 md:p-6 cursor-pointer hover:border-primary/50 hover:bg-card/80 transition-colors h-full">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Member Profiles</h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Browse every current and historical member of Congress. Filter by party, state, or chamber. View full voting histories for recent members, consequential votes for earlier members, and each member's ideology score and key issue positions.
            </p>
            <div className="flex items-center gap-1 mt-4 text-xs text-primary font-semibold group-hover:gap-2 transition-all">
              Explore members <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

        <Link href="/compass">
          <div className="group bg-card border border-border rounded-xl p-4 md:p-6 cursor-pointer hover:border-primary/50 hover:bg-card/80 transition-colors h-full">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
              <Map className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Political Compass</h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Visualize ideological diversity by plotting each member of Congress on a two‑dimensional map, using scores derived from roll‑call voting patterns, interest‑group ratings, bill sponsorships, media behavior, and major campaign donors.
            </p>
            <div className="flex items-center gap-1 mt-4 text-xs text-primary font-semibold group-hover:gap-2 transition-all">
              View the compass <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

        <Link href="/quiz">
          <div className="group bg-card border border-border rounded-xl p-4 md:p-6 cursor-pointer hover:border-primary/50 hover:bg-card/80 transition-colors h-full">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Ideology Quiz</h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Take a short quiz to see where you land on the same political compass as members of Congress, then discover your closest and furthest ideological matches.
            </p>
            <div className="flex items-center gap-1 mt-4 text-xs text-primary font-semibold group-hover:gap-2 transition-all">
              Take the quiz <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

        <Link href="/ballot">
          <div className="group bg-card border border-border rounded-xl p-4 md:p-6 cursor-pointer hover:border-primary/50 hover:bg-card/80 transition-colors h-full">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
              <ScrollText className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Ballot Measures</h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Browse a complete list of upcoming local ballot initiatives, see the ideological leaning of each measure, and receive voting recommendations based on your ideology score.
            </p>
            <div className="flex items-center gap-1 mt-4 text-xs text-primary font-semibold group-hover:gap-2 transition-all">
              View ballot measures <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Live recent votes feed */}
      <RecentVotesFeed />

    </div>
  );
}

function RecentVotesFeed() {
  const { data: votes, isLoading } = useQuery({
    queryKey: ["votes-recent"],
    queryFn: () => getRecentVotes(8),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
  });

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Vote className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-foreground">Recent Congressional Votes</h2>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live data" />
        </div>
        <a
          href="https://www.govtrack.us/congress/votes"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View all on GovTrack <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (votes?.length || 0) === 0 ? (
        <div className="text-sm text-muted-foreground p-4 bg-muted/20 rounded-lg">No recent vote data available.</div>
      ) : (
        <div className="space-y-2">
          {(votes || []).map((vote: any, i: number) => (
            <a
              key={i}
              href={vote.link || `https://www.govtrack.us/congress/votes`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/40 hover:bg-card/80 transition-colors group"
            >
              <div className="flex-shrink-0">
                <Badge
                  variant="outline"
                  className={
                    vote.passed
                      ? "border-emerald-500/50 text-emerald-400 text-[10px] px-1.5"
                      : "border-red-500/50 text-red-400 text-[10px] px-1.5"
                  }
                >
                  {vote.passed ? "Passed" : "Failed"}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{vote.question}</div>
                <div className="text-xs text-muted-foreground">
                  {vote.chamber_label} · {vote.created?.substring(0, 10)} ·{" "}
                  <span className="text-emerald-400">{vote.total_plus} Yes</span>{" / "}
                  <span className="text-red-400">{vote.total_minus} No</span>
                  {vote.total_other > 0 && <span className="text-muted-foreground"> / {vote.total_other} other</span>}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
