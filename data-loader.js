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
   * X = economic axis (from Nokken-Poole dim1)
   * Y = social axis (from dim2, party-adjusted)
   */
  function computeCompass(member, party) {
    var dim1 = member.dim1;
    var dim2 = member.dim2;
    var nk1 = member.nk_dim1;
    var nk2 = member.nk_dim2;

    if (dim1 === null || dim2 === null) {
      return { compassX: null, compassY: null };
    }

    var baseX = nk1 !== null ? nk1 : dim1;
    var compassX = baseX * 0.55;

    var baseY = nk2 !== null ? nk2 : dim2;
    var compassY;
    if (party === "Republican") {
      compassY = baseY * 0.8 + 0.3;
    } else if (party === "Democrat") {
      compassY = baseY * 0.7 - 0.3;
    } else {
      compassY = baseY * 0.75;
    }

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

    // Intercept stats.json to recompute from live members if available
    if (url.indexOf("stats.json") !== -1) {
      var cachedMembers = getCachedMembers();
      if (cachedMembers) {
        var stats = computeStats(cachedMembers);
        return Promise.resolve(new Response(JSON.stringify(stats), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
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
   * Compute stats from member data.
   * Only count members marked as currently serving (isCurrent or has govtrackId).
   */
  function computeStats(members) {
    var house = 0, senate = 0, dems = 0, reps = 0, inds = 0;
    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      // Only count currently serving members
      if (!m.isCurrent && !m.govtrackId) continue;
      if (m.chamber === "House") house++;
      else senate++;
      if (m.party === "Democrat") dems++;
      else if (m.party === "Republican") reps++;
      else inds++;
    }
    return {
      total_historical: 12579,
      current_total: members.length,
      current_house: house,
      current_senate: senate,
      current_dems: dems,
      current_reps: reps,
      current_ind: inds
    };
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
   * Global hook called by the bundle's ra() function.
   * Loads voting records from pre-processed Voteview data files.
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

        console.log("[CongressWatch] Loaded", all.length, "total votes");
        return { votes: all, source: "voteview", totalCount: all.length };
      });
    }).catch(function (err) {
      console.error("[CongressWatch] Vote loading failed:", err);
      return { votes: [], source: "error", totalCount: 0 };
    });
  };

})();
