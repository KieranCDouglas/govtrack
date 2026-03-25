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
    }
  });

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
        "background:hsl(var(--muted)/0.45);border:1px solid hsl(var(--border));";

      box.innerHTML =
        '<div style="display:flex;align-items:center;gap:5px;">' +
          '<span style="color:hsl(var(--primary));font-weight:600;">\u2190 \u2192</span>' +
          '<span style="color:hsl(var(--muted-foreground));">Economic: Left (collectivist) \u2194 Right (free market)</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:5px;">' +
          '<span style="color:hsl(var(--primary));font-weight:600;">\u2191 \u2193</span>' +
          '<span style="color:hsl(var(--muted-foreground));">Social: Up (conservative) \u2194 Down (progressive)</span>' +
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

  /* ---- 2b  Expandable vote items ---- */

  function enhanceVotes() {
    // vote items live inside .divide-y containers
    document.querySelectorAll(".divide-y > div, .space-y-0 > div").forEach(function (item) {
      if (item.dataset.cwExp) return;
      var badge = item.querySelector(".vote-yes,.vote-no,.vote-not-voting,.vote-present");
      if (!badge) return;

      item.dataset.cwExp = "1";

      // grab truncated text element references
      var questionEl = item.querySelector(".line-clamp-2") || item.querySelector(".text-sm.text-foreground");
      var allXs = item.querySelectorAll(".line-clamp-1");
      var billTitleEl = allXs[0] || null;
      var descEl = allXs[1] || null;

      // build expanded panel
      var panel = document.createElement("div");
      panel.className = "cw-vote-panel";
      panel.style.cssText =
        "display:none;margin-top:8px;padding:10px 12px;border-radius:8px;" +
        "background:hsl(var(--muted)/0.35);font-size:12px;line-height:1.6;" +
        "color:hsl(var(--muted-foreground));";

      var qText = (questionEl && questionEl.textContent) || "";
      var bTitle = (billTitleEl && billTitleEl.textContent) || "";
      var dText = (descEl && descEl.textContent) || "";

      var html = "";
      if (qText) html += '<div style="font-weight:500;color:hsl(var(--foreground));margin-bottom:4px;">' + esc(qText) + "</div>";
      if (bTitle && bTitle !== qText) html += '<div style="margin-bottom:4px;">' + esc(bTitle) + "</div>";
      if (dText && dText !== bTitle) html += '<div style="margin-bottom:6px;">' + esc(dText) + "</div>";

      // source link
      var searchQ = encodeURIComponent(bTitle || qText);
      html +=
        '<div style="display:flex;gap:10px;margin-top:4px;">' +
          '<a href="https://www.govtrack.us/congress/bills/#text=' + searchQ + '" ' +
            'target="_blank" rel="noopener noreferrer" ' +
            'style="color:hsl(var(--primary));font-size:11px;text-decoration:none;display:inline-flex;align-items:center;gap:3px;"' +
            ' onmouseover="this.style.textDecoration=\'underline\'" onmouseout="this.style.textDecoration=\'none\'">' +
            'View on GovTrack \u2197</a>' +
          '<a href="https://www.congress.gov/search?q=' + searchQ + '" ' +
            'target="_blank" rel="noopener noreferrer" ' +
            'style="color:hsl(var(--primary));font-size:11px;text-decoration:none;display:inline-flex;align-items:center;gap:3px;"' +
            ' onmouseover="this.style.textDecoration=\'underline\'" onmouseout="this.style.textDecoration=\'none\'">' +
            'Congress.gov \u2197</a>' +
        "</div>";
      panel.innerHTML = html;

      var textBox = item.querySelector(".flex-1");
      if (textBox) textBox.appendChild(panel);
      else item.appendChild(panel);

      // cursor + hover
      item.style.cursor = "pointer";
      item.style.transition = "background .15s";
      item.addEventListener("mouseenter", function () {
        if (panel.style.display === "none") item.style.backgroundColor = "hsl(var(--muted)/0.15)";
      });
      item.addEventListener("mouseleave", function () {
        if (panel.style.display === "none") item.style.backgroundColor = "";
      });

      // click to toggle
      item.addEventListener("click", function (ev) {
        if (ev.target.tagName === "A") return;
        var open = panel.style.display !== "none";
        panel.style.display = open ? "none" : "block";
        item.style.backgroundColor = open ? "" : "hsl(var(--muted)/0.25)";

        // toggle line-clamp
        [questionEl, billTitleEl, descEl].forEach(function (el) {
          if (!el) return;
          if (open) {
            el.style.webkitLineClamp = "";
            el.style.display = "";
          } else {
            el.style.webkitLineClamp = "unset";
            el.style.overflow = "visible";
          }
        });
      });
    });
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
