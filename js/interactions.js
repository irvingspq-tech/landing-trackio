/* ==========================================================================
   TrackIO SaaS — interactions.js
   UI pura: estado del nav al hacer scroll, menú móvil, scroll-reveal y
   smooth scroll de anclas.
   ========================================================================== */

(function () {
  "use strict";

  function safe(fn, label) {
    try {
      fn();
    } catch (err) {
      console.error("[Trackio] Fallo en " + label + ":", err);
    }
  }

  function initNavScrollState() {
    var nav = document.getElementById("navbar");
    if (!nav) return;

    var ticking = false;

    function update() {
      nav.classList.toggle("is-scrolled", window.scrollY > 40);
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initMobileNav() {
    var toggle = document.getElementById("nav-toggle");
    var panel = document.getElementById("nav-mobile-panel");
    var close = document.getElementById("nav-mobile-close");
    var overlay = document.getElementById("nav-mobile-overlay");
    if (!toggle || !panel || !close || !overlay) return;

    function open() {
      panel.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }

    function closePanel() {
      panel.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }

    toggle.addEventListener("click", open);
    close.addEventListener("click", closePanel);
    overlay.addEventListener("click", closePanel);

    panel.querySelectorAll(".nav-mobile-link").forEach(function (link) {
      link.addEventListener("click", closePanel);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && panel.classList.contains("is-open")) closePanel();
    });
  }

  function initScrollReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    // Escalona solo entre los elementos que entran a la vez y por filas: los de una misma fila aparecen juntos.
    var showObserver = new IntersectionObserver(
      function (entries) {
        var entering = entries.filter(function (entry) {
          return entry.isIntersecting && !entry.target.classList.contains("is-visible");
        });

        entering.sort(function (a, b) {
          return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left;
        });

        var row = -1;
        var rowTop = null;
        entering.forEach(function (entry) {
          var top = entry.boundingClientRect.top;
          if (rowTop === null || Math.abs(top - rowTop) > 8) {
            row += 1;
            rowTop = top;
          }
          entry.target.style.transitionDelay = Math.min(row * 90, 360) + "ms";
          entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );

    // Se reinicia solo al salir por completo de la pantalla, para que vuelva a animarse al regresar.
    var resetObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          entry.target.style.transitionDelay = "";
          entry.target.classList.remove("is-visible");
        }
      });
    });

    items.forEach(function (el) {
      // Quita el retraso al terminar de aparecer, para que no frene las transiciones de hover.
      el.addEventListener("transitionend", function (event) {
        if (event.target === el && event.propertyName === "opacity") el.style.transitionDelay = "";
      });
      showObserver.observe(el);
      resetObserver.observe(el);
    });
  }

  function initSmoothScroll() {
    var links = document.querySelectorAll('a[href^="#"]');
    if (!links.length) return;

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var targetId = link.getAttribute("href");
        if (!targetId || targetId === "#") return;

        var target = document.querySelector(targetId);
        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function initVideoAutoplay() {
    var video = document.querySelector(".video-embed-player");
    if (!video) return;

    video.addEventListener("contextmenu", function (event) {
      event.preventDefault();
    });

    if (!("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            video.play().catch(function () {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
  }

  // Carrusel continuo: clona las tarjetas antes y después para avanzar siempre en la misma dirección.
  function initSeamlessCarousel(root) {
    var viewport = root.querySelector(".carousel-viewport");
    var track = root.querySelector(".carousel-track");
    var slides = Array.prototype.slice.call(root.querySelectorAll(".carousel-slide"));
    var prevBtn = root.querySelector(".carousel-btn--prev");
    var nextBtn = root.querySelector(".carousel-btn--next");
    var count = slides.length;
    if (!viewport || !track || !count) return;

    function makeClone(slide) {
      var clone = slide.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("inert", "");
      return clone;
    }

    var firstReal = slides[0];
    slides.forEach(function (slide) {
      track.insertBefore(makeClone(slide), firstReal);
      track.appendChild(makeClone(slide));
    });

    var dots = document.createElement("div");
    dots.className = "carousel-dots";
    var dotButtons = slides.map(function (slide, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", "Ir a la tarjeta " + (index + 1));
      dot.addEventListener("click", function () {
        goTo(count + index);
      });
      dots.appendChild(dot);
      return dot;
    });
    root.appendChild(dots);

    var position = count;
    var animating = false;
    var fallbackTimer = null;

    function perPage() {
      return window.innerWidth > 900 ? 2 : 1;
    }

    function render(animate) {
      track.style.transition = animate ? "" : "none";
      track.style.transform = "translateX(-" + position * (viewport.clientWidth / perPage()) + "px)";
      if (!animate) {
        void track.offsetWidth;
        track.style.transition = "";
      }

      var active = (((position - count) % count) + count) % count;
      dotButtons.forEach(function (dot, index) {
        dot.classList.toggle("is-active", index === active);
        if (index === active) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });

      var canScroll = count > perPage();
      if (prevBtn) prevBtn.hidden = !canScroll;
      if (nextBtn) nextBtn.hidden = !canScroll;
      dots.hidden = !canScroll;
    }

    // Al terminar sobre un clon, salta sin animación a la tarjeta real equivalente.
    function finish() {
      window.clearTimeout(fallbackTimer);
      animating = false;
      var before = position;
      if (position >= 2 * count) position -= count;
      else if (position < count) position += count;
      if (position !== before) render(false);
    }

    function goTo(target) {
      if (animating || target === position) return;
      animating = true;
      position = target;
      render(true);
      fallbackTimer = window.setTimeout(finish, 1000);
    }

    track.addEventListener("transitionend", function (event) {
      if (event.target === track && event.propertyName === "transform") finish();
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        goTo(position - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goTo(position + 1);
      });
    }

    if ("ResizeObserver" in window) {
      new ResizeObserver(function () {
        render(false);
      }).observe(viewport);
    } else {
      var resizeTimer = null;
      window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
          render(false);
        }, 150);
      });
    }

    render(false);
  }

  function initCarousels() {
    var carousels = document.querySelectorAll("[data-carousel]");
    if (!carousels.length) return;

    carousels.forEach(function (root) {
      if (root.getAttribute("data-carousel") === "seamless") {
        initSeamlessCarousel(root);
        return;
      }

      var viewport = root.querySelector(".carousel-viewport");
      var track = root.querySelector(".carousel-track");
      var slides = root.querySelectorAll(".carousel-slide");
      var prevBtn = root.querySelector(".carousel-btn--prev");
      var nextBtn = root.querySelector(".carousel-btn--next");
      if (!viewport || !track || !slides.length) return;

      var currentPage = 0;

      function perPage() {
        return window.innerWidth > 900 ? 2 : 1;
      }

      function totalPages() {
        return Math.max(1, Math.ceil(slides.length / perPage()));
      }

      function update() {
        var pages = totalPages();
        if (currentPage > pages - 1) currentPage = pages - 1;

        track.style.transform = "translateX(-" + currentPage * viewport.clientWidth + "px)";

        var canScroll = pages > 1;
        if (prevBtn) prevBtn.hidden = !canScroll;
        if (nextBtn) nextBtn.hidden = !canScroll;
      }

      if (prevBtn) {
        prevBtn.addEventListener("click", function () {
          var pages = totalPages();
          currentPage = currentPage <= 0 ? pages - 1 : currentPage - 1;
          update();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", function () {
          var pages = totalPages();
          currentPage = currentPage >= pages - 1 ? 0 : currentPage + 1;
          update();
        });
      }

      var resizeTimer = null;
      window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(update, 150);
      });

      update();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    safe(initNavScrollState, "estado-nav-scroll");
    safe(initMobileNav, "nav-movil");
    safe(initScrollReveal, "scroll-reveal");
    safe(initSmoothScroll, "smooth-scroll");
    safe(initVideoAutoplay, "video-autoplay");
    safe(initCarousels, "carruseles");
  });
})();
