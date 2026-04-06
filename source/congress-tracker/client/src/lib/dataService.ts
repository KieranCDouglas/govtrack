/**
 * dataService.ts — Unified data access layer
 *
 * In server mode (Perplexity Computer / local dev):
 *   All calls go through Express via apiRequest() which correctly handles
 *   the __PORT_5000__ proxy URL rewriting done by deploy_website().
 *
 * In static mode (GitHub Pages):
 *   - Member data: fetched from pre-built /data/*.json files
 *   - Recent votes: fetched directly from GovTrack.us API
 *   - Member votes: fetched directly from GovTrack.us API
 */

import { IS_STATIC, GOVTRACK_API, apiRequest } from "./queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Member {
  bioguideId: string;
  displayName: string;
  chamber: string;
  state: string;
  district: string | null;
  party: string;
  partyCode?: string;
  born?: number | null;
  lastCongress?: number;
  dim1?: number | null;
  dim2?: number | null;
  numVotes?: number;
  compassX?: number | null;
  compassY?: number | null;
  govtrackId?: number | null;
  policyHeterodoxy?: Record<string, number | null>;
  partyAlignmentByCategory?: Record<string, number> | null;
  isCurrent?: boolean;
}

export interface VoteRecord {
  question: string;
  position: string;
  voteDate: string;
  result?: string;
  billId?: string;
  billTitle?: string;
  billGovtrackId?: number;
  description?: string;
  category?: string;
  chamber?: string;
  congress?: number;
  voteId?: number;
  mjrPctPlus?: number;
  pctPlus?: number;
  totalPlus?: number;
  totalMinus?: number;
  totalOther?: number;
  questionDetails?: string;
}

export interface RecentVote {
  question: string;
  passed: boolean;
  created: string;
  chamber_label: string;
  total_plus: number;
  total_minus: number;
  total_other: number;
  link: string;
}

// ─── Caches ──────────────────────────────────────────────────────────────────

let _currentMembersCache: Member[] | null = null;
let _indexCache: any[] | null = null;

// ─── Member data ─────────────────────────────────────────────────────────────

/** Fetch all current members (538) with full data including compass coords */
export async function getCurrentMembers(): Promise<Member[]> {
  if (_currentMembersCache) return _currentMembersCache;

  let data: any;
  if (IS_STATIC) {
    // Static mode: read from pre-built JSON file
    const res = await fetch(`${getDataBase()}/data/members-current.json`);
    if (!res.ok) throw new Error(`Failed to load members: ${res.status}`);
    data = await res.json();
  } else {
    // Server mode: use apiRequest so PROXY_BASE is correctly prepended
    const res = await apiRequest("GET", "/api/members/compass");
    data = await res.json();
  }

  // Normalize between static JSON format and API format
  const members: Member[] = (Array.isArray(data) ? data : data.members || []).map(normalizeM);
  _currentMembersCache = members;
  return members;
}

