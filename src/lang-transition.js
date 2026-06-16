import "./lang-transition.css";
import {
  applyLangToSubtree,
  getHeadlineCopyForLang,
  getNextLang,
} from "./i18n.js";
import { getAboutContent } from "./about-content.js";

const DURATION_MS = 1500;
const REVEAL_LAG_PX = 160;
const REVEAL_FEATHER_PX = 56;
const WARP_SCALE_MAX = 22;
const WARP_PEAK = 0.38;

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_origin;
uniform float u_progress;
uniform float u_time;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2 res = u_resolution;
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / res;
  vec2 origin = u_origin / res;
  vec2 diff = uv - origin;
  diff.x *= res.x / max(res.y, 1.0);
  float dist = length(diff);
  float maxDist = length(vec2(res.x / max(res.y, 1.0), 1.0));

  float waveFront = u_progress * maxDist * 1.35;
  float band = 0.06 + 0.02 * sin(u_time * 8.0 + dist * 20.0);
  float ring = abs(dist - waveFront);
  float liquid = smoothstep(band, 0.0, ring);

  float wake = smoothstep(waveFront, waveFront - 0.24, dist);
  wake *= 1.0 - smoothstep(waveFront - 0.24, waveFront - 0.46, dist);

  float ripple = sin((dist - waveFront) * 58.0 - u_time * 4.5) * 0.5 + 0.5;
  ripple *= smoothstep(waveFront + 0.1, waveFront - 0.06, dist);
  ripple *= smoothstep(waveFront - 0.32, waveFront - 0.1, dist);

  float n = noise(diff * 16.0 + vec2(u_time * 0.7, -u_time * 0.4));
  float intensity = clamp(liquid * 0.8 + wake * 0.24 + ripple * 0.2, 0.0, 1.0);

  vec3 aqua = vec3(0.2, 0.73, 1.0);
  vec3 foam = vec3(0.77, 0.89, 0.94);
  vec3 deep = vec3(0.09, 0.11, 0.14);
  vec3 col = mix(deep, mix(aqua, foam, n), 0.55 + n * 0.35);

  outColor = vec4(col, intensity * 0.78);
}`;

let busy = false;
/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {WebGL2RenderingContext | null} */
let gl = null;
/** @type {WebGLProgram | null} */
let program = null;
/** @type {WebGLBuffer | null} */
let quad = null;
/** @type {Record<string, WebGLUniformLocation | null> | null} */
let uniforms = null;
/** @type {SVGElement | null} */
let displaceMap = null;
/** @type {SVGElement | null} */
let displaceNoise = null;

/** @typedef {{ x: number; y: number }} Point */

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function ensureSvgFilter() {
  if (displaceMap) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "lang-liquid-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `
    <defs>
      <filter id="lang-liquid-displace" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence id="lang-liquid-noise" type="fractalNoise" baseFrequency="0.018 0.055" numOctaves="3" seed="4" result="noise" />
        <feDisplacementMap id="lang-liquid-map" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
  displaceMap = svg.querySelector("#lang-liquid-map");
  displaceNoise = svg.querySelector("#lang-liquid-noise");
}

