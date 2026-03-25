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

})();
