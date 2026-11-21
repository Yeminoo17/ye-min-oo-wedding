/* ============================================================
   IVORY ELEGANCE — Wedding Invitation behaviour
   Vanilla JS + GSAP + Luxon (timezone-aware countdown) + HTML audio
   RSVP submissions go to a private Google Sheet via an Apps Script Web App.
   ============================================================ */

document.documentElement.classList.add("js");

(function () {
  "use strict";

  /* ---------- Wedding configuration ---------- */
  const WEDDING = {
    // Local wall-clock time in Yangon. Luxon converts this to the correct UTC instant.
    dateISO: "2026-12-19T09:00:00",
    timezone: "Asia/Yangon",
    utcFallback: "2026-12-19T09:00:00+06:30"
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Countdown timer ---------- */
  function getTargetTime() {
    if (window.luxon && window.luxon.DateTime) {
      return window.luxon.DateTime.fromISO(WEDDING.dateISO, { zone: WEDDING.timezone }).toMillis();
    }
    return new Date(WEDDING.utcFallback).getTime();
  }

  function setValue(element, value) {
    if (!element || element.textContent === value) return;
    element.textContent = value;

    // Understated tick: a soft fade/slide whenever a figure changes.
    if (!reduceMotion) {
      element.classList.remove("is-ticking");
      void element.offsetWidth;
      element.classList.add("is-ticking");
    }
  }

  function initCountdown() {
    const target = getTargetTime();
    const els = {
      days: document.getElementById("cd-days"),
      hours: document.getElementById("cd-hours"),
      minutes: document.getElementById("cd-minutes"),
      seconds: document.getElementById("cd-seconds")
    };
    const note = document.querySelector(".countdown__timezone");
    if (!els.days || !target) return;

    const pad = (value) => String(value).padStart(2, "0");

    function tick() {
      const remaining = Math.max(0, target - Date.now());
      const totalSeconds = Math.floor(remaining / 1000);

      setValue(els.days, pad(Math.floor(totalSeconds / 86400)));
      setValue(els.hours, pad(Math.floor((totalSeconds % 86400) / 3600)));
      setValue(els.minutes, pad(Math.floor((totalSeconds % 3600) / 60)));
      setValue(els.seconds, pad(totalSeconds % 60));

      if (remaining === 0 && note) {
        note.textContent = "Today is the day — we can't wait to see you!";
      }
    }

    tick();
    window.setInterval(tick, 1000);
  }

  /* ---------- 3. Fade-up reveals (GSAP + graceful fallback) ---------- */
  function initReveals() {
    const items = Array.from(document.querySelectorAll(".reveal"));
    if (!items.length) return;

    if (window.gsap && window.ScrollTrigger && !reduceMotion) {
      window.gsap.registerPlugin(window.ScrollTrigger);

      items.forEach((el, index) => {
        const isAlreadyVisible = el.getBoundingClientRect().top < window.innerHeight * 0.88;
        const tween = {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
          onStart: () => el.classList.add("is-visible")
        };

        // First-view elements animate straight away; ScrollTrigger only fires
        // on a scroll state change, so they would otherwise stay hidden.
        if (isAlreadyVisible) {
          tween.delay = index * 0.06;
          window.gsap.fromTo(el, { opacity: 0, y: 22 }, tween);
        } else {
          tween.scrollTrigger = { trigger: el, start: "top 88%", once: true };
          window.gsap.fromTo(el, { opacity: 0, y: 22 }, tween);
        }
      });
      return;
    }

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => observer.observe(el));
  }

  /* ---------- 4. Header state + scroll progress ---------- */
  function initScrollUI() {
    const header = document.getElementById("site-header");
    const bar = document.getElementById("scroll-progress-bar");

    let ticking = false;
    function update() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? (scrollTop / max) * 100 : 0;

      if (bar) bar.style.width = `${progress}%`;
      if (header) header.classList.toggle("is-scrolled", scrollTop > 40);
      ticking = false;
    }

    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ---------- 5. Navigation (mobile menu + active link) ---------- */
  function initNavigation() {
    const toggle = document.getElementById("nav-toggle");
    const nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    function closeMenu() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
      document.body.style.overflow = "";
    }

    toggle.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      document.body.style.overflow = open ? "hidden" : "";
    });

    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
    const sections = links
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    if (!("IntersectionObserver" in window) || !sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
  }

  /* ---------- 6. Background music (one audible autoplay attempt) ---------- */
  function initMusic() {
    const button = document.getElementById("music-toggle");
    const audio = document.getElementById("background-music");
    const caption = document.getElementById("music-caption");
    const status = document.getElementById("music-status");
    if (!button || !audio) return;

    // Try audible autoplay once. If the browser blocks it, keep the button
    // ready for a guest click. Missing-file errors are reported on interaction.
    let unavailable = false;
    const missingNotice = "Music file not yet added. Place the wedding music file in assets/music.";

    function setCaption(text) {
      if (caption) caption.textContent = text;
    }

    function announce(text) {
      if (status) status.textContent = text;
    }

    function reflectPlaying(playing) {
      button.classList.toggle("is-playing", playing);
      button.setAttribute("aria-pressed", String(playing));
      const label = playing ? "Pause background music" : "Play background music";
      button.setAttribute("aria-label", label);
      button.title = label;
      setCaption(playing ? "PAUSE MUSIC" : "PLAY MUSIC");
      announce(playing ? "Background music playing" : "Background music paused");
    }

    function reportMissing() {
      unavailable = true;
      if (!audio.paused) audio.pause();
      reflectPlaying(false);
      setCaption("MUSIC UNAVAILABLE");
      announce(missingNotice);
    }

    // A missing file can leave the element "unpaused" with no loadable source,
    // so check the network state as well as the usual error signals.
    function noLoadableSource() {
      return audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
    }

    audio.addEventListener("play", () => reflectPlaying(true));
    audio.addEventListener("pause", () => reflectPlaying(false));
    audio.addEventListener("error", reportMissing);
    const source = audio.querySelector("source");
    if (source) source.addEventListener("error", reportMissing);

    button.addEventListener("click", () => {
      if (unavailable || noLoadableSource()) {
        reportMissing();
        return;
      }

      if (!audio.paused) {
        audio.pause();
        return;
      }

      const attempt = audio.play();
      if (attempt && typeof attempt.then === "function") {
        attempt.then(() => {
          if (noLoadableSource()) reportMissing();
        }).catch(reportMissing);
      }
    });

    // Attempt audible autoplay once. No muted fallback and no retry loop:
    // a blocked attempt simply leaves the guest-controlled button available.
    try {
      const autoplay = audio.play();
      if (autoplay && typeof autoplay.catch === "function") {
        autoplay.catch(() => {
          audio.pause();
          reflectPlaying(false);
        });
      }
    } catch (_) {
      audio.pause();
      reflectPlaying(false);
    }

    // The audio element sits outside every section, so playback continues
    // through in-page navigation and scrolling.
    reflectPlaying(false);
  }

  /* ---------- 7. RSVP (Google Apps Script Web App) ---------- */
  function initRSVP() {
    const form = document.getElementById("rsvp-form");
    if (!form) return;

    const nameInput = document.getElementById("guest-name");
    const status = document.getElementById("form-status");
    const nameError = document.getElementById("error-name");
    const attendingError = document.getElementById("error-attending");
    const submitButton = form.querySelector('button[type="submit"]');
    const guestWrap = document.getElementById("rsvp-guest-wrap");
    const guestCount = document.getElementById("guest-count");
    const dietaryInput = document.getElementById("dietary");

    // Google Apps Script Web App configuration.
    const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbyKXdlcF4_8nSZPMRHSlX6DXC8kolEw-BVyejpt75QI9x0uHB6BAMdQGVZcwqU89MeE/exec";
    const RESPONSE_TIMEOUT = 20000;

    let pendingSubmission = null;

    function setStatus(message, type) {
      if (!status) return;
      status.textContent = message || "";
      status.classList.remove("is-error", "is-success");
      if (type) status.classList.add("is-" + type);
    }

    function setError(element, group, message) {
      if (element) element.textContent = message;
      if (group) group.classList.toggle("has-error", Boolean(message));
    }

    function clearErrors() {
      setError(nameError, nameInput ? nameInput.closest(".form-group") : null, "");
      setError(attendingError, null, "");
    }

    function syncAttendanceFields() {
      const attending = form.querySelector('input[name="attending"]:checked');
      const accepted = Boolean(attending && attending.value === "yes");

      if (guestWrap) {
        guestWrap.classList.toggle("is-hidden", !accepted);
        guestWrap.setAttribute("aria-hidden", String(!accepted));
      }
      if (guestCount) {
        guestCount.disabled = !accepted;
        if (accepted && !guestCount.value) guestCount.selectedIndex = 0;
      }
      if (dietaryInput) dietaryInput.disabled = !accepted;

      if (!accepted) {
        // Clear hidden values so they cannot be submitted with a decline.
        if (guestCount) guestCount.selectedIndex = 0;
        if (dietaryInput) dietaryInput.value = "";
      }
    }

    function makeId() {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
      return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    }

    function getResponseFrame() {
      let frame = document.getElementById("rsvp-response-frame");
      if (!frame) {
        frame = document.createElement("iframe");
        frame.id = "rsvp-response-frame";
        frame.name = "rsvp-response-frame";
        frame.title = "RSVP response";
        frame.setAttribute("aria-hidden", "true");
        frame.style.display = "none";
        document.body.appendChild(frame);
      }
      return frame;
    }

    function setField(name, value) {
      let field = form.querySelector('[name="' + name + '"]');
      if (!field) {
        field = document.createElement("input");
        field.type = "hidden";
        field.name = name;
        form.appendChild(field);
      }
      field.value = value === undefined || value === null ? "" : String(value);
    }

    function readValues() {
      const attending = form.querySelector('input[name="attending"]:checked');
      const accepted = Boolean(attending && attending.value === "yes");
      return {
        name: nameInput ? nameInput.value.trim() : "",
        attending: attending ? attending.value : "",
        guests: accepted && guestCount ? guestCount.value : "",
        meal: accepted && dietaryInput ? dietaryInput.value : "",
        message: (form.querySelector('[name="message"]') || {}).value || ""
      };
    }

    function sendRSVP(data) {
      const frame = getResponseFrame();
      const nonce = makeId();

      setStatus("Sending your RSVP…", "");
      if (submitButton) submitButton.disabled = true;

      // Hidden fields are added only at send time; the visible design stays unchanged.
      setField("nonce", nonce);
      setField("clientId", makeId());
      setField("reply", data.attending);
      setField("guests", data.guests);
      setField("meal", data.meal);
      setField("message", data.message);

      const timer = window.setTimeout(() => {
        if (!pendingSubmission || pendingSubmission.nonce !== nonce) return;
        pendingSubmission = null;
        if (submitButton) submitButton.disabled = false;
        setStatus("The RSVP service took too long. Please try again.", "error");
      }, RESPONSE_TIMEOUT);

      pendingSubmission = {
        nonce: nonce,
        name: data.name,
        button: submitButton,
        timer: timer
      };

      form.target = frame.name;
      form.action = RSVP_ENDPOINT;
      form.method = "post";
      form.submit();
    }

    window.addEventListener("message", (event) => {
      const pending = pendingSubmission;
      if (!pending) return;

      const origin = event.origin || "";
      const isGoogle = origin === "https://script.google.com" ||
        origin.endsWith("-script.googleusercontent.com");
      if (!isGoogle) return;

      const data = event.data;
      if (!data || typeof data !== "object" || data.nonce !== pending.nonce) return;

      window.clearTimeout(pending.timer);
      pendingSubmission = null;
      if (pending.button) pending.button.disabled = false;

      if (data.ok) {
        setStatus("Thank you, " + pending.name + "! " +
          (data.message || "Your RSVP has been received."), "success");
        form.reset();
        syncAttendanceFields();
      } else {
        setStatus(data.message || "Something went wrong. Please try again.", "error");
      }
    });

    if (nameInput) {
      nameInput.addEventListener("input", () => {
        setError(nameError, nameInput.closest(".form-group"), "");
      });
    }

    form.querySelectorAll('input[name="attending"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        setError(attendingError, null, "");
        syncAttendanceFields();
      });
    });

    syncAttendanceFields();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (pendingSubmission) return;

      clearErrors();
      setStatus("", "");

      const data = readValues();
      let valid = true;

      if (!data.name) {
        setError(nameError, nameInput ? nameInput.closest(".form-group") : null, "Please enter your name.");
        valid = false;
      }
      if (!data.attending) {
        setError(attendingError, null, "Please let us know if you can attend.");
        valid = false;
      }
      if (!valid) {
        setStatus("Please check the highlighted fields.", "error");
        return;
      }

      sendRSVP(data);
    });
  }

  /* ---------- 8. Payment QR downloads ---------- */
  function initQRDownloads() {
    document.querySelectorAll(".qr-download").forEach((button) => {
      button.addEventListener("click", () => {
        const src = button.dataset.qrSrc;
        const name = button.dataset.qrName;
        if (!src || !name) return;

        // Download the original file directly; the QR image itself is untouched.
        const link = document.createElement("a");
        link.href = src;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
    });
  }

  /* ---------- Boot ---------- */
  function init() {
    initCountdown();
    initReveals();
    initScrollUI();
    initNavigation();
    initMusic();
    initRSVP();
    initQRDownloads();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
