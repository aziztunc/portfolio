import { getHeadlineCopy, onLangChange } from "./i18n.js";

const CURSOR_ARROW_SVG = `
<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
  <g>
    <path d="M4 0L52 25.9459L29.9459 30.4865L16.973 48L4 0Z" fill="#17191C"/>
    <path d="M49.1094 25.5195L29.7441 29.5068L29.3701 29.584L29.1426 29.8916L17.3984 45.7432L5.57324 1.9873L49.1094 25.5195Z" stroke="white" stroke-width="2"/>
  </g>
</svg>
`;

const CURSOR_TEXT_SVG = `
<svg viewBox="0 0 36 96" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
  <g>
    <path d="M28 4H24C20.6863 4 18 6.68629 18 10V78C18 81.3137 20.6863 84 24 84H28" stroke="white" stroke-width="8" stroke-linecap="round"/>
    <path d="M7.99999 84L12 84C15.3137 84 18 81.3137 18 78L18 10C18 6.68629 15.3137 4 12 4L8 4" stroke="white" stroke-width="8" stroke-linecap="round"/>
    <path d="M28 4H24C20.6863 4 18 6.68629 18 10V78C18 81.3137 20.6863 84 24 84H28" stroke="#17191C" stroke-width="4" stroke-linecap="round"/>
    <path d="M7.99999 84L12 84C15.3137 84 18 81.3137 18 78L18 10C18 6.68629 15.3137 4 12 4L8 4" stroke="#17191C" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>
`;

const LAYER_ICON_SVG = `
<svg viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
  <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.25"/>
</svg>
`;

function el(tag, className, attrs) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "style") Object.assign(node.style, v);
      else node.setAttribute(k, v);
    }
  }
  return node;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function transitionEndOnce(node, prop, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      node.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = (e) => {
      if (e.target === node && e.propertyName === prop) finish();
    };
    node.addEventListener("transitionend", onEnd);
    setTimeout(finish, timeoutMs);
  });
}

const DRAG_EASE = "cubic-bezier(0.445, 0.05, 0.55, 0.95)";

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function applyTypedSyntax(text, applySyntaxColorsByIndex) {
  const paren = text.indexOf("(");
  if (paren === -1) return;
  applySyntaxColorsByIndex(
    { range: [0, paren], cls: "headline__char--accent" },
    { range: [paren, paren + 2], cls: "headline__char--accent-blue" },
    { range: [text.length - 1, text.length], cls: "headline__char--accent-soft" }
  );
}

