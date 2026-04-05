import { db } from "./db";
import { members } from "@shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface SeedMember {
  bioguide_id: string;
  display_name: string;
  raw_name: string;
  chamber: string;
  state: string;
  district: string | null;
  party: string;
  party_code: string;
  born: number | null;
  last_congress: number;
  is_current: boolean;
  dim1: number | null;
  dim2: number | null;
  num_votes: number;
}

async function seed() {
  console.log("Creating tables...");
  
  db.run(sql`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bioguide_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    raw_name TEXT NOT NULL,
    chamber TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT,
    party TEXT NOT NULL,
    party_code TEXT NOT NULL,
    born INTEGER,
    last_congress INTEGER NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0,
    dim1 REAL,
    dim2 REAL,
    num_votes INTEGER NOT NULL DEFAULT 0,
    image_url TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS member_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bioguide_id TEXT NOT NULL,
    member_id INTEGER NOT NULL,
    congress INTEGER NOT NULL,
    session INTEGER,
    chamber TEXT NOT NULL,
    roll_call INTEGER,
    vote_date TEXT NOT NULL,
    vote_time TEXT,
    bill_id TEXT,
    bill_title TEXT,
    question TEXT NOT NULL,
    description TEXT,
    result TEXT,
    position TEXT NOT NULL,
    category TEXT,
    cached INTEGER DEFAULT 0
  )`);

  const count = db.select({ count: sql<number>`count(*)` }).from(members).get()?.count ?? 0;
  
  if (count > 0) {
    console.log(`Database already has ${count} members, skipping seed.`);
    return;
  }

  console.log("Loading seed data...");
  const seedPath = path.join(process.cwd(), "seed_data.json");
  const seedData: SeedMember[] = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

  console.log(`Inserting ${seedData.length} members...`);
  
  const BATCH = 500;
  for (let i = 0; i < seedData.length; i += BATCH) {
    const batch = seedData.slice(i, i + BATCH);
    for (const m of batch) {
      db.run(sql`INSERT OR IGNORE INTO members 
        (bioguide_id, display_name, raw_name, chamber, state, district, party, party_code, born, last_congress, is_current, dim1, dim2, num_votes)
        VALUES (
          ${m.bioguide_id}, ${m.display_name}, ${m.raw_name}, ${m.chamber}, ${m.state},
          ${m.district}, ${m.party}, ${m.party_code}, ${m.born}, ${m.last_congress},
          ${m.is_current ? 1 : 0}, ${m.dim1}, ${m.dim2}, ${m.num_votes}
        )`);
    }
    console.log(`  Inserted ${Math.min(i + BATCH, seedData.length)} / ${seedData.length}`);
  }

  const finalCount = db.select({ count: sql<number>`count(*)` }).from(members).get()?.count ?? 0;
  console.log(`Seed complete. Total members in DB: ${finalCount}`);
}

seed().catch(console.error);
