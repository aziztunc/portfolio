import "./lang-transition.css";
import { applyLangToSubtree, getNextLang } from "./i18n.js";
import {
  patchAboutCurrently,
  patchAboutIntro,
  patchAboutTimeline,
  patchHeadlineInRoot,
} from "./lang-patch.js";

const DURATION_MS = 2800;
const WARP_BAND_PX = 48;
const WARP_SCALE_MAX = 20;

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

/** @typedef {{ x: number; y: number }} Point */
/** @typedef {{ node: HTMLElement; patch: (lang: "en" | "de") => void }} SwapUnit */

/** @type {Set<HTMLElement>} */
const warpedElements = new Set();
/** @type {Set<HTMLElement>} */
const swappedUnits = new Set();

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
        <feTurbulence id="lang-liquid-noise" type="fractalNoise" baseFrequency="0.014 0.042" numOctaves="3" seed="4" result="noise" />
        <feDisplacementMap id="lang-liquid-map" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
  displaceMap = svg.querySelector("#lang-liquid-map");
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

function elementCenter(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function distanceFromOrigin(el, origin) {
  const center = elementCenter(el);
  return Math.hypot(center.x - origin.x, center.y - origin.y);
}

function cleanupTransitionArtifacts() {
  document.querySelectorAll(".lang-liquid-reveal").forEach((node) => node.remove());
  clearBandWarp();
  swappedUnits.clear();

  const screens = document.getElementById("screens");
  if (screens) {
    screens.classList.remove("lang-liquid-masked");
    screens.style.maskImage = "";
    screens.style.webkitMaskImage = "";
    screens.style.filter = "";
  }
}

/** @param {HTMLElement} screens @returns {SwapUnit[]} */
function buildSwapUnits(screens) {
  const about = screens.querySelector("[data-about-root]");
  /** @type {SwapUnit[]} */
  const units = [];

  const headline = screens.querySelector("#headline-host");
  if (headline instanceof HTMLElement) {
    units.push({
      node: headline,
      patch: (lang) => patchHeadlineInRoot(headline, lang),
    });
  }

  const work = screens.querySelector("#work");
  if (work instanceof HTMLElement) {
    units.push({
      node: work,
      patch: (lang) => applyLangToSubtree(work, lang),
    });
  }

  const skills = screens.querySelector("#skills");
  if (skills instanceof HTMLElement) {
    units.push({
      node: skills,
      patch: (lang) => applyLangToSubtree(skills, lang),
    });
  }

  if (about instanceof HTMLElement) {
    const intro = about.querySelector(".about-intro");
    if (intro instanceof HTMLElement) {
      units.push({
        node: intro,
        patch: (lang) => patchAboutIntro(about, lang),
      });
    }

    const timeline = about.querySelector(".about-timeline");
    if (timeline instanceof HTMLElement) {
      units.push({
        node: timeline,
        patch: (lang) => patchAboutTimeline(about, lang),
      });
    }

    const currently = about.querySelector(".about-currently");
    if (currently instanceof HTMLElement) {
      units.push({
        node: currently,
        patch: (lang) => patchAboutCurrently(about, lang),
      });
    }
  }

  return units;
}

/** @param {SwapUnit[]} units @param {Point} origin @param {number} swapRadius @param {"en" | "de"} lang */
function swapUnitsInWave(units, origin, swapRadius, lang) {
  for (const unit of units) {
    if (swappedUnits.has(unit.node)) continue;
    if (distanceFromOrigin(unit.node, origin) > swapRadius) continue;
    unit.patch(lang);
    swappedUnits.add(unit.node);
    unit.node.style.filter = "";
    unit.node.classList.remove("lang-liquid-warp");
    warpedElements.delete(unit.node);
  }
}

/** @param {SwapUnit[]} units @param {Point} origin @param {number} swapRadius @param {number} waveRadius */
function updateBandWarp(units, origin, swapRadius, waveRadius) {
  if (!displaceMap) return;

  const active = waveRadius > swapRadius + 4;
  displaceMap.setAttribute("scale", active ? String(WARP_SCALE_MAX) : "0");

  const next = new Set();
  if (!active) {
    clearBandWarp();
    return;
  }

  for (const unit of units) {
    if (swappedUnits.has(unit.node)) continue;
    const dist = distanceFromOrigin(unit.node, origin);
    if (dist >= swapRadius && dist <= waveRadius + 28) {
      unit.node.classList.add("lang-liquid-warp");
      unit.node.style.filter = "url(#lang-liquid-displace)";
      next.add(unit.node);
    }
  }

  for (const node of warpedElements) {
    if (!next.has(node)) {
      node.classList.remove("lang-liquid-warp");
      node.style.filter = "";
    }
  }

  warpedElements.clear();
  for (const node of next) warpedElements.add(node);
}

function clearBandWarp() {
  for (const node of warpedElements) {
    node.classList.remove("lang-liquid-warp");
    node.style.filter = "";
  }
  warpedElements.clear();
  if (displaceMap) displaceMap.setAttribute("scale", "0");
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
function maxWaveRadius(origin) {
  const { innerWidth: w, innerHeight: h } = window;
  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ];
  return Math.max(...corners.map(([x, y]) => Math.hypot(x - origin.x, y - origin.y))) + 48;
}

/** Remove any leftover overlay layers from a previous broken transition. */
export function cleanupStuckLangTransition() {
  cleanupTransitionArtifacts();
  busy = false;
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

  cleanupTransitionArtifacts();
  busy = true;
  ensureSvgFilter();
  const hasGl = ensureGl();
  const origin = getOriginViewport(originEl);
  const glOrigin = getOriginGl(origin);
  const maxRadius = maxWaveRadius(origin);
  const nextLang = getNextLang();
  const swapUnits = buildSwapUnits(screens);

  return new Promise((resolve) => {
    const start = performance.now();

    const frame = (now) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = easeOutCubic(t);
      const timeSec = (now - start) / 1000;
      const waveRadius = eased * maxRadius;
      const swapRadius = Math.max(0, waveRadius - WARP_BAND_PX);
      const waveProgress = waveRadius / maxRadius;

      swapUnitsInWave(swapUnits, origin, swapRadius, nextLang);
      updateBandWarp(swapUnits, origin, swapRadius, waveRadius);
      if (hasGl) drawLiquid(waveProgress, timeSec, glOrigin);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        for (const unit of swapUnits) {
          if (!swappedUnits.has(unit.node)) unit.patch(nextLang);
        }
        apply();
        clearBandWarp();
        swappedUnits.clear();
        if (canvas) canvas.style.display = "none";
        busy = false;
        resolve();
      }
    };

    if (canvas) canvas.style.display = "block";
    requestAnimationFrame(frame);
  });
}
