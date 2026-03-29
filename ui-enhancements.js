/**
 * ui-enhancements.js
 * Loaded BEFORE the main bundle. Provides:
 *  1. window.__getPositions  — individualized member positions
 *  2. DOM observer           — compass legends, expandable votes, disclaimer fix
 */
(function () {
  "use strict";

  /* ================================================================
     1.  INDIVIDUALIZED  MEMBER  POSITIONS  (disabled — replaced by LLM summaries)
     ================================================================ */

  window.__getPositions = function () { return []; };

  /* ================================================================
     2a. FLASH-PREVENTION STYLES (injected immediately, before React renders)
     ================================================================ */
  (function () {
    var s = document.createElement("style");
    s.id = "cw-flash-prevention";
    s.textContent =
      "img[alt='CongressWatch logo'] { display: none !important; }" +
      "header a[href='/'] span { display: none !important; }" +
      "header [data-testid='button-theme-toggle'] ~ a { display: none !important; }";

    document.head.appendChild(s);
  })();

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

    // Inject CSS to hide React's children inside replaced vote text containers.
    // This survives React re-renders because it targets by class, not individual elements.
    if (!document.getElementById("cw-vote-styles")) {
      var style = document.createElement("style");
      style.id = "cw-vote-styles";
      style.textContent =
        ".cw-replaced > :not(.cw-bill-line):not(.cw-proc-line):not(.cw-vote-panel) { display: none !important; }" +
        "header { height: clamp(70px, 8vw, 120px) !important; overflow: hidden !important; padding: 0 !important; display: flex !important; align-items: center !important; position: sticky !important; top: 0 !important; z-index: 50 !important; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.15s ease !important; }" +
        "header > div { display: grid !important; grid-template-columns: 1fr auto 1fr !important; align-items: center !important; height: clamp(70px, 8vw, 120px) !important; grid-template-rows: clamp(70px, 8vw, 120px) !important; padding-left: 0 !important; margin-left: 0 !important; width: 100% !important; max-width: 100% !important; min-width: 600px !important; transition: height 0.15s ease !important; }" +
        "header > div > a:first-child { overflow: hidden !important; display: flex !important; align-items: center !important; padding-left: 0 !important; }" +
        "header nav { justify-self: center !important; display: flex !important; justify-content: center !important; align-items: center !important; white-space: nowrap !important; overflow: hidden !important; min-width: 0 !important; transition: opacity 0.2s ease !important; }" +
        "header > div > div:last-child { justify-self: end !important; overflow: hidden !important; min-width: 0 !important; }" +
        ".cw-new-logo { height: clamp(120px, 17vw, 260px) !important; width: auto !important; max-width: none !important; flex-shrink: 0 !important; transition: height 0.15s ease !important; }" +
        "html:not(.light) .cw-new-logo { filter: invert(1) contrast(5) brightness(0.75) sepia(1) hue-rotate(155deg) saturate(0.7) !important; }" +
        "@keyframes cw-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }" +
        "@keyframes cw-shimmer { 0% { opacity:0.5; } 50% { opacity:1; } 100% { opacity:0.5; } }" +
        "@media (max-width:640px) { .cw-recent-grid { grid-template-columns:1fr !important; } }" +
        "@media (max-width:767px) {" +
        "  header { height: auto !important; overflow: visible !important; padding: 0 !important; }" +
        "  header > div { display: flex !important; flex-wrap: wrap !important; align-items: center !important; position: relative !important; width: 100% !important; min-width: 0 !important; height: auto !important; padding: 8px 0 !important; }" +
        "  header > div > a:first-child { flex: 0 0 auto !important; overflow: hidden !important; }" +
        "  .cw-new-logo { height: 300px !important; transition: none !important; margin-top: -90px !important; margin-bottom: -110px !important; }" +
        "  header > div > a:first-child { width: 100% !important; justify-content: center !important; }" +
        "  header nav { display: flex !important; flex-wrap: nowrap !important; justify-content: center !important; opacity: 1 !important; padding: 2px 8px 6px !important; gap: 2px !important; white-space: nowrap !important; flex: 1 !important; }" +
        "  header nav a { padding: 4px 8px !important; font-size: 12px !important; }" +
        "  header > div > div:last-child { position: static !important; flex: 0 0 auto !important; display: flex !important; align-items: center !important; padding-right: 8px !important; }" +
        "  header [aria-label='Menu'] { display: none !important; }" +
        "}";
      document.head.appendChild(style);
    }

    var debounce;
    var ob = new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(run, 120);
    });
    ob.observe(root, { childList: true, subtree: true });

    // Rename brand text immediately on any DOM change — no debounce — so the
    // old names never flash before being replaced.
    var brandOb = new MutationObserver(function () {
      renameBrand();
    });
    brandOb.observe(root, { childList: true, subtree: true });

    window.addEventListener("hashchange", function () {
      setTimeout(run, 300);
    });
    setTimeout(run, 600);

    function run() {
      addCompassLegends();
      enhanceVotes();
      enhanceRecentVotes();
      injectMemberSummary();
      renameBrand();
      enhanceCompassPage();
      enhanceHeaderLayout();
    }

    function enhanceHeaderLayout() {
      var header = document.querySelector('header');
      if (!header) return;
      var themeToggle = header.querySelector('[data-testid="button-theme-toggle"]');
      if (!themeToggle) return;
      var rightDiv = themeToggle.parentElement;
      if (!rightDiv) return;
      // Only hide the quiz link, not the mobile menu button
      Array.from(rightDiv.querySelectorAll('a')).forEach(function (el) {
        if (el.textContent.trim().toLowerCase().includes('take the quiz')) {
          el.style.display = 'none';
        }
      });
    }

    function updateNavFade() {
      var nav = document.querySelector('header nav');
      if (!nav) return;
      var w = window.innerWidth;
      if (w <= 767) return;
      // Fade nav out between 1000px and 800px viewport width
      var opacity = Math.max(0, Math.min(1, (w - 800) / 200));
      nav.style.opacity = opacity;
      nav.style.pointerEvents = opacity < 0.05 ? 'none' : 'auto';
    }

    updateNavFade();
    window.addEventListener('resize', updateNavFade);

    // Hide header on scroll down, reveal on scroll up
    var lastScrollY = window.scrollY;
    window.addEventListener('scroll', function () {
      var header = document.querySelector('header');
      if (!header) return;
      var currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        header.style.transform = 'translateY(-100%)';
      } else {
        header.style.transform = 'translateY(0)';
      }
      lastScrollY = currentScrollY;
    }, { passive: true });

    function renameBrand() {
      var header = document.querySelector("header");
      if (header) {
        // Inject new unified logo once
        if (!header.querySelector('.cw-new-logo')) {
          var oldLogo = header.querySelector('img[alt="CongressWatch logo"]');
          if (oldLogo) {
            var newLogo = document.createElement('img');
            newLogo.src = './civicism-logo.png';
            newLogo.alt = 'Civicism';
            newLogo.className = 'cw-new-logo flex-shrink-0';
            newLogo.style.cssText = 'height:260px;width:auto;display:block;filter:contrast(5) brightness(0.75);align-self:center;margin-top:0;margin-right:0;';
            oldLogo.parentElement.insertBefore(newLogo, oldLogo);
          }
        }
        // Hide old logo img and brand text span
        var oldImg = header.querySelector('img[alt="CongressWatch logo"]');
        if (oldImg) oldImg.style.display = 'none';
        var walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
          var val = node.nodeValue.trim();
          if (val === "CongressWatch" || val === "Civicism") {
            node.parentElement.style.display = 'none';
          }
        }
      }
      var body = document.getElementById("root");
      if (body) {
        var walker2 = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        var node2;
        while ((node2 = walker2.nextNode())) {
          if (node2.nodeValue.includes("Track Every Vote in Congress")) {
            node2.nodeValue = node2.nodeValue.replace(/Track Every Vote in Congress/g, "A Civic Engagement Tool");
          }
        }
      }
    }

  });

  /* ================================================================
     1b.  MEMBER  LIST  FILTER  PERSISTENCE
     ================================================================ */

  var FILTER_KEY = "cw-member-filters";
  var _filterSaveTimer = null;

  function _getReactFiber(dom) {
    var key = Object.keys(dom).find(function (k) {
      return k.startsWith("__reactFiber$");
    });
    return key ? dom[key] : null;
  }

  /** Walk up the fiber tree from a Radix Select trigger to find the
   *  Select.Root fiber whose props include { value, onValueChange }. */
  function _findSelectFiber(testId) {
    var trigger = document.querySelector('[data-testid="' + testId + '"]');
    if (!trigger) return null;
    var fiber = _getReactFiber(trigger);
    var f = fiber;
    while (f) {
      var props = f.memoizedProps || f.pendingProps;
      if (
        props &&
        typeof props.onValueChange === "function" &&
        "value" in props
      ) {
        return props;
      }
      f = f.return;
    }
    return null;
  }

  function _readSelect(testId) {
    var p = _findSelectFiber(testId);
    return p ? p.value : null;
  }

  function _writeSelect(testId, value) {
    var p = _findSelectFiber(testId);
    if (p && p.value !== value) {
      p.onValueChange(value);
      return true;
    }
    return false;
  }

  function _isOnMembersList() {
    var h = window.location.hash || "";
    return h === "#/members" || h === "#/members/";
  }

  function _saveFilters() {
    if (!_isOnMembersList()) return;

    var input = document.querySelector(
      '[data-testid="input-member-search"]'
    );
    if (!input) return; // UI not rendered yet

    var filters = {
      search: input.value || "",
      chamber: _readSelect("select-chamber") || "all",
      party: _readSelect("select-party") || "all",
      state: _readSelect("select-state") || "all",
      current: _readSelect("select-current") || "current",
    };

    var isDefault =
      !filters.search &&
      filters.chamber === "all" &&
      filters.party === "all" &&
      filters.state === "all" &&
      filters.current === "current";

    if (isDefault) {
      sessionStorage.removeItem(FILTER_KEY);
    } else {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    }
  }

  function _restoreFilters() {
    var raw = sessionStorage.getItem(FILTER_KEY);
    if (!raw) return;

    var filters;
    try {
      filters = JSON.parse(raw);
    } catch (e) {
      return;
    }

    // Restore search input via native setter so React picks it up
    if (filters.search) {
      var input = document.querySelector(
        '[data-testid="input-member-search"]'
      );
      if (input) {
        var nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        ).set;
        nativeSetter.call(input, filters.search);
        var tracker = input._valueTracker;
        if (tracker) tracker.setValue("");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    // Restore selects through React fiber
    if (filters.chamber && filters.chamber !== "all")
      _writeSelect("select-chamber", filters.chamber);
    if (filters.party && filters.party !== "all")
      _writeSelect("select-party", filters.party);
    if (filters.state && filters.state !== "all")
      _writeSelect("select-state", filters.state);
    if (filters.current && filters.current !== "current")
      _writeSelect("select-current", filters.current);
  }

  function _startFilterTracking() {
    _stopFilterTracking();
    _filterSaveTimer = setInterval(_saveFilters, 400);
  }

  function _stopFilterTracking() {
    if (_filterSaveTimer) {
      clearInterval(_filterSaveTimer);
      _filterSaveTimer = null;
    }
  }

  /** When entering the members list, wait for React to render then
   *  restore saved filters and begin continuous saving. */
  function _handleMembersNav() {
    if (!_isOnMembersList()) {
      _stopFilterTracking();
      return;
    }
    // Wait for React to mount the filter controls
    var attempts = 0;
    var waitId = setInterval(function () {
      attempts++;
      var input = document.querySelector(
        '[data-testid="input-member-search"]'
      );
      if (input || attempts > 20) {
        clearInterval(waitId);
        if (input) {
          _restoreFilters();
          _startFilterTracking();
        }
      }
    }, 100);
  }

  window.addEventListener("hashchange", _handleMembersNav);
  // Handle initial page load on #/members
  if (_isOnMembersList()) {
    setTimeout(_handleMembersNav, 0);
  }

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

    // Immediately hide the generic positions content to prevent flash
    var _oldPos = positionsCard.querySelector(".space-y-3");
    if (_oldPos) _oldPos.style.display = "none";
    positionsCard.querySelectorAll("p").forEach(function (p) {
      if (p.style.fontStyle === "italic" || (p.className && p.className.indexOf("italic") !== -1) ||
          (p.textContent && p.textContent.indexOf("Positions are estimated") !== -1)) {
        p.style.display = "none";
      }
    });

    loadSummaries(function (summaries) {
      // Double-check inside callback in case of edge-case race
      if (positionsCard.querySelector("[data-cw-summary]")) return;

      var summary = summaries[bioguideId];
      if (!summary) {
        // No LLM summary — hide the entire Issue Positions card
        positionsCard.style.display = "none";
        return;
      }

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

  /* ---- 2c  Full compass page: fixed view + polished overlays ---- */

  function enhanceCompassPage() {
    // Only target the large full-page compass canvas (900×700)
    var canvas = null;
    document.querySelectorAll("canvas").forEach(function (cv) {
      if (parseInt(cv.getAttribute("width") || cv.width, 10) >= 500) canvas = cv;
    });
    if (!canvas || canvas._cwCompassFixed) return;
    canvas._cwCompassFixed = true;

    // --- Block pan (mousedown) and zoom (wheel); keep hover + click intact ---
    canvas.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    }, true);
    canvas.addEventListener("wheel", function (e) {
      e.stopPropagation();
      // Do NOT preventDefault — let the browser scroll the page normally
    }, { capture: true, passive: true });
    // Remove the "grab" cursor — show pointer when over a member, default otherwise
    canvas.style.setProperty("cursor", "default", "important");

    // --- Polish the container ---
    var container = canvas.parentElement;
    if (!container || container._cwCompassStyled) return;
    container._cwCompassStyled = true;
    container.style.position = "relative";
    container.style.borderRadius = "16px";
    container.style.border = "1px solid rgba(94,177,191,0.35)";
    container.style.boxShadow =
      "0 8px 40px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.25), " +
      "inset 0 1px 0 rgba(94,177,191,0.15)";

    // --- Overlay: quadrant corner labels + axis direction labels ---
  }

  /* ---- 2b  Expandable vote items with party-line detection & filtering ---- */

  var billCache = {};
  // Stores resolved full titles so enhanceVotes can apply them synchronously on re-renders
  // keyed by gtId, or by billDisplay+"_"+congress when no gtId
  var resolvedTitleMap = {};

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
        if (data.congress && data.congress >= 93 && data.bill_type_label && data.number) {
          var typeMap = {"S.":"senate-bill","H.R.":"house-bill","H.Res.":"house-resolution","S.Res.":"senate-resolution","H.J.Res.":"house-joint-resolution","S.J.Res.":"senate-joint-resolution","H.Con.Res.":"house-concurrent-resolution","S.Con.Res.":"senate-concurrent-resolution"};
          var t = typeMap[data.bill_type_label] || "";
          if (t) cgUrl = "https://www.congress.gov/bill/" + data.congress + (data.congress === 1 ? "st" : data.congress === 2 ? "nd" : data.congress === 3 ? "rd" : "th") + "-congress/" + t + "/" + data.number;
        }
        // GovTrack's data.title can be truncated; build full title from title_without_number + display_number
        var twn = data.title_without_number || "";
        var dn = data.display_number || "";
        var fullTitleWithNum = (dn && twn) ? (dn + ": " + twn) : (data.title || twn);
        return {
          title: twn || data.title || "",
          titleWithNumber: fullTitleWithNum,
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

  /* -- Fetch bill info by display ID (e.g. "HR29") from GovTrack search API -- */
  var billSearchCache = {};

  function fetchBillByDisplayId(displayId, congress) {
    var key = displayId + "_" + congress;
    if (billSearchCache[key]) return billSearchCache[key];

    // Parse bill type and number from display ID
    var id = displayId.replace(/[.\s]/g, "").toUpperCase().trim();
    var gtTypeMap = {
      "HCONRES": "house_concurrent_resolution", "SCONRES": "senate_concurrent_resolution",
      "HCONR": "house_concurrent_resolution", "SCONR": "senate_concurrent_resolution",
      "HCRES": "house_concurrent_resolution", "SCRES": "senate_concurrent_resolution",
      "HCR": "house_concurrent_resolution", "SCR": "senate_concurrent_resolution",
      "HJRES": "house_joint_resolution", "SJRES": "senate_joint_resolution",
      "HJRE": "house_joint_resolution", "SJRE": "senate_joint_resolution",
      "HJR": "house_joint_resolution", "SJR": "senate_joint_resolution",
      "HRES": "house_resolution", "SRES": "senate_resolution",
      "HRE": "house_resolution", "SRE": "senate_resolution",
      "HR": "house_bill", "S": "senate_bill"
    };
    var prefixes = [
      "HCONRES","SCONRES","HCONR","SCONR","HCRES","SCRES","HCR","SCR",
      "HJRES","SJRES","HJRE","SJRE","HJR","SJR",
      "HRES","SRES","HRE","SRE","HR","S"
    ];
    var billType = "", billNum = "";
    for (var i = 0; i < prefixes.length; i++) {
      if (id.indexOf(prefixes[i]) === 0) {
        var num = id.substring(prefixes[i].length);
        if (num && /^\d+$/.test(num)) {
          billType = gtTypeMap[prefixes[i]];
          billNum = num;
          break;
        }
      }
    }

    if (!billType || !billNum) {
      billSearchCache[key] = Promise.resolve(null);
      return billSearchCache[key];
    }

    var url = "https://www.govtrack.us/api/v2/bill?bill_type=" + billType +
      "&number=" + billNum + "&congress=" + congress + "&limit=1";

    var p = fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.objects || !data.objects.length) return null;
        var b = data.objects[0];
        // Fetch full details using the bill ID (if available)
        if (b.id) return fetchBillSummary(b.id);
        // No id — extract what we can from search result directly
        var sponsorName = b.sponsor ? b.sponsor.name : "";
        var twn = b.title_without_number || "";
        var dn = b.display_number || "";
        var fullTitleWithNum = (dn && twn) ? (dn + ": " + twn) : (b.title || twn);
        return {
          title: twn || b.title || "",
          titleWithNumber: fullTitleWithNum,
          officialTitle: "",
          number: dn,
          status: b.current_status_description || "",
          statusDate: (b.current_status_date || "").substring(0, 10),
          sponsor: sponsorName,
          cosponsors: 0,
          link: b.link || "",
          congressDotGov: ""
        };
      })
      .catch(function () { return null; });

    billSearchCache[key] = p;
    return p;
  }

  /* -- Fetch and update the collapsed title for a single vote item (lazy, per-page) -- */
  function fetchTitleForItem(item) {
    if (item._cwTitleFetched || !item._cwLine1) return;
    item._cwTitleFetched = true;

    var gtId = item.dataset.billGtId || "";
    var billDisplay = item.dataset.billDisplay || "";
    var congress = item.dataset.congress || "";

    function applyTitle(bill) {
      if (!bill) return;
      var rawTitle = bill.title || bill.officialTitle || "";
      var prettyId = item._cwPrettyBillId || formatBillId(billDisplay);
      var clean = rawTitle;
      if (prettyId && clean) {
        var ci = clean.indexOf(":");
        if (ci > 0 && ci < 20) {
          var bf = clean.substring(0, ci).replace(/[.\s]/g, "").toUpperCase();
          var idn = prettyId.replace(/[.\s]/g, "").toUpperCase();
          if (bf === idn) clean = clean.substring(ci + 1).trim();
        }
      }
      var newTitle;
      if (prettyId && clean) newTitle = prettyId + " \u2014 " + clean;
      else if (prettyId) newTitle = prettyId + (rawTitle ? " \u2014 " + rawTitle : "");
      else if (clean) newTitle = clean;
      else return;
      // Cache so enhanceVotes uses the full title synchronously on future re-renders
      var cacheKey = gtId || (billDisplay + "_" + (congress || ""));
      resolvedTitleMap[cacheKey] = newTitle;
      var span = item._cwLine1 && item._cwLine1.querySelector("span");
      if (span) span.textContent = newTitle;
    }

    if (gtId) {
      fetchBillSummary(gtId).then(applyTitle).catch(function () {});
    } else if (billDisplay && congress) {
      fetchBillByDisplayId(billDisplay, congress).then(applyTitle).catch(function () {});
    }
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
    var countEl = bar.querySelector(".cw-vote-count");

    var currentPage = 0;

    // Collect all vote items once for full-dataset search
    function applyFilters(resetPage) {
      if (resetPage) currentPage = 0;

      // Re-query each time so items enhanced after addVoteFilters ran are included
      var allVoteItems = Array.from(voteSection.querySelectorAll(":scope > div")).filter(function (item) {
        return item.dataset.cwExp;
      });

      var q = searchIn.value.toLowerCase().trim();
      var pv = posSel.value;
      var pa = ptySel.value;
      var matching = [];

      // Search all votes, not just visible ones
      allVoteItems.forEach(function (item) {
        var show = true;

        // Keyword-sensitive: match bill number/title as well as text
        if (q) {
          var text = item.textContent.toLowerCase();
          var billNum = (item._cwPrettyBillId || "").toLowerCase();
          var billTitle = (item._cwOrigBillTitle || "").toLowerCase();
          var billLine = "";
          var billLineEl = item.querySelector('.cw-bill-line span');
          if (billLineEl) billLine = billLineEl.textContent.toLowerCase();
          if (
            text.indexOf(q) === -1 &&
            billNum.indexOf(q) === -1 &&
            billTitle.indexOf(q) === -1 &&
            billLine.indexOf(q) === -1
          ) {
            show = false;
          }
        }

        if (show && pv) {
          var pos = (item.dataset.position || "").toLowerCase();
          if (pv === "yea"  && pos !== "yes" && pos !== "yea") show = false;
          if (pv === "nay"  && pos !== "no"  && pos !== "nay") show = false;
          if (pv === "nv"   && pos !== "not voting")           show = false;
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
        var visible = idx >= start && idx < end;
        item.style.display = visible ? "" : "none";
        if (visible) fetchTitleForItem(item);
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

    // debounced re-count when new items appear
    var recount;
    new MutationObserver(function () {
      clearTimeout(recount);
      recount = setTimeout(function () {
        applyFilters(false);
      }, 200);
    }).observe(voteSection, { childList: true });

    // Store applyFilters so enhanceVotes can call it after marking items
    container._cwApplyFilters = applyFilters;

    // Run initial applyFilters to ensure filter selection immediately updates the vote list
    setTimeout(function () {
      applyFilters(true);
    }, 0);
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

      // Restructure collapsed view: bill name prominent, question secondary
      // Instead of modifying React's text nodes (which React reconciliation can overwrite),
      // we hide the originals and create new elements.
      var textParent = item.querySelector(".flex-1");

      if (textParent) {
        var questionEl = textParent.querySelector(".line-clamp-2") || textParent.querySelector(".text-sm.text-foreground");
        var allXs = textParent.querySelectorAll(".line-clamp-1");
        var billTitleEl = allXs[0] || null;
        var descEl      = allXs[1] || null;

        var origQuestion = (questionEl && questionEl.textContent) || "";
        var origBillTitle = (billTitleEl && billTitleEl.textContent) || "";

        // Save originals as data attrs so renderPanel can read them later
        item.dataset.cwOrigQuestion = origQuestion;
        item.dataset.cwOrigBillTitle = origBillTitle;

        // Format bill display number nicely: "HR29" → "H.R. 29"
        var prettyBillId = formatBillId(billDisplay);

        // If no bill ID from data, try to extract one from the title or question text
        // Search anywhere in the text for patterns like "H.Res. 1131", "H.R. 8029", "S. 1234"
        var _billIdRe = /(H\.?\s*R\.?\s*\d+|H\.?\s*(?:Con\.?\s*)?(?:J\.?\s*)?Res\.?\s*\d+|S\.?\s*(?:Con\.?\s*)?(?:J\.?\s*)?(?:Res\.?\s*)?\s*\d+)/i;
        if (!prettyBillId) {
          var _extractSrc = origBillTitle || origQuestion || "";
          var _billIdMatch = _extractSrc.match(_billIdRe);
          if (_billIdMatch) {
            prettyBillId = _billIdMatch[1].replace(/\s+/g, " ").trim();
          }
        }

        // Strip redundant bill number prefix from title
        var cleanTitle = origBillTitle || "";
        if (prettyBillId && cleanTitle) {
          var colonIdx = cleanTitle.indexOf(":");
          if (colonIdx > 0 && colonIdx < 20) {
            var beforeColon = cleanTitle.substring(0, colonIdx).replace(/[.\s]/g, "").toUpperCase();
            var billIdNorm = prettyBillId.replace(/[.\s]/g, "").toUpperCase();
            if (beforeColon === billIdNorm) {
              cleanTitle = cleanTitle.substring(colonIdx + 1).trim();
            }
          }
        }

        if (prettyBillId || origQuestion || origBillTitle) {
          // Mark parent so CSS hides ALL React children (survives React re-renders)
          textParent.classList.add("cw-replaced");

          // Check resolved title cache first (populated by fetchTitleForItem on prior renders)
          var _cacheKey = gtId || (billDisplay + "_" + (congress || ""));
          var primaryTitle = resolvedTitleMap[_cacheKey] || "";

          if (!primaryTitle) {
            if (prettyBillId && cleanTitle) {
              primaryTitle = prettyBillId + " \u2014 " + cleanTitle;
            } else if (prettyBillId) {
              primaryTitle = prettyBillId + (origBillTitle ? " \u2014 " + origBillTitle : "");
            } else {
              primaryTitle = origBillTitle || origQuestion || "Roll Call Vote";
            }
          }

          // Create new primary line with title + badge
          var cwLine1 = document.createElement("div");
          cwLine1.className = "cw-bill-line";
          cwLine1.style.cssText = "display:flex;align-items:center;gap:8px;font-size:14px;color:hsl(var(--foreground));line-height:1.4;";

          var titleSpan = document.createElement("span");
          titleSpan.style.cssText = "font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;";
          titleSpan.textContent = primaryTitle;
          cwLine1.appendChild(titleSpan);

          // Result badge (Passed/Failed) — right-aligned
          var passed = /pass|agree|confirm|approved/i.test(voteResult);
          var failed = /fail|reject|not agreed|defeated/i.test(voteResult);
          if (voteResult) {
            var resultBadge = document.createElement("span");
            resultBadge.style.cssText = "font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap;flex-shrink:0;";
            if (passed) {
              resultBadge.textContent = "Passed";
              resultBadge.style.background = "hsl(142,60%,42%,0.15)";
              resultBadge.style.color = "hsl(142,60%,35%)";
            } else if (failed) {
              resultBadge.textContent = "Failed";
              resultBadge.style.background = "hsl(0,65%,50%,0.15)";
              resultBadge.style.color = "hsl(0,65%,45%)";
            } else {
              resultBadge.textContent = voteResult;
              resultBadge.style.background = "hsl(var(--muted)/0.3)";
              resultBadge.style.color = "hsl(var(--muted-foreground))";
            }
            cwLine1.appendChild(resultBadge);
          }

          // Create secondary line: "247-164 · 2026-03-27 · Passage · On Passage..."
          var cwLine2 = document.createElement("div");
          cwLine2.className = "cw-proc-line";
          cwLine2.style.cssText = "font-size:12px;font-weight:400;color:hsl(var(--muted-foreground));margin-top:2px;" +
            "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

          var secondaryParts = [];
          // Vote tally
          var _tp = parseInt(totalPlus, 10);
          var _tm = parseInt(totalMinus, 10);
          if (!isNaN(_tp) && !isNaN(_tm) && (_tp + _tm) > 0) {
            secondaryParts.push(_tp + "-" + _tm);
          }
          // Vote date from global map
          var _voteKey = "";
          if (congress && chamber && voteIdNum) {
            _voteKey = String(congress) + (chamber || "").charAt(0).toLowerCase() + String(voteIdNum);
          }
          var _voteDate = (window.__cwVoteDates && _voteKey && window.__cwVoteDates[_voteKey]) || "";
          if (_voteDate) secondaryParts.push(_voteDate);
          // Description / category
          var origDesc = (descEl && descEl.textContent) || "";
          if (origDesc) secondaryParts.push(origDesc);

          cwLine2.textContent = secondaryParts.join(" \u00b7 ");

          var firstChild = textParent.firstChild;
          textParent.insertBefore(cwLine2, firstChild);
          textParent.insertBefore(cwLine1, firstChild);
        } else {
          // Truly empty vote — hide extras
          if (descEl) descEl.style.display = "none";
        }
      }

      // Store references for title update after async load
      item._cwLine1 = typeof cwLine1 !== 'undefined' ? cwLine1 : null;
      item._cwLine2 = typeof cwLine2 !== 'undefined' ? cwLine2 : null;
      item._cwQuestionEl = questionEl || null;
      item._cwBillTitleEl = billTitleEl || null;
      item._cwPrettyBillId = prettyBillId || '';
      item._cwOrigQuestion = origQuestion || '';
      item._cwOrigBillTitle = origBillTitle || '';

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

      // Append panel inside .flex-1 text area
      var textBox = item.querySelector(".flex-1");
      if (textBox) textBox.appendChild(panel);
      else item.appendChild(panel);

      item.addEventListener("click", function (ev) {
        if (ev.target.tagName === "A" || ev.target.closest(".cw-vote-filters")) return;
        var open = panel.style.display !== "none";
        panel.style.display = open ? "none" : "block";
        item.style.backgroundColor = open ? "" : "hsl(var(--muted)/0.25)";

        // Restore truncated title when collapsing, re-show full title when expanding
        if (open && item._cwRestoreTitle) item._cwRestoreTitle();
        if (!open && item._cwShowFullTitle) item._cwShowFullTitle();

        if (!open && !loaded) {
          loaded = true;
          renderPanel(panel, gtId, billDisplay, voteResult, alignment, questionDetails, item, congress, chamber, totalPlus, totalMinus, voteIdNum, position);
        }
      });

    });

    // Now that all items are marked with cwExp, trigger pagination
    if (container._cwApplyFilters) container._cwApplyFilters(false);
  }

  /* -- Render expanded panel content -- */
  function renderPanel(panel, gtId, billDisplay, voteResult, alignment, questionDetails, item, congress, chamber, totalPlus, totalMinus, voteIdNum, position) {
    // Read original (pre-swap) values saved in data attributes
    var qText  = item.dataset.cwOrigQuestion || "";
    var bTitle = item.dataset.cwOrigBillTitle || "";

    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;color:hsl(var(--muted-foreground));">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>' +
        'Loading bill details\u2026' +
      '</div>' +
      '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

    function renderContent(bill) {
      panel.innerHTML = buildExpandedHtml(bill, voteResult, alignment, questionDetails, qText, bTitle, billDisplay, congress, chamber, totalPlus, totalMinus, voteIdNum, position);

      // Resolve full title from API for the header
      var rawTitle = (bill && (bill.title || bill.officialTitle)) || bTitle || '';
      var prettyId = item._cwPrettyBillId || formatBillId(billDisplay);

      // Strip redundant bill number prefix from title
      var cleanFullTitle = rawTitle;
      if (prettyId && cleanFullTitle) {
        var _ci = cleanFullTitle.indexOf(':');
        if (_ci > 0 && _ci < 20) {
          var _bf = cleanFullTitle.substring(0, _ci).replace(/[.\s]/g, '').toUpperCase();
          var _in = prettyId.replace(/[.\s]/g, '').toUpperCase();
          if (_bf === _in) cleanFullTitle = cleanFullTitle.substring(_ci + 1).trim();
        }
      }

      if (item._cwLine1) {
        var titleText;
        if (prettyId && cleanFullTitle) {
          titleText = prettyId + ' \u2014 ' + cleanFullTitle;
        } else if (prettyId) {
          titleText = prettyId + (rawTitle ? ' \u2014 ' + rawTitle : '');
        } else if (cleanFullTitle) {
          titleText = cleanFullTitle;
        } else {
          titleText = null; // keep existing title
        }
        var titleSpan = item._cwLine1.querySelector('span');

        // Update the title span with the full API title if we have one
        if (titleSpan && titleText) titleSpan.textContent = titleText;

        // Expand: unwrap text so full title is visible, keep bold
        var showFull = function () {
          if (titleSpan) {
            titleSpan.style.whiteSpace = 'normal';
            titleSpan.style.overflow = 'visible';
          }
          if (item._cwLine2) {
            item._cwLine2.style.whiteSpace = 'normal';
            item._cwLine2.style.overflow = 'visible';
          }
        };
        showFull();
        item._cwShowFullTitle = showFull;
        item._cwRestoreTitle = function () {
          if (titleSpan) {
            titleSpan.style.whiteSpace = 'nowrap';
            titleSpan.style.overflow = 'hidden';
          }
          if (item._cwLine2) {
            item._cwLine2.style.whiteSpace = 'nowrap';
            item._cwLine2.style.overflow = 'hidden';
          }
        };
      } else if (item._cwQuestionEl) {
        var showFullReact = function () {
          item._cwQuestionEl.textContent = rawTitle || item._cwOrigQuestion;
          item._cwQuestionEl.classList.remove('line-clamp-2');
          if (item._cwBillTitleEl) item._cwBillTitleEl.style.display = 'none';
        };
        showFullReact();
        item._cwShowFullTitle = showFullReact;
        item._cwRestoreTitle = function () {
          item._cwQuestionEl.textContent = item._cwOrigQuestion;
          item._cwQuestionEl.classList.add('line-clamp-2');
          if (item._cwBillTitleEl) item._cwBillTitleEl.style.display = '';
        };
      }
    }

    if (gtId) {
      fetchBillSummary(gtId).then(renderContent).catch(function () { renderContent(null); });
    } else if (billDisplay && congress) {
      fetchBillByDisplayId(billDisplay, congress).then(renderContent).catch(function () { renderContent(null); });
    } else {
      renderContent(null);
    }
  }

  /* -- Helper: parse a bill/nomination identifier into a congress.gov URL -- */
  function billIdToCongressGovUrl(rawId, congress) {
    if (!rawId || !congress) return "";
    var id = rawId.replace(/[.\s]/g, "").toUpperCase().trim();
    var c = parseInt(congress, 10);
    if (!c || c < 1 || c < 93) return "";
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

  /* -- Format a bill ID like "HR29" into "H.R. 29" for display -- */
  function formatBillId(raw) {
    if (!raw) return "";
    var id = raw.replace(/[.\s]/g, "").toUpperCase().trim();
    var displayMap = {
      "HCONRES": "H.Con.Res.", "SCONRES": "S.Con.Res.",
      "HCONR": "H.Con.Res.", "SCONR": "S.Con.Res.",
      "HCRES": "H.Con.Res.", "SCRES": "S.Con.Res.",
      "HCR": "H.Con.Res.", "SCR": "S.Con.Res.",
      "HJRES": "H.J.Res.", "SJRES": "S.J.Res.",
      "HJRE": "H.J.Res.", "SJRE": "S.J.Res.",
      "HJR": "H.J.Res.", "SJR": "S.J.Res.",
      "HRES": "H.Res.", "SRES": "S.Res.",
      "HRE": "H.Res.", "SRE": "S.Res.",
      "HR": "H.R.", "S": "S.",
      "PN": "PN"
    };
    var prefixes = [
      "HCONRES","SCONRES","HCONR","SCONR","HCRES","SCRES","HCR","SCR",
      "HJRES","SJRES","HJRE","SJRE","HJR","SJR",
      "HRES","SRES","HRE","SRE","HR","PN","S"
    ];
    for (var i = 0; i < prefixes.length; i++) {
      if (id.indexOf(prefixes[i]) === 0) {
        var num = id.substring(prefixes[i].length);
        if (num && /^\d+$/.test(num)) {
          return displayMap[prefixes[i]] + " " + num;
        }
      }
    }
    return raw;
  }

  /* -- Build the expansion-panel HTML -- */
  function buildExpandedHtml(bill, voteResult, alignment, questionDetails, qText, bTitle, billDisplay, congress, chamber, totalPlus, totalMinus, voteIdNum, position) {
    try {
    var html = "";
    var tp = parseInt(totalPlus, 10);
    var tm = parseInt(totalMinus, 10);
    var hasTally = !isNaN(tp) && !isNaN(tm) && (tp + tm) > 0;

    // 1. Vote tally graphic with member's position highlighted
    if (hasTally) {
      // Compute "not voting" from expected chamber size
      var chamberLower = (chamber || "").toLowerCase();
      var expectedTotal = /senate/i.test(chamberLower) ? 100 : 435;
      var notVoting = Math.max(0, expectedTotal - tp - tm);

      var grandTotal = tp + tm + notVoting;
      var yeaPct = Math.round(100 * tp / grandTotal);
      var nayPct = Math.round(100 * tm / grandTotal);
      var nvPct = 100 - yeaPct - nayPct;

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
      if (nvPct > 0 && notVoting > 0) {
        html += '<div style="width:' + nvPct + '%;background:hsl(var(--muted-foreground)/0.25);color:hsl(var(--muted-foreground));text-align:center;' +
          'min-width:' + (nvPct > 5 ? '0' : '28px') + ';font-weight:500;font-size:10px;">' +
          (nvPct >= 10 ? notVoting + ' NV' : notVoting) + '</div>';
      }
      html += '</div>';

      // Legend with member's position indicated
      html += '<div style="display:flex;gap:12px;font-size:10px;color:hsl(var(--muted-foreground));">';
      html += '<span>' + (memberVotedYea ? '\u25b6 ' : '') + 'Yea: ' + tp + ' (' + Math.round(100 * tp / (tp + tm)) + '%)</span>';
      html += '<span>' + (memberVotedNay ? '\u25b6 ' : '') + 'Nay: ' + tm + ' (' + Math.round(100 * tm / (tp + tm)) + '%)</span>';
      if (notVoting > 0) {
        html += '<span style="margin-left:auto;">Not Voting: ' + notVoting + '</span>';
      }
      html += '</div>';

      html += '</div>';
    } else if (voteResult) {
      html += '<div style="font-size:12px;font-weight:600;color:hsl(var(--muted-foreground));margin-bottom:10px;">' +
        'Result: ' + esc(voteResult) + '</div>';
    }

    // 2. Party-alignment badge — prominent display
    if (alignment) {
      var alBg = alignment === "with" ? "hsl(var(--primary)/0.12)" : "hsla(0,70%,50%,0.12)";
      var alColor = alignment === "with" ? "hsl(var(--primary))" : "hsl(0,70%,55%)";
      var alLabel = alignment === "with" ? "\u2713 Voted with party" : "\u2717 Voted against party";
      html += '<div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:3px 10px;border-radius:5px;background:' + alBg + ';color:' + alColor + ';margin-bottom:10px;">' + alLabel + '</div>';
    }

    // Title is shown in the bold header line above — do not repeat it in the body

    // Question text — only show if it adds info beyond what's in the secondary line
    if (questionDetails && questionDetails !== qText) {
      html += '<div style="font-size:11px;color:hsl(var(--muted-foreground));font-style:italic;margin-bottom:8px;">' + esc(questionDetails) + '</div>';
    }

    // 5. Sponsor — shown prominently
    if (bill && bill.sponsor) {
      html += '<div style="font-size:12px;color:hsl(var(--foreground));margin-bottom:6px;">' +
        'Sponsor: <strong>' + esc(bill.sponsor) + '</strong>' +
        (bill.cosponsors > 0 ? ' <span style="color:hsl(var(--muted-foreground));font-weight:400;">(' + bill.cosponsors + ' cosponsor' + (bill.cosponsors !== 1 ? 's' : '') + ')</span>' : '') +
        '</div>';
    }

    // 5b. Status
    var meta = [];
    if (bill && bill.status) meta.push('<span>' + esc(bill.status) + (bill.statusDate ? ' (' + bill.statusDate + ')' : '') + '</span>');
    if (meta.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:hsl(var(--muted-foreground));margin-bottom:8px;">' +
        meta.join("") + '</div>';
    }

    // 7. Bill links — primary bill + any referenced bills from procedural text
    var linkStyle = 'style="color:hsl(var(--primary));font-size:11px;font-weight:600;text-decoration:none;' +
      'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:5px;' +
      'background:hsl(var(--primary)/0.08);transition:background .15s;" ' +
      'onmouseover="this.style.background=\'hsl(var(--primary)/0.15)\'" ' +
      'onmouseout="this.style.background=\'hsl(var(--primary)/0.08)\'"';

    var billUrl = "";
    var billLinkLabel = "";
    var isNom = billDisplay && billDisplay.replace(/[.\s]/g, "").toUpperCase().indexOf("PN") === 0;

    // Priority 1: construct congress.gov URL directly from bill ID + congress
    if (billDisplay && congress) {
      var directUrl = billIdToCongressGovUrl(billDisplay, congress);
      if (directUrl) {
        billUrl = directUrl;
        billLinkLabel = isNom ? "View nomination on Congress.gov \u2197" : "View bill on Congress.gov \u2197";
      }
    }
    // Priority 2: congress.gov URL from API data
    if (!billUrl && bill && bill.congressDotGov) {
      billUrl = bill.congressDotGov;
      billLinkLabel = isNom ? "View nomination on Congress.gov \u2197" : "View bill on Congress.gov \u2197";
    }
    // Priority 3: GovTrack link from API data
    if (!billUrl && bill && bill.link) {
      billUrl = bill.link;
      billLinkLabel = "View bill on GovTrack \u2197";
    }

    if (billUrl) {
      html += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid hsl(var(--border)/0.3);display:flex;flex-wrap:wrap;gap:8px;align-items:center;">';
      html += '<a href="' + billUrl + '" target="_blank" rel="noopener noreferrer" ' + linkStyle + '>' +
        billLinkLabel + '</a>';
      html += '</div>';
    } else if (billDisplay) {
      // Fallback: link to congress.gov search
      var searchUrl = 'https://www.congress.gov/search?q=' + encodeURIComponent(billDisplay);
      html += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid hsl(var(--border)/0.3);">' +
        '<a href="' + searchUrl + '" target="_blank" rel="noopener noreferrer" ' + linkStyle + '>' +
        'Search for ' + esc(billDisplay) + ' on Congress.gov \u2197</a></div>';
    }

    return html || '<div style="color:hsl(var(--muted-foreground));">No additional details available.</div>';
    } catch (err) {
      console.error('[CW] buildExpandedHtml error:', err);
      // Emergency fallback: at minimum show the bill link
      var fallback = '<div style="color:hsl(var(--muted-foreground));">Error loading details.</div>';
      if (billDisplay && congress) {
        try {
          var fbUrl = billIdToCongressGovUrl(billDisplay, congress);
          if (fbUrl) {
            fallback += '<div style="margin-top:8px;"><a href="' + fbUrl +
              '" target="_blank" rel="noopener noreferrer" style="color:hsl(var(--primary));font-size:12px;">View bill on Congress.gov \u2197</a></div>';
          }
        } catch (e2) {}
      }
      return fallback;
    }
  }

  /* ================================================================
     3.  RECENT  VOTES  (home page)
     ================================================================ */

  var RECENT_PER_PAGE = 10;
  var _recentVoteCache = {}; // key: "house:0" or "senate:0" → { votes, total }

  function fetchRecentVotesByChamber(chamber, offset) {
    var key = chamber + ":" + offset;
    if (_recentVoteCache[key]) return Promise.resolve(_recentVoteCache[key]);
    var url = "https://www.govtrack.us/api/v2/vote?congress=119&chamber=" +
      encodeURIComponent(chamber) + "&limit=" + RECENT_PER_PAGE +
      "&offset=" + offset + "&order_by=-created";
    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var result = { votes: (d && d.objects) || [], total: (d && d.meta && d.meta.total_count) || 0 };
        _recentVoteCache[key] = result;
        return result;
      })
      .catch(function () { return { votes: [], total: 0 }; });
  }



  function enhanceRecentVotes() {
    // Find the "Recent Congressional Votes" section on the home page
    var headings = document.querySelectorAll("h2");
    var recentHeading = null;
    for (var i = 0; i < headings.length; i++) {
      if (/recent congressional votes/i.test(headings[i].textContent)) {
        recentHeading = headings[i];
        break;
      }
    }
    if (!recentHeading) return;

    var section = recentHeading.closest(".mb-8");
    if (!section) return;

    // Check if already enhanced
    if (section.dataset.cwRecentV2) return;
    section.dataset.cwRecentV2 = "1";

    // Remove the existing vote list and "View all on GovTrack" link
    var voteList = section.querySelector(".space-y-2");
    var viewAllLink = section.querySelector('a[href*="govtrack.us/congress/votes"]');
    if (viewAllLink && viewAllLink.closest(".mb-8") === section) {
      viewAllLink.remove();
    }
    if (voteList) voteList.remove();

    // Build new two-column layout
    var container = document.createElement("div");
    container.className = "cw-recent-votes-container";

    // -- Recent Votes Section --
    var recentSection = document.createElement("div");
    recentSection.className = "cw-recent-section";

    // Remove search bar from Recent Congressional Votes section

    // Two-column grid for House and Senate
    var votesGrid = document.createElement("div");
    votesGrid.className = "cw-recent-grid";
    votesGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:16px;";
    recentSection.appendChild(votesGrid);

    // House column
    var houseCol = document.createElement("div");
    houseCol.className = "cw-chamber-col";
    houseCol.style.cssText = "min-width:0;";
    houseCol.innerHTML =
      '<div style="font-size:13px;font-weight:600;color:hsl(var(--foreground));margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid hsl(210,70%,50%);display:flex;justify-content:space-between;align-items:center;">' +
        '<span>House</span>' +
        '<span class="cw-house-live" style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:500;color:hsl(var(--muted-foreground));">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:hsl(142,60%,45%);animation:cw-pulse 2s ease-in-out infinite;"></span>Live' +
        '</span>' +
      '</div>' +
      '<div class="cw-house-list" style="display:flex;flex-direction:column;gap:6px;"></div>' +
      '<div class="cw-house-pag" style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:10px;font-size:12px;"></div>';
    votesGrid.appendChild(houseCol);

    // Senate column
    var senateCol = document.createElement("div");
    senateCol.className = "cw-chamber-col";
    senateCol.style.cssText = "min-width:0;";
    senateCol.innerHTML =
      '<div style="font-size:13px;font-weight:600;color:hsl(var(--foreground));margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid hsl(0,65%,50%);display:flex;justify-content:space-between;align-items:center;">' +
        '<span>Senate</span>' +
        '<span class="cw-senate-live" style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:500;color:hsl(var(--muted-foreground));">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:hsl(142,60%,45%);animation:cw-pulse 2s ease-in-out infinite;"></span>Live' +
        '</span>' +
      '</div>' +
      '<div class="cw-senate-list" style="display:flex;flex-direction:column;gap:6px;"></div>' +
      '<div class="cw-senate-pag" style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:10px;font-size:12px;"></div>';
    votesGrid.appendChild(senateCol);

    container.appendChild(recentSection);

    // Insert the new layout after the heading row
    var headingRow = recentHeading.parentElement;
    if (headingRow && headingRow.parentElement === section) {
      headingRow.after(container);
    } else {
      section.appendChild(container);
    }

    // State tracking for pagination
    var state = {
      house: { page: 0, total: 0 },
      senate: { page: 0, total: 0 }
    };

    var houseListEl = houseCol.querySelector(".cw-house-list");
    var senateListEl = senateCol.querySelector(".cw-senate-list");
    var housePagEl = houseCol.querySelector(".cw-house-pag");
    var senatePagEl = senateCol.querySelector(".cw-senate-pag");

    function loadColumn(chamber) {
      var listEl = chamber === "house" ? houseListEl : senateListEl;
      var pagEl = chamber === "house" ? housePagEl : senatePagEl;
      var s = state[chamber];
      var offset = s.page * RECENT_PER_PAGE;

      // Show skeleton
      listEl.innerHTML = buildSkeletons(4);

      fetchRecentVotesByChamber(chamber, offset).then(function (data) {
        s.total = data.total;
        var votes = data.votes;



        listEl.innerHTML = "";

        if (!votes.length) {
          listEl.innerHTML = '<div style="text-align:center;padding:20px;color:hsl(var(--muted-foreground));font-size:12px;">No votes found</div>';
        } else {
          votes.forEach(function (vote) {
            listEl.appendChild(buildRecentVoteCard(vote));
          });
        }

        // Pagination controls
        var totalPages = Math.max(1, Math.ceil(s.total / RECENT_PER_PAGE));
        pagEl.innerHTML = "";

        var prevBtn = document.createElement("button");
        prevBtn.textContent = "\u2190 Prev";
        prevBtn.disabled = s.page === 0;
        prevBtn.style.cssText = recentBtnCss(prevBtn.disabled);
        prevBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (s.page > 0) { s.page--; loadColumn(chamber); }
        });
        pagEl.appendChild(prevBtn);

        var info = document.createElement("span");
        info.style.cssText = "font-size:11px;color:hsl(var(--muted-foreground));white-space:nowrap;";
        info.textContent = "Page " + (s.page + 1) + " of " + totalPages;
        pagEl.appendChild(info);

        var nextBtn = document.createElement("button");
        nextBtn.textContent = "Next \u2192";
        nextBtn.disabled = s.page >= totalPages - 1;
        nextBtn.style.cssText = recentBtnCss(nextBtn.disabled);
        nextBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (s.page < totalPages - 1) { s.page++; loadColumn(chamber); }
        });
        pagEl.appendChild(nextBtn);
      });
    }

    function recentBtnCss(disabled) {
      return "padding:4px 12px;border-radius:6px;border:1px solid hsl(var(--border));" +
        "background:hsl(var(--muted)/0.3);color:" + (disabled ? "hsl(var(--muted-foreground)/0.4)" : "hsl(var(--foreground))") +
        ";font-size:11px;cursor:" + (disabled ? "default" : "pointer") + ";transition:background .15s;outline:none;";
    }

    function buildSkeletons(count) {
      var html = "";
      for (var i = 0; i < count; i++) {
        html += '<div style="padding:10px 12px;border-radius:8px;background:hsl(var(--muted)/0.2);margin-bottom:6px;">' +
          '<div style="height:14px;width:60%;border-radius:4px;background:hsl(var(--muted)/0.4);margin-bottom:6px;animation:cw-shimmer 1.5s ease-in-out infinite;"></div>' +
          '<div style="height:10px;width:80%;border-radius:4px;background:hsl(var(--muted)/0.3);animation:cw-shimmer 1.5s ease-in-out infinite;"></div>' +
          '</div>';
      }
      return html;
    }

    function buildRecentVoteCard(vote) {
      var card = document.createElement("div");
      card.style.cssText = "padding:10px 12px;border-radius:8px;border:1px solid hsl(var(--border)/0.4);" +
        "cursor:pointer;transition:background .15s;overflow:hidden;";

      // Extract vote info
      var billDisplay = (vote.related_bill && vote.related_bill.display_number) || "";
      var billTitle = (vote.related_bill && vote.related_bill.title_without_number) ||
                      (vote.related_bill && vote.related_bill.title) || "";
      var question = vote.question || "";
      var result = vote.result || "";
      var passed = /pass|agree|confirm|approved/i.test(result);
      var failed = /fail|reject|not agreed|defeated/i.test(result);
      var tp = vote.total_plus || 0;
      var tm = vote.total_minus || 0;
      var voteDate = vote.created ? vote.created.slice(0, 10) : "";

      var prettyBillId = formatBillId(billDisplay) || "";

      // Header row: bill ID + result badge
      var header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";

      // Clean title: strip bill number prefix if it duplicates the ID
      var cleanTitle = billTitle;
      if (prettyBillId && cleanTitle) {
        var colonIdx = cleanTitle.indexOf(":");
        if (colonIdx > 0 && colonIdx < 20) {
          var beforeColon = cleanTitle.substring(0, colonIdx).replace(/[.\s]/g, "").toUpperCase();
          var billIdNorm = prettyBillId.replace(/[.\s]/g, "").toUpperCase();
          if (beforeColon === billIdNorm) cleanTitle = cleanTitle.substring(colonIdx + 1).trim();
        }
      }

      var titleDiv = document.createElement("div");
      titleDiv.className = "cw-bill-line";
      titleDiv.style.cssText = "font-size:13px;color:hsl(var(--foreground));line-height:1.4;flex:1;min-width:0;" +
        "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      if (prettyBillId) {
        var idSpan = document.createElement("span");
        idSpan.style.fontWeight = "700";
        idSpan.textContent = prettyBillId;
        titleDiv.appendChild(idSpan);
        if (cleanTitle) {
          titleDiv.appendChild(document.createTextNode(" \u2014 "));
          var titleSpan = document.createElement("span");
          titleSpan.style.fontWeight = "700";
          titleSpan.textContent = cleanTitle;
          titleDiv.appendChild(titleSpan);
        }
      } else {
        titleDiv.style.fontWeight = "600";
        titleDiv.textContent = question;
      }
      header.appendChild(titleDiv);

      // Store refs for expand/collapse title swap
      card._cwTitleDiv = titleDiv;
      card._cwPrettyBillId = prettyBillId;
      card._cwCleanTitle = cleanTitle;
      card._cwBillTitle = billTitle;
      card._cwQuestion = question;
      // Save collapsed innerHTML for restore
      card._cwCollapsedHtml = titleDiv.innerHTML;

      // Result badge
      var badge = document.createElement("span");
      badge.style.cssText = "font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;white-space:nowrap;flex-shrink:0;";
      if (passed) {
        badge.textContent = "Passed";
        badge.style.background = "hsl(142,60%,42%,0.15)";
        badge.style.color = "hsl(142,60%,35%)";
      } else if (failed) {
        badge.textContent = "Failed";
        badge.style.background = "hsl(0,65%,50%,0.15)";
        badge.style.color = "hsl(0,65%,45%)";
      } else {
        badge.textContent = result || "Vote";
        badge.style.background = "hsl(var(--muted)/0.3)";
        badge.style.color = "hsl(var(--muted-foreground))";
      }
      header.appendChild(badge);

      card.appendChild(header);

      // Secondary line: procedure text + tally + date
      var secondary = document.createElement("div");
      secondary.className = "cw-proc-line";
      secondary.style.cssText = "font-size:11px;color:hsl(var(--muted-foreground));margin-top:3px;" +
        "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      var secondaryText = "";
      if (tp || tm) secondaryText += tp + "-" + tm;
      if (voteDate) secondaryText += (secondaryText ? " \u00b7 " : "") + voteDate;
      if (vote.category_label) secondaryText += (secondaryText ? " \u00b7 " : "") + vote.category_label;
      if (vote.question_details) secondaryText += (secondaryText ? " \u00b7 " : "") + vote.question_details;
      secondary.textContent = secondaryText;
      card.appendChild(secondary);

      // Expansion panel
      var panel = document.createElement("div");
      panel.className = "cw-recent-panel";
      panel.style.cssText =
        "display:none;margin-top:10px;padding:12px 14px;border-radius:8px;" +
        "background:hsl(var(--muted)/0.35);font-size:12px;line-height:1.6;" +
        "color:hsl(var(--muted-foreground));";
      card.appendChild(panel);

      var loaded = false;

      card.addEventListener("mouseenter", function () {
        if (panel.style.display === "none")
          card.style.backgroundColor = "hsl(var(--muted)/0.15)";
      });
      card.addEventListener("mouseleave", function () {
        if (panel.style.display === "none")
          card.style.backgroundColor = "";
      });
      card.addEventListener("click", function (ev) {
        if (ev.target.tagName === "A" || ev.target.closest("a")) return;
        var open = panel.style.display !== "none";
        panel.style.display = open ? "none" : "block";
        card.style.backgroundColor = open ? "" : "hsl(var(--muted)/0.25)";

        // Toggle title: show full unwrapped title when expanded, truncated "ID — Title" when collapsed
        var td = card._cwTitleDiv;
        if (td && card._cwPrettyBillId) {
          if (!open) {
            // Expanding — show full title unwrapped
            var fullTitle = card._cwBillTitle || card._cwCleanTitle || card._cwQuestion || "";
            td.innerHTML = "";
            var fullId = document.createElement("span");
            fullId.style.fontWeight = "700";
            fullId.textContent = card._cwPrettyBillId;
            td.appendChild(fullId);
            if (fullTitle) {
              td.appendChild(document.createTextNode(" \u2014 "));
              var fullTitleSpan = document.createElement("span");
              fullTitleSpan.style.fontWeight = "700";
              fullTitleSpan.textContent = fullTitle;
              td.appendChild(fullTitleSpan);
            }
            td.style.whiteSpace = "normal";
            td.style.overflow = "visible";
            td.style.textOverflow = "clip";
          } else {
            // Collapsing — restore truncated "ID — Title"
            td.innerHTML = card._cwCollapsedHtml;
            td.style.whiteSpace = "nowrap";
            td.style.overflow = "hidden";
            td.style.textOverflow = "ellipsis";
          }
        }

        if (!open && !loaded) {
          loaded = true;
          renderRecentPanel(panel, vote);
        }
      });

      return card;
    }

    // Load initial data
    loadColumn("house");
    loadColumn("senate");
  }

  function renderRecentPanel(panel, vote) {
    if (!vote) {
      panel.innerHTML = '<div style="color:hsl(var(--muted-foreground));">No additional details available.</div>';
      return;
    }

    // Show loading spinner
    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;color:hsl(var(--muted-foreground));">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>' +
        'Loading details\u2026' +
      '</div>';

    var billGtId = (vote.related_bill && vote.related_bill.id) || null;
    var billDisplayNum = (vote.related_bill && vote.related_bill.display_number) || "";
    var billTitle = (vote.related_bill && vote.related_bill.title) || "";
    var congress = vote.congress || 119;

    var billPromise = billGtId ? fetchBillSummary(billGtId) : Promise.resolve(null);

    billPromise.then(function (bill) {
      var html = "";

      // 1. Vote tally graphic
      var tp = vote.total_plus || 0;
      var tm = vote.total_minus || 0;
      var hasTally = (tp + tm) > 0;

      if (hasTally) {
        var chamberLabel = (vote.chamber_label || vote.chamber || "").toLowerCase();
        var expectedTotal = /senate/i.test(chamberLabel) ? 100 : 435;
        var notVoting = Math.max(0, expectedTotal - tp - tm);

        var grandTotal = tp + tm + notVoting;
        var yeaPct = Math.round(100 * tp / grandTotal);
        var nayPct = Math.round(100 * tm / grandTotal);
        var nvPct = 100 - yeaPct - nayPct;

        var result = vote.result || "";
        var passed = /pass|agree|confirm|approved/i.test(result);
        var failed = /fail|reject|not agreed|defeated/i.test(result);
        var resultColor = passed ? "hsl(142,60%,40%)" : failed ? "hsl(0,70%,55%)" : "hsl(var(--muted-foreground))";

        html += '<div style="margin-bottom:12px;">';
        if (result) {
          html += '<div style="font-size:12px;font-weight:700;color:' + resultColor + ';margin-bottom:8px;">' + esc(result) + '</div>';
        }

        // Stacked bar
        html += '<div style="display:flex;border-radius:5px;overflow:hidden;height:24px;font-size:11px;font-weight:600;line-height:24px;margin-bottom:6px;">';
        if (yeaPct > 0) {
          html += '<div style="width:' + yeaPct + '%;background:hsl(142,60%,42%);color:#fff;text-align:center;' +
            'min-width:' + (yeaPct > 8 ? '0' : '32px') + ';">' +
            (yeaPct >= 12 ? 'Yea ' + tp : tp) + '</div>';
        }
        if (nayPct > 0) {
          html += '<div style="width:' + nayPct + '%;background:hsl(0,65%,50%);color:#fff;text-align:center;' +
            'min-width:' + (nayPct > 8 ? '0' : '32px') + ';">' +
            (nayPct >= 12 ? 'Nay ' + tm : tm) + '</div>';
        }
        if (nvPct > 0 && notVoting > 0) {
          html += '<div style="width:' + nvPct + '%;background:hsl(var(--muted-foreground)/0.25);color:hsl(var(--muted-foreground));text-align:center;' +
            'min-width:' + (nvPct > 5 ? '0' : '28px') + ';font-weight:500;font-size:10px;">' +
            (nvPct >= 10 ? notVoting + ' NV' : notVoting) + '</div>';
        }
        html += '</div>';

        // Legend
        html += '<div style="display:flex;gap:12px;font-size:10px;color:hsl(var(--muted-foreground));">';
        html += '<span>Yea: ' + tp + ' (' + Math.round(100 * tp / (tp + tm)) + '%)</span>';
        html += '<span>Nay: ' + tm + ' (' + Math.round(100 * tm / (tp + tm)) + '%)</span>';
        if (notVoting > 0) html += '<span style="margin-left:auto;">Not Voting: ' + notVoting + '</span>';
        html += '</div>';
        html += '</div>';
      }

      // 2. Question details
      if (vote.question_details) {
        html += '<div style="font-size:11px;color:hsl(var(--muted-foreground));margin-bottom:8px;font-style:italic;">' +
          esc(vote.question_details) + '</div>';
      }

      // 3. Official title (if different from main title — skip main title since it's shown in the card header)
      if (bill && bill.officialTitle && bill.officialTitle !== bill.title) {
        html += '<div style="margin-bottom:8px;font-size:11px;line-height:1.7;color:hsl(var(--foreground)/0.75);">'
          + esc(bill.officialTitle) + '</div>';
      }

      // 5. Metadata
      var meta = [];
      if (bill) {
        if (bill.sponsor) meta.push('<span>Sponsor: <strong style="color:hsl(var(--foreground));">' + esc(bill.sponsor) + '</strong></span>');
        if (bill.cosponsors > 0) meta.push('<span>' + bill.cosponsors + ' cosponsor' + (bill.cosponsors !== 1 ? 's' : '') + '</span>');
        if (bill.status) meta.push('<span>' + esc(bill.status) + (bill.statusDate ? ' (' + bill.statusDate + ')' : '') + '</span>');
      }
      if (vote.category_label) meta.push('<span>' + esc(vote.category_label) + '</span>');
      if (meta.length) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:hsl(var(--muted-foreground));margin-bottom:8px;">' +
          meta.join("") + '</div>';
      }

      // 6. Links: congress.gov bill link + GovTrack vote link
      var linkStyle = 'style="color:hsl(var(--primary));font-size:11px;font-weight:600;text-decoration:none;' +
        'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:5px;' +
        'background:hsl(var(--primary)/0.08);transition:background .15s;" ' +
        'onmouseover="this.style.background=\'hsl(var(--primary)/0.15)\'" ' +
        'onmouseout="this.style.background=\'hsl(var(--primary)/0.08)\'"';

      var links = "";

      // Bill link (congress.gov preferred)
      var cgUrl = (bill && bill.congressDotGov) || "";
      if (!cgUrl && billDisplayNum) {
        cgUrl = billIdToCongressGovUrl(billDisplayNum, congress);
      }
      if (cgUrl) {
        var isNom = billDisplayNum && billDisplayNum.replace(/[.\s]/g, "").toUpperCase().indexOf("PN") === 0;
        links += '<a href="' + cgUrl + '" target="_blank" rel="noopener noreferrer" ' + linkStyle + '>' +
          (isNom ? 'View nomination \u2197' : 'View bill \u2197') + '</a> ';
      } else if (bill && bill.link) {
        links += '<a href="' + bill.link + '" target="_blank" rel="noopener noreferrer" ' + linkStyle + '>' +
          'View bill \u2197</a> ';
      }

      // Vote page link
      var voteLink = vote.link || "";
      if (voteLink) {
        links += '<a href="' + voteLink + '" target="_blank" rel="noopener noreferrer" ' + linkStyle + '>' +
          'Full vote details \u2197</a>';
      }

      if (links) {
        html += '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">' + links + '</div>';
      }

      panel.innerHTML = html || '<div style="color:hsl(var(--muted-foreground));">No additional details available.</div>';
    });
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