export function createHeadline(host) {
  const frame = el("div", "headline-frame");
  const root = el("div", "headline", {
    role: "heading",
    "aria-level": "1",
  });
  frame.appendChild(root);

  const metaTop = el("div", "headline__meta headline__meta--top");
  const top = el("div", "headline__line headline__line--top");
  const metaBottom = el("div", "headline__meta headline__meta--bottom");

  const bottom = el("div", "headline__line headline__line--bottom");
  const bottomText = el("span", "headline__bottom-text");
  const caret = el("span", "headline__caret");
  bottom.appendChild(bottomText);
  bottom.appendChild(caret);

  const bottomFade = el("div", "headline__line headline__line--bottom");
  bottomFade.style.opacity = "0";
  bottomFade.style.pointerEvents = "none";
  let chars = [];

  function setBottomText(text) {
    bottomText.textContent = "";
    chars = [];
    for (const ch of text) {
      const s = el("span", "headline__char");
      s.textContent = ch === " " ? "\u00a0" : ch;
      bottomText.appendChild(s);
      chars.push(s);
    }
  }

  const accentStrip = el("div", "headline__accent-strip");
  const textHighlight = el("div", "headline__text-highlight");
  const selection = el("div", "headline__selection");
  const anchorTL = el("div", "headline__anchor");
  const anchorTR = el("div", "headline__anchor");
  const anchorBL = el("div", "headline__anchor");
  const anchorBR = el("div", "headline__anchor");
  const sizeLabel = el("div", "headline__size-label");
  sizeLabel.textContent = "640 × 80";

  const layersPanel = el("div", "headline__layers");
  const layersHeader = el("div", "headline__layers-header");
  const layersList = el("div", "headline__layers-list");
  const layersRow = el("div", "headline__layers-row headline__layers-row--active");
  const layersIcon = el("span", "headline__layers-icon");
  layersIcon.innerHTML = LAYER_ICON_SVG;
  const layersName = el("span", "headline__layers-name");
  const layersCaret = el("span", "headline__layers-caret headline__caret");
  layersRow.appendChild(layersIcon);
  layersRow.appendChild(layersName);
  layersRow.appendChild(layersCaret);
  layersList.appendChild(layersRow);
  layersPanel.appendChild(layersHeader);
  layersPanel.appendChild(layersList);

  const cursor = el("div", "headline__cursor");
  cursor.innerHTML = CURSOR_ARROW_SVG;

  root.appendChild(metaTop);
  root.appendChild(top);
  root.appendChild(textHighlight);
  root.appendChild(accentStrip);
  root.appendChild(bottom);
  root.appendChild(bottomFade);
  root.appendChild(metaBottom);
  root.appendChild(layersPanel);
  root.appendChild(selection);
  root.appendChild(anchorTL);
  root.appendChild(anchorTR);
  root.appendChild(anchorBL);
  root.appendChild(anchorBR);
  root.appendChild(sizeLabel);
  root.appendChild(cursor);
  host.appendChild(frame);

  function applyStaticCopy() {
    const c = getHeadlineCopy();
    root.setAttribute("aria-label", c.aria);
    metaTop.textContent = c.metaTop;
    top.textContent = c.top;
    metaBottom.textContent = c.metaBottom;
    layersHeader.textContent = c.layersTitle;
  }
  applyStaticCopy();

  const DESIGN_WIDTH = 720;
  const SIDE_PADDING = 32;
  let currentScale = 1;
  function applyScale() {
    const viewportW = document.documentElement.clientWidth;
    const available = viewportW - SIDE_PADDING * 2;
    const s = Math.min(1, available / DESIGN_WIDTH);
    currentScale = s;
    frame.style.setProperty("--scale", String(s));
    root.style.transform = `scale(${s})`;
  }
  applyScale();

  function elementInRootCoords(node) {
    const rootRect = root.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const s = currentScale || 1;
    return {
      x: (r.left - rootRect.left) / s,
      y: (r.top - rootRect.top) / s,
      w: r.width / s,
      h: r.height / s,
      cx: (r.left + r.width / 2 - rootRect.left) / s,
      cy: (r.top + r.height / 2 - rootRect.top) / s,
    };
  }

  function setLayerName(text) {
    layersName.textContent = text;
  }

  function showLayerCaret(on) {
    layersCaret.style.opacity = on ? "1" : "0";
    layersCaret.classList.toggle("headline__layers-caret--blink", on);
  }

  function showLayersPanel(on) {
    layersPanel.classList.toggle("headline__layers--visible", on);
  }

  async function slideLayersPanel(on) {
    showLayersPanel(on);
    await transitionEndOnce(layersPanel, "transform", 480);
  }

  function measureBottomBox() {
    const rootRect = root.getBoundingClientRect();
    const r = bottomText.getBoundingClientRect();
    const s = currentScale || 1;
    return {
      x: (r.left - rootRect.left) / s,
      y: (r.top - rootRect.top) / s,
      w: r.width / s,
      h: r.height / s,
    };
  }

  function applySelectionToBottomText(pad = 6) {
    const b = measureBottomBox();
    const x = b.x - pad;
    const y = b.y - pad;
    const w = b.w + pad * 2;
    const h = b.h + pad * 2;

    selection.style.left = `${x}px`;
    selection.style.top = `${y}px`;
    selection.style.width = `${w}px`;
    selection.style.height = `${h}px`;

    const placeAnchor = (node, ax, ay) => {
      node.style.left = `${ax - 4}px`;
      node.style.top = `${ay - 4}px`;
    };
    placeAnchor(anchorTL, x, y);
    placeAnchor(anchorTR, x + w, y);
    placeAnchor(anchorBL, x, y + h);
    placeAnchor(anchorBR, x + w, y + h);

    sizeLabel.style.left = `${x + w / 2}px`;
    sizeLabel.style.top = `${y + h + 8}px`;
    sizeLabel.textContent = "640 × 80";
  }

  function applyTextHighlight(leftX, rightX) {
    const b = measureBottomBox();
    const padY = 8;
    const y = b.y - padY;
    const h = b.h + padY * 2;
    const w = Math.max(0, rightX - leftX);
    textHighlight.style.left = `${leftX}px`;
    textHighlight.style.top = `${y}px`;
    textHighlight.style.width = `${w}px`;
    textHighlight.style.height = `${h}px`;

    accentStrip.style.left = `${rightX - 7}px`;
    accentStrip.style.top = `${y}px`;
    accentStrip.style.height = `${h}px`;
  }

  function charMidpoints() {
    const rootRect = root.getBoundingClientRect();
    const s = currentScale || 1;
    return chars.map((c) => {
      const r = c.getBoundingClientRect();
      return {
        left: (r.left - rootRect.left) / s,
        right: (r.right - rootRect.left) / s,
        mid: (r.left + r.width / 2 - rootRect.left) / s,
      };
    });
  }

  function applyCharSelectionUpTo(cursorX, anchorX) {
    const mids = charMidpoints();
    const lo = Math.min(anchorX, cursorX);
    const hi = Math.max(anchorX, cursorX);
    for (let i = 0; i < chars.length; i++) {
      const m = mids[i];
      const inside = m.mid >= lo && m.mid <= hi;
      chars[i].classList.toggle("headline__char--selected", inside);
    }
  }

  function clearCharSelection() {
    for (const c of chars) c.classList.remove("headline__char--selected");
  }

  function clearCharSyntax() {
    for (const c of chars) {
      c.classList.remove("headline__char--accent");
      c.classList.remove("headline__char--accent-soft");
      c.classList.remove("headline__char--accent-blue");
    }
  }

  function applySyntaxColorsByIndex(...rules) {
    for (const rule of rules) {
      const [start, end] = rule.range;
      for (let i = start; i < end && i < chars.length; i++) {
        chars[i].classList.add(rule.cls);
      }
    }
  }

  const TEXT_CURSOR_SCALE = 0.75;
  const TEXT_CURSOR_W = 36 * TEXT_CURSOR_SCALE;
  const TEXT_CURSOR_H = 96 * TEXT_CURSOR_SCALE;

  function setCursor(kind) {
    if (kind === "text") {
      cursor.classList.add("headline__cursor--text");
      cursor.style.width = `${TEXT_CURSOR_W}px`;
      cursor.style.height = `${TEXT_CURSOR_H}px`;
      cursor.innerHTML = CURSOR_TEXT_SVG;
    } else {
      cursor.classList.remove("headline__cursor--text");
      cursor.style.width = "56px";
      cursor.style.height = "56px";
      cursor.innerHTML = CURSOR_ARROW_SVG;
    }
  }

  let cursorState = { x: -9999, y: -9999, scale: 1 };
  function applyCursor() {
    cursor.style.transform = `translate3d(${cursorState.x}px, ${cursorState.y}px, 0) scale(${cursorState.scale})`;
  }
  applyCursor();

  function moveCursorTo(x, y, duration, easing = easeOutCubic) {
    return new Promise((resolve) => {
      const startX = cursorState.x;
      const startY = cursorState.y;
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const e = easing(t);
        cursorState.x = lerp(startX, x, e);
        cursorState.y = lerp(startY, y, e);
        applyCursor();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function scaleCursor(target, duration) {
    return new Promise((resolve) => {
      const startScale = cursorState.scale;
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        cursorState.scale = lerp(startScale, target, easeOutCubic(t));
        applyCursor();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function showSelection(on) {
    selection.classList.toggle("headline__selection--visible", on);
    anchorTL.classList.toggle("headline__anchor--visible", on);
    anchorTR.classList.toggle("headline__anchor--visible", on);
    anchorBL.classList.toggle("headline__anchor--visible", on);
    anchorBR.classList.toggle("headline__anchor--visible", on);
    sizeLabel.classList.toggle("headline__size-label--visible", on);
  }

  function showHighlight(on) {
    textHighlight.classList.toggle("headline__text-highlight--visible", on);
    accentStrip.classList.toggle("headline__accent-strip--visible", on);
    if (!on) clearCharSelection();
  }

  function showCaret(on) {
    caret.style.opacity = on ? "1" : "0";
    caret.classList.toggle("headline__caret--blink", on);
  }

  async function typeText(text, perChar = 55) {
    setBottomText("");
    showCaret(true);
    for (let i = 0; i < text.length; i++) {
      setBottomText(text.slice(0, i + 1));
      if (selection.classList.contains("headline__selection--visible")) {
        applySelectionToBottomText();
      }
      await wait(perChar);
    }
  }

  async function typeLayerName(text, perChar = 60) {
    layersRow.classList.add("headline__layers-row--editing");
    setLayerName("");
    showLayerCaret(true);
    for (let i = 0; i < text.length; i++) {
      setLayerName(text.slice(0, i + 1));
      await wait(perChar);
    }
  }

  async function playLayersRename(currentLabel, targetLabel, startGen) {
    setLayerName(currentLabel);
    layersRow.classList.remove("headline__layers-row--editing");
    showLayerCaret(false);
    showLayersPanel(false);
    void layersPanel.offsetWidth;

    setCursor("arrow");
    cursor.style.opacity = "1";

    await slideLayersPanel(true);
    if (generation !== startGen) return true;

    await new Promise((r) => requestAnimationFrame(r));
    const nameBox = elementInRootCoords(layersName);
    const tipTarget = arrowTipAt(nameBox.cx, nameBox.cy);
    await moveCursorTo(tipTarget.x, tipTarget.y, 520);
    if (generation !== startGen) return true;

    await scaleCursor(0.85, 70);
    await scaleCursor(1, 90);
    await wait(90);
    await scaleCursor(0.85, 70);
    await scaleCursor(1, 90);
    await wait(180);
    if (generation !== startGen) return true;

    await typeLayerName(targetLabel, 60);
    await wait(500);
    if (generation !== startGen) return true;

    setBottomText(targetLabel);
    clearCharSyntax();
    showLayerCaret(false);
    layersRow.classList.remove("headline__layers-row--editing");

    await wait(300);
    await slideLayersPanel(false);
    return false;
  }

  const ARROW_TIP_X = 4;
  const ARROW_TIP_Y = 4;
  const TEXT_CENTER_X = 18 * TEXT_CURSOR_SCALE;
  const TEXT_CENTER_Y = 44 * TEXT_CURSOR_SCALE;

  function arrowTipAt(px, py) {
    return { x: px - ARROW_TIP_X, y: py - ARROW_TIP_Y };
  }
  function textCenterAt(px, py) {
    return { x: px - TEXT_CENTER_X, y: py - TEXT_CENTER_Y };
  }

  const DRAG_SCALE = 0.65;

  function computeOffscreenStartTip(restTipY, restTipX, textWidth) {
    const rootRect = root.getBoundingClientRect();
    const pad = 60;
    const s = currentScale || 1;
    const startTipX = (-pad - rootRect.left) / s - textWidth;
    return {
      x: startTipX,
      y: restTipY + 256,
    };
  }

  let generation = 0;
  function bumpGeneration() {
    generation++;
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    applyScale();
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(bumpGeneration, 120);
  });

  onLangChange(() => {
    applyStaticCopy();
    bumpGeneration();
  });

  async function runOnce() {
    const c = getHeadlineCopy();

    setCursor("arrow");
    cursorState.scale = 1;
    cursor.style.opacity = "0";
    cursor.classList.remove("headline__cursor--moving");
    setBottomText(c.initialBottom);
    bottomText.style.transform = "";
    bottomFade.style.opacity = "0";
    bottomFade.innerHTML = "";
    bottomFade.style.left = "";
    bottomFade.style.width = "";
    bottomFade.style.transform = "";
    bottomFade.style.justifyContent = "";
    clearCharSelection();
    clearCharSyntax();
    showSelection(false);
    showHighlight(false);
    showCaret(false);
    showLayersPanel(false);
    showLayerCaret(false);
    layersRow.classList.remove("headline__layers-row--editing");

    const startGen = generation;
    const resetIfStale = () => generation !== startGen;

    await new Promise((r) => requestAnimationFrame(r));

    const finalBottom = measureBottomBox();
    const restTipX = finalBottom.x + 8;
    const restTipY = finalBottom.y + finalBottom.h * 0.7;

    const startTip = computeOffscreenStartTip(restTipY, restTipX, finalBottom.w);
    const startTipX = startTip.x;
    const startTipY = startTip.y;

    cursorState.scale = DRAG_SCALE;
    {
      const p = arrowTipAt(startTipX, startTipY);
      cursorState.x = p.x;
      cursorState.y = p.y;
      applyCursor();
    }
    cursor.style.opacity = "1";
    cursor.classList.add("headline__cursor--moving");

    function syncBottomTextToTip() {
      const tipX = cursorState.x + ARROW_TIP_X;
      const tipY = cursorState.y + ARROW_TIP_Y;
      const dx = tipX - restTipX;
      const dy = tipY - restTipY;
      bottomText.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }
    syncBottomTextToTip();

    {
      const target = arrowTipAt(restTipX, restTipY);
      const duration = 900;
      void cursor.offsetWidth;
      cursor.style.transition = `transform ${duration}ms ${DRAG_EASE}`;
      bottomText.style.transition = `transform ${duration}ms ${DRAG_EASE}`;
      cursorState.x = target.x;
      cursorState.y = target.y;
      applyCursor();
      bottomText.style.transform = "translate3d(0, 0, 0)";
      await transitionEndOnce(cursor, "transform", duration + 80);
      cursor.style.transition = "";
      bottomText.style.transition = "";
    }

    bottomText.style.transform = "";
    await scaleCursor(1, 160);
    cursor.classList.remove("headline__cursor--moving");

    applySelectionToBottomText();
    const selectionChrome = [selection, anchorTL, anchorTR, anchorBL, anchorBR, sizeLabel];
    for (const node of selectionChrome) node.style.transition = "none";
    showSelection(true);
    void selection.offsetWidth;
    requestAnimationFrame(() => {
      for (const node of selectionChrome) node.style.transition = "";
    });

    await wait(1200);
    if (resetIfStale()) return;

    showSelection(false);
    await wait(260);

    const pointerX = cursorState.x + ARROW_TIP_X;
    const pointerY = cursorState.y + ARROW_TIP_Y;

    setCursor("text");

    {
      const p = textCenterAt(pointerX, pointerY);
      cursorState.x = p.x;
      cursorState.y = p.y;
      cursorState.scale = 1;
      applyCursor();
    }

    const b1 = measureBottomBox();
    const textY = b1.y + b1.h / 2;
    const selectAnchorX = b1.x + 2;
    {
      const p = textCenterAt(selectAnchorX, textY);
      await moveCursorTo(p.x, p.y, 480);
    }

    await scaleCursor(0.85, 80);
    await scaleCursor(1, 100);

    applyTextHighlight(selectAnchorX, selectAnchorX);
    showHighlight(true);

    const textRightX = b1.x + b1.w - 2;
    const cursorTrail = 96;
    let caretShown = false;
    await new Promise((resolve) => {
      const targetTipX = textRightX + cursorTrail;
      const targetX = textCenterAt(targetTipX, textY).x;
      const sx = cursorState.x;
      const duration = 1100;
      const fadeMs = 150;
      const fadeStart = duration - fadeMs;
      const start = performance.now();
      function frame(now) {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / duration);
        const e = easeInOutCubic(t);
        cursorState.x = lerp(sx, targetX, e);
        applyCursor();

        const tipX = cursorState.x + TEXT_CENTER_X;
        const cappedTipX = Math.min(tipX, textRightX);
        applyTextHighlight(selectAnchorX, cappedTipX);
        applyCharSelectionUpTo(cappedTipX, selectAnchorX);

        if (!caretShown && tipX >= textRightX) {
          showCaret(true);
          caretShown = true;
        }

        if (elapsed >= fadeStart) {
          const ft = Math.min(1, (elapsed - fadeStart) / fadeMs);
          cursor.style.opacity = String(1 - easeOutCubic(ft));
        }

        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });

    if (!caretShown) showCaret(true);
    await wait(420);

    showHighlight(false);
    clearCharSelection();
    await typeText(c.typedBottom, 70);
    applyTypedSyntax(c.typedBottom, applySyntaxColorsByIndex);
    await wait(1400);
    if (resetIfStale()) return;

    showCaret(false);
    await wait(450);

    if (await playLayersRename(c.typedBottom, c.scrambleBottom, startGen)) return;
    await wait(1400);
    if (resetIfStale()) return;

    const liveRect = bottomText.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const s = currentScale || 1;
    const fadeLeftPx = (liveRect.left - rootRect.left) / s;
    const fadeWidthPx = liveRect.width / s;

    bottomFade.innerHTML = "";
    const fadeText = bottomText.cloneNode(true);
    bottomFade.appendChild(fadeText);
    bottomFade.style.left = `${fadeLeftPx}px`;
    bottomFade.style.width = `${fadeWidthPx}px`;
    bottomFade.style.transform = "none";
    bottomFade.style.justifyContent = "flex-start";
    bottomFade.style.opacity = "1";

    const fadeMs = 600;
    const fadeStart = performance.now();
    const fadeGen = startGen;
    function fadeFrame(now) {
      if (generation !== fadeGen) return;
      const t = Math.min(1, (now - fadeStart) / fadeMs);
      bottomFade.style.opacity = String(1 - easeOutCubic(t));
      if (t < 1) requestAnimationFrame(fadeFrame);
      else bottomFade.style.opacity = "0";
    }
    requestAnimationFrame(fadeFrame);

    await wait(200);
  }

  let headlineVisible = true;
  let visibilityWaiters = [];
  new IntersectionObserver(
    (entries) => {
      for (const entry of entries) headlineVisible = entry.isIntersecting;
      if (headlineVisible && visibilityWaiters.length) {
        const waiters = visibilityWaiters;
        visibilityWaiters = [];
        for (const resolve of waiters) resolve();
      }
    },
    { threshold: 0 }
  ).observe(frame);

  function whenVisible() {
    return headlineVisible
      ? Promise.resolve()
      : new Promise((resolve) => visibilityWaiters.push(resolve));
  }

  async function loop() {
    while (true) {
      await whenVisible();
      await runOnce();
    }
  }

  function waitForFonts() {
    return document.fonts && document.fonts.ready
      ? document.fonts.ready
      : Promise.resolve();
  }
  waitForFonts().then(() => loop());

  return { root };
}