/** Search members — current + historical index */
export async function searchMembers(params: {
  q?: string;
  chamber?: string;
  party?: string;
  state?: string;
  isCurrent?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ members: Member[]; total: number }> {
  const { q, chamber, party, state, isCurrent, limit = 50, offset = 0 } = params;

  if (!IS_STATIC) {
    // Server mode: use apiRequest so PROXY_BASE is correctly prepended
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (chamber) p.set("chamber", chamber);
    if (party) p.set("party", party);
    if (state) p.set("state", state);
    if (isCurrent !== undefined) p.set("current", String(isCurrent));
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    const res = await apiRequest("GET", `/api/members?${p}`);
    const data = await res.json();
    return {
      members: (data.members || []).map(normalizeM),
      total: data.total,
    };
  }

  // Static mode: filter in-memory from pre-loaded JSON
  const current = await getCurrentMembers();
  let pool: Member[];

  if (isCurrent === false) {
    // Need historical — load the index
    const idx = await getHistoricalIndex();
    pool = idx.map(expandIndexEntry);
  } else if (isCurrent === true) {
    pool = current;
  } else {
    // No filter — combine current + historical
    const idx = await getHistoricalIndex();
    pool = [...current, ...idx.map(expandIndexEntry)];
  }

  let results = pool;
  if (q) {
    const lq = q.toLowerCase();
    results = results.filter(
      (m) =>
        m.displayName.toLowerCase().includes(lq) ||
        m.state.toLowerCase().includes(lq)
    );
  }
  if (chamber) results = results.filter((m) => m.chamber === chamber);
  if (party) results = results.filter((m) => m.party === party);
  if (state) results = results.filter((m) => m.state === state);

  const total = results.length;
  return { members: results.slice(offset, offset + limit), total };
}

/** Get a single member by bioguide ID */
export async function getMember(bioguideId: string): Promise<Member | null> {
  if (!IS_STATIC) {
    const res = await apiRequest("GET", `/api/members/${bioguideId}`);
    const data = await res.json();
    return normalizeM(data.member || data);
  }

  // Static: check current members first (they have full data)
  const current = await getCurrentMembers();
  const found = current.find((m) => m.bioguideId === bioguideId);
  if (found) return found;

  // Fall back to historical index (lightweight, no compass data for very old members)
  const idx = await getHistoricalIndex();
  const entry = idx.find((e: any) => e.b === bioguideId);
  return entry ? expandIndexEntry(entry) : null;
}

// ─── Votes ───────────────────────────────────────────────────────────────────

/** Fetch recent congressional votes (live from GovTrack) */
export async function getRecentVotes(limit = 15): Promise<RecentVote[]> {
  if (!IS_STATIC) {
    const res = await apiRequest("GET", `/api/votes/recent?limit=${limit}`);
    const data = await res.json();
    return data.votes || [];
  }

  // Static mode: call GovTrack directly from browser (CORS: *)
  const res = await fetch(
    `${GOVTRACK_API}/vote?congress=119&limit=${limit}&order_by=-created`
  );
  if (!res.ok) throw new Error("Failed to fetch recent votes");
  const data = await res.json();
  return data.objects || [];
}

/** Fetch a member's voting record (live from GovTrack) */
export async function getMemberVotes(
  bioguideId: string,
  govtrackId: number | null | undefined,
  limit = 50
): Promise<{ votes: VoteRecord[]; source: string }> {
  if (!IS_STATIC) {
    const res = await apiRequest(
      "GET",
      `/api/members/${bioguideId}/votes?limit=${limit}`
    );
    if (!res.ok) return { votes: [], source: "error" };
    return res.json();
  }

  // Static mode: paginate GovTrack directly from browser (up to 2000 votes)
  if (!govtrackId) {
    return { votes: [], source: "none" };
  }

  const PAGE = 300, MAX = 300;
  const allVoters: any[] = [];
  let offset = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(
        `${GOVTRACK_API}/voter?person=${govtrackId}&limit=${PAGE}&offset=${offset}&sort=-created`
      );
    } catch {
      break;
    }
    if (!res.ok) break;
    const data = await res.json();
    const objects: any[] = (data.objects || []).filter((v: any) => v.vote);
    allVoters.push(...objects);
    const totalCount = data.meta?.total_count || 0;
    offset += PAGE;
    if (offset >= totalCount || !objects.length || allVoters.length >= MAX) break;
  }

  function mapVoter(v: any): VoteRecord {
    const vote = v.vote || {};
    const opt = v.option?.key || "";
    const position = opt === "+" ? "Yes" : opt === "-" ? "No" : opt === "0" ? "Present" : "Not Voting";
    // related_bill from /voter endpoint is a bare numeric ID, not an embedded object.
    // Extract bill display number and title from the question text instead.
    const question = vote.question || "Roll Call Vote";
    const relatedBill = vote.related_bill;
    const billGtId = typeof relatedBill === "number" ? relatedBill
                   : typeof relatedBill === "object" && relatedBill ? relatedBill.id
                   : undefined;
    const billDisplayFromApi = typeof relatedBill === "object" && relatedBill
                               ? relatedBill.display_number : undefined;
    const billTitleFromApi   = typeof relatedBill === "object" && relatedBill
                               ? relatedBill.title?.substring(0, 200) : undefined;
    // Parse "H.Res. 1142: Some Title Here" or "H.R. 7147 ..." from question text
    const qBillMatch = question.match(/^((?:H|S)\.?\s*(?:Con\.?\s*|J\.?\s*)?(?:Res\.?\s*)?\d+[^:]*?)(?::\s*(.+))?$/i);
    const billIdFromQ    = billDisplayFromApi || (qBillMatch ? qBillMatch[1].trim() : undefined);
    // If no bill title from API or regex, use the full question as the title so the
    // vote item shows meaningful text instead of just the category label ("Procedural").
    const billTitleFromQ = billTitleFromApi
                        || (qBillMatch?.[2] ? qBillMatch[2].trim().substring(0, 200) : undefined)
                        || question.substring(0, 200);
    return {
      question,
      position,
      voteDate: (vote.created || "").substring(0, 10),
      result: vote.result || undefined,
      billId: billIdFromQ || undefined,
      billTitle: billTitleFromQ || undefined,
      billGovtrackId: billGtId || undefined,
      description: vote.category_label || undefined,
      category: vote.category || undefined,
      chamber: vote.chamber_label || undefined,
      congress: vote.congress || 119,
      voteId: vote.id || undefined,
      mjrPctPlus: vote.majority_party_percent_plus ?? undefined,
      pctPlus: vote.percent_plus ?? undefined,
      totalPlus: vote.total_plus ?? undefined,
      totalMinus: vote.total_minus ?? undefined,
      totalOther: vote.total_other ?? undefined,
      questionDetails: vote.question_details || undefined,
    };
  }

  const votes = allVoters.filter((v) => v.vote?.congress === 119).map(mapVoter);
  return { votes, source: "govtrack.us" };
}

