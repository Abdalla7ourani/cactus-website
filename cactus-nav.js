(function () {
  if (window.__cactusNav) return;
  window.__cactusNav = true;

  var ITEMS = [
    { label: "Build", href: "/#connect" },
    { label: "Solutions", href: "/#solutions-insights" },
    { label: "BIM", href: "/bim/" },
    { label: "About", href: "/about" },
  ];

  function isMobile() {
    return window.matchMedia("(max-width: 1023px)").matches;
  }

  function getNavHeight() {
    var nav = document.getElementById("navigation");
    if (!nav) return 80;
    return nav.getBoundingClientRect().height || 80;
  }

  function positionDrawer() {
    var drawer = document.getElementById("cactus-mobile-drawer");
    if (!drawer) return;
    drawer.style.setProperty("--cactus-nav-top", getNavHeight() + "px");
  }

  function setMenuOpen(open) {
    var nav = document.getElementById("navigation");
    var overlay = document.getElementById("overlay");
    var drawer = document.getElementById("cactus-mobile-drawer");
    var btn = document.getElementById("toggle-menu-button");

    if (drawer) {
      drawer.classList.toggle("is-open", open);
      drawer.setAttribute("aria-hidden", open ? "false" : "true");
    }
    if (nav) nav.classList.toggle("opened", open);
    if (overlay) overlay.classList.toggle("visible", open);
    document.documentElement.classList.toggle("scroll-disabled", open);
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");

    if (open) {
      positionDrawer();
      document.querySelectorAll(".accordion.opened").forEach(function (el) {
        el.classList.remove("opened");
      });
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleMenu() {
    if (!isMobile()) return;
    var drawer = document.getElementById("cactus-mobile-drawer");
    var open = !(drawer && drawer.classList.contains("is-open"));
    setMenuOpen(open);
  }

  function navigate(path) {
    var hashMatch = path.match(/#(.+)$/);
    var hash = hashMatch ? hashMatch[1] : null;
    var pathOnly = path.split("#")[0] || "/";
    var p =
      window.location.pathname.replace(/\/index\.html$/i, "").replace(/\/$/, "") ||
      "/";
    var onHome = p === "" || p === "/";

    if (hash && (pathOnly === "/" || pathOnly === "") && onHome) {
      var el = document.getElementById(hash);
      if (el) {
        closeMenu();
        window.setTimeout(function () {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          if (history.replaceState) history.replaceState(null, "", "#" + hash);
        }, 80);
        return;
      }
    }

    window.location.assign(path);
  }

  function buildDrawer() {
    if (document.getElementById("cactus-mobile-drawer")) return;

    var drawer = document.createElement("div");
    drawer.id = "cactus-mobile-drawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML =
      '<div class="cactus-mobile-drawer-shell">' +
      '<div class="cactus-mobile-drawer-panel" role="menu" aria-label="Site navigation">' +
      ITEMS.map(function (item, i) {
        return (
          '<a href="' +
          item.href +
          '" class="cactus-mobile-drawer-link" role="menuitem" style="--i:' +
          i +
          '">' +
          '<span class="cactus-mobile-drawer-link-text">' +
          item.label +
          "</span>" +
          '<span class="cactus-mobile-drawer-link-arrow" aria-hidden="true"></span>' +
          "</a>"
        );
      }).join("") +
      "</div></div>";

    document.body.appendChild(drawer);

    drawer.addEventListener("click", function (e) {
      var link = e.target.closest("a.cactus-mobile-drawer-link");
      if (!link || !isMobile()) return;
      e.preventDefault();
      e.stopPropagation();
      var href = link.getAttribute("href");
      if (href) navigate(href);
    });
  }

  function bindMobileToggle() {
    var btn = document.getElementById("toggle-menu-button");
    if (!btn || btn.dataset.cactusBound) return;
    btn.dataset.cactusBound = "1";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "cactus-mobile-drawer");

    btn.addEventListener(
      "click",
      function (e) {
        if (!isMobile()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleMenu();
      },
      true
    );
  }

  function bindOverlay() {
    var overlay = document.getElementById("overlay");
    if (!overlay || overlay.dataset.cactusBound) return;
    overlay.dataset.cactusBound = "1";

    overlay.addEventListener(
      "click",
      function () {
        if (!isMobile()) return;
        closeMenu();
      },
      true
    );
  }

  function bindBimLinks() {
    document.addEventListener(
      "click",
      function (e) {
        if (isMobile()) return;
        var link = e.target.closest(
          '#navigation li.bim a[href], a[href="/bim/"], a[href="/bim"]'
        );
        if (!link || link.closest("#cactus-mobile-drawer")) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        navigate(link.getAttribute("href") || "/bim/");
      },
      true
    );
  }

  function init() {
    buildDrawer();
    bindMobileToggle();
    bindOverlay();
    bindBimLinks();
    positionDrawer();

    window.addEventListener("resize", function () {
      positionDrawer();
      if (!isMobile()) closeMenu();
    });

    window.addEventListener("orientationchange", function () {
      window.setTimeout(positionDrawer, 120);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
