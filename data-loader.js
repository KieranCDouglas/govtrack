/**
 * CongressWatch Dynamic Data Loader
 * 
 * Intercepts fetch requests to data/members-current.json and data/stats.json,
 * fetching live NOMINATE scores from Voteview on each page load.
 * Falls back to the static JSON files if the API is unavailable.
 * 
 * Loaded BEFORE the main app bundle via <script> tag.
 */
(function () {
  "use strict";

  var CONGRESS = 119;
  var VOTEVIEW_HOUSE = "https://voteview.com/static/data/out/members/H" + CONGRESS + "_members.csv";
  var VOTEVIEW_SENATE = "https://voteview.com/static/data/out/members/S" + CONGRESS + "_members.csv";
  var CACHE_KEY = "cw_members_cache";
  var CACHE_TS_KEY = "cw_members_ts";
  var CACHE_TTL = 3600000; // 1 hour in ms

  var originalFetch = window.fetch;

  /**
   * Parse CSV text into an array of objects.
   */
  function parseCSV(text) {
    var lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    var headers = lines[0].split(",").map(function (h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var values = lines[i].split(",");
      if (values.length !== headers.length) continue;
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[j].trim();
      }
      rows.push(obj);
    }
    return rows;
  }

  /**
   * Convert Voteview bioname "LAST, First Middle" to "First Last".
   */
  function formatName(bioname) {
    if (!bioname) return "";
    bioname = bioname.replace(/"/g, "").trim();
    if (bioname.indexOf(",") === -1) return titleCase(bioname);
    var parts = bioname.split(",");
    var last = titleCase(parts[0].trim());
    var first = parts[1].trim();
    // Handle nicknames in parentheses
    var parenIdx = first.indexOf("(");
    if (parenIdx >= 0) {
      first = first.substring(parenIdx + 1).replace(")", "").trim();
    }
    // Take first word only
    var firstWord = first.split(/\s+/)[0];
    return titleCase(firstWord) + " " + last;
  }

  function titleCase(s) {
    return s.replace(/\w\S*/g, function (t) {
      return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase();
    });
  }

  function safeFloat(val) {
    if (!val || val === "NA" || val === "") return null;
    var n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  function safeInt(val) {
    if (!val || val === "NA" || val === "") return 0;
    var n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Compute compass coordinates from NOMINATE scores.
   * X = Dimension 1 (primary left-right ideology, Nokken-Poole preferred)
   * Y = Dimension 2 (secondary dimension, no party adjustment)
   */
  function computeCompass(member, party) {
    var dim1 = member.dim1;
    var dim2 = member.dim2;
    var nk1 = member.nk_dim1;
    var nk2 = member.nk_dim2;

    if (dim1 === null || dim2 === null) {
      return { compassX: null, compassY: null };
    }

    var compassX = nk1 !== null ? nk1 : dim1;
    var compassY = nk2 !== null ? nk2 : dim2;

    return {
      compassX: Math.round(Math.max(-1, Math.min(1, compassX)) * 10000) / 10000,
      compassY: Math.round(Math.max(-1, Math.min(1, compassY)) * 10000) / 10000
    };
  }

  /**
   * Transform Voteview CSV rows into members-current.json format.
   * Merges with existing static data for fields Voteview doesn't provide.
   */
  function transformMembers(voteviewRows, staticMembers) {
    // Build a lookup of static members by bioguideId for fallback fields
    var staticLookup = {};
    if (staticMembers && Array.isArray(staticMembers)) {
      for (var i = 0; i < staticMembers.length; i++) {
        var sm = staticMembers[i];
        staticLookup[sm.bioguideId] = sm;
      }
    }

    var members = [];
    for (var k = 0; k < voteviewRows.length; k++) {
      var row = voteviewRows[k];
      var bioguide = (row.bioguide_id || "").trim();
      if (!bioguide) continue;

      var partyCode = parseInt(row.party_code || "0", 10);
      var party;
      if (partyCode === 100) party = "Democrat";
      else if (partyCode === 200) party = "Republican";
      else party = "Independent";

      var chamber = (row.chamber || "").trim();
      var chamberName = chamber === "House" ? "House" : chamber === "Senate" ? "Senate" : chamber;

      var dim1 = safeFloat(row.nominate_dim1);
      var dim2 = safeFloat(row.nominate_dim2);
      var nk1 = safeFloat(row.nokken_poole_dim1);
      var nk2 = safeFloat(row.nokken_poole_dim2);

      var compass = computeCompass(
        { dim1: dim1, dim2: dim2, nk_dim1: nk1, nk_dim2: nk2 },
        party
      );

      var districtCode = (row.district_code || "0").trim();
      var district = districtCode !== "0" && chamberName === "House" ? districtCode : null;

      var bornRaw = (row.born || "").trim();
      var born = bornRaw && bornRaw !== "NA" ? parseInt(parseFloat(bornRaw), 10) : null;

      // Get govtrackId and policyHeterodoxy from static data (can't compute from Voteview alone)
      var staticData = staticLookup[bioguide];

      members.push({
        bioguideId: bioguide,
        displayName: formatName(row.bioname),
        chamber: chamberName,
        state: (row.state_abbrev || "").trim(),
        district: district,
        party: party,
        partyCode: String(partyCode),
        born: born,
        lastCongress: CONGRESS,
        dim1: dim1 !== null ? Math.round(dim1 * 1000) / 1000 : null,
        dim2: dim2 !== null ? Math.round(dim2 * 1000) / 1000 : null,
        numVotes: safeInt(row.nominate_number_of_votes),
        compassX: compass.compassX,
        compassY: compass.compassY,
        govtrackId: staticData ? staticData.govtrackId : null,
        isCurrent: staticData ? (staticData.isCurrent !== false) : false,
        policyHeterodoxy: staticData ? staticData.policyHeterodoxy : {}
      });
    }

    // Sort by display name
    members.sort(function (a, b) {
      return a.displayName.localeCompare(b.displayName);
    });

    return members;
  }

  /**
   * Fetch live NOMINATE data from Voteview and transform to app format.
   */
  function fetchLiveMembers(staticMembers) {
    return Promise.all([
      originalFetch.call(window, VOTEVIEW_HOUSE).then(function (r) {
        if (!r.ok) throw new Error("House CSV fetch failed: " + r.status);
        return r.text();
      }),
      originalFetch.call(window, VOTEVIEW_SENATE).then(function (r) {
        if (!r.ok) throw new Error("Senate CSV fetch failed: " + r.status);
        return r.text();
      })
    ]).then(function (results) {
      var houseRows = parseCSV(results[0]);
      var senateRows = parseCSV(results[1]);

      // Add chamber field since CSV doesn't include it directly
      for (var i = 0; i < houseRows.length; i++) houseRows[i].chamber = "House";
      for (var j = 0; j < senateRows.length; j++) senateRows[j].chamber = "Senate";

      var allRows = houseRows.concat(senateRows);
      return transformMembers(allRows, staticMembers);
    });
  }

  /**
   * Check if cached data exists and is fresh enough.
   */
  function getCachedMembers() {
    try {
      var ts = sessionStorage.getItem(CACHE_TS_KEY);
      if (ts && (Date.now() - parseInt(ts, 10)) < CACHE_TTL) {
        var cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) return JSON.parse(cached);
      }
    } catch (e) {
      // sessionStorage might be unavailable
    }
    return null;
  }

  function setCachedMembers(members) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(members));
      sessionStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch (e) {
      // Storage might be full or unavailable
    }
  }

  /**
   * Override window.fetch to intercept data file requests.
   */
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url ? input.url : "");

    // Intercept members-current.json requests
    if (url.indexOf("members-current.json") !== -1) {
      // Check session cache first
      var cached = getCachedMembers();
      if (cached) {
        return Promise.resolve(new Response(JSON.stringify(cached), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }

      // Fetch static JSON first (for fallback fields like govtrackId, policyHeterodoxy)
      return originalFetch.apply(window, arguments).then(function (staticResponse) {
        return staticResponse.clone().json().then(function (staticMembers) {
          // Try live Voteview data, merge with static for missing fields
          return fetchLiveMembers(staticMembers).then(function (liveMembers) {
            console.log("[CongressWatch] Loaded " + liveMembers.length + " members from live Voteview data");
            setCachedMembers(liveMembers);
            return new Response(JSON.stringify(liveMembers), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          });
        });
      }).catch(function (err) {
        console.warn("[CongressWatch] Live data fetch failed, using static fallback:", err.message);
        return originalFetch.apply(window, [input, init]);
      });
    }

    // Intercept stats.json — fetch live counts from GovTrack API
    // (Voteview includes resigned/replaced members; GovTrack has only current)
    if (url.indexOf("stats.json") !== -1) {
      return fetchGovTrackStats().then(function (stats) {
        if (stats) {
          return new Response(JSON.stringify(stats), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
        // Fall back to static stats.json
        return originalFetch.apply(window, [input, init]);
      });
    }

    // Cache members-index.json when it's fetched by the bundle
    if (url.indexOf("members-index.json") !== -1) {
      return originalFetch.apply(window, arguments).then(function (resp) {
        resp.clone().json().then(function (data) {
          _membersIndex = data;
        });
        return resp;
      });
    }

    // Pass through all other requests
    return originalFetch.apply(window, arguments);
  };

  /**
   * Fetch current member counts from GovTrack API.
   * Uses role?current=true with limit=1 to get meta.total_count for each slice.
   * Caches in sessionStorage for the browser session.
   */
  var _govtrackStatsCache = null;
  function fetchGovTrackStats() {
    if (_govtrackStatsCache) return Promise.resolve(_govtrackStatsCache);

    // Check sessionStorage first
    try {
      var cached = sessionStorage.getItem("cw_govtrack_stats");
      if (cached) {
        _govtrackStatsCache = JSON.parse(cached);
        return Promise.resolve(_govtrackStatsCache);
      }
    } catch (e) { /* ignore */ }

    var API = "https://www.govtrack.us/api/v2/role?current=true&limit=1";
    function getCount(extra) {
      return originalFetch.call(window, API + (extra || ""))
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.meta ? d.meta.total_count : 0; });
    }

    return Promise.all([
      getCount(""),
      getCount("&role_type=representative"),
      getCount("&role_type=senator"),
      getCount("&party=Democrat"),
      getCount("&party=Republican")
    ]).then(function (counts) {
      var historicalCount = _membersIndex ? _membersIndex.length : 12579;

      // Compute full-congress totals from Voteview cached members
      var cachedMembers = getCachedMembers();
      var congressTotal = 0, congressHouse = 0, congressSenate = 0;
      if (cachedMembers) {
        congressTotal = cachedMembers.length;
        for (var i = 0; i < cachedMembers.length; i++) {
          if (cachedMembers[i].chamber === "House") congressHouse++;
          else congressSenate++;
        }
      }

      var stats = {
        total_historical: historicalCount,
        current_total: counts[0],
        current_house: counts[1],
        current_senate: counts[2],
        current_dems: counts[3],
        current_reps: counts[4],
        current_ind: counts[0] - counts[3] - counts[4],
        congress: CONGRESS,
        congress_total: congressTotal || 547,
        congress_house: congressHouse || 445,
        congress_senate: congressSenate || 102
      };
      _govtrackStatsCache = stats;
      try { sessionStorage.setItem("cw_govtrack_stats", JSON.stringify(stats)); } catch (e) { /* ignore */ }
      console.log("[CongressWatch] Live stats from GovTrack:", stats);
      return stats;
    }).catch(function (err) {
      console.warn("[CongressWatch] GovTrack stats fetch failed, using static:", err.message);
      return null;
    });
  }

  /* ================================================================
     VOTEVIEW  VOTE  DATA  LOADING
     Uses pre-processed local JSON files (data/votes/{C}{congress}.json)
     generated from Voteview CSV data by scripts/fetch_vote_data.py.

     JSON format:
       r: [[rollnum,date,bill,question,result,yea,nay,desc], ...]
       v: { "icpsr": "16119..." }  (cast codes as single-digit string)
     ================================================================ */

  var _membersIndex = null;
  var _congressVoteCache = {}; // "H119" -> parsed JSON data

  function ensureMembersIndex() {
    if (_membersIndex) return Promise.resolve(_membersIndex);
    return originalFetch.call(window, "./data/members-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { _membersIndex = data; return data; });
  }

  /**
   * Load and cache pre-processed vote data for a chamber/congress pair.
   */
  function loadCongressVoteData(chamberCode, congress) {
    var key = chamberCode + congress;
    if (_congressVoteCache[key]) return Promise.resolve(_congressVoteCache[key]);

    var url = "./data/votes/" + key + ".json";
    return originalFetch.call(window, url).then(function (r) {
      if (!r.ok) throw new Error(key + " " + r.status);
      return r.json();
    }).then(function (data) {
      _congressVoteCache[key] = data;
      return data;
    });
  }

  function castCodeToPosition(cc) {
    if (cc >= 1 && cc <= 3) return "Yes";
    if (cc >= 4 && cc <= 6) return "No";
    if (cc === 7) return "Present";
    return "Not Voting";
  }

  /**
   * Get a specific member's votes for one congress from pre-processed data.
   * Rollcall format: [rollnum, date, bill, question, result, yea, nay, desc]
   * Vote string: one digit per rollcall (0=missing, 1-3=Yea, 4-6=Nay, 7=Present, 8-9=NV)
   */
  function getMemberVotesForCongress(icpsr, chamberCode, congress) {
    return loadCongressVoteData(chamberCode, congress).then(function (data) {
      var voteStr = data.v[String(icpsr)] || "";
      if (!voteStr) return [];

      var out = [];
      var chLabel = chamberCode === "H" ? "House" : "Senate";

      for (var i = 0; i < data.r.length; i++) {
        var cc = parseInt(voteStr.charAt(i), 10) || 0;
        if (cc === 0) continue; // missing

        var rc = data.r[i];
        // rc: [rollnum, date, bill, question, result, yea, nay, desc]
        out.push({
          question: rc[3] || "Roll Call Vote #" + rc[0],
          position: castCodeToPosition(cc),
          voteDate: rc[1] || "",
          result: rc[4] || undefined,
          billId: rc[2] || undefined,
          billTitle: rc[7] || undefined,
          description: undefined,
          category: undefined,
          chamber: chLabel,
          congress: congress,
          voteId: rc[0] || 0,
          totalPlus: rc[5] || 0,
          totalMinus: rc[6] || 0,
          totalOther: 0,
          questionDetails: rc[7] || undefined
        });
      }
      return out;
    });
  }

  /**
   * Fetch recent votes from the GovTrack API for a given member.
   * Returns an array of vote objects in the same shape as Voteview votes.
   * If afterDate is provided, only returns votes after that date.
   */
  function fetchGovTrackVotes(govtrackId, afterDate) {
    var GT_API = "https://www.govtrack.us/api/v2";
    var allVotes = [];
    var offset = 0;
    var pageSize = 600;
    var maxVotes = 2000;

    function mapVote(item) {
      var vote = item.vote || {};
      var optKey = (item.option && item.option.key) || "";
      var position;
      if (optKey === "+") position = "Yes";
      else if (optKey === "-") position = "No";
      else if (optKey === "0") position = "Present";
      else position = "Not Voting";

      return {
        question: vote.question || "Roll Call Vote",
        position: position,
        voteDate: (vote.created || "").substring(0, 10),
        result: vote.result || undefined,
        billId: (vote.related_bill && vote.related_bill.display_number) || undefined,
        billTitle: (vote.related_bill && vote.related_bill.title) ?
          vote.related_bill.title.substring(0, 200) : undefined,
        description: vote.category_label || undefined,
        category: vote.category || undefined,
        chamber: vote.chamber_label || undefined,
        congress: vote.congress || undefined,
        voteId: vote.id || undefined,
        totalPlus: vote.total_plus || 0,
        totalMinus: vote.total_minus || 0,
        totalOther: vote.total_other || 0,
        questionDetails: vote.question_details || undefined,
        _source: "govtrack"
      };
    }

    function fetchPage() {
      var url = GT_API + "/voter?person=" + govtrackId +
        "&limit=" + pageSize + "&offset=" + offset + "&sort=-created";
      return originalFetch.call(window, url).then(function (r) {
        if (!r.ok) throw new Error("GovTrack API " + r.status);
        return r.json();
      }).then(function (data) {
        var objects = (data.objects || []).filter(function (o) { return o.vote; });
        var mapped = objects.map(mapVote);

        // If we have an afterDate cutoff, stop when we reach older votes
        var hitCutoff = false;
        for (var i = 0; i < mapped.length; i++) {
          if (afterDate && mapped[i].voteDate <= afterDate) {
            hitCutoff = true;
            break;
          }
          allVotes.push(mapped[i]);
        }

        var totalCount = (data.meta && data.meta.total_count) || 0;
        offset += pageSize;

        if (hitCutoff || !objects.length || offset >= totalCount || allVotes.length >= maxVotes) {
          return allVotes;
        }
        return fetchPage();
      });
    }

    return fetchPage();
  }

  /**
   * Global hook called by the bundle's ra() function.
   * Loads voting records from pre-processed Voteview data files,
   * then supplements with live GovTrack API data if Voteview is stale.
   */
  window.__cwLoadVotes = function (bioguideId, govtrackId) {
    return ensureMembersIndex().then(function () {
      var member = null;
      for (var i = 0; i < _membersIndex.length; i++) {
        var m = _membersIndex[i];
        if (m.b === bioguideId || (govtrackId && m.g === govtrackId)) {
          member = m;
          break;
        }
      }

      if (!member || !member.i) {
        console.warn("[CongressWatch] No ICPSR for", bioguideId);
        // Fall back to GovTrack API directly if we have a govtrackId
        if (govtrackId) {
          return fetchGovTrackVotes(govtrackId, null).then(function (votes) {
            return { votes: votes, source: "govtrack.us", totalCount: votes.length };
          }).catch(function () {
            return { votes: [], source: "none", totalCount: 0 };
          });
        }
        return { votes: [], source: "voteview", totalCount: 0 };
      }

      var icpsr = member.i;
      var ch = member.c; // "H" or "S"
      var last = member.l;
      var first = member.fc || last;

      // Load up to 5 most recent congresses
      var congresses = [];
      for (var c = last; c >= first && congresses.length < 5; c--) {
        congresses.push(c);
      }

      console.log("[CongressWatch] Loading votes for ICPSR", icpsr,
        ch === "H" ? "House" : "Senate", "congresses:", congresses.join(","));

      return Promise.all(congresses.map(function (cong) {
        return getMemberVotesForCongress(icpsr, ch, cong)
          .catch(function (err) {
            console.warn("[CongressWatch] No vote data for", ch + cong, err.message);
            return [];
          });
      })).then(function (arrays) {
        var all = [];
        for (var j = 0; j < arrays.length; j++) {
          all = all.concat(arrays[j]);
        }
        all.sort(function (a, b) {
          return (b.voteDate || "").localeCompare(a.voteDate || "");
        });

        // Check if Voteview data is stale (most recent vote > 14 days old)
        var latestDate = all.length > 0 ? all[0].voteDate : "";
        var now = new Date();
        var staleThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        var staleDate = staleThreshold.toISOString().substring(0, 10);
        var isStale = !latestDate || latestDate < staleDate;

        if (isStale && govtrackId) {
          console.log("[CongressWatch] Voteview data stale (latest: " + latestDate +
            "), fetching recent votes from GovTrack API...");

          return fetchGovTrackVotes(govtrackId, latestDate).then(function (gtVotes) {
            if (gtVotes.length > 0) {
              console.log("[CongressWatch] Got " + gtVotes.length + " newer votes from GovTrack");
              all = gtVotes.concat(all);
              // Re-sort by date descending
              all.sort(function (a, b) {
                return (b.voteDate || "").localeCompare(a.voteDate || "");
              });
            }
            return { votes: all, source: "voteview+govtrack", totalCount: all.length };
          }).catch(function (err) {
            console.warn("[CongressWatch] GovTrack supplement failed:", err.message);
            return { votes: all, source: "voteview", totalCount: all.length };
          });
        }

        console.log("[CongressWatch] Loaded", all.length, "total votes");
        return { votes: all, source: "voteview", totalCount: all.length };
      });
    }).catch(function (err) {
      console.error("[CongressWatch] Vote loading failed:", err);
      return { votes: [], source: "error", totalCount: 0 };
    });
  };

})();
