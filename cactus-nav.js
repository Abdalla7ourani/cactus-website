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
    return window.innerWidth < 1024;
  }

  function closeMenu() {
    var nav = document.getElementById("navigation");
    var overlay = document.getElementById("overlay");
    if (nav) nav.classList.remove("opened");
    if (overlay) overlay.classList.remove("visible");
    document.documentElement.classList.remove("scroll-disabled");
    var drawer = document.getElementById("cactus-mobile-drawer");
    if (drawer) {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }
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
        setTimeout(function () {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          if (history.replaceState) history.replaceState(null, "", "#" + hash);
        }, 50);
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
      '<div class="cactus-mobile-drawer-panel" role="menu">' +
      ITEMS.map(function (item) {
        return (
          '<a href="' +
          item.href +
          '" class="cactus-mobile-drawer-link" role="menuitem">' +
          item.label +
          "</a>"
        );
      }).join("") +
      "</div>";

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

  function syncDrawer() {
    var nav = document.getElementById("navigation");
    var drawer = document.getElementById("cactus-mobile-drawer");
    if (!nav || !drawer) return;

    if (!isMobile()) {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      return;
    }

    var open = nav.classList.contains("opened");
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function bindBimLinks() {
    document.addEventListener(
      "click",
      function (e) {
        var link = e.target.closest(
          '#navigation li.bim a[href], a[href="/bim/"], a[href="/bim"]'
        );
        if (!link) return;
        if (link.closest("#cactus-mobile-drawer")) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        navigate(link.getAttribute("href") || "/bim/");
      },
      true
    );
  }

  function init() {
    buildDrawer();
    bindBimLinks();

    var nav = document.getElementById("navigation");
    if (nav) {
      new MutationObserver(syncDrawer).observe(nav, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    var overlay = document.getElementById("overlay");
    if (overlay) {
      overlay.addEventListener("click", function () {
        syncDrawer();
      });
    }

    window.addEventListener("resize", syncDrawer);
    syncDrawer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
