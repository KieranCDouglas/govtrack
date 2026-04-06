import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Members of Congress
export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bioguideId: text("bioguide_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  rawName: text("raw_name").notNull(),
  chamber: text("chamber").notNull(), // 'House' | 'Senate'
  state: text("state").notNull(),
  district: text("district"),
  party: text("party").notNull(),
  partyCode: text("party_code").notNull(),
  born: integer("born"),
  lastCongress: integer("last_congress").notNull(),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  dim1: real("dim1"), // DW-NOMINATE economic dimension
  dim2: real("dim2"), // DW-NOMINATE social/2nd dimension
  compassX: real("compass_x"), // Derived: Free Market (+1) to State-Directed (-1)
  compassY: real("compass_y"), // Derived: Traditional (-1) to Progressive (+1)
  numVotes: integer("num_votes").notNull().default(0),
  imageUrl: text("image_url"),
  govtrackId: integer("govtrack_id"), // GovTrack.us person ID for live vote fetching
  policyHeterodoxy: text("policy_heterodoxy"), // JSON: {family -> normalized distance from party median}
});

// Cached recent votes per member (fetched from ProPublica)
export const memberVotes = sqliteTable("member_votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bioguideId: text("bioguide_id").notNull(),
  memberId: integer("member_id").notNull(),
  congress: integer("congress").notNull(),
  session: integer("session"),
  chamber: text("chamber").notNull(),
  rollCall: integer("roll_call"),
  voteDate: text("vote_date").notNull(),
  voteTime: text("vote_time"),
  billId: text("bill_id"),
  billTitle: text("bill_title"),
  question: text("question").notNull(),
  description: text("description"),
  result: text("result"),
  position: text("position").notNull(), // Yes/No/Not Voting/Present
  category: text("category"),
  cached: integer("cached", { mode: "boolean" }).default(false),
});

// Insert schemas
export const insertMemberSchema = createInsertSchema(members).omit({ id: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;

export const insertMemberVoteSchema = createInsertSchema(memberVotes).omit({ id: true });
export type InsertMemberVote = z.infer<typeof insertMemberVoteSchema>;
export type MemberVote = typeof memberVotes.$inferSelect;
