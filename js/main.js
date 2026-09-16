(function () {
  "use strict";

  var hasGSAP = typeof window.gsap !== "undefined";
  if (hasGSAP && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ---------------------------------------------------------
     PRELOADER
  --------------------------------------------------------- */
  window.addEventListener("load", function () {
    var pre = document.getElementById("preloader");
    setTimeout(function () {
      pre.classList.add("is-hidden");
      document.body.classList.add("is-ready");
      playHeroIntro();
    }, 450);
  });

  /* ---------------------------------------------------------
     CUSTOM CURSOR
  --------------------------------------------------------- */
  var dot = document.getElementById("cursorDot");
  var ring = document.getElementById("cursorRing");
  var mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

  if (window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
    window.addEventListener("mousemove", function (e) {
      mouseX = e.clientX; mouseY = e.clientY;
      dot.style.transform = "translate(" + mouseX + "px," + mouseY + "px) translate(-50%,-50%)";
    });
    (function loopRing() {
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;
      ring.style.transform = "translate(" + ringX + "px," + ringY + "px) translate(-50%,-50%)";
      requestAnimationFrame(loopRing);
    })();

    document.querySelectorAll("a, button, input, select, .pillar-card, .gallery-tile, .choice, .chip-option").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        ring.style.width = "54px"; ring.style.height = "54px"; ring.style.borderColor = "rgba(255,90,31,0.9)";
      });
      el.addEventListener("mouseleave", function () {
        ring.style.width = "34px"; ring.style.height = "34px"; ring.style.borderColor = "rgba(255,90,31,0.5)";
      });
    });
  }

  /* ---------------------------------------------------------
     NAV: scroll state + mobile burger + smooth active link
  --------------------------------------------------------- */
  var nav = document.getElementById("nav");
  var burger = document.getElementById("navBurger");
  var navLinks = document.getElementById("navLinks");

  window.addEventListener("scroll", function () {
    nav.classList.toggle("is-scrolled", window.scrollY > 30);
  }, { passive: true });

  burger.addEventListener("click", function () {
    navLinks.classList.toggle("is-open");
    document.body.classList.toggle("nav-open");
  });

  document.querySelectorAll("[data-nav]").forEach(function (link) {
    link.addEventListener("click", function () {
      navLinks.classList.remove("is-open");
      document.body.classList.remove("nav-open");
    });
  });

  /* ---------------------------------------------------------
     HERO INTRO ANIMATION
  --------------------------------------------------------- */
  function playHeroIntro() {
    if (!hasGSAP) {
      document.querySelectorAll(".hero .reveal-up, .hero .reveal-line span").forEach(function (el) {
        el.style.opacity = 1; el.style.transform = "none";
      });
      document.querySelector(".hero__bike").classList.add("is-riding");
      return;
    }
    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".hero__eyebrow", { y: 20, opacity: 0, duration: 0.6 })
      .from(".reveal-line span", { yPercent: 120, opacity: 0, duration: 0.9, stagger: 0.12 }, "-=0.3")
      .from(".hero__subtitle", { y: 20, opacity: 0, duration: 0.6 }, "-=0.5")
      .from(".hero__cta", { y: 20, opacity: 0, duration: 0.6 }, "-=0.4")
      .fromTo(".hero__bike", { x: -60, opacity: 0 }, { x: 300, opacity: 0.9, duration: 1.3, ease: "power2.out" }, "-=0.9")
      .to(".hero__bike", { x: 340, duration: 20, ease: "none" });
  }

  /* ---------------------------------------------------------
     SCROLL REVEAL (IntersectionObserver — no hard GSAP dependency)
  --------------------------------------------------------- */
  var revealEls = document.querySelectorAll(".reveal-up");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (entry.isIntersecting) {
          setTimeout(function () {
            entry.target.classList.add("is-visible");
          }, (i % 4) * 90);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------------------------------------------------------
     HERO PARTICLE CANVAS (embers rising)
  --------------------------------------------------------- */
  (function initParticles() {
    var canvas = document.getElementById("particleCanvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var particles = [];
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var hero = document.querySelector(".hero");

    function resize() {
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
    }
    function makeParticle() {
      return {
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        r: Math.random() * 1.8 + 0.6,
        speed: Math.random() * 0.6 + 0.25,
        drift: Math.random() * 0.6 - 0.3,
        alpha: Math.random() * 0.5 + 0.2,
        hue: Math.random() > 0.5 ? "255,90,31" : "255,176,32",
      };
    }
    resize();
    window.addEventListener("resize", resize);

    var count = window.innerWidth < 700 ? 35 : 70;
    for (var i = 0; i < count; i++) particles.push(makeParticle());

    if (reduceMotion) return; // keep canvas static/empty for reduced-motion users

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(function (p) {
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + p.hue + "," + p.alpha + ")";
        ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    tick();
  })();

  /* ---------------------------------------------------------
     STATS COUNT-UP
  --------------------------------------------------------- */
  (function initCounters() {
    var nums = document.querySelectorAll(".stat__num");
    if (!nums.length || !("IntersectionObserver" in window)) return;
    var done = false;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !done) {
          done = true;
          nums.forEach(animateCount);
          obs.disconnect();
        }
      });
    }, { threshold: 0.4 });
    obs.observe(document.querySelector(".stats"));

    function animateCount(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      var duration = 1600;
      var start = performance.now();
      function step(now) {
        var progress = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target.toLocaleString();
      }
      requestAnimationFrame(step);
    }
  })();

  /* ---------------------------------------------------------
     MAGNETIC BUTTONS
  --------------------------------------------------------- */
  document.querySelectorAll(".magnetic").forEach(function (btn) {
    if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    btn.addEventListener("mousemove", function (e) {
      var rect = btn.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = "translate(" + x * 0.18 + "px," + y * 0.35 + "px)";
    });
    btn.addEventListener("mouseleave", function () {
      btn.style.transform = "";
    });
  });

  /* ---------------------------------------------------------
     TILT ON CARDS
  --------------------------------------------------------- */
  document.querySelectorAll(".pillar-card, .membership-card").forEach(function (card) {
    if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    card.addEventListener("mousemove", function (e) {
      var rect = card.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width - 0.5;
      var py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = "perspective(700px) rotateX(" + (-py * 5) + "deg) rotateY(" + (px * 5) + "deg) translateY(-4px)";
    });
    card.addEventListener("mouseleave", function () {
      card.style.transform = "";
    });
  });

  /* ---------------------------------------------------------
     ACCORDION (FAQ)
  --------------------------------------------------------- */
  document.querySelectorAll(".accordion-item__head").forEach(function (head) {
    head.addEventListener("click", function () {
      var item = head.closest(".accordion-item");
      var body = item.querySelector(".accordion-item__body");
      var isOpen = item.classList.contains("is-open");

      document.querySelectorAll(".accordion-item.is-open").forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove("is-open");
          openItem.querySelector(".accordion-item__body").style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.classList.remove("is-open");
        body.style.maxHeight = null;
      } else {
        item.classList.add("is-open");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    });
  });

  /* ---------------------------------------------------------
     JOIN FORM -> GOOGLE SHEET
  --------------------------------------------------------- */
  var form = document.getElementById("joinForm");
  var statusEl = document.getElementById("joinStatus");
  var submitBtn = document.getElementById("joinSubmit");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.className = "join__status";
    statusEl.textContent = "";

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var url = (window.SITE_CONFIG || {}).GOOGLE_SHEET_WEB_APP_URL;
    if (!url || url.indexOf("PASTE_YOUR_GOOGLE_APPS_SCRIPT") !== -1) {
      statusEl.classList.add("is-error");
      statusEl.textContent = "Form isn't connected to Google Sheets yet — see README.md to finish setup.";
      return;
    }

    var rideTypes = Array.from(form.querySelectorAll('input[name="rideTypes"]:checked')).map(function (i) { return i.value; });
    var payload = new FormData();
    payload.append("name", form.name.value.trim());
    payload.append("email", form.email.value.trim());
    payload.append("mobile", form.mobile.value.trim());
    payload.append("membershipType", (form.querySelector('input[name="membershipType"]:checked') || {}).value || "");
    payload.append("bike", form.bike.value.trim());
    payload.append("experience", form.experience.value);
    payload.append("rideTypes", rideTypes.join(", "));
    payload.append("source", form.source.value);
    payload.append("submittedAt", new Date().toISOString());

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    fetch(url, { method: "POST", mode: "no-cors", body: payload })
      .then(function () {
        statusEl.classList.add("is-success");
        statusEl.textContent = "You're in! Welcome to the pack — we'll be in touch soon.";
        form.reset();
      })
      .catch(function () {
        statusEl.classList.add("is-error");
        statusEl.textContent = "Something went wrong sending your details. Please try again in a moment.";
      })
      .finally(function () {
        submitBtn.classList.remove("is-loading");
        submitBtn.disabled = false;
      });
  });

  /* ---------------------------------------------------------
     FOOTER YEAR
  --------------------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
