import "./lang-transition.css";

const DURATION_MS = 800;
const SWAP_AT = 0.48;

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
  float band = 0.07 + 0.025 * sin(u_time * 7.0 + dist * 18.0);
  float ring = abs(dist - waveFront);
  float liquid = smoothstep(band, 0.0, ring);

  float wake = smoothstep(waveFront, waveFront - 0.28, dist);
  wake *= 1.0 - smoothstep(waveFront - 0.28, waveFront - 0.5, dist);

  float ripple = sin((dist - waveFront) * 55.0 - u_time * 4.0) * 0.5 + 0.5;
  ripple *= smoothstep(waveFront + 0.12, waveFront - 0.08, dist);
  ripple *= smoothstep(waveFront - 0.35, waveFront - 0.12, dist);

  float n = noise(diff * 14.0 + vec2(u_time * 0.6, -u_time * 0.35));
  float intensity = clamp(liquid * 0.75 + wake * 0.22 + ripple * 0.18, 0.0, 1.0);

  vec3 aqua = vec3(0.2, 0.73, 1.0);
  vec3 foam = vec3(0.77, 0.89, 0.94);
  vec3 deep = vec3(0.09, 0.11, 0.14);
  vec3 col = mix(deep, mix(aqua, foam, n), 0.55 + n * 0.35);

  outColor = vec4(col, intensity * 0.72);
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

/** @param {number} progress @param {number} time @param {{ x: number; y: number }} origin */
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

/** @param {number} progress */
function setPageWarp(progress) {
  const screens = document.getElementById("screens");
  if (!screens || !displaceMap) return;

  const peak = 1 - Math.abs(progress - 0.5) * 2;
  const scale = peak * 42;
  displaceMap.setAttribute("scale", String(scale.toFixed(2)));
  if (displaceNoise) {
    const freq = 0.018 + peak * 0.02;
    displaceNoise.setAttribute("baseFrequency", `${freq.toFixed(4)} ${(freq * 3.1).toFixed(4)}`);
  }
  screens.classList.add("lang-liquid-warp");
  screens.style.filter = "url(#lang-liquid-displace)";
}

function clearPageWarp() {
  const screens = document.getElementById("screens");
  if (screens) {
    screens.classList.remove("lang-liquid-warp");
    screens.style.filter = "";
  }
  if (displaceMap) displaceMap.setAttribute("scale", "0");
}

/** @param {HTMLElement} originEl */
function getOrigin(originEl) {
  const rect = originEl.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: window.innerHeight - (rect.top + rect.height / 2),
  };
}

/** @param {() => void} apply @param {HTMLElement | null | undefined} originEl */
export function playLangTransition(apply, originEl) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || busy) {
    if (!busy) apply();
    return Promise.resolve();
  }

  busy = true;
  ensureSvgFilter();
  const hasGl = ensureGl();
  const origin = originEl
    ? getOrigin(originEl)
    : { x: window.innerWidth * 0.85, y: window.innerHeight * 0.92 };

  return new Promise((resolve) => {
    let swapped = false;
    const start = performance.now();

    const frame = (now) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const timeSec = (now - start) / 1000;

      if (!swapped && t >= SWAP_AT) {
        swapped = true;
        apply();
      }

      setPageWarp(t);
      if (hasGl) drawLiquid(t, timeSec, origin);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        clearPageWarp();
        if (canvas) canvas.style.display = "none";
        busy = false;
        resolve();
      }
    };

    if (canvas) canvas.style.display = "block";
    requestAnimationFrame(frame);
  });
}
