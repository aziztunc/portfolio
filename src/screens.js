// Scroll behavior adapted from jake.ly: free wheel/touch scrolling with
// scroll-tied section fades, smooth glides for nav/keyboard, and centered snaps.

const SNAP_MIN_MS = 450;
const SNAP_MAX_MS = 900;
const SNAP_MS_PER_PX = 7;
const NAV_CLICK_DURATION_MS = 800;
const ENTRANCE_DURATION_MS = 700;
const ENTRANCE_DISTANCE_PX = 128;
const OPACITY_LERP = 0.25;
const OPACITY_EPSILON = 0.001;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const screensApi = {};

const container = document.getElementById("screens");
const scroller = document.scrollingElement || document.documentElement;

const stableViewportH = () => document.documentElement.clientHeight || window.innerHeight;

if (container) {
  const screenList = Array.from(container.querySelectorAll(".screen"));
  const screens = () => screenList;

  let programmatic = false;
  let rafId = 0;

  function cancelAnimation() {
    if (!programmatic) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
    programmatic = false;
  }

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutCirc = (t) => Math.sqrt(1 - Math.pow(t - 1, 2));
  const easeInCirc = (t) => 1 - Math.sqrt(1 - t * t);
  const easeInOutCirc = (t) =>
    t < 0.5 ? easeInCirc(t * 2) / 2 : 0.5 + easeOutCirc(t * 2 - 1) / 2;

  function scrollToTop(top, options) {
    cancelAnimation();
    const start = scroller.scrollTop;
    const distance = top - start;
    if (Math.abs(distance) < 0.5) return;
    if (prefersReducedMotion) {
      scroller.scrollTop = top;
      syncHashToSection();
      return;
    }
    const duration =
      options && options.duration != null
        ? options.duration
        : Math.max(SNAP_MIN_MS, Math.min(SNAP_MAX_MS, Math.abs(distance) * SNAP_MS_PER_PX));
    const easing = (options && options.easing) || easeOutCubic;
    const startTime = performance.now();
    programmatic = true;
    const step = (now) => {
      if (!programmatic) return;
      const t = Math.min(1, (now - startTime) / duration);
      scroller.scrollTop = start + distance * easing(t);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        programmatic = false;
        rafId = 0;
        syncHashToSection();
      }
    };
    rafId = requestAnimationFrame(step);
  }

  window.addEventListener("wheel", cancelAnimation, { passive: true });
  window.addEventListener("touchstart", cancelAnimation, { passive: true });

  function getHeaderH() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
    return parseFloat(v) || 0;
  }

  function targetForSection(section) {
    const headerH = getHeaderH();
    const contentH = Math.max(0, stableViewportH() - headerH);
    const inner = section.querySelector(".screen__inner") || section;
    const innerH = inner.offsetHeight;
    const innerOffsetInSection = inner === section ? 0 : inner.offsetTop;
    const innerTop = section.offsetTop + innerOffsetInSection;
    const sectionStyles = getComputedStyle(section);
    let target;
    if (innerH <= contentH) {
      const slackAbove = (contentH - innerH) / 2;
      const bias = parseFloat(sectionStyles.getPropertyValue("--snap-offset-y")) || 0;
      target = innerTop - headerH - slackAbove - bias;
    } else {
      const smt = parseFloat(sectionStyles.scrollMarginTop) || 0;
      target = section.offsetTop - headerH - smt;
    }
    return Math.max(0, target);
  }

  screensApi.targetForId = (id) => {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains("screen")) return null;
    return targetForSection(el);
  };

  const opacityState = new WeakMap();

  let entranceSection = null;
  let entranceStart = 0;
  const wantsEntrance =
    document.documentElement.classList.contains("home-entrance");
  if (wantsEntrance && !prefersReducedMotion) {
    entranceSection = document.getElementById("work");
    if (entranceSection) {
      entranceStart = performance.now();
      entranceSection.style.opacity = "0";
      entranceSection.style.transform = `translateY(${ENTRANCE_DISTANCE_PX}px)`;
      opacityState.set(entranceSection, { opacity: 0 });
    }
  }
  document.documentElement.classList.remove("home-entrance");

  function updateScreenOpacities() {
    if (prefersReducedMotion) return false;
    const V = stableViewportH();
    if (V <= 0) return false;
    const headerH = getHeaderH();
    const contentH = Math.max(1, V - headerH);
    const list = screens();
    let needsMoreFrames = false;
    const now = performance.now();

    for (const section of list) {
      const rect = section.getBoundingClientRect();
      const top = rect.top;
      const H = rect.height;
      const visibleTop = Math.max(headerH, top);
      const visibleBottom = Math.min(V, top + H);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const maxVisible = Math.max(1, Math.min(H, contentH));
      const coverage = Math.min(1, visibleHeight / maxVisible);
      const target = coverage >= 0.999 ? 1 : easeInOutCirc(coverage);

      let state = opacityState.get(section);
      if (!state) {
        state = { opacity: target };
        opacityState.set(section, state);
      }

      if (section === entranceSection) {
        const elapsed = now - entranceStart;
        if (elapsed < ENTRANCE_DURATION_MS) {
          const eased = easeOutCirc(elapsed / ENTRANCE_DURATION_MS);
          state.opacity = target * eased;
          section.style.transform = `translateY(${ENTRANCE_DISTANCE_PX * (1 - eased)}px)`;
          section.style.opacity = state.opacity.toFixed(3);
          needsMoreFrames = true;
          continue;
        }
        section.style.transform = "";
        entranceSection = null;
      }

      const diff = target - state.opacity;
      if (Math.abs(diff) > OPACITY_EPSILON) {
        state.opacity += diff * OPACITY_LERP;
        needsMoreFrames = true;
      } else {
        state.opacity = target;
      }

      section.style.opacity = state.opacity.toFixed(3);
    }

    return needsMoreFrames;
  }

  let opacityFrame = 0;
  function tickOpacity() {
    opacityFrame = 0;
    if (updateScreenOpacities()) {
      opacityFrame = requestAnimationFrame(tickOpacity);
    }
  }
  function scheduleOpacityUpdate() {
    if (opacityFrame) return;
    opacityFrame = requestAnimationFrame(tickOpacity);
  }

  function currentIndex() {
    const list = screens();
    const top = scroller.scrollTop;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < list.length; i++) {
      const dist = Math.abs(targetForSection(list[i]) - top);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  screensApi.currentSectionHash = () => {
    const section = screens()[currentIndex()];
    if (!section || !section.id) return null;
    return section.id === "home" ? "" : `#${section.id}`;
  };

  function syncHashToSection() {
    if (programmatic) return;
    const nextHash = screensApi.currentSectionHash();
    if (nextHash === null || nextHash === location.hash) return;
    const url = location.pathname + location.search + nextHash;
    history.replaceState(null, "", url);
  }

  function go(delta) {
    const list = screens();
    const i = Math.max(0, Math.min(list.length - 1, currentIndex() + delta));
    scrollToTop(targetForSection(list[i]));
  }

  function goTo(i, options) {
    const list = screens();
    const clamped = Math.max(0, Math.min(list.length - 1, i));
    scrollToTop(targetForSection(list[clamped]), options);
  }

  let hashSyncTimer = 0;
  window.addEventListener(
    "scroll",
    () => {
      scheduleOpacityUpdate();
      if (programmatic) return;
      clearTimeout(hashSyncTimer);
      hashSyncTimer = setTimeout(syncHashToSection, 120);
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    scheduleOpacityUpdate();
  });
  scheduleOpacityUpdate();

  document.addEventListener("click", (e) => {
    const link = e.target && e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;
    const id = href.slice(1);
    if (!id) {
      e.preventDefault();
      if (location.hash) {
        history.pushState(null, "", location.pathname + location.search);
      }
      goTo(0, { duration: NAV_CLICK_DURATION_MS });
      return;
    }
    const target = document.getElementById(id);
    if (!target || !target.classList.contains("screen")) return;
    const list = screens();
    const idx = list.indexOf(target);
    if (idx === -1) return;
    e.preventDefault();
    const nextHash = `#${id}`;
    if (location.hash !== nextHash) {
      history.pushState(null, "", nextHash);
    }
    goTo(idx, { duration: NAV_CLICK_DURATION_MS });
  });

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(tag) || (e.target && e.target.isContentEditable)) {
      return;
    }
    switch (e.key) {
      case "ArrowDown":
      case "PageDown":
      case "j":
        e.preventDefault();
        go(1);
        break;
      case "ArrowUp":
      case "PageUp":
      case "k":
        e.preventDefault();
        go(-1);
        break;
      case "Home":
        e.preventDefault();
        goTo(0);
        break;
      case "End":
        e.preventDefault();
        goTo(screens().length - 1);
        break;
      default:
        break;
    }
  });

  const initialHash = location.hash.slice(1);
  if (initialHash && initialHash !== "home") {
    const target = document.getElementById(initialHash);
    if (target && target.classList.contains("screen")) {
      requestAnimationFrame(() => {
        scrollToTop(targetForSection(target));
      });
    }
  }
}
