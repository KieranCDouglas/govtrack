import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { members } from "@shared/schema";
import { eq } from "drizzle-orm";

const GOVTRACK_API = "https://www.govtrack.us/api/v2";
const UA = "CongressWatch/1.0 (educational tool; kieran@tilquhillie.com)";

// ── GovTrack helpers ───────────────────────────────────────────────────────

async function govtrackFetch(path: string): Promise<any> {
  const url = path.startsWith("http") ? path : `${GOVTRACK_API}${path}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GovTrack ${res.status}: ${url}`);
  return res.json();
}

// Fetch recent votes for a member by their GovTrack person ID
// Returns the most recent 50 votes across both chambers
async function fetchGovTrackVotes(govtrackPersonId: number, limit = 50): Promise<any[]> {
  const data = await govtrackFetch(
    `/voter?person=${govtrackPersonId}&limit=${limit}&sort=-created`
  );
  return data?.objects || [];
}

// Get recent congressional votes (both chambers)
async function fetchRecentVotes(congress = 119, limit = 20): Promise<any[]> {
  const data = await govtrackFetch(
    `/vote?congress=${congress}&limit=${limit}&order_by=-created`
  );
  return data?.objects || [];
}

// Normalize GovTrack vote option to a display string
function normalizeOption(option: any): string {
  if (!option) return "Not Voting";
  const v = (option.value || option.key || "").toLowerCase();
  if (v === "yea" || v === "aye" || v === "+") return "Yes";
  if (v === "nay" || v === "no" || v === "-") return "No";
  if (v === "present" || v === "0") return "Present";
  return "Not Voting";
}

// ── Routes ─────────────────────────────────────────────────────────────────

export async function registerRoutes(httpServer: Server, app: Express) {
  // GET /api/members - search/list members
  app.get("/api/members", (req, res) => {
    const {
      q,
      chamber,
      party,
      state,
      current,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string>;

    const result = storage.searchMembers({
      query: q || undefined,
      chamber: chamber || undefined,
      party: party || undefined,
      state: state || undefined,
      isCurrent: current !== undefined ? current === "true" : undefined,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
    });

    res.json(result);
  });

  // GET /api/members/compass - get all current members with compass scores
  app.get("/api/members/compass", (req, res) => {
    const { chamber } = req.query as Record<string, string>;
    const result = storage.getCurrentMembers(chamber || undefined);
    res.json(result);
  });

  // GET /api/members/:bioguideId - get single member + GovTrack enrichment
  app.get("/api/members/:bioguideId", async (req, res) => {
    const { bioguideId } = req.params;
    const member = storage.getMemberByBioguide(bioguideId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }
    res.json({ member });
  });

  // GET /api/members/:bioguideId/votes - live voting record from GovTrack
  app.get("/api/members/:bioguideId/votes", async (req, res) => {
    const { bioguideId } = req.params;
    const { limit = "50", refresh = "false" } = req.query as Record<string, string>;

    const member = storage.getMemberByBioguide(bioguideId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Return cached votes unless refresh=true
    const forceRefresh = refresh === "true";
    if (!forceRefresh) {
      const cached = storage.getVotesForMember(bioguideId, parseInt(limit));
      if (cached.length > 0) {
        return res.json({ votes: cached, source: "cache" });
      }
    }

    // Need govtrack_id to fetch votes
    const govtrackId = (member as any).govtrackId;
    if (!govtrackId) {
      return res.json({
        votes: [],
        source: "none",
        note: "No GovTrack ID found for this member. They may be newly seated.",
      });
    }

    try {
      const rawVotes = await fetchGovTrackVotes(govtrackId, parseInt(limit));

      if (rawVotes.length > 0) {
        const votesToStore = rawVotes.map((v: any) => {
          const vote = v.vote || {};
          const bill = vote.related_bill || null;
          return {
            bioguideId,
            memberId: member.id,
            congress: vote.congress || 119,
            session: parseInt(vote.session) || 1,
            chamber: vote.chamber || member.chamber.toLowerCase(),
            rollCall: vote.number || null,
            voteDate: (vote.created || "").substring(0, 10),
            voteTime: (vote.created || "").substring(11, 19) || null,
            billId: bill
              ? `${bill.bill_type_label || ""}${bill.number || ""}`.trim()
              : null,
            billTitle: bill?.title?.substring(0, 300) || null,
            question: (vote.question || "Roll Call Vote").substring(0, 300),
            description: vote.category_label || null,
            result: vote.result || null,
            position: normalizeOption(v.option),
            category: vote.category || null,
            cached: true,
          };
        });

        storage.upsertVotes(votesToStore);
        const votes = storage.getVotesForMember(bioguideId, parseInt(limit));
        return res.json({ votes, source: "govtrack.us" });
      }
    } catch (err) {
      console.error("GovTrack vote fetch error:", err);
    }

    res.json({
      votes: [],
      source: "none",
      note: "Could not fetch vote data from GovTrack.us at this time. Try again shortly.",
    });
  });

  // GET /api/votes/recent - live feed of the most recent votes in Congress
  app.get("/api/votes/recent", async (req, res) => {
    const { congress = "119", limit = "20" } = req.query as Record<string, string>;
    try {
      const votes = await fetchRecentVotes(parseInt(congress), Math.min(parseInt(limit), 50));
      res.json({ votes, source: "govtrack.us", updated: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch recent votes", detail: String(err) });
    }
  });

  // GET /api/stats - summary statistics
  app.get("/api/stats", (req, res) => {
    const all = storage.getAllMembers();
    const current = all.filter((m) => m.isCurrent);
    const house = current.filter((m) => m.chamber === "House");
    const senate = current.filter((m) => m.chamber === "Senate");
    const dems = current.filter((m) => m.party === "Democrat");
    const reps = current.filter((m) => m.party === "Republican");
    const ind = current.filter((m) => m.party !== "Democrat" && m.party !== "Republican");

    res.json({
      total_historical: all.length,
      current_total: current.length,
      current_house: house.length,
      current_senate: senate.length,
      current_dems: dems.length,
      current_reps: reps.length,
      current_ind: ind.length,
    });
  });
}
