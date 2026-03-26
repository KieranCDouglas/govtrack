/**
 * ui-enhancements.js
 * Loaded BEFORE the main bundle. Provides:
 *  1. window.__getPositions  — individualized member positions
 *  2. DOM observer           — compass legends, expandable votes, disclaimer fix
 */
(function () {
  "use strict";

  /* ================================================================
     1.  INDIVIDUALIZED  MEMBER  POSITIONS
     ================================================================ */

  var POLICY = {
    healthcare: {
      title: "Healthcare",
      econ: true,
      left: "Supports expanding access to affordable healthcare, including a public option and Medicaid expansion.",
      right: "Supports market-based healthcare reform and opposes government-run healthcare programs.",
      hLeft: "While generally favoring public healthcare, shows more openness to market-based solutions than most in their party.",
      hRight: "Though aligned with market-based principles, shows some support for expanded healthcare access."
    },
    environment_energy: {
      title: "Climate & Energy",
      econ: true,
      left: "Advocates for aggressive climate legislation, clean-energy investment, and environmental protections.",
      right: "Prioritizes energy independence through domestic production and is skeptical of heavy climate regulation.",
      hLeft: "Supports climate action but takes a more pragmatic stance on energy policy than typical party members.",
      hRight: "While skeptical of regulation, shows more willingness to consider clean-energy initiatives than most in their party."
    },
    immigration: {
      title: "Immigration",
      econ: false,
      left: "Favors pathways to citizenship for undocumented immigrants and expanded protections for DACA recipients.",
      right: "Supports stricter border enforcement, reduced illegal immigration, and merit-based legal immigration.",
      hLeft: "While supportive of immigration reform, takes a more moderate stance on enforcement than typical party members.",
      hRight: "Holds firm views on border security but shows some flexibility on specific reform measures."
    },
    fiscal_tax: {
      title: "Fiscal & Tax Policy",
      econ: true,
      left: "Supports progressive taxation, social-safety-net expansions, and government investment in public services.",
      right: "Backs tax cuts, deregulation, and fiscal conservatism to promote private-sector growth.",
      hLeft: "While favoring progressive fiscal policy, shows more concern for deficit reduction than many in their party.",
      hRight: "Generally supports lower taxes but occasionally breaks with party on specific spending measures."
    },
    guns: {
      title: "Gun Policy",
      econ: false,
      left: "Backs universal background checks, assault-weapons restrictions, and red-flag laws.",
      right: "Strong defender of Second Amendment rights, opposing most new gun restrictions.",
      hLeft: "Supports gun-safety measures but takes a more moderate position on certain firearm regulations.",
      hRight: "Generally defends gun rights but shows some willingness to consider targeted safety measures."
    },
    social_rights: {
      title: "Social & Civil Rights",
      econ: false,
      left: "Champions LGBTQ+ rights, reproductive rights, and civil-liberties protections.",
      right: "Emphasizes traditional values, religious liberty, and a cautious approach to social-policy changes.",
      hLeft: "Supports civil rights broadly but takes more nuanced positions on certain social issues.",
      hRight: "Holds traditional social views overall but diverges from party on some civil-rights positions."
    },
    trade: {
      title: "Trade & Tariffs",
      econ: true,
      left: "Favors trade policies that protect workers and the environment, with skepticism toward unrestricted free trade.",
      right: "Generally supports free trade and market-oriented trade agreements.",
      hLeft: "More open to free-trade agreements than typical party members.",
      hRight: "More supportive of protectionist trade measures than the party mainstream."
    },
    military_defense: {
      title: "Military & Defense",
      econ: false,
      left: "Advocates for diplomatic solutions, reduced military spending, and restraint in foreign intervention.",
      right: "Supports strong national defense, robust military funding, and American global leadership.",
      hLeft: "While favoring diplomacy, shows more support for defense spending than many in their party.",
      hRight: "Supports strong defense but shows more restraint on military intervention than typical party members."
    },
    foreign_policy: {
      title: "Foreign Policy",
      econ: false,
      left: "Emphasizes multilateral diplomacy, international cooperation, and a human-rights-centered foreign policy.",
      right: "Favors strong alliances, peace through strength, and an America-first approach to world affairs.",
      hLeft: "Supports international engagement but takes more hawkish positions on certain foreign-policy issues.",
      hRight: "While aligned with a strong-defense posture, diverges on specific alliance or intervention questions."
    },
    criminal_justice: {
      title: "Criminal Justice",
      econ: false,
      left: "Supports criminal-justice reform, sentencing reduction, and addressing systemic inequities in policing.",
      right: "Emphasizes law and order, police funding, and tougher sentencing for violent offenders.",
      hLeft: "Supports reform but takes a more balanced position on policing and public safety.",
      hRight: "While supporting law enforcement, shows openness to targeted criminal-justice reforms."
    },
    elections_democracy: {
      title: "Elections & Democracy",
      econ: false,
      left: "Champions voting access, campaign-finance reform, and protections against voter suppression.",
      right: "Emphasizes election integrity, voter-ID requirements, and fraud prevention.",
      hLeft: "Supports expanded voting access but takes more nuanced positions on specific election reforms.",
      hRight: "Supports election-integrity measures but diverges from party on some voting-access questions."
    }
  };

  var HETERO_THRESHOLD = 0.15;

  window.__getPositions = function (member, party, St) {
    var ph = member.policyHeterodoxy;
    if (!ph) return St[party] || St.Independent;
    if (typeof ph === "string") {
      try { ph = JSON.parse(ph); } catch (_) { return St[party] || St.Independent; }
    }

    var cx = member.compassX ?? 0;
    var cy = member.compassY ?? 0;

    // For near-zero scores, fall back to party default direction
    var NEUTRAL = 0.08;
    var isRightEcon = Math.abs(cx) < NEUTRAL
      ? party === "Republican"
      : cx > 0;
    var isConservative = Math.abs(cy) < NEUTRAL
      ? party === "Republican"
      : cy > 0;

    var keys = Object.keys(POLICY);
    var scored = keys.map(function (k) {
      var v = ph[k];
      var has = v !== null && v !== undefined;
      var het = has && v > HETERO_THRESHOLD;
      return { key: k, s: (has ? 1 : 0) + (het ? 2 : 0), v: v, has: has, het: het };
    });
    scored.sort(function (a, b) { return b.s - a.s || (b.has ? 1 : 0) - (a.has ? 1 : 0); });

    var out = scored.slice(0, 6).map(function (item) {
      var d = POLICY[item.key];
      if (!d) return null;
      var useRight = d.econ ? isRightEcon : isConservative;
      var desc;
      if (item.het) {
        desc = party === "Democrat" ? d.hLeft : party === "Republican" ? d.hRight : (useRight ? d.right : d.left);
      } else {
        desc = useRight ? d.right : d.left;
      }
      return { title: d.title, description: desc, dimHint: useRight ? "+" : "-" };
    }).filter(Boolean);

    return out.length ? out : St[party] || St.Independent;
  };

  /* ================================================================
     2.  DOM  ENHANCEMENTS  (after app renders)
     ================================================================ */

  function ready(fn) {
    if (document.readyState !== "loading") setTimeout(fn, 0);
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var root = document.getElementById("root");
    if (!root) return;

    var debounce;
    var ob = new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(run, 120);
    });
    ob.observe(root, { childList: true, subtree: true });

    window.addEventListener("hashchange", function () {
      setTimeout(run, 300);
    });
    setTimeout(run, 600);

    function run() {
      addCompassLegends();
      enhanceVotes();
      injectMemberSummary();
    }
  });

  /* ---- 2a-pre  Member policy summary injection ---- */

  var _summariesData = null;
  var _summariesLoading = false;
  var _summariesCallbacks = [];

  function loadSummaries(cb) {
    if (_summariesData) { cb(_summariesData); return; }
    _summariesCallbacks.push(cb);
    if (_summariesLoading) return;
    _summariesLoading = true;

    var base = window.location.pathname.split("/").filter(Boolean).slice(0, -1).join("/");
    var prefix = base ? "/" + base : ".";
    fetch(prefix + "/data/member-summaries.json")
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) {
        _summariesData = data;
        _summariesCallbacks.forEach(function (fn) { fn(data); });
        _summariesCallbacks = [];
      })
      .catch(function () {
        _summariesData = {};
        _summariesCallbacks.forEach(function (fn) { fn({}); });
        _summariesCallbacks = [];
      });
  }

  function injectMemberSummary() {
    // Only on member detail pages: /#/members/{bioguideId}
    var hash = window.location.hash || "";
    var match = hash.match(/^#\/members\/([A-Z]\d{5,6})$/);
    if (!match) return;
    var bioguideId = match[1];

    // Find the "Issue Positions" card
    var headings = document.querySelectorAll("h2");
    var positionsCard = null;
    headings.forEach(function (h) {
      if (h.textContent.trim() === "Issue Positions") {
        positionsCard = h.closest(".bg-card");
      }
    });
    if (!positionsCard) return;

    // Don't inject twice — set marker synchronously to prevent race from
    // multiple MutationObserver callbacks queuing async loadSummaries calls
    if (positionsCard.querySelector("[data-cw-summary]") || positionsCard.hasAttribute("data-cw-summary-pending")) return;
    positionsCard.setAttribute("data-cw-summary-pending", "true");

    loadSummaries(function (summaries) {
      // Double-check inside callback in case of edge-case race
      if (positionsCard.querySelector("[data-cw-summary]")) return;

      var summary = summaries[bioguideId];
      if (!summary) { positionsCard.removeAttribute("data-cw-summary-pending"); return; }

      // Find the Issue Positions heading
      var h2 = null;
      positionsCard.querySelectorAll("h2").forEach(function (h) {
        if (h.textContent.trim() === "Issue Positions") h2 = h;
      });
      if (!h2) { positionsCard.removeAttribute("data-cw-summary-pending"); return; }

      // Create summary block and insert after the heading
      var block = document.createElement("div");
      block.setAttribute("data-cw-summary", "true");
      block.style.cssText = "margin-bottom:16px;padding:12px 14px;border-radius:8px;"
        + "background:hsl(var(--muted)/0.3);border:1px solid hsl(var(--border)/0.5);";

      // Parse summary: split into prose paragraph and bullet points
      var parts = summary.split("\n");
      var proseLines = [];
      var bulletLines = [];
      parts.forEach(function (line) {
        var trimmed = line.trim();
        if (trimmed.match(/^[-•]\s/)) {
          bulletLines.push(trimmed.replace(/^[-•]\s*/, ""));
        } else if (trimmed.length > 0) {
          proseLines.push(trimmed);
        }
      });

      var text = document.createElement("p");
      text.style.cssText = "font-size:13px;line-height:1.65;color:hsl(var(--foreground));margin:0;";
      text.textContent = proseLines.join(" ");
      block.appendChild(text);

      if (bulletLines.length > 0) {
        var ul = document.createElement("ul");
        ul.style.cssText = "margin:10px 0 0 0;padding-left:18px;list-style:disc;";
        bulletLines.forEach(function (b) {
          var li = document.createElement("li");
          li.style.cssText = "font-size:12.5px;line-height:1.55;color:hsl(var(--foreground));margin-bottom:4px;";
          li.textContent = b;
          ul.appendChild(li);
        });
        block.appendChild(ul);
      }

      var label = document.createElement("div");
      label.style.cssText = "font-size:10px;color:hsl(var(--muted-foreground));margin-top:6px;font-style:italic;";
      label.textContent = "AI-generated summary based on voting record and ideology scores.";
      block.appendChild(label);

      // Insert after the h2
      h2.insertAdjacentElement("afterend", block);

      // Hide the old generic position items (the space-y-3 div and italic disclaimer)
      var oldPositions = positionsCard.querySelector(".space-y-3");
      if (oldPositions) oldPositions.style.display = "none";
      positionsCard.querySelectorAll("p").forEach(function (p) {
        if (p.style.fontStyle === "italic" || (p.className && p.className.indexOf("italic") !== -1) ||
            (p.textContent && p.textContent.indexOf("Positions are estimated") !== -1)) {
          p.style.display = "none";
        }
      });
    });
  }

  /* ---- 2a  Compass axis-explanation boxes ---- */

  function addCompassLegends() {
    document.querySelectorAll("canvas").forEach(function (cv) {
      var par = cv.parentElement;
      if (!par) return;
      if (par.querySelector(".cw-legend")) return;

      // only target compass canvases
      var isCompass =
        (cv.width >= 200 && cv.height >= 180) ||
        (par.closest && par.closest(".bg-card") &&
         par.textContent.indexOf("Ideological") !== -1);
      // also match the full compass page canvas (large canvas, often > 500px)
      if (!isCompass && cv.width >= 500) isCompass = true;
      if (!isCompass) return;

      var box = document.createElement("div");
      box.className = "cw-legend";
      box.style.cssText =
        "display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;font-size:11px;" +
        "margin-top:10px;padding:10px 14px;border-radius:8px;" +
        "background:hsl(var(--card));border:1px solid hsl(var(--border));";

      box.innerHTML =
        '<div style="display:flex;align-items:center;gap:5px;">' +
          '<span style="color:hsl(var(--primary));font-weight:600;">\u25c2 \u25b8</span>' +
          '<span style="color:hsl(var(--muted-foreground));">Economic: Progressive (\u22121) \u2013 Conservative (+1)</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:5px;">' +
          '<span style="color:hsl(var(--primary));font-weight:600;">\u25b4 \u25be</span>' +
          '<span style="color:hsl(var(--muted-foreground));">Social: Progressive (\u22121) \u2013 Conservative (+1)</span>' +
        '</div>';

      // insert after the existing description <p>, or after canvas
      var desc = par.querySelector("p.text-xs");
      if (desc && desc.parentElement === par) {
        desc.replaceWith(box);
      } else {
        par.appendChild(box);
      }
    });
  }

  /* ---- 2b  Expandable vote items with party-line detection & filtering ---- */

  var billCache = {};

  function fetchBillSummary(gtId) {
    if (billCache[gtId]) return billCache[gtId];
    var p = fetch("https://www.govtrack.us/api/v2/bill/" + gtId)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return null;
        var sponsorName = data.sponsor ? data.sponsor.name : "";
        var cosponsorsArr = data.cosponsors || [];
        // Extract official title (describes what the bill does)
        var officialTitle = "";
        if (data.titles) {
          var off = data.titles.find(function (t) { return t[0] === "official"; });
          if (off) officialTitle = off[2] || "";
        }
        // Build congress.gov URL from bill type
        var cgUrl = "";
        if (data.congress && data.bill_type_label && data.number) {
          var typeMap = {"S.":"senate-bill","H.R.":"house-bill","H.Res.":"house-resolution","S.Res.":"senate-resolution","H.J.Res.":"house-joint-resolution","S.J.Res.":"senate-joint-resolution","H.Con.Res.":"house-concurrent-resolution","S.Con.Res.":"senate-concurrent-resolution"};
          var t = typeMap[data.bill_type_label] || "";
          if (t) cgUrl = "https://www.congress.gov/bill/" + data.congress + (data.congress === 1 ? "st" : data.congress === 2 ? "nd" : data.congress === 3 ? "rd" : "th") + "-congress/" + t + "/" + data.number;
        }
        return {
          title: data.title_without_number || data.title || "",
          officialTitle: officialTitle,
          number: data.display_number || "",
          status: data.current_status_description || "",
          statusDate: (data.current_status_date || "").substring(0, 10),
          sponsor: sponsorName,
          cosponsors: cosponsorsArr.length,
          link: data.link || ("https://www.govtrack.us" + (data.get_absolute_url || "")),
          congressDotGov: cgUrl
        };
      })
      .catch(function () { return null; });
    billCache[gtId] = p;
    return p;
  }

  /* -- Detect the member's party from the page -- */
  function detectMemberParty() {
    var el = document.querySelector(".party-dem, .party-rep, .party-ind");
    if (el) {
      var t = el.textContent.trim();
      if (t === "Democrat" || t === "Republican" || t === "Independent") return t;
    }
    return null;
  }

  /* -- Determine if a member's vote aligned with their party -- */
  function getPartyAlignment(party, position, chamber, mjrPctPlusStr, pctPlusStr) {
    if (!party || !position) return null;
    var pos = position.toLowerCase();
    if (pos === "not voting" || pos === "present") return null;
    var mjr = parseFloat(mjrPctPlusStr);
    var pct = parseFloat(pctPlusStr);
    if (isNaN(mjr) || isNaN(pct)) return null;

    var memberVotedYea = pos === "yes" || pos === "yea";
    // 119th Congress: Republican majority in both chambers
    var rFrac = chamber === "House" ? 0.506 : 0.53;

    if (party === "Republican") {
      var rPositionYea = mjr > 0.5;
      return memberVotedYea === rPositionYea ? "with" : "against";
    }
    // Democrat / Independent — estimate minority-party position
    var minPctPlus = (pct - mjr * rFrac) / (1 - rFrac);
    var dPositionYea = minPctPlus > 0.5;
    return memberVotedYea === dPositionYea ? "with" : "against";
  }

  var VOTES_PER_PAGE = 15;

  /* -- Filter bar above vote list -- */
  function addVoteFilters(container, voteSection, memberParty) {
    if (container.querySelector(".cw-vote-filters")) return;

    var bar = document.createElement("div");
    bar.className = "cw-vote-filters";
    bar.style.cssText =
      "margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;";
    bar.addEventListener("click", function (ev) { ev.stopPropagation(); });

    var inputCss =
      "padding:6px 10px;border-radius:6px;border:1px solid hsl(var(--border));" +
      "background:hsl(var(--muted)/0.3);color:hsl(var(--foreground));font-size:12px;outline:none;";

    bar.innerHTML =
      '<input type="text" placeholder="Search votes\u2026" class="cw-vote-search" ' +
        'style="flex:1;min-width:160px;' + inputCss + '" />' +
      '<select class="cw-vote-pos-filter" style="' + inputCss + '">' +
        '<option value="">All positions</option>' +
        '<option value="yea">Yea</option>' +
        '<option value="nay">Nay</option>' +
        '<option value="nv">Not Voting</option>' +
      '</select>' +
      '<select class="cw-vote-party-filter" style="' + inputCss + '">' +
        '<option value="">Party alignment</option>' +
        '<option value="with">With party</option>' +
        '<option value="against">Against party</option>' +
      '</select>' +
      '<select class="cw-vote-congress-filter" style="' + inputCss + '">' +
        '<option value="">All congresses</option>' +
      '</select>' +
      '<span class="cw-vote-count" style="font-size:11px;color:hsl(var(--muted-foreground));white-space:nowrap;"></span>';

    container.insertBefore(bar, voteSection);

    /* ---- Pagination controls (inserted after vote list) ---- */
    var pagBar = document.createElement("div");
    pagBar.className = "cw-vote-pagination";
    pagBar.style.cssText =
      "display:flex;justify-content:center;align-items:center;gap:10px;" +
      "margin-top:14px;padding:8px 0;";

    var btnCss =
      "padding:6px 14px;border-radius:6px;border:1px solid hsl(var(--border));" +
      "background:hsl(var(--muted)/0.3);color:hsl(var(--foreground));" +
      "font-size:12px;cursor:pointer;transition:background .15s;";

    pagBar.innerHTML =
      '<button class="cw-page-prev" style="' + btnCss + '">Previous</button>' +
      '<span class="cw-page-info" style="font-size:12px;color:hsl(var(--muted-foreground));"></span>' +
      '<button class="cw-page-next" style="' + btnCss + '">Next</button>';

    // Insert after voteSection
    if (voteSection.nextSibling) {
      container.insertBefore(pagBar, voteSection.nextSibling);
    } else {
      container.appendChild(pagBar);
    }

    var prevBtn  = pagBar.querySelector(".cw-page-prev");
    var nextBtn  = pagBar.querySelector(".cw-page-next");
    var pageInfo = pagBar.querySelector(".cw-page-info");

    var searchIn = bar.querySelector(".cw-vote-search");
    var posSel  = bar.querySelector(".cw-vote-pos-filter");
    var ptySel  = bar.querySelector(".cw-vote-party-filter");
    var congSel = bar.querySelector(".cw-vote-congress-filter");
    var countEl = bar.querySelector(".cw-vote-count");

    var currentPage = 0;

    function applyFilters(resetPage) {
      if (resetPage) currentPage = 0;

      var q = searchIn.value.toLowerCase().trim();
      var pv = posSel.value;
      var pa = ptySel.value;
      var cv = congSel.value;
      var matching = [];

      voteSection.querySelectorAll(":scope > div").forEach(function (item) {
        if (!item.dataset.cwExp) return;
        var show = true;

        if (q && item.textContent.toLowerCase().indexOf(q) === -1) show = false;

        if (show && pv) {
          var pos = (item.dataset.position || "").toLowerCase();
          if (pv === "yea"  && pos !== "yes" && pos !== "yea") show = false;
          if (pv === "nay"  && pos !== "no"  && pos !== "nay") show = false;
          if (pv === "nv"   && pos !== "not voting")           show = false;
        }

        if (show && cv) {
          if ((item.dataset.congress || "") !== cv) show = false;
        }

        if (show && pa && memberParty) {
          var al = getPartyAlignment(
            memberParty,
            item.dataset.position,
            item.dataset.chamber,
            item.dataset.mjrPctPlus,
            item.dataset.pctPlus
          );
          if (pa === "with"    && al !== "with")    show = false;
          if (pa === "against" && al !== "against") show = false;
        }

        if (show) matching.push(item);
        else item.style.display = "none";
      });

      var totalMatching = matching.length;
      var totalPages = Math.max(1, Math.ceil(totalMatching / VOTES_PER_PAGE));
      if (currentPage >= totalPages) currentPage = totalPages - 1;
      var start = currentPage * VOTES_PER_PAGE;
      var end = start + VOTES_PER_PAGE;

      matching.forEach(function (item, idx) {
        item.style.display = (idx >= start && idx < end) ? "" : "none";
      });

      var showingEnd = Math.min(end, totalMatching);
      countEl.textContent = totalMatching + " votes";

      // Update pagination bar
      pageInfo.textContent = "Page " + (currentPage + 1) + " of " + totalPages;
      prevBtn.disabled = currentPage <= 0;
      nextBtn.disabled = currentPage >= totalPages - 1;
      prevBtn.style.opacity = prevBtn.disabled ? "0.4" : "1";
      nextBtn.style.opacity = nextBtn.disabled ? "0.4" : "1";
      prevBtn.style.cursor = prevBtn.disabled ? "default" : "pointer";
      nextBtn.style.cursor = nextBtn.disabled ? "default" : "pointer";

      // Hide pagination if only 1 page
      pagBar.style.display = totalPages <= 1 ? "none" : "flex";
    }

    prevBtn.addEventListener("click", function () {
      if (currentPage > 0) { currentPage--; applyFilters(false); }
    });
    nextBtn.addEventListener("click", function () {
      currentPage++; applyFilters(false);
    });

    searchIn.addEventListener("input", function () { applyFilters(true); });
    posSel.addEventListener("change", function () { applyFilters(true); });
    ptySel.addEventListener("change", function () { applyFilters(true); });
    congSel.addEventListener("change", function () { applyFilters(true); });

    // debounced re-count when new items appear
    var recount;
    function populateCongressFilter() {
      var congresses = new Set();
      voteSection.querySelectorAll(":scope > div[data-congress]").forEach(function (item) {
        var c = item.dataset.congress;
        if (c) congresses.add(c);
      });
      var sorted = Array.from(congresses).sort(function (a, b) { return Number(b) - Number(a); });
      if (sorted.length <= 1) {
        congSel.style.display = "none";
      } else {
        // Preserve current selection
        var cur = congSel.value;
        congSel.innerHTML = '<option value="">All congresses</option>';
        sorted.forEach(function (c) {
          var opt = document.createElement("option");
          opt.value = c;
          opt.textContent = "Congress " + c;
          congSel.appendChild(opt);
        });
        congSel.value = cur;
        congSel.style.display = "";
      }
    }
    new MutationObserver(function () {
      clearTimeout(recount);
      recount = setTimeout(function () {
        populateCongressFilter();
        applyFilters(false);
      }, 200);
    }).observe(voteSection, { childList: true });

    // Store applyFilters so enhanceVotes can call it after marking items
    container._cwApplyFilters = applyFilters;

    // Don't run initial applyFilters here — wait for enhanceVotes to mark items first
  }

  /* -- Main vote enhancement entry point -- */
  function enhanceVotes() {
    var voteSection = document.querySelector(".divide-y.divide-border\\/40");
    if (!voteSection) return;
    var container = voteSection.parentElement;
    if (!container) return;

    var memberParty = detectMemberParty();
    addVoteFilters(container, voteSection, memberParty);

    // enhance individual vote items
    voteSection.querySelectorAll(":scope > div").forEach(function (item) {
      if (item.dataset.cwExp) return;
      var badge = item.querySelector(".vote-yes,.vote-no,.vote-not-voting,.vote-present");
      if (!badge) return;

      item.dataset.cwExp = "1";

      var gtId           = item.dataset.billGtId || "";
      var billDisplay    = item.dataset.billDisplay || "";
      var voteResult     = item.dataset.voteResult || "";
      var position       = item.dataset.position || "";
      var chamber        = item.dataset.chamber || "";
      var mjrPctPlus     = item.dataset.mjrPctPlus || "";
      var pctPlus        = item.dataset.pctPlus || "";
      var questionDetails = item.dataset.questionDetails || "";
      var congress        = item.dataset.congress || "";
      var totalPlus      = item.dataset.totalPlus || "";
      var totalMinus     = item.dataset.totalMinus || "";
      var voteIdNum      = item.dataset.voteId || "";

      var alignment = memberParty
        ? getPartyAlignment(memberParty, position, chamber, mjrPctPlus, pctPlus)
        : null;

      // ---- Inline party-alignment badge (always visible) ----
      if (alignment) {
        var ab = document.createElement("div");
        ab.style.cssText =
          "font-size:9px;padding:1px 5px;border-radius:3px;margin-top:4px;" +
          "text-align:center;font-weight:600;white-space:nowrap;";
        if (alignment === "with") {
          ab.textContent = "w/ party";
          ab.style.background = "hsl(var(--primary)/0.15)";
          ab.style.color = "hsl(var(--primary))";
        } else {
          ab.textContent = "vs party";
          ab.style.background = "hsla(0,70%,50%,0.15)";
          ab.style.color = "hsl(0,70%,55%)";
        }
        badge.parentElement.appendChild(ab);
      }

      // Remove line-clamp truncation so full text is always visible
      var questionEl = item.querySelector(".line-clamp-2") || item.querySelector(".text-sm.text-foreground");
      var allXs = item.querySelectorAll(".line-clamp-1");
      var billTitleEl = allXs[0] || null;
      var descEl      = allXs[1] || null;

      [questionEl, billTitleEl, descEl].forEach(function (el) {
        if (!el) return;
        el.style.webkitLineClamp = "unset";
        el.style.overflow = "visible";
        el.style.display = "block";
        el.style.whiteSpace = "normal";
        el.style.textOverflow = "unset";
        el.classList.remove("line-clamp-1", "line-clamp-2", "truncate");
      });

      // build expandable panel
      var panel = document.createElement("div");
      panel.className = "cw-vote-panel";
      panel.style.cssText =
        "display:none;margin-top:8px;padding:12px 14px;border-radius:8px;" +
        "background:hsl(var(--muted)/0.35);font-size:12px;line-height:1.6;" +
        "color:hsl(var(--muted-foreground));";

      var loaded = false;

      item.style.cursor = "pointer";
      item.style.transition = "background .15s";
      item.addEventListener("mouseenter", function () {
        if (panel.style.display === "none") item.style.backgroundColor = "hsl(var(--muted)/0.15)";
      });
      item.addEventListener("mouseleave", function () {
        if (panel.style.display === "none") item.style.backgroundColor = "";
      });

      var textBox = item.querySelector(".flex-1");
      if (textBox) textBox.appendChild(panel);
      else item.appendChild(panel);

      item.addEventListener("click", function (ev) {
        if (ev.target.tagName === "A" || ev.target.closest(".cw-vote-filters")) return;
        var open = panel.style.display !== "none";
        panel.style.display = open ? "none" : "block";
        item.style.backgroundColor = open ? "" : "hsl(var(--muted)/0.25)";

        if (!open && !loaded) {
          loaded = true;
          renderPanel(panel, gtId, billDisplay, voteResult, alignment, questionDetails, questionEl, billTitleEl, congress, chamber, totalPlus, totalMinus, voteIdNum, position);
        }
      });
    });

    // Now that all items are marked with cwExp, trigger pagination
    if (container._cwApplyFilters) container._cwApplyFilters(false);
  }

  /* -- Render expanded panel content -- */
  function renderPanel(panel, gtId, billDisplay, voteResult, alignment, questionDetails, questionEl, billTitleEl, congress, chamber, totalPlus, totalMinus, voteIdNum, position) {
    var qText  = (questionEl  && questionEl.textContent)  || "";
    var bTitle = (billTitleEl && billTitleEl.textContent)  || "";

    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;color:hsl(var(--muted-foreground));">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>' +
        'Loading bill details\u2026' +
      '</div>' +
      '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

    if (gtId) {
      fetchBillSummary(gtId).then(function (bill) {
        panel.innerHTML = buildExpandedHtml(bill, voteResult, alignment, questionDetails, qText, bTitle, billDisplay, congress, chamber, totalPlus, totalMinus, voteIdNum, position);
      });
    } else {
      panel.innerHTML = buildExpandedHtml(null, voteResult, alignment, questionDetails, qText, bTitle, billDisplay, congress, chamber, totalPlus, totalMinus, voteIdNum, position);
    }
  }

  /* -- Helper: parse a bill/nomination identifier into a congress.gov URL -- */
  function billIdToCongressGovUrl(rawId, congress) {
    if (!rawId || !congress) return "";
    var id = rawId.replace(/[.\s]/g, "").toUpperCase().trim();
    var c = parseInt(congress, 10);
    if (!c || c < 1) return "";
    var suffix = c === 1 ? "st" : c === 2 ? "nd" : c === 3 ? "rd" : "th";
    var base = "https://www.congress.gov/";

    // Presidential Nominations (PN123 → congress.gov/nomination/119th-congress/123)
    if (id.indexOf("PN") === 0) {
      var pnNum = id.substring(2);
      if (pnNum && /^\d+$/.test(pnNum)) {
        return base + "nomination/" + c + suffix + "-congress/" + pnNum;
      }
      return "";
    }

    // Bill type mapping — canonical and abbreviated forms
    var typeMap = {
      "HCONRES": "house-concurrent-resolution",
      "SCONRES": "senate-concurrent-resolution",
      "HCONR":   "house-concurrent-resolution",
      "SCONR":   "senate-concurrent-resolution",
      "HCRES":   "house-concurrent-resolution",
      "SCRES":   "senate-concurrent-resolution",
      "HCR":     "house-concurrent-resolution",
      "SCR":     "senate-concurrent-resolution",
      "HJRES":   "house-joint-resolution",
      "SJRES":   "senate-joint-resolution",
      "HJRE":    "house-joint-resolution",
      "SJRE":    "senate-joint-resolution",
      "HJR":     "house-joint-resolution",
      "SJR":     "senate-joint-resolution",
      "HRES":    "house-resolution",
      "SRES":    "senate-resolution",
      "HRE":     "house-resolution",
      "SRE":     "senate-resolution",
      "HR":      "house-bill",
      "S":       "senate-bill"
    };
    // Try longest prefixes first to avoid partial matches
    var prefixes = [
      "HCONRES","SCONRES","HCONR","SCONR","HCRES","SCRES","HCR","SCR",
      "HJRES","SJRES","HJRE","SJRE","HJR","SJR",
      "HRES","SRES","HRE","SRE","HR","S"
    ];
    for (var i = 0; i < prefixes.length; i++) {
      if (id.indexOf(prefixes[i]) === 0) {
        var num = id.substring(prefixes[i].length);
        if (num && /^\d+$/.test(num)) {
          return base + "bill/" + c + suffix + "-congress/" +
            typeMap[prefixes[i]] + "/" + num;
        }
      }
    }
    return "";
  }

  /* -- Build the expansion-panel HTML -- */
  function buildExpandedHtml(bill, voteResult, alignment, questionDetails, qText, bTitle, billDisplay, congress, chamber, totalPlus, totalMinus, voteIdNum, position) {
    var html = "";
    var tp = parseInt(totalPlus, 10);
    var tm = parseInt(totalMinus, 10);
    var hasTally = !isNaN(tp) && !isNaN(tm) && (tp + tm) > 0;

    // 1. Vote tally graphic with member's position highlighted
    if (hasTally) {
      var total = tp + tm;
      var yeaPct = Math.round(100 * tp / total);
      var nayPct = 100 - yeaPct;
      var passed = /pass|agree|confirm|approved/i.test(voteResult || "");
      var failed = /fail|reject|not agreed|defeated/i.test(voteResult || "");
      var resultLabel = voteResult ? esc(voteResult) : "";
      var resultColor = passed ? "hsl(142,60%,40%)" : failed ? "hsl(0,70%,55%)" : "hsl(var(--muted-foreground))";

      // Determine if member sided with majority
      var posLower = (position || "").toLowerCase();
      var memberVotedYea = posLower === "yes" || posLower === "yea";
      var memberVotedNay = posLower === "no" || posLower === "nay";
      var majorityIsYea = tp >= tm;
      var withMajority = (memberVotedYea && majorityIsYea) || (memberVotedNay && !majorityIsYea);
      var memberDidVote = memberVotedYea || memberVotedNay;

      html += '<div style="margin-bottom:12px;">';

      // Result + majority indicator
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">';
      if (resultLabel) {
        html += '<span style="font-size:12px;font-weight:700;color:' + resultColor + ';">' + resultLabel + '</span>';
      }
      if (memberDidVote) {
        var majBg = withMajority ? "hsl(var(--primary)/0.12)" : "hsla(0,70%,50%,0.12)";
        var majColor = withMajority ? "hsl(var(--primary))" : "hsl(0,70%,55%)";
        var majLabel = withMajority ? "\u2713 Voted with majority" : "\u2717 Voted against majority";
        html += '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:' + majBg + ';color:' + majColor + ';">' + majLabel + '</span>';
      }
      html += '</div>';

      // Stacked bar chart with member's side highlighted
      var yeaBorder = memberVotedYea ? "box-shadow:inset 0 0 0 2px rgba(255,255,255,0.6);" : "";
      var nayBorder = memberVotedNay ? "box-shadow:inset 0 0 0 2px rgba(255,255,255,0.6);" : "";
      var yeaOpacity = memberVotedNay ? "opacity:0.5;" : "";
      var nayOpacity = memberVotedYea ? "opacity:0.5;" : "";

      html += '<div style="display:flex;border-radius:5px;overflow:hidden;height:24px;font-size:11px;font-weight:600;line-height:24px;margin-bottom:6px;">';
      if (yeaPct > 0) {
        html += '<div style="width:' + yeaPct + '%;background:hsl(142,60%,42%);color:#fff;text-align:center;' +
          'min-width:' + (yeaPct > 8 ? '0' : '32px') + ';' + yeaBorder + yeaOpacity + '">' +
          (yeaPct >= 12 ? 'Yea ' + tp : tp) + '</div>';
      }
      if (nayPct > 0) {
        html += '<div style="width:' + nayPct + '%;background:hsl(0,65%,50%);color:#fff;text-align:center;' +
          'min-width:' + (nayPct > 8 ? '0' : '32px') + ';' + nayBorder + nayOpacity + '">' +
          (nayPct >= 12 ? 'Nay ' + tm : tm) + '</div>';
      }
      html += '</div>';

      // Legend with member's position indicated
      html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:hsl(var(--muted-foreground));">';
      html += '<span>' + (memberVotedYea ? '\u25b6 ' : '') + 'Yea: ' + tp + ' (' + yeaPct + '%)</span>';
      html += '<span>' + (memberVotedNay ? '\u25b6 ' : '') + 'Nay: ' + tm + ' (' + nayPct + '%)</span>';
      html += '</div>';

      html += '</div>';
    } else if (voteResult) {
      html += '<div style="font-size:12px;font-weight:600;color:hsl(var(--muted-foreground));margin-bottom:10px;">' +
        'Result: ' + esc(voteResult) + '</div>';
    }

    // 2. Party-alignment badge
    if (alignment) {
      var aColor, aBg, aLabel;
      if (alignment === "with") {
        aColor = "hsl(var(--primary))";
        aBg    = "hsl(var(--primary)/0.12)";
        aLabel = "\u2713 Voted with party";
      } else {
        aColor = "hsl(0,70%,55%)";
        aBg    = "hsla(0,70%,50%,0.12)";
        aLabel = "\u2717 Voted against party";
      }
      html += '<div style="display:inline-block;font-size:11px;font-weight:600;' +
        'padding:3px 10px;border-radius:5px;background:' + aBg + ';color:' + aColor + ';' +
        'margin-bottom:10px;">' + aLabel + '</div>';
    }

    // 3. Vote procedure (e.g. "On Motion to Suspend the Rules and Pass")
    if (questionDetails) {
      html += '<div style="font-size:11px;color:hsl(var(--muted-foreground));margin-bottom:8px;font-style:italic;">' +
        esc(questionDetails) + '</div>';
    }

    // 4. Official bill title / purpose (different from the displayed short title)
    if (bill && bill.officialTitle && bill.officialTitle !== bill.title) {
      html += '<div style="margin-bottom:10px;line-height:1.7;color:hsl(var(--foreground)/0.85);">' +
        esc(bill.officialTitle) + '</div>';
    }

    // 5. Metadata row
    var meta = [];
    if (bill) {
      if (bill.sponsor) meta.push('<span>Sponsor: <strong style="color:hsl(var(--foreground));">' + esc(bill.sponsor) + '</strong></span>');
      if (bill.cosponsors > 0) meta.push('<span>' + bill.cosponsors + ' cosponsor' + (bill.cosponsors !== 1 ? 's' : '') + '</span>');
      if (bill.status) meta.push('<span>' + esc(bill.status) + (bill.statusDate ? ' (' + bill.statusDate + ')' : '') + '</span>');
    }
    if (meta.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:hsl(var(--muted-foreground));margin-bottom:8px;">' +
        meta.join("") + '</div>';
    }

    // 6. Single bill link — prefer congress.gov, fall back to GovTrack
    var linkStyle = 'style="color:hsl(var(--primary));font-size:11px;font-weight:600;text-decoration:none;' +
      'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:5px;' +
      'background:hsl(var(--primary)/0.08);transition:background .15s;" ' +
      'onmouseover="this.style.background=\'hsl(var(--primary)/0.15)\'" ' +
      'onmouseout="this.style.background=\'hsl(var(--primary)/0.08)\'"';

    var billUrl = "";
    var billLinkLabel = "";

    // Try congress.gov first (from API or constructed from bill ID)
    var cgUrl = (bill && bill.congressDotGov) || "";
    if (!cgUrl && billDisplay) {
      cgUrl = billIdToCongressGovUrl(billDisplay, congress);
    }
    if (cgUrl) {
      billUrl = cgUrl;
      var isNom = billDisplay && billDisplay.replace(/[.\s]/g, "").toUpperCase().indexOf("PN") === 0;
      billLinkLabel = isNom ? "View nomination on Congress.gov \u2197" : "View bill on Congress.gov \u2197";
    } else if (bill && bill.link) {
      billUrl = bill.link;
      billLinkLabel = "View bill on GovTrack \u2197";
    }

    if (billUrl) {
      html += '<div style="margin-top:8px;">' +
        '<a href="' + billUrl + '" target="_blank" rel="noopener noreferrer" ' + linkStyle + '>' +
        billLinkLabel + '</a></div>';
    }

    return html || '<div style="color:hsl(var(--muted-foreground));">No additional details available.</div>';
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