/** Get site stats */
export async function getStats(): Promise<Record<string, number>> {
  if (!IS_STATIC) {
    const res = await apiRequest("GET", "/api/stats");
    return res.json();
  }
  const res = await fetch(`${getDataBase()}/data/stats.json`);
  return res.json();
}

/** Get roll call vote counts for the current congress from pre-built vote files */
export async function getCongressVoteCounts(congress = 119): Promise<{ house: number; senate: number }> {
  const [hRes, sRes] = await Promise.allSettled([
    fetch(`${getDataBase()}/data/votes/H${congress}.json`),
    fetch(`${getDataBase()}/data/votes/S${congress}.json`),
  ]);
  let house = 0, senate = 0;
  if (hRes.status === "fulfilled" && hRes.value.ok) {
    const d = await hRes.value.json();
    house = Array.isArray(d.r) ? d.r.length : 0;
  }
  if (sRes.status === "fulfilled" && sRes.value.ok) {
    const d = await sRes.value.json();
    senate = Array.isArray(d.r) ? d.r.length : 0;
  }
  return { house, senate };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the base URL path for static data files.
 * Works on GitHub Pages (e.g. /govtrack) and local static serving (/).
 * Uses import.meta.env.BASE_URL which Vite sets from the `base` config option.
 */
function getDataBase(): string {
  // BASE_URL is "/govtrack/" on GitHub Pages with VITE_BASE_PATH=/govtrack
  // Strip trailing slash so we can append /data/...
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return base || "";
}

async function getHistoricalIndex(): Promise<any[]> {
  if (_indexCache) return _indexCache;
  const res = await fetch(`${getDataBase()}/data/members-index.json`);
  if (!res.ok) return [];
  _indexCache = await res.json();
  return _indexCache!;
}

function expandIndexEntry(e: any): Member {
  const chamberMap: Record<string, string> = { H: "House", S: "Senate" };
  const partyMap: Record<string, string> = {
    D: "Democrat",
    R: "Republican",
    I: "Independent",
  };
  // Estimated compass scores derived from regression on 546 current members (R²=0.90/0.90):
  //   compassX = 1.1282 * dim1 - 0.0907
  //   compassY = 0.9363 * dim1 + 0.1976 * dim2 + 0.0966 * partyCode - 0.0643
  //     where partyCode: R=+1, D=-1, I=0
  // compassX/compassY are on the same calibrated scale as LLM-scored current members.
  // dim1/dim2 reuse these transformed values so the IdeologyBar stays on the same scale.
  const partyCode = e.p === "R" ? 1 : e.p === "D" ? -1 : 0;
  const compassX = e.x != null ? Math.max(-1, Math.min(1, 1.1282 * e.x - 0.0907)) : null;
  const compassY = (e.x != null && e.y != null)
    ? Math.max(-1, Math.min(1,
        0.9363 * e.x +
        0.1976 * e.y +
        0.0966 * partyCode +
        -0.0643
      ))
    : null;
  return {
    bioguideId: e.b,
    displayName: e.n,
    chamber: chamberMap[e.c] || e.c,
    state: e.s,
    district: null,
    party: partyMap[e.p] || "Independent",
    lastCongress: e.l,
    dim1: compassX,
    dim2: compassY,
    compassX,
    compassY,
    isCurrent: false,
  };
}

export function normalizeM(m: any): Member {
  return {
    bioguideId: m.bioguideId || m.bioguide_id,
    displayName: m.displayName || m.display_name,
    chamber: m.chamber,
    state: m.state,
    district: m.district || null,
    party: m.party,
    partyCode: m.partyCode || m.party_code,
    born: m.born ?? null,
    lastCongress: m.lastCongress || m.last_congress,
    dim1: m.dim1 ?? null,
    dim2: m.dim2 ?? null,
    numVotes: m.numVotes || m.num_votes || 0,
    compassX: m.compassX ?? m.compass_x ?? null,
    compassY: m.compassY ?? m.compass_y ?? null,
    govtrackId: m.govtrackId ?? m.govtrack_id ?? null,
    policyHeterodoxy:
      typeof m.policyHeterodoxy === "string"
        ? JSON.parse(m.policyHeterodoxy || "{}")
        : m.policyHeterodoxy || {},
    partyAlignmentByCategory:
      typeof m.partyAlignmentByCategory === "string"
        ? JSON.parse(m.partyAlignmentByCategory || "{}")
        : m.partyAlignmentByCategory ?? null,
    isCurrent: m.isCurrent ?? m.is_current ?? true,
  };
}
