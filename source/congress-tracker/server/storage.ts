import { db } from "./db";
import { members, memberVotes } from "@shared/schema";
import type { Member, InsertMember, MemberVote, InsertMemberVote } from "@shared/schema";
import { eq, like, and, or, desc, asc, sql, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Members
  getMemberByBioguide(bioguideId: string): Member | undefined;
  getMemberById(id: number): Member | undefined;
  searchMembers(params: {
    query?: string;
    chamber?: string;
    party?: string;
    state?: string;
    isCurrent?: boolean;
    limit?: number;
    offset?: number;
  }): { members: Member[]; total: number };
  getAllMembers(): Member[];
  getCurrentMembers(chamber?: string): Member[];
  upsertMember(member: InsertMember): Member;

  // Votes
  getVotesForMember(bioguideId: string, limit?: number): MemberVote[];
  upsertVotes(votes: InsertMemberVote[]): void;
  hasVoteCache(bioguideId: string): boolean;
}

export class Storage implements IStorage {
  getMemberByBioguide(bioguideId: string): Member | undefined {
    return db.select().from(members).where(eq(members.bioguideId, bioguideId)).get();
  }

  getMemberById(id: number): Member | undefined {
    return db.select().from(members).where(eq(members.id, id)).get();
  }

  searchMembers(params: {
    query?: string;
    chamber?: string;
    party?: string;
    state?: string;
    isCurrent?: boolean;
    limit?: number;
    offset?: number;
  }): { members: Member[]; total: number } {
    const { query, chamber, party, state, isCurrent, limit = 50, offset = 0 } = params;

    const conditions = [];
    if (query) {
      conditions.push(like(members.displayName, `%${query}%`));
    }
    if (chamber) {
      conditions.push(eq(members.chamber, chamber));
    }
    if (party) {
      conditions.push(eq(members.party, party));
    }
    if (state) {
      conditions.push(eq(members.state, state));
    }
    if (isCurrent !== undefined) {
      conditions.push(eq(members.isCurrent, isCurrent));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const total = db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(where)
      .get()?.count ?? 0;

    const result = db
      .select()
      .from(members)
      .where(where)
      .orderBy(desc(members.isCurrent), desc(members.lastCongress), asc(members.displayName))
      .limit(limit)
      .offset(offset)
      .all();

    return { members: result, total };
  }

  getAllMembers(): Member[] {
    return db.select().from(members).orderBy(asc(members.displayName)).all();
  }

  getCurrentMembers(chamber?: string): Member[] {
    const conditions = [eq(members.isCurrent, true), isNotNull(members.dim1)];
    if (chamber) {
      conditions.push(eq(members.chamber, chamber));
    }
    return db
      .select()
      .from(members)
      .where(and(...conditions))
      .orderBy(asc(members.dim1))
      .all();
  }

  upsertMember(member: InsertMember): Member {
    const existing = db
      .select()
      .from(members)
      .where(eq(members.bioguideId, member.bioguideId))
      .get();

    if (existing) {
      return db
        .update(members)
        .set(member)
        .where(eq(members.bioguideId, member.bioguideId))
        .returning()
        .get()!;
    } else {
      return db.insert(members).values(member).returning().get()!;
    }
  }

  getVotesForMember(bioguideId: string, limit = 50): MemberVote[] {
    return db
      .select()
      .from(memberVotes)
      .where(eq(memberVotes.bioguideId, bioguideId))
      .orderBy(desc(memberVotes.voteDate))
      .limit(limit)
      .all();
  }

  upsertVotes(votes: InsertMemberVote[]): void {
    for (const vote of votes) {
      const exists = db
        .select()
        .from(memberVotes)
        .where(
          and(
            eq(memberVotes.bioguideId, vote.bioguideId),
            eq(memberVotes.voteDate, vote.voteDate),
            vote.rollCall ? eq(memberVotes.rollCall, vote.rollCall) : sql`1=1`
          )
        )
        .get();

      if (!exists) {
        db.insert(memberVotes).values(vote).run();
      }
    }
  }

  hasVoteCache(bioguideId: string): boolean {
    const count = db
      .select({ count: sql<number>`count(*)` })
      .from(memberVotes)
      .where(eq(memberVotes.bioguideId, bioguideId))
      .get()?.count ?? 0;
    return count > 0;
  }
}

export const storage = new Storage();
