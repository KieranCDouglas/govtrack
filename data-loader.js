/**
 * Civicism Dynamic Data Loader
 *
 * Intercepts fetch requests to data/stats.json to fetch live member counts
 * from the GovTrack API on each page load.
 *
 * Member data (members-current.json) is kept fresh by the daily GitHub Actions
 * workflow which fetches from Voteview server-side and commits updated JSON.
 * Client-side fetches from voteview.com are blocked by CORS, so we serve the
 * static file directly.
 *
 * Loaded BEFORE the main app bundle via <script> tag.
 */
(function () {
  "use strict";
  console.log("[Civicism] data-loader.js v20260327h loaded");

  var CONGRESS = 119;

  var originalFetch = window.fetch;

  function _exposeLastNames(members) {
    if (!Array.isArray(members)) return;
    window.__cwLastNameMap = window.__cwLastNameMap || {};
    window.__cwFirstNameMap = window.__cwFirstNameMap || {};
    members.forEach(function (m) {
      if (m.bioguideId && m.displayName) {
        var parts = m.displayName.split(/\s+/);
        window.__cwLastNameMap[m.bioguideId] = parts[parts.length - 1];
        window.__cwFirstNameMap[m.bioguideId] = parts[0];
      }
    });
    window.dispatchEvent(new CustomEvent("cwMembersLoaded"));
  }

  /**
   * Override window.fetch to intercept data file requests.
   */
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url ? input.url : "");

    // Pass members-current.json through to the static file (kept fresh by GitHub Actions)
    // and expose name maps for ui-enhancements.js sorting.
    if (url.indexOf("members-current.json") !== -1) {
      return originalFetch.apply(window, arguments).then(function (resp) {
        return resp.json().then(function (members) {
          _exposeLastNames(members);
          window.__cwIdeologyMap = window.__cwIdeologyMap || {};
          window.__cwMembersData = window.__cwMembersData || {};
          members.forEach(function (m) {
            if (m.bioguideId && m.dim1 !== undefined && m.dim1 !== null) {
              window.__cwIdeologyMap[m.bioguideId] = m.dim1;
            }
            if (m.bioguideId) {
              window.__cwMembersData[m.bioguideId] = m;
            }
          });

          // When "All historical" mode is active the bundle prepends members-current.json
          // to members-index.json, putting all current members above former ones.
          // Returning [] forces the bundle to use only members-index.json (which already
          // contains current 119th-congress members, sorted alphabetically).
          // Detect "all" mode via the DOM trigger (if rendered) or saved sessionStorage.
          var isAllMode = false;
          try {
            var trigger = document.querySelector('[data-testid="select-current"]');
            if (trigger && /all\s+historical/i.test(trigger.textContent || "")) {
              isAllMode = true;
            }
            if (!isAllMode) {
              var sf = JSON.parse(sessionStorage.getItem("cw-member-filters") || "{}");
              if (sf.current === "all") isAllMode = true;
            }
          } catch (e) { /* ignore */ }

          if (isAllMode) {
            return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
          }

          // Sort by first name before handing data to React
          members.sort(function (a, b) {
            var la = ((a.displayName || "").trim().split(/\s+/)[0] || "").toLowerCase();
            var lb = ((b.displayName || "").trim().split(/\s+/)[0] || "").toLowerCase();
            return la.localeCompare(lb);
          });
          return new Response(JSON.stringify(members), {
            status: 200, headers: { "Content-Type": "application/json" }
          });
        });
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

    // Cache members-index.json, sort by last name, then return sorted response to React
    if (url.indexOf("members-index.json") !== -1) {
      return originalFetch.apply(window, arguments).then(function (resp) {
        return resp.json().then(function (data) {
          _membersIndex = data;
          if (Array.isArray(data)) {
            window.__cwLastNameMap = window.__cwLastNameMap || {};
            window.__cwFirstNameMap = window.__cwFirstNameMap || {};
            window.__cwIdeologyMap = window.__cwIdeologyMap || {};
            data.forEach(function (m) {
              if (m.b && m.n) {
                var parts = m.n.trim().split(/\s+/);
                window.__cwFirstNameMap[m.b] = parts[0];
                window.__cwLastNameMap[m.b] = parts[parts.length - 1];
              }
              if (m.b && m.x !== undefined && m.x !== null) {
                window.__cwIdeologyMap[m.b] = m.x;
              }
            });
            window.dispatchEvent(new CustomEvent("cwMembersLoaded"));
            // Sort by first name before handing data to React
            data.sort(function (a, b) {
              var la = ((a.n || "").trim().split(/\s+/)[0] || "").toLowerCase();
              var lb = ((b.n || "").trim().split(/\s+/)[0] || "").toLowerCase();
              return la.localeCompare(lb);
            });
          }
          return new Response(JSON.stringify(data), {
            status: 200, headers: { "Content-Type": "application/json" }
          });
        });
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

      var stats = {
        total_historical: historicalCount,
        current_total: counts[0],
        current_house: counts[1],
        current_senate: counts[2],
        current_dems: counts[3],
        current_reps: counts[4],
        current_ind: counts[0] - counts[3] - counts[4],
        congress: CONGRESS,
        congress_total: counts[0],
        congress_house: counts[1],
        congress_senate: counts[2]
      };
      _govtrackStatsCache = stats;
      try { sessionStorage.setItem("cw_govtrack_stats", JSON.stringify(stats)); } catch (e) { /* ignore */ }
      console.log("[Civicism] Live stats from GovTrack:", stats);
      return stats;
    }).catch(function (err) {
      console.warn("[Civicism] GovTrack stats fetch failed, using static:", err.message);
      return null;
    });
  }

  // Passive cache — populated when the bundle fetches members-index.json (see fetch intercept above)
  var _membersIndex = null;

  /* ================================================================
     GOVTRACK  PERSON  LOOKUP
     Resolves a bioguideId to a GovTrack person ID when govtrackId
     is not available in the static data.
     ================================================================ */

  var _govtrackIdCache = {}; // bioguideId -> govtrackId

  function lookupGovTrackId(bioguideId) {
    if (_govtrackIdCache[bioguideId]) return Promise.resolve(_govtrackIdCache[bioguideId]);
    var url = "https://www.govtrack.us/api/v2/person?bioguideid=" +
      encodeURIComponent(bioguideId) + "&limit=1";
    return originalFetch.call(window, url).then(function (r) {
      if (!r.ok) throw new Error("Person lookup " + r.status);
      return r.json();
    }).then(function (data) {
      var objects = data.objects || [];
      if (objects.length > 0 && objects[0].id) {
        var id = objects[0].id;
        _govtrackIdCache[bioguideId] = id;
        console.log("[Civicism] Resolved", bioguideId, "-> GovTrack person", id);
        return id;
      }
      throw new Error("No GovTrack person found for " + bioguideId);
    });
  }

  /**
   * Fetch recent votes from the GovTrack API for a given member.
   * Returns an array of vote objects in the same shape as Voteview votes.
   * If afterDate is provided, only returns votes after that date.
   */
  // Global maps for vote metadata not exposed via React data attributes
  window.__cwVoteLinks = window.__cwVoteLinks || {};
  window.__cwVoteDates = window.__cwVoteDates || {};

  function fetchGovTrackVotes(govtrackId, afterDate) {
    var GT_API = "https://www.govtrack.us/api/v2";
    var allVotes = [];
    var offset = 0;
    var pageSize = 500;
    var maxVotes = 1000; // GovTrack's voter API returns 400 beyond offset ~1500

    function mapVote(item) {
      var vote = item.vote || {};
      var optKey = (item.option && item.option.key) || "";
      var position;
      if (optKey === "+") position = "Yes";
      else if (optKey === "-") position = "No";
      else if (optKey === "0") position = "Present";
      else position = "Not Voting";

      // related_bill can be an integer ID or an expanded object
      var rb = vote.related_bill;
      var rbIsObj = rb && typeof rb === "object";
      var rbId = rbIsObj ? rb.id : (typeof rb === "number" ? rb : undefined);
      var rbDisplay = rbIsObj ? rb.display_number : undefined;
      var rbTitle = rbIsObj ? rb.title : undefined;

      // When related_bill is just an integer, parse bill ID + title from the question text
      // Question format: "H.R. 7084: Defending American Property Abroad Act of 2026"
      // or "On Motion to Recommit: H.R. 8029: Pay Our Homeland Defenders Act"
      var q = vote.question || "";
      if (!rbDisplay && q) {
        var billRe = /\b(H\.?\s*R\.?\s*\d+|H\.?\s*(?:Con\.?\s*)?(?:J\.?\s*)?Res\.?\s*\d+|S\.?\s*(?:Con\.?\s*)?(?:J\.?\s*)?(?:Res\.?\s*)?\s*\d+|PN\s*\d+)\b/i;
        var billMatch = q.match(billRe);
        if (billMatch) {
          rbDisplay = billMatch[1].replace(/\s+/g, " ").trim();
          // Extract title after the bill ID — look for ": Title" or just "ID Title"
          var afterBill = q.substring(billMatch.index + billMatch[0].length);
          var titleMatch = afterBill.match(/^[:\s]+(.+)/);
          if (titleMatch && !rbTitle) {
            rbTitle = titleMatch[1].trim();
          }
        }
      }

      var mapped = {
        question: vote.question || "Roll Call Vote",
        position: position,
        voteDate: (vote.created || "").substring(0, 10),
        result: vote.result || undefined,
        billId: rbDisplay || undefined,
        billTitle: rbTitle || undefined,
        billGovtrackId: rbId || undefined,
        description: vote.category_label || undefined,
        category: vote.category || undefined,
        chamber: vote.chamber_label || undefined,
        congress: vote.congress || undefined,
        voteId: vote.number || vote.id || undefined,
        totalPlus: vote.total_plus || 0,
        totalMinus: vote.total_minus || 0,
        totalOther: vote.total_other || 0,
        questionDetails: vote.question_details || undefined,
        _source: "govtrack"
      };

      // Store metadata in global maps for enhancement layer
      var voteNum = vote.number || vote.id;
      var voteCongress = vote.congress;
      var voteChamber = (vote.chamber || "").charAt(0);
      if (voteNum && voteCongress && voteChamber) {
        var vKey = String(voteCongress) + voteChamber + String(voteNum);
        if (vote.link) window.__cwVoteLinks[vKey] = vote.link;
        if (vote.created) window.__cwVoteDates[vKey] = (vote.created || "").substring(0, 10);
      }

      return mapped;
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
      }).catch(function (pageErr) {
        // On page-level error (CORS / rate-limit), return what we have so far
        console.warn("[Civicism] Page fetch failed at offset " + offset + ", returning " + allVotes.length + " votes collected so far:", pageErr.message);
        return allVotes;
      });
    }

    return fetchPage();
  }

  /**
   * Global hook called by the bundle's ra() function.
   * Uses GovTrack API as the sole vote data source.
   * If govtrackId is missing, resolves it via person lookup first.
   */
  window.__cwLoadVotes = function (bioguideId, govtrackId) {
    console.log("[Civicism] __cwLoadVotes called:", bioguideId, "govtrackId:", govtrackId);
    // Resolve govtrackId if not provided
    var idPromise = govtrackId
      ? Promise.resolve(govtrackId)
      : lookupGovTrackId(bioguideId);

    return idPromise.then(function (resolvedId) {
      console.log("[Civicism] Fetching votes from GovTrack API for person", resolvedId);
      return fetchGovTrackVotes(resolvedId, null).then(function (gtVotes) {
        console.log("[Civicism] Loaded", gtVotes.length, "votes from GovTrack API");
        return { votes: gtVotes, source: "govtrack.us", totalCount: gtVotes.length };
      });
    }).catch(function (err) {
      console.error("[Civicism] Vote loading failed:", err.message, err.stack || err);
      return { votes: [], source: "error", totalCount: 0 };
    });
  };

})();
