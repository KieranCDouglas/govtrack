import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getMember, getMemberVotes } from "@/lib/dataService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, MapPin, Calendar, Vote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/dataService";
import type { VoteRecord } from "@/lib/dataService";
import MiniCompass from "@/components/MiniCompass";

const CONGRESS_YEAR: Record<number, string> = {
  119: "2025–2027", 118: "2023–2025", 117: "2021–2023", 116: "2019–2021",
  115: "2017–2019", 114: "2015–2017", 113: "2013–2015",
};

function partyClass(party: string) {
  if (party === "Democrat") return "party-dem";
  if (party === "Republican") return "party-rep";
  return "party-ind";
}

function VoteBadge({ position }: { position: string }) {
  if (!position) return null;
  const pos = position.toLowerCase();
  if (pos === "yes" || pos === "yea") return <span className="vote-yes">Yea</span>;
  if (pos === "no" || pos === "nay") return <span className="vote-no">Nay</span>;
  if (pos === "not voting") return <span className="vote-not-voting">Not Voting</span>;
  return <span className="vote-present">{position}</span>;
}

export default function MemberDetailPage() {
  const { bioguideId } = useParams<{ bioguideId: string }>();

  const { data: memberData, isLoading: memberLoading } = useQuery({
    queryKey: ["member", bioguideId],
    queryFn: async () => {
      const m = await getMember(bioguideId);
      return m ? { member: m } : null;
    },
    enabled: !!bioguideId,
  });

  const member: Member | null = memberData?.member ?? null;

  const { data: votesData, isLoading: votesLoading } = useQuery({
    queryKey: ["member-votes", bioguideId, member?.govtrackId],
    queryFn: async () => {
      // Former members (no govtrackId): load from Voteview static files via data-loader.js
      const loader = (window as any).__cwLoadVotes;
      if (!member?.govtrackId && loader) {
        return loader(bioguideId, null);
      }
      return getMemberVotes(bioguideId, member?.govtrackId);
    },
    enabled: !!member,
  });
  const votes: VoteRecord[] = votesData?.votes ?? [];

  if (memberLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Member not found.</p>
        <Link href="/members"><Button variant="ghost" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button></Link>
      </div>
    );
  }

  const party = member.party || "Other";

  const congYear = CONGRESS_YEAR[member.lastCongress] || "";

  // Compute vote breakdown
  const yeas = votes.filter((v) => ["yes", "yea"].includes(v.position?.toLowerCase()));
  const nays = votes.filter((v) => ["no", "nay"].includes(v.position?.toLowerCase()));
  const notVoting = votes.filter((v) => v.position?.toLowerCase() === "not voting");
  const voteRate = votes.length > 0
    ? Math.round(((yeas.length + nays.length) / votes.length) * 100)
    : null;

  const photoUrl = `https://bioguide.congress.gov/bioguide/photo/${member.bioguideId[0]}/${member.bioguideId}.jpg`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back */}
      <Link href="/members">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          All Members
        </Button>
      </Link>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6 flex gap-5">
        <div className="flex-shrink-0">
          <img
            src={photoUrl}
            alt={member.displayName}
            className="w-20 h-24 object-cover rounded-lg border border-border bg-muted"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.displayName)}&size=80&background=2d3748&color=a0aec0&bold=true`;
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">{member.displayName}</h1>
            <Badge variant="outline" className={cn("text-xs border-0 font-semibold px-2", partyClass(party))}>
              {party}
            </Badge>
            {member.isCurrent && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Current</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {member.chamber} · {member.state}
              {member.chamber === "House" && member.district && member.district !== "0" && ` · District ${member.district}`}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {member.isCurrent ? "Serving" : "Last served"} {member.lastCongress}th Congress {congYear}
            </span>
            {member.born && (
              <span>Born {member.born}</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {member.compassX != null && (
              <div className="text-xs bg-muted/60 px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="text-muted-foreground">Economic:</span>
                <span className={cn("font-semibold", (member.compassX ?? 0) > 0 ? "text-[#5eb1bf]" : "text-[#5eb1bf]")}>
                  {(member.compassX ?? 0) > 0 ? "Econ Right" : "Econ Left"} ({(member.compassX ?? 0) > 0 ? "+" : ""}{member.compassX?.toFixed(3)})
                </span>
              </div>
            )}
            {member.compassY != null && (
              <div className="text-xs bg-muted/60 px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="text-muted-foreground">Social:</span>
                <span className={cn("font-semibold", (member.compassY ?? 0) > 0 ? "text-[#ef7b45]" : "text-[#ef7b45]")}>
                  {(member.compassY ?? 0) > 0 ? "Conservative" : "Progressive"} ({(member.compassY ?? 0) > 0 ? "+" : ""}{member.compassY?.toFixed(3)})
                </span>
              </div>
            )}
            {member.numVotes > 0 && (
              <div className="text-xs bg-muted/60 px-2.5 py-1 rounded text-muted-foreground">
                {member.numVotes.toLocaleString()} votes recorded
              </div>
            )}
          </div>

          <div className="mt-3">
            <a
              href={`https://www.congress.gov/member/${member.displayName.toLowerCase().replace(/\s+/g, "-")}/${member.bioguideId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline w-fit"
            >
              Congress.gov profile <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Mini Compass */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2">
            <Vote className="w-4 h-4 text-primary" />
            Ideological Position
          </h2>
          {member.compassX != null && member.compassY != null ? (
            <MiniCompass compassX={member.compassX!} compassY={member.compassY!} name={member.displayName} party={party} />
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No ideology scores available
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Horizontal: Economic axis — Collectivist (−1) → Free Market (+1). Vertical: Social axis — Progressive (−1) → Conservative (+1).
          </p>
          <Link href={`/compass?highlight=${member.bioguideId}`}>
            <Button variant="ghost" size="sm" className="mt-2 text-xs h-7 text-primary">
              See on full compass →
            </Button>
          </Link>
        </div>

        {/* Issue Positions — content replaced by ui-enhancements.js with LLM summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2">
            <Vote className="w-4 h-4 text-primary" />
            Issue Positions
          </h2>
          <div className="space-y-3" />
        </div>
      </div>

      {/* Voting Record — hidden for pre-114th members (no curated data) */}
      {(member.isCurrent || (member.lastCongress != null && member.lastCongress >= 114)) && <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Vote className="w-4 h-4 text-primary" />
            {member.isCurrent ? "Recent Voting Record" : "Most Consequential Votes"}
          </h2>
          {member.isCurrent && votes.length > 0 && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-[#5eb1bf] font-medium">{yeas.length} Yea</span>
              <span className="text-red-400 font-medium">{nays.length} Nay</span>
              <span className="text-slate-400">{notVoting.length} NV</span>
              {voteRate !== null && <span className="text-[#ef7b45]">{voteRate}% participation</span>}
            </div>
          )}
        </div>

        {votesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}
          </div>
        ) : votes.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <p className="mb-2">No cached votes yet.</p>
            <p className="text-xs">Voting records are fetched live from GovTrack.us. Click "Refresh votes" to load the latest.</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-border/40">
            {votes.map((vote) => (
              <div
                key={`${vote.voteDate}-${vote.question.slice(0,20)}`}
                className="py-3 flex items-start gap-3"
                data-bill-gt-id={vote.billGovtrackId ?? ""}
                data-bill-display={vote.billId ?? ""}
                data-vote-result={vote.result ?? ""}
                data-vote-id={vote.voteId ?? ""}
                data-position={vote.position ?? ""}
                data-chamber={vote.chamber ?? ""}
                data-mjr-pct-plus={vote.mjrPctPlus ?? ""}
                data-pct-plus={vote.pctPlus ?? ""}
                data-total-plus={vote.totalPlus ?? ""}
                data-total-minus={vote.totalMinus ?? ""}
                data-congress={vote.congress ?? ""}
                data-question-details={vote.questionDetails ?? ""}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <VoteBadge position={vote.position} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground leading-snug line-clamp-2">{vote.question}</div>
                  {vote.billTitle && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{vote.billTitle}</div>
                  )}
                  {vote.description && (
                    <div className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">{vote.description}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-muted-foreground">{vote.voteDate}</div>
                  {vote.category && (
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">{vote.category}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
}
