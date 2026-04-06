import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchMembers } from "@/lib/dataService";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/dataService";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","GU","VI","AS","MP"
];

function partyClass(party: string) {
  if (party === "Democrat") return "party-dem";
  if (party === "Republican") return "party-rep";
  return "party-ind";
}

function IdeologyBar({ dim1 }: { dim1: number | null }) {
  if (dim1 == null) return <span className="text-xs text-muted-foreground">—</span>;
  // dim1 ranges roughly -1 to +1; map to 0-100%
  const pct = Math.round(((dim1 + 1) / 2) * 100);
  const color = dim1 < -0.1 ? "bg-blue-500" : dim1 > 0.1 ? "bg-red-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px]">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8">{dim1.toFixed(2)}</span>
    </div>
  );
}

export default function MembersPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [chamber, setChamber] = useState("all");
  const [party, setParty] = useState("all");
  const [state, setState] = useState("all");
  const [current, setCurrent] = useState("current");
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const handleQueryChange = useCallback((v: string) => {
    setQuery(v);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => {
      setDebouncedQuery(v);
      setPage(0);
    }, 300);
  }, []);

  const params = new URLSearchParams({
    limit: String(LIMIT),
    offset: String(page * LIMIT),
    ...(debouncedQuery && { q: debouncedQuery }),
    ...(chamber !== "all" && { chamber }),
    ...(party !== "all" && { party }),
    ...(state !== "all" && { state }),
    ...(current !== "all" && { current: current === "current" ? "true" : "false" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["members-search", params.toString()],
    queryFn: () => searchMembers({
      q: params.get("q") || undefined,
      chamber: params.get("chamber") || undefined,
      party: params.get("party") || undefined,
      state: params.get("state") || undefined,
      isCurrent: params.get("current") === "false" ? false : params.get("current") === "true" ? true : undefined,
      limit: parseInt(params.get("limit") || "50"),
      offset: parseInt(params.get("offset") || "0"),
    }),
  });

  const members: Member[] = data?.members ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  function resetFilters() {
    setQuery(""); setDebouncedQuery(""); setChamber("all"); setParty("all"); setState("all"); setCurrent("current"); setPage(0);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Members of Congress</h1>
        <p className="text-muted-foreground text-sm">
          {total > 0 ? `${total.toLocaleString()} members` : "Loading…"}
          {current === "current" ? " currently serving" : " (all historical)"}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-member-search"
          />
        </div>

        <Select value={chamber} onValueChange={(v) => { setChamber(v); setPage(0); }}>
          <SelectTrigger className="w-32 h-9" data-testid="select-chamber">
            <SelectValue placeholder="Chamber" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chambers</SelectItem>
            <SelectItem value="House">House</SelectItem>
            <SelectItem value="Senate">Senate</SelectItem>
          </SelectContent>
        </Select>

        <Select value={party} onValueChange={(v) => { setParty(v); setPage(0); }}>
          <SelectTrigger className="w-36 h-9" data-testid="select-party">
            <SelectValue placeholder="Party" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All parties</SelectItem>
            <SelectItem value="Democrat">Democrat</SelectItem>
            <SelectItem value="Republican">Republican</SelectItem>
            <SelectItem value="Independent">Independent</SelectItem>
          </SelectContent>
        </Select>

        <Select value={state} onValueChange={(v) => { setState(v); setPage(0); }}>
          <SelectTrigger className="w-24 h-9" data-testid="select-state">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={current} onValueChange={(v) => { setCurrent(v); setPage(0); }}>
          <SelectTrigger className="w-32 h-9" data-testid="select-current">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current only</SelectItem>
            <SelectItem value="former">Former only</SelectItem>
            <SelectItem value="all">All historical</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs">
          Reset
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Name</span>
          <span>Chamber</span>
          <span>Party</span>
          <span>State</span>
          <span>Ideology (Dim 1)</span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton h-8 rounded" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            No members found. Try adjusting your filters.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {members.map((m) => (
              <Link key={m.bioguideId} href={`/members/${m.bioguideId}`}>
                <div
                  data-testid={`row-member-${m.bioguideId}`}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer items-center"
                >
                  <div>
                    <span className="font-medium text-sm text-foreground">{m.displayName}</span>
                    {m.isCurrent && (
                      <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                        Current
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{m.chamber}</span>
                  <span className={cn("text-sm font-medium", partyClass(m.party))}>
                    {m.party === "Democrat" ? "Dem" : m.party === "Republican" ? "Rep" : m.party}
                  </span>
                  <span className="text-sm text-muted-foreground">{m.state}</span>
                  <IdeologyBar dim1={m.dim1} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="tabular-nums px-2 text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
