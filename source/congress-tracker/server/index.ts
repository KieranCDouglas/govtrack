import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { members } from "@shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function ensureSeeded() {
  try {
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
      compass_x REAL,
      compass_y REAL,
      num_votes INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      govtrack_id INTEGER
    `);
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
    if (count === 0) {
      const seedPath = path.join(process.cwd(), 'seed_data.json');
      if (fs.existsSync(seedPath)) {
        const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
        for (const m of seedData) {
          db.run(sql`INSERT OR IGNORE INTO members 
            (bioguide_id, display_name, raw_name, chamber, state, district, party, party_code, born, last_congress, is_current, dim1, dim2, compass_x, compass_y, num_votes, govtrack_id)
            VALUES (${m.bioguide_id}, ${m.display_name}, ${m.raw_name}, ${m.chamber}, ${m.state},
              ${m.district}, ${m.party}, ${m.party_code}, ${m.born}, ${m.last_congress},
              ${m.is_current ? 1 : 0}, ${m.dim1}, ${m.dim2}, ${m.compass_x ?? null}, ${m.compass_y ?? null}, ${m.num_votes}, ${m.govtrack_id ?? null})`);
        }
        console.log(`Seeded ${seedData.length} members from seed_data.json`);
      }
    }
  } catch(e) {
    console.error('Seed error:', e);
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureSeeded();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