function compileShader(type, source) {
  if (!gl) return null;
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function ensureGl() {
  if (gl && program) return true;
  canvas = document.createElement("canvas");
  canvas.className = "lang-liquid-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
  if (!gl) return false;

  const vs = compileShader(gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return false;

  program = gl.createProgram();
  if (!program) return false;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;

  quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  uniforms = {
    u_resolution: gl.getUniformLocation(program, "u_resolution"),
    u_origin: gl.getUniformLocation(program, "u_origin"),
    u_progress: gl.getUniformLocation(program, "u_progress"),
    u_time: gl.getUniformLocation(program, "u_time"),
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

function resizeCanvas() {
  if (!canvas || !gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
}

/** @param {number} progress @param {number} time @param {Point} origin */
function drawLiquid(progress, time, origin) {
  if (!gl || !program || !canvas || !uniforms) return;
  resizeCanvas();
  const dpr = canvas.width / window.innerWidth;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
  gl.uniform2f(uniforms.u_origin, origin.x * dpr, origin.y * dpr);
  gl.uniform1f(uniforms.u_progress, progress);
  gl.uniform1f(uniforms.u_time, time);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/** @param {number} progress @param {HTMLElement | null} target */
function setPageWarp(progress, target) {
  if (!displaceMap || !target) return;

  const edge = 1 - Math.abs(progress - WARP_PEAK) / WARP_PEAK;
  const scale = Math.max(0, edge) * WARP_SCALE_MAX;
  displaceMap.setAttribute("scale", String(scale.toFixed(2)));
  if (displaceNoise) {
    const freq = 0.014 + Math.max(0, edge) * 0.014;
    displaceNoise.setAttribute("baseFrequency", `${freq.toFixed(4)} ${(freq * 2.8).toFixed(4)}`);
  }

  target.classList.add("lang-liquid-warp");
  target.style.filter = "url(#lang-liquid-displace)";
}

/** @param {HTMLElement | null} target */
function clearPageWarp(target) {
  if (target) {
    target.classList.remove("lang-liquid-warp");
    target.style.filter = "";
  }
  if (displaceMap) displaceMap.setAttribute("scale", "0");
}

/** @param {HTMLElement} el @param {Point} origin @param {number} revealRadius */
function setOldMask(el, origin, revealRadius) {
  if (revealRadius <= 0) {
    el.style.maskImage = "";
    el.style.webkitMaskImage = "";
    return;
  }
  const gradient = `radial-gradient(circle at ${origin.x}px ${origin.y}px, transparent ${revealRadius}px, #000 ${revealRadius + 1}px)`;
  el.style.maskImage = gradient;
  el.style.webkitMaskImage = gradient;
}

/** @param {HTMLElement} reveal @param {Point} origin @param {number} revealRadius */
function setRevealMask(reveal, origin, revealRadius) {
  if (revealRadius <= 0) {
    reveal.style.clipPath = `circle(0px at ${origin.x}px ${origin.y}px)`;
    reveal.style.maskImage = "";
    reveal.style.webkitMaskImage = "";
    reveal.style.opacity = "0";
    return;
  }

  const fadeStart = Math.max(0, revealRadius - REVEAL_FEATHER_PX);
  const gradient = `radial-gradient(circle at ${origin.x}px ${origin.y}px, #000 ${fadeStart}px, transparent ${revealRadius}px)`;
  reveal.style.maskImage = gradient;
  reveal.style.webkitMaskImage = gradient;
  reveal.style.clipPath = `circle(${revealRadius + 2}px at ${origin.x}px ${origin.y}px)`;
  reveal.style.opacity = "1";
}

/** @param {HTMLElement} el */
function clearMask(el) {
  el.style.maskImage = "";
  el.style.webkitMaskImage = "";
  el.style.clipPath = "";
  el.style.opacity = "";
}

/** @param {HTMLElement} originEl */
function getOriginViewport(originEl) {
  const rect = originEl.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/** @param {Point} origin */
function getOriginGl(origin) {
  return {
    x: origin.x,
    y: window.innerHeight - origin.y,
  };
}

/** @param {Point} origin */
function maxRevealRadius(origin) {
  const { innerWidth: w, innerHeight: h } = window;
  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ];
  return Math.max(...corners.map(([x, y]) => Math.hypot(x - origin.x, y - origin.y))) + 48;
}


/** @param {HTMLElement} track */
function syncRevealScroll(track) {
  const scroller = document.scrollingElement || document.documentElement;
  track.style.transform = `translate3d(0, ${-scroller.scrollTop}px, 0)`;
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
function patchHeadlineInClone(root, lang) {
  const c = getHeadlineCopyForLang(lang);
  const old = getHeadlineCopyForLang(lang === "en" ? "de" : "en");
  const frame = root.querySelector(".headline__frame");
  if (frame) frame.setAttribute("aria-label", c.aria);

  const metaTop = root.querySelector(".headline__meta--top");
  const top = root.querySelector(".headline__line--top");
  const metaBottom = root.querySelector(".headline__meta--bottom");
  const layersHeader = root.querySelector(".headline__layers-header");
  const bottomText = root.querySelector(".headline__bottom-text");
  const layersName = root.querySelector(".headline__layers-name");

  if (metaTop) metaTop.textContent = c.metaTop;
  if (top) top.textContent = c.top;
  if (metaBottom) metaBottom.textContent = c.metaBottom;
  if (layersHeader) layersHeader.textContent = c.layersTitle;

  if (bottomText) {
    const current = bottomText.textContent?.trim() ?? "";
    let nextBottom = c.initialBottom;
    if (current === old.typedBottom || current.includes("(")) {
      nextBottom = c.typedBottom;
    } else if (current === old.scrambleBottom) {
      nextBottom = c.scrambleBottom;
    }
    bottomText.textContent = nextBottom;
  }

  if (layersName) layersName.textContent = c.scrambleBottom;
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
function patchAboutInClone(root, lang) {
  const content = getAboutContent(lang);

  const greeting = root.querySelector("[data-about='greeting']");
  const meta = root.querySelector("[data-about='meta']");
  const introP1 = root.querySelector("[data-about='intro-p1']");
  const introP2 = root.querySelector("[data-about='intro-p2']");
  const imgLabel = root.querySelector("[data-about='img-label']");
  const imgMeta = root.querySelector("[data-about='img-meta']");
  const img = root.querySelector("[data-about='img']");

  if (greeting) greeting.textContent = content.greeting;
  if (meta) meta.textContent = content.meta;
  if (introP1) introP1.textContent = content.introP1;
  if (introP2) introP2.textContent = content.introP2;
  if (imgLabel) imgLabel.textContent = content.imgLabel;
  if (imgMeta) imgMeta.textContent = content.imgMeta;
  if (img) img.setAttribute("alt", content.imgAlt);

  const title = root.querySelector(".about-timeline__title");
  const mode = root.querySelector(".about-timeline__mode");
  const hint = root.querySelector(".about-timeline__hint");
  if (title) title.textContent = content.timelineTitle;
  if (mode) mode.textContent = `[${content.timelineMode}]`;
  if (hint) hint.textContent = content.timelineHint;

  const activeButton =
    root.querySelector(".about-timeline__node--active .about-timeline__button") ??
    root.querySelector(".about-timeline__button");
  const activeId = activeButton?.dataset.nodeId ?? content.nodes[0]?.id ?? "01";
  const activeNode = content.nodes.find((node) => node.id === activeId) ?? content.nodes[0];

  root.querySelectorAll(".about-timeline__button").forEach((button) => {
    const node = content.nodes.find((entry) => entry.id === button.dataset.nodeId);
    if (!node) return;
    const period = button.querySelector(".about-timeline__node-period");
    const nodeTitle = button.querySelector(".about-timeline__node-title");
    const summary = button.querySelector(".about-timeline__node-summary");
    if (period) period.textContent = node.period;
    if (nodeTitle) nodeTitle.textContent = node.title;
    if (summary) summary.textContent = node.summary;
    button.setAttribute("aria-label", `${node.period}: ${node.title}`);
  });

  if (activeNode) {
    const detail = root.querySelector(".about-timeline__detail");
    if (detail) {
      const detailMeta = detail.querySelector(".about-timeline__detail-meta");
      const period = detail.querySelector(".about-timeline__detail-period");
      const detailTitle = detail.querySelector(".about-timeline__detail-title");
      const subtitle = detail.querySelector(".about-timeline__detail-subtitle");
      const bullets = detail.querySelector(".about-timeline__bullets");
      const tags = detail.querySelector(".about-timeline__tags");

      if (detailMeta) detailMeta.textContent = `${content.selectedPrefix} ${activeNode.id}`;
      if (period) period.textContent = activeNode.period;
      if (detailTitle) detailTitle.textContent = activeNode.title;
      if (subtitle) subtitle.textContent = activeNode.subtitle;

      if (bullets) {
        bullets.innerHTML = "";
        for (const point of activeNode.bullets) {
          const li = document.createElement("li");
          li.textContent = point;
          bullets.appendChild(li);
        }
      }

      if (tags) {
        tags.innerHTML = "";
        for (const tag of activeNode.tags) {
          const span = document.createElement("span");
          span.className = "about-timeline__tag";
          span.textContent = tag;
          tags.appendChild(span);
        }
      }
    }
  }

  const currentlyTitle = root.querySelector(".about-currently__title");
  const currentlyList = root.querySelector(".about-currently__list");
  if (currentlyTitle) currentlyTitle.textContent = content.currentlyTitle;
  if (currentlyList) {
    currentlyList.innerHTML = "";
    for (const item of content.currentlyItems) {
      const li = document.createElement("li");
      li.className = "about-currently__item";
      li.textContent = item;
      currentlyList.appendChild(li);
    }
  }
}

/** @param {HTMLElement} screens @param {"en" | "de"} lang */
function createRevealLayer(screens, lang) {
  const reveal = document.createElement("div");
  reveal.className = "lang-liquid-reveal";
  reveal.setAttribute("aria-hidden", "true");

  const track = document.createElement("div");
  track.className = "lang-liquid-reveal__track";

  const clone = screens.cloneNode(true);
  if (clone instanceof HTMLElement) {
    clone.removeAttribute("id");
    clone.removeAttribute("tabindex");
    clone.classList.add("lang-liquid-clone");
    applyLangToSubtree(clone, lang);
    patchHeadlineInClone(clone, lang);
    patchAboutInClone(clone, lang);
    track.appendChild(clone);
  }

  reveal.appendChild(track);
  document.body.appendChild(reveal);

  return { reveal, track, clone };
}

/** @param {() => void} apply @param {HTMLElement | null | undefined} originEl */
export function playLangTransition(apply, originEl) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || busy) {
    if (!busy) apply();
    return Promise.resolve();
  }

  const screens = document.getElementById("screens");
  if (!screens || !originEl) {
    apply();
    return Promise.resolve();
  }

  busy = true;
  ensureSvgFilter();
  const hasGl = ensureGl();
  const origin = getOriginViewport(originEl);
  const glOrigin = getOriginGl(origin);
  const maxRadius = maxRevealRadius(origin);
  const nextLang = getNextLang();
  const { reveal, track } = createRevealLayer(screens, nextLang);

  return new Promise((resolve) => {
    const start = performance.now();

    const frame = (now) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = easeOutCubic(t);
      const timeSec = (now - start) / 1000;
      const waveRadius = eased * maxRadius;
      const revealRadius = Math.max(0, waveRadius - REVEAL_LAG_PX);
      const waveProgress = waveRadius / maxRadius;

      setOldMask(screens, origin, revealRadius);
      setRevealMask(reveal, origin, revealRadius);
      syncRevealScroll(track);
      setPageWarp(t, screens);
      if (hasGl) drawLiquid(waveProgress, timeSec, glOrigin);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        apply();
        reveal.remove();
        clearPageWarp(screens);
        clearMask(screens);
        if (canvas) canvas.style.display = "none";
        busy = false;
        resolve();
      }
    };

    setRevealMask(reveal, origin, 0);
    syncRevealScroll(track);
    if (canvas) canvas.style.display = "block";
    requestAnimationFrame(frame);
  });
}
