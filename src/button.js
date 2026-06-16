// Glass button with refractive chromatic-aberration hover halo.
// Render path: a single full-quad fragment shader sampled per pixel.

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

in vec2 v_uv;
out vec4 outColor;

uniform vec2  u_size;        // pixel size of canvas (after DPR)
uniform vec2  u_buttonSize;  // pixel size of the button rect (after DPR), inside the canvas bleed
uniform float u_dpr;         // device pixel ratio
uniform vec2  u_pointer;     // pointer in pixel space (canvas-centered); (-9999) = none
uniform float u_hover;       // 0..1
uniform float u_press;       // 0..1
uniform float u_time;
uniform vec2  u_clickPos;    // last click position in pixel space (canvas-centered)
uniform float u_clickAge;    // seconds since last click; <0 = no active click
uniform float u_clickEnv;    // 0..1 specular brightness envelope (decaying)
uniform float u_clickReach;  // pixel distance the ripple needs to travel to clear the pill
uniform float u_variant;     // 0 = glass (dark fill), 1 = solid (near-white fill, no specular)

// Signed distance to a rounded rectangle. Positive = outside.
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Smooth 1px-ish anti-aliased step around an SDF iso-line.
float aaLine(float d, float halfWidth, float feather) {
  return smoothstep(halfWidth + feather, halfWidth - feather, abs(d));
}

// Heat-treated steel ramp. t=0 is the stroke iso-line (white-hot); t=1 is
// the outermost cool band. Stops chosen to read like quenched steel: a tight
// hot core, then a warm yellow/orange band, cooling through red/violet to
// deep blue. Sampled by distance from the stroke, not by angle.
vec3 heat(float t) {
  t = clamp(t, 0.0, 1.0);
  // Brighter stops than literal heat-treated steel — the cool end has to
  // hold its own next to the white-hot core, otherwise it disappears under
  // the warm bands. Pink-leaning violet and a brighter cyan-blue keep the
  // far bands visible against the page bg.
  vec3 c0 = vec3(1.00, 1.00, 1.00); // hot white at the stroke
  vec3 c1 = vec3(1.00, 0.95, 0.65); // pale yellow
  vec3 c2 = vec3(1.00, 0.62, 0.20); // orange
  vec3 c3 = vec3(1.00, 0.32, 0.34); // red
  vec3 c4 = vec3(0.90, 0.42, 0.85); // pink/violet
  vec3 c5 = vec3(0.45, 0.60, 1.00); // bright cool blue
  if      (t < 0.10) return mix(c0, c1, smoothstep(0.00, 0.10, t));
  else if (t < 0.28) return mix(c1, c2, smoothstep(0.10, 0.28, t));
  else if (t < 0.50) return mix(c2, c3, smoothstep(0.28, 0.50, t));
  else if (t < 0.75) return mix(c3, c4, smoothstep(0.50, 0.75, t));
  else               return mix(c4, c5, smoothstep(0.75, 1.00, t));
}

// Hash + value noise + fbm for ethereal break-up.
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Per-band displacement noise. Each rim band samples the same noise field
// twice (low + mid octave at the same scales as the old shared-noise pass)
// but at a unique positional seed and with a small time-velocity jitter, so
// every color's wobble is uncorrelated in both shape and cadence. cfg is
// packed as (seedX, seedY, timeJitter) — seed shifts the sample into a
// different region of the noise field; tj nudges the time multipliers a few
// percent off baseline so the band doesn't animate in lockstep with its
// neighbours. Returns a signed value roughly in [-0.6, 0.6]; the caller
// multiplies by warpAmp to convert into pixels of rim displacement.
float bandWarp(vec2 noisePx, vec2 cursorOff, float time, vec3 cfg) {
  vec2 seed = cfg.xy;
  float tj = cfg.z;
  float a = vnoise(noisePx * 0.30 + cursorOff * 0.5 + seed
                   + vec2(time * (1.20 + tj), time * (0.45 + tj * 0.6)));
  float b = vnoise(noisePx * 0.70 - cursorOff * 0.4 + seed * 1.7 + 11.0
                   + vec2(time * (-0.60 - tj * 0.8), time * (1.00 + tj * 0.5)));
  return (a - 0.5) * 0.70 + (b - 0.5) * 0.45;
}

// Slow per-band radial drift. A low-frequency, TIME-ONLY noise sample (no
// spatial coord — the value is uniform across the rim, so the entire band
// slides inward/outward together rather than snaking). Decoupled from
// bandWarp: warp gives each band its wobbly snake shape; drift makes the
// band's resting position slowly wander over time. Together: same band, two
// independent motion components, so the radial composition is never quite
// the same twice. Reuses the band's warp cfg but offsets the seed so drift
// is uncorrelated with the snake motion. Returns -1..+1; caller multiplies
// by a per-band drift amplitude (smaller for outward bands, which have less
// radial room before they hit the outsideFalloff and disappear).
float bandDrift(float time, vec3 cfg) {
  vec2 seed = cfg.xy + vec2(13.7, -7.4);
  float tj = cfg.z;
  float n = vnoise(seed + vec2(time * (0.22 + tj * 0.6), time * (0.15 - tj * 0.4)));
  return (n - 0.5) * 2.0;
}

// Project point p onto the rounded-rect edge to find the closest edge point.
// Returns the closest edge point in the same coordinate space.
vec2 closestOnRoundRect(vec2 p, vec2 b, float r) {
  // Closest point on inset rect (the corner-circle centers form this rect).
  vec2 inset = b - vec2(r);
  vec2 q = clamp(p, -inset, inset);
  vec2 dir = p - q;
  float len = length(dir);
  if (len < 1e-5) {
    // Inside the inset rect; choose nearest cardinal edge.
    vec2 ad = inset - abs(p);
    if (ad.x < ad.y) {
      return vec2(sign(p.x) * b.x, p.y);
    } else {
      return vec2(p.x, sign(p.y) * b.y);
    }
  }
  return q + dir * (r / len);
}

// Outward unit normal of the rounded rect at point p (gradient of the SDF via
// central differences). Used to orient the exterior glow's chromatic split
// along the rim tangent at the cursor's anchor point.
vec2 rrNormal(vec2 p, vec2 b, float r) {
  vec2 e = vec2(0.75, 0.0);
  float dx = sdRoundRect(p + e.xy, b, r) - sdRoundRect(p - e.xy, b, r);
  float dy = sdRoundRect(p + e.yx, b, r) - sdRoundRect(p - e.yx, b, r);
  vec2 g = vec2(dx, dy);
  float l = length(g);
  return l > 1e-5 ? g / l : vec2(0.0, 1.0);
}

void main() {
  vec2 px = (v_uv - 0.5) * u_size;     // pixel coords, origin = canvas center
  vec2 halfSize = u_buttonSize * 0.5;  // SDF is sized to the button, not the canvas (canvas has bleed)

  // ---- Click press distortion.
  // Radial UV displacement around the click point, mimicking a finger
  // pressing into a flexible screen: surface dimples inward, rebounds out
  // past resting, then settles. The displacement is applied to px before
  // any other computation so the SDF, specular highlights, and refraction
  // gradient all warp together — the whole button geometry visibly bends.
  if (u_clickAge >= 0.0) {
    vec2 toPx = px - u_clickPos;
    float pressDist = length(toPx);
    // Localized falloff — pixels near the click point move most, falling
    // off toward the far side of the pill so the distortion reads as a
    // broad dimple rather than a pinpoint poke.
    float pressReach = max(u_clickReach * 0.85, 90.0);
    float pressMask = exp(-pow(pressDist / pressReach, 2.0));
    // Amplitude curve in time: negative early (inward press), positive in
    // the middle (rebound outward past resting), settling to zero. Scaled
    // by clickEnv so it dies with the rest of the click animation.
    //   t=0.00 -> 0
    //   t~0.08 -> -1   (deepest inward press)
    //   t~0.22 -> +0.5 (rebound outward)
    //   t~0.40 -> 0    (settled)
    float ageS = u_clickAge;
    float pressIn  = -1.0 * exp(-pow((ageS - 0.08) / 0.07, 2.0));
    float pressOut =  0.5 * exp(-pow((ageS - 0.22) / 0.10, 2.0));
    float pressAmp = pressIn + pressOut;
    // Peak displacement in pixels — keep modest so the text/highlights
    // bend perceptibly without breaking the silhouette.
    float pressMag = 8.0 * u_dpr * pressAmp * pressMask;
    vec2 dir = pressDist > 0.5 ? toPx / pressDist : vec2(0.0);
    px += dir * pressMag;
  }

  float radius = min(halfSize.x, halfSize.y);  // pill: corner radius == half-height
  float d = sdRoundRect(px, halfSize, radius);

  // ---- Background contribution: keep button transparent outside the pill.
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // ---- Body fill. Two variants:
  //   glass (u_variant = 0): very subtle dark fill so the specular highlights
  //     and bevel rim read brighter against it.
  //   solid (u_variant = 1): mostly-opaque off-white that backs the dark
  //     label, but with a soft inset taper near the rim so the chromatic
  //     halo composites against the page (not white) and the bevel/stroke
  //     highlights pop against a slightly less blown-out surface.
  float inside = smoothstep(0.5, -0.5, d);   // 1 inside, 0 outside, 1px AA
  float isSolid = step(0.5, u_variant);
  // Distance from inside edge (positive value, growing inward). Hoisted up
  // from below so the body fill can use it for the solid-variant rim taper.
  float inner = max(-d, 0.0);
  // Solid variant: hold near-full opacity through the body, taper down across
  // a band ~halfSize.y * 0.18 from the rim. The rim band is what the halo
  // paints into, so dropping body alpha there lets the prismatic colors show
  // against the dark page rather than washing out against white.
  float rimTaper = smoothstep(0.0, max(halfSize.y * 0.18, 4.0), inner);
  float solidAlpha = mix(0.55, 0.92, rimTaper);
  // Glass tint vs. solid tint, alpha picked per variant. At rest the solid
  // sits near pure white; as hover ramps in it falls to the cooler off-white
  // so the bevel ring + outer stroke read as bright accents on contact. The
  // smoothstep front-loads the fade so it lands well before u_hover hits 1.
  float solidHoverFade = smoothstep(0.0, 0.35, u_hover);
  vec3 solidTint = mix(vec3(0.985, 0.985, 0.99), vec3(0.792, 0.792, 0.808), solidHoverFade);
  vec3 bodyTint = mix(vec3(0.03, 0.03, 0.04), solidTint, isSolid);
  float bodyAlpha = inside * mix(0.28, solidAlpha, isSolid);
  col += bodyTint * bodyAlpha;
  alpha += bodyAlpha;

  // ---- Inner glow, biased toward the top edge (subtle ambient lift).
  // Glass-only — on the white solid variant this would just dirty the fill.
  float glowFalloff = exp(-inner / (u_size.y * 0.42));
  float topBias = smoothstep(-halfSize.y * 0.2, halfSize.y * 0.9, px.y);
  float glow = glowFalloff * mix(0.25, 0.9, topBias) * inside * (1.0 - isSolid);
  col += vec3(0.82, 0.86, 0.95) * glow * 0.14;
  alpha += glow * 0.14;

  // ---- Outer hairline stroke (always-on outline).
  float strokeHalf = max(0.6, 0.5 * u_dpr);
  float stroke = aaLine(d, strokeHalf, max(0.5, 0.5 * u_dpr));
  col += vec3(0.55, 0.58, 0.66) * stroke * 0.55;
  alpha += stroke * 0.55;

  // ---- Liquid-glass specular system.
  // Three coordinated lights make the pill read as a polished glass capsule:
  //   (a) Top specular arc — the bright crescent along the upper rim.
  //   (b) Bottom rim light — dimmer counterpart along the lower rim,
  //       reading as light passing through the glass thickness from below.
  //   (c) Inner bevel ring — a thin highlight a couple px inside the edge,
  //       running the full perimeter to sell glass thickness/refraction.
  //
  // Direction along the rim is encoded by py = px.y / halfSize.y, so
  // py = +1 at the top, -1 at the bottom. We then build smooth arc masks
  // that peak at the top/bottom centerlines and fall off toward the
  // corners, giving the highlights their characteristic crescent shape.
  float py = clamp(px.y / max(halfSize.y, 1.0), -1.0, 1.0);

  // (a0) Top specular glow — soft sheen that lives ENTIRELY INSIDE the pill,
  // hugging the upper rim and tracing the pill's rounded shape. The glow
  // strength is driven by 'inner' (distance from the inside edge), so it
  // naturally follows the curve of the rounded ends instead of being a
  // straight horizontal band. Masked to the upper half so it only kisses
  // the top of the glass.
  float topGlowFall = u_size.y * 0.16;          // inward falloff distance
  float topGlow = exp(-inner / topGlowFall) * inside;
  // Crescent mask along the upper arc: peaks near the top, fades to zero
  // before the equator so the glow can't spill into the lower half.
  float topGlowMask = smoothstep(0.05, 0.55, py) * pow(max(py, 0.0), 0.6);
  topGlow *= topGlowMask;
  // Solid variant: zero out the specular topGlow contribution. We keep the
  // local 'topGlow' value defined (the click-flash block reuses the mask) but
  // multiply additive contributions by (1 - isSolid) so the white surface
  // stays clean.
  float specGate = 1.0 - isSolid;
  col += vec3(0.95, 0.97, 1.0) * topGlow * 0.14 * specGate;
  alpha += topGlow * 0.14 * specGate;

  // (a) Top specular arc.
  // A thin AA band centered just outside the rim (negative offset pulls it
  // slightly inward so it sits on the glass surface, not floating above).
  float specInset = max(0.6, 0.6 * u_dpr);
  float specHalf  = max(0.9, 0.8 * u_dpr);
  float specFeather = max(0.7, 0.7 * u_dpr);
  float topArc = aaLine(d + specInset, specHalf, specFeather);
  // Crescent mask: peaks at py = +1, fades toward py = 0. Pow shapes the
  // falloff so the highlight is concentrated near the top center.
  float topMask = pow(max(py, 0.0), 1.4);
  // Soften the very tips at the corners to avoid hard cutoffs.
  float cornerSoft = smoothstep(0.0, 0.25, max(py, 0.0));
  float topSpec = topArc * topMask * cornerSoft;
  col += vec3(1.0, 1.0, 1.0) * topSpec * 0.95 * specGate;
  alpha += topSpec * 0.95 * specGate;

  // (b) Bottom rim light — same band, mirrored, dimmer and slightly cooler.
  float botMask = pow(max(-py, 0.0), 1.6);
  float botCornerSoft = smoothstep(0.0, 0.25, max(-py, 0.0));
  float botSpec = topArc * botMask * botCornerSoft;
  col += vec3(0.86, 0.90, 1.0) * botSpec * 0.45 * specGate;
  alpha += botSpec * 0.45 * specGate;

  // (c) Inner bevel ring — thin, full perimeter, sits a few px inside the
  // edge. This is the "glass thickness" line; it's what makes the pill
  // read as a 3D extrusion rather than a flat painted shape.
  float bevelOffset = 2.2 * u_dpr;
  float bevelHalf   = max(0.55, 0.55 * u_dpr);
  float bevelFeather = max(0.7, 0.7 * u_dpr);
  float bevelRing = aaLine(d + bevelOffset + bevelHalf, bevelHalf, bevelFeather);
  // Brighten slightly toward top and bottom (where the surface curvature
  // catches light), keep a baseline along the sides so the ring is
  // continuous all the way around.
  float bevelDirBoost = 0.55 + 0.45 * (py * py); // 0.55 at sides, 1.0 at top/bot
  float bevel = bevelRing * bevelDirBoost;
  col += vec3(0.92, 0.94, 1.0) * bevel * 0.32;
  alpha += bevel * 0.32;

  // ---- Hover heat halo.
  //
  // Colors band by DISTANCE FROM THE STROKE (not by angle around the pill),
  // sampled from a heat-treated-steel palette: hot white right on the stroke,
  // then warm yellow/orange/red bands extending mostly inward across the rim,
  // cooling to violet/blue at the deepest band. Noise warp on the band
  // coordinate breaks the rings up so they read organic rather than concentric.
  // Hybrid coverage: a baseline glow runs around the full perimeter on hover,
  // with an extra hot-spot under the cursor.
  // ---- Click ripple gain.
  // Expanding ring of brightness centered on the click point; modulates the
  // chromatic refraction gradient so it visibly pulses outward across the
  // full width of the pill. ringR grows linearly with time; ringBand is a
  // Gaussian thickness envelope around it. ringEnv fades the whole effect
  // over the ripple's lifetime so it dies cleanly once it has cleared.
  float clickRipple = 0.0;
  if (u_clickAge >= 0.0 && u_clickReach > 0.0) {
    float clickDist = length(px - u_clickPos);
    float reach = u_clickReach;
    // Travel the full reach in 0.4s.
    float ringR = u_clickAge * (reach / 0.4);
    // Tighter band relative to reach so the ring reads as a distinct
    // wavefront. Thickness shrinks with travel distance — the wave is
    // tallest at the click point and tapers down as it spreads, matching
    // the brightness falloff so the ripple narrows + dims together.
    float ringNorm = clamp(ringR / reach, 0.0, 1.0);
    float ringThick = mix(reach * 0.32, reach * 0.04, ringNorm);
    float ringHalf = max(ringThick, 6.0);
    float ringBand = exp(-pow((clickDist - ringR) / ringHalf, 2.0));
    // Lifetime: hold near full strength until the ring has crossed the pill,
    // then fade. Slower decay than before so amplitude stays visible across
    // the whole sweep.
    float ringEnv = exp(-u_clickAge / 0.55);
    // Distance attenuation: ripple loses energy quickly as it spreads,
    // reaching zero by the time the wavefront crosses the pill. Exponential
    // falloff — drops to ~37% by 1/3 of the way out, ~14% at 2/3, and is
    // gone by full reach. Feels like the wave is shedding energy into the
    // glass rather than coasting at full brightness across the surface.
    float distNorm = clamp(clickDist / reach, 0.0, 1.0);
    float distFall = max(0.0, exp(-distNorm * 3.0) - exp(-3.0)) / (1.0 - exp(-3.0));
    clickRipple = ringBand * ringEnv * distFall;
  }

  if (u_hover > 0.001 && u_pointer.x > -9000.0) {
    // Each color is a SEPARATE band-shaped "stroke" at a specific signed
    // distance from the main stroke. Additively blended, so where two bands
    // overlap they brighten toward white. Inward bands outnumber outward
    // bands to keep the "more inward than outward" balance, and the total
    // spread is capped so the effect stays within the canvas bleed.

    // Per-band displacement noise. Each color samples vnoise at the SAME base
    // scale as the others (so all bands wobble at a consistent visual rate),
    // but at a unique positional seed and a small per-band time-velocity
    // jitter. The seed shifts each band into a different region of the noise
    // field so the resulting snake shapes are uncorrelated; the timing jitter
    // (±~10%) keeps the bands from animating in lockstep. Together this is
    // what makes adjacent bands cross and weave instead of holding a fixed
    // radial order — and where they cross, additive blending brightens toward
    // white, which is most of where the "moving rainbow" feel comes from.
    vec2 noisePx = px / max(halfSize.y, 1.0);
    vec2 cursorOff = u_pointer / max(u_size.y, 1.0);

    // Positional thickness noise — independent low-frequency sample. Combined
    // with a cursor-bias multiplier further down (once cursorBoost is known)
    // to form thickMod, the SHARED width multiplier applied to every band at
    // each rim point. Both band centers and band widths scale with thickMod,
    // so the rainbow as a whole pinches into a tight prismatic line in some
    // areas and flares outward in others. Decoupled from the per-band warps
    // so the pinching/swelling axis is its own motion.
    float nThick = vnoise(noisePx * 0.55 + cursorOff * 0.15
                          + vec2(u_time * 0.33, u_time * -0.24 + 11.0));

    // Per-band warps. Each band gets its own seed (xy), tiny time jitter
    // (z), and a per-band warp amp multiplier — cool colors (green, pink,
    // cyan) get a larger snake-wobble so their noise visibly carries them
    // deeper into the body than the warm bands. One band per color, in
    // VIBGYOR draw order (pink/violet first, orange last) so w1..w5 map 1:1
    // to the bandSum entries below.
    float warpAmp = halfSize.y * 0.24;
    float w1 = bandWarp(noisePx, cursorOff, u_time, vec3( 7.04,  5.18, -0.07)) * warpAmp * 1.9; // pink (cool)
    float w2 = bandWarp(noisePx, cursorOff, u_time, vec3( 4.55,  3.62, -0.08)) * warpAmp * 2.2; // cyan (cool)
    float w3 = bandWarp(noisePx, cursorOff, u_time, vec3( 1.39, -3.21,  0.07)) * warpAmp * 1.9; // green (cool)
    float w4 = bandWarp(noisePx, cursorOff, u_time, vec3( 0.00,  0.00,  0.00)) * warpAmp * 1.0; // yellow (warm)
    float w5 = bandWarp(noisePx, cursorOff, u_time, vec3(-2.17,  4.31, -0.06)) * warpAmp * 1.4; // orange (warm)

    // Slow radial drift per band — reuses each band's warp cfg so identity
    // stays consistent (bandDrift internally offsets the seed so drift is
    // decorrelated from warp). Returns -1..+1; multiplied by a per-band
    // amplitude in the band draws below. Inward bands get a larger drift
    // amount (0.040) since they have room to wander into the body; outward
    // bands get a smaller amount (0.020) so they don't drift past the
    // outsideFalloff window and disappear.
    float dr1 = bandDrift(u_time, vec3( 7.04,  5.18, -0.07));
    float dr2 = bandDrift(u_time, vec3( 4.55,  3.62, -0.08));
    float dr3 = bandDrift(u_time, vec3( 1.39, -3.21,  0.07));
    float dr4 = bandDrift(u_time, vec3( 0.00,  0.00,  0.00));
    float dr5 = bandDrift(u_time, vec3(-2.17,  4.31, -0.06));

    // Cursor localization. Heavily biased toward the cursor: a small baseline
    // (0.20) keeps a dim continuous trace of yellow/orange around the full
    // rim so the rainbow doesn't snap on/off, but the bright iridescent
    // rainbow with red/pink/blue only emerges under the cursor. Tighter
    // cursorReach (0.55 × half-width) focuses the bright spot into a visible
    // hotspot instead of washing over half the pill. Per-band exponents fade
    // the cooler bands faster than the warm ones — far side reads as a quiet
    // warm whisper; cursor side glows full prism.
    float pointerDist = length(px - u_pointer);
    // Two Gaussians around the cursor, on purpose:
    //   cursorReach (wide) — drives noise wobble and rim breathing. Stays
    //     wide so warpScale + thickMod still energize bands across most of
    //     the pill; the snake motion and inward push don't shrink down to a
    //     tiny zone under the cursor.
    //   brightReach (tight) — drives only the brightness pop in coverage.
    //     The bright/white-overlap region collapses to a small halo right
    //     under the pointer; further out, coverage drops fast so the bands
    //     dim and their distinct colors become readable again.
    float cursorReach = halfSize.x * 0.55;
    float cursorBoost = exp(-pow(pointerDist / cursorReach, 2.0));
    float brightReach = halfSize.x * 0.33;
    float brightBoost = exp(-pow(pointerDist / brightReach, 2.0));
    // Coverage peaks ABOVE 1.0 at the cursor (0.20 + 1.10 = 1.30) so the bands
    // brighten beyond their resting full intensity right under the hotspot,
    // then ramp down through the per-band exponents toward the dim baseline
    // on the far side. Uses brightBoost (tight) so the overlap clip-to-white
    // only happens in the immediate cursor zone.
    float coverage = 0.20 + 1.10 * brightBoost;
    float c1 = pow(coverage, 1.55);      // yellow
    float c2 = pow(coverage, 2.00);      // (unused at present)
    float c3 = pow(coverage, 2.50);      // orange, pink
    float c4 = pow(coverage, 3.00);      // green, cyan

    // Noise warp keeps a small baseline amplitude all the way around the rim
    // so the bands snake continuously, with much stronger wobble near the
    // cursor where the rainbow is brightest. Lower baseline than the prior
    // pass makes the far-side rim read as a calmer concentric trace, with the
    // snaking visibly concentrated under the cursor.
    float warpScale = 0.65 + 0.35 * cursorBoost;

    // Thickness modulator: noise base [0.55..1.40] multiplied by a cursor-bias
    // factor [0.75..1.25] so bands physically thicken near the cursor (rim
    // swells under the hotspot) and stay slimmer far from it (the dim warm
    // trace on the far side is narrow as well as faint).
    float thickMod = mix(0.55, 1.40, nThick) * mix(0.75, 1.45, cursorBoost);

    // Click ripple amplification (applied once to the final sum).
    float rippleGain = 1.0 + clickRipple * 4.0;

    // Per-band Gaussian widths in halfSize.y units (effective width is
    // wXxx * thickMod per pixel). Each band declared individually so each
    // color can be tuned in isolation — yellow stays narrowest (sharp
    // chromatic fringe), orange and pink widened for more body, green/cyan
    // sit between.
    float wYellow = halfSize.y * 0.030;
    float wOrange = halfSize.y * 0.060;
    float wGreen  = halfSize.y * 0.055;
    float wPink   = halfSize.y * 0.080;
    float wCyan   = halfSize.y * 0.055;

    // Each band: x = (d − band_center * thickMod + warp) / (width * thickMod);
    // envelope = exp(−x²). band_center is signed (negative = inside, positive
    // = outside) and both center and width scale with thickMod, so the rim
    // breathes — pinching into a tight prismatic line where thickMod is small
    // and flaring outward where it swells. No white core band: the rim
    // outline is defined by the colored bands themselves, not by an
    // achromatic stripe at d=0. The flanking yellow centers sit far enough
    // from the stroke that their Gaussian tails don't pile up to white at the
    // iso-line — instead, d=0 reads as a saturated yellow transition.
    //
    // One band per color, each at a distinct radial slice. Per-band noise
    // (w1..w5) gives each its own snake-wobble; drift (dr1..dr5) makes each
    // band's resting depth slowly wander over time, so neighbouring colors
    // routinely swap order. Where bands cross, additive blending brightens
    // but the tone-shape further below keeps the overlap colored rather than
    // clipping to white.
    //
    // Centers written as (base + driftAmp * drN): base is the resting
    // halfSize.y-fraction; driftAmp is how far the band can wander; drN is
    // the time-only noise for this band. Negative bases sit outward of the
    // stroke (positive d), positive bases sit inward (negative d). Outward
    // bands use a smaller drift so they don't slide past the outsideFalloff
    // window and disappear; inward bands have more room.
    //
    // Each band line takes the form:
    //   x = (d + halfSize.y * (BASE + DRIFT_AMP * drN) * thickMod
    //        + wN * warpScale) / (WIDTH * thickMod);
    //   bandSum += COLOR * exp(-x*x) * WEIGHT * FADE_EXPONENT;
    // so all five per-band knobs (base, drift, width, color, weight, fade)
    // are visible on the two lines per band below.
    vec3 bandSum = vec3(0.0);
    float x;
    // Pink / violet (bottom of the stack — drawn first).
    x = (d - halfSize.y * (0.035 + 0.020 * dr1) * thickMod + w1 * warpScale) / (wPink * thickMod);
    bandSum += vec3(0.75, 0.35, 0.95) * exp(-x * x) * 0.65 * c3;
    // Cyan / blue.
    x = (d + halfSize.y * (0.110 + 0.040 * dr2) * thickMod + w2 * warpScale) / (wCyan * thickMod);
    bandSum += vec3(0.40, 0.70, 1.00) * exp(-x * x) * 0.35 * c4;
    // Green.
    x = (d - halfSize.y * (0.015 + 0.020 * dr3) * thickMod + w3 * warpScale) / (wGreen * thickMod);
    bandSum += vec3(0.30, 0.80, 0.50) * exp(-x * x) * 0.40 * c4;
    // Yellow.
    x = (d + halfSize.y * (0.080 + 0.040 * dr4) * thickMod + w4 * warpScale) / (wYellow * thickMod);
    bandSum += vec3(1.00, 0.93, 0.55) * exp(-x * x) * 0.78 * c1;
    // Orange (top of the stack — drawn last).
    x = (d + halfSize.y * (0.085 + 0.040 * dr5) * thickMod + w5 * warpScale) / (wOrange * thickMod);
    bandSum += vec3(1.00, 0.55, 0.18) * exp(-x * x) * 0.65 * c3;

    // Containment falloff: attenuate the band sum when d > 0 (outside the
    // pill) so the halo doesn't bleed far into the canvas bleed area. Sigma
    // at ~8% of half-height lets the per-band warp + drift visibly push the
    // outward bands a few px past the stroke — they hold ~50% strength at
    // halfSize.y * 0.07 outside and fade out by ~halfSize.y * 0.16 — so the
    // noise reads as the rainbow physically spilling off the rim rather than
    // being clipped at the iso-line. Inside the pill (d < 0), the max(0, d)
    // clamp keeps this factor at 1.0 so the inward bands are unaffected.
    float outsideFalloff = exp(-pow(max(0.0, d) / (halfSize.y * 0.08), 2.0));
    vec3 heatBand = bandSum * outsideFalloff * rippleGain;

    // ---- Specular boost — re-light the always-on top/bottom arc and bevel
    // ring under the cursor so the glass surface visibly catches additional
    // light during hover. Reuses the idle masks. Solid variant suppresses the
    // arc/glow contributions via specGate (already zero on solid).
    float specBoost = (topSpec * specGate
                       + botSpec * 0.5 * specGate
                       + bevel * 0.6
                       + topGlow * 0.4 * specGate) * cursorBoost;
    vec3 specHover = vec3(1.0) * specBoost * 0.7;

    // ---- Opposite-side white rim flare. The cursor side now reads as the
    // hottest part of the heat band; the far side picks up a clean achromatic
    // specular so the pill silhouette reads as a key/fill light pair instead
    // of an even ring of color. Anchor is the projected rim point opposite
    // the cursor's rim-projected anchor.
    vec2 anchor = closestOnRoundRect(u_pointer, halfSize, radius);
    vec2 oppRaw = -anchor;
    vec2 oppAnchor = closestOnRoundRect(oppRaw, halfSize, radius);
    float oppDist = length(px - oppAnchor);
    float oppFall = u_size.y * 0.32;
    float oppLocal = exp(-oppDist / oppFall);
    float oppRimCenter  = -max(0.6, 0.6 * u_dpr);
    float oppRimHalf    = max(1.2, 1.2 * u_dpr);
    float oppRimFeather = max(0.6, 0.6 * u_dpr);
    float oppRimBand    = aaLine(d - oppRimCenter, oppRimHalf, oppRimFeather);
    vec3 oppRim = vec3(1.0) * oppRimBand * oppLocal * inside * 1.2 * specGate;

    // ---- Exterior chromatic glow ("where the mouse is").
    // A soft bloom that lives strictly OUTSIDE the pill, anchored to the rim
    // point nearest the cursor and split into a warm (orange) and cool (blue)
    // lobe offset along the rim tangent. Where the two lobes overlap (directly
    // outward from the cursor) they sum toward a bright warm-white core; their
    // tangential offset leaves an orange fringe on one flank and a blue fringe
    // on the other — a chromatic-aberration split that tracks the pointer.
    // Reuses the same accent hues as the interior halo so the two read as one
    // material. Rendered into the canvas bleed, so the bleed is widened in CSS
    // (.experiment-button --bleed) to give this room before the buffer edge.
    vec2 nrm = rrNormal(anchor, halfSize, radius);   // outward normal at anchor
    vec2 tang = vec2(-nrm.y, nrm.x);                 // rim tangent at anchor
    float outD = max(d, 0.0);                        // distance OUTSIDE the pill
    // Localize by RADIUS FROM THE CURSOR (same model as the interior noise
    // effect's cursorBoost) instead of by tangential position along the rim,
    // so the bloom always sits on the cursor's own side and fades with 2D
    // distance from the pointer — it can't mirror to the far side. The two
    // chromatic lobes are the cursor point split along the rim tangent by
    // ±chroma. Reach keyed to height so the hotspot stays a consistent size
    // across narrow/wide buttons.
    // Anisotropic reach: extend further on the left/right flanks than top/
    // bottom. nrm is the outward direction of the glow, so abs(nrm.x) is ~1
    // when the bloom sits on a side and ~0 when it sits above/below.
    // Isotropic outward reach: the glow now extends the same distance off the
    // rounded left/right caps as it does off the top/bottom. The old anisotropic
    // boost (mix up to 4.5×, then 3.5×, on abs(nrm.x)) stretched the bloom far
    // past the side caps — on a wide pill that overran the canvas --bleed and
    // hard-clipped at the buffer edge, reading as a left/right cutoff. The
    // radial falloff below uses outD (true rounded-rect SDF distance), so corners
    // are already handled; a single uniform reach keeps the halo even all around.
    float glowReach = halfSize.y * 0.24;             // outward (radial) falloff, all sides
    float glowSpread = halfSize.y * 1.05;            // hotspot radius around the cursor
    float chroma = halfSize.y * 0.24;                // orange/blue separation
    float radial = exp(-outD / glowReach);
    vec2 warmCenter = u_pointer + tang * chroma;     // cursor, split toward one flank
    vec2 coolCenter = u_pointer - tang * chroma;     // cursor, split toward the other
    float warmLobe = exp(-pow(length(px - warmCenter) / glowSpread, 2.0));
    float coolLobe = exp(-pow(length(px - coolCenter) / glowSpread, 2.0));
    // Exterior-only mask: 0 inside the pill, 1 just outside, with a 1px AA
    // transition straddling the stroke so the glow joins the rim cleanly.
    float extOutside = smoothstep(-1.0, 1.0, d);
    // Window the glow to zero before the buffer edge so a tight bleed can't
    // clip it into a hard rectangle.
    vec2 edgeDist = u_size * 0.5 - abs(px);
    float edgeWin = smoothstep(0.0, 6.0 * u_dpr, min(edgeDist.x, edgeDist.y));
    vec3 extWarm = vec3(1.00, 0.55, 0.18);           // matches the orange band
    vec3 extCool = vec3(0.40, 0.70, 1.00);           // matches the cyan/blue band
    vec3 extGlow = (extWarm * warmLobe + extCool * coolLobe)
                   * radial * extOutside * edgeWin * 0.62;

    // ---- Combine (additive — colors layer like light).
    vec3 halo = heatBand + specHover + oppRim + extGlow;
    halo *= u_hover;

    // Soft tone shaping. Per-channel Reinhard with a fairly aggressive
    // compression factor so overlapping bands brighten toward the sum of
    // their colors but stop short of clipping to pure white — a red+yellow
    // overlap reads as a hot orange-white rather than full white, a
    // red+blue+yellow overlap reads as warm pink rather than washing out.
    // Previous factor (0.2) let bright sums approach 1.0 almost cleanly,
    // which made multi-band overlaps look like a flashlight across the rim
    // once per-band noise started routinely stacking 3+ bands per pixel.
    halo = halo / (1.0 + halo * 0.45);

    col   += halo;
    float haloA = max(max(halo.r, halo.g), halo.b);
    alpha += clamp(haloA, 0.0, 1.0);
  }

  // ---- Click flash: re-lights the same idle specular masks so the
  // highlights brighten in place. Top contributions are weighted more heavily
  // so the flash reads as a top-down light burst — matching the idle bias
  // where the top arc/glow dominate the bottom rim and side bevel.
  if (u_clickEnv > 0.001) {
    float flash = u_clickEnv;
    float flashSpec = flash * (1.0 - isSolid);
    col   += vec3(0.95, 0.97, 1.00) * topGlow * 0.45 * flashSpec;
    alpha += topGlow * 0.45 * flashSpec;
    col   += vec3(1.00, 1.00, 1.00) * topSpec * 1.40 * flashSpec;
    alpha += topSpec * 1.40 * flashSpec;
    col   += vec3(0.86, 0.90, 1.00) * botSpec * 0.35 * flashSpec;
    alpha += botSpec * 0.35 * flashSpec;
    col   += vec3(0.92, 0.94, 1.00) * bevel   * 0.28 * flash;
    alpha += bevel * 0.28 * flash;
  }

  // Press: subtle white inner brighten when actively pressed. Glass-only —
  // on the solid white variant it would just wash out the fill.
  if (u_press > 0.001) {
    float pressGlow = inside * exp(-inner / (u_size.y * 0.7)) * u_press * 0.18 * (1.0 - isSolid);
    col += vec3(1.0) * pressGlow;
    alpha += pressGlow;
  }

  alpha = clamp(alpha, 0.0, 1.0);
  // Premultiplied alpha out (matches canvas premultipliedAlpha:true default).
  outColor = vec4(col, alpha);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error("shader compile error:\n" + log + "\n---\n" + src);
    throw new Error(log);
  }
  return sh;
}

function link(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p));
  }
  return p;
}

// ---------------------------------------------------------------------------
// Shared WebGL2 renderer. Browsers cap the number of live WebGL contexts
// (~16); with ~19 glass buttons across the page, a context-per-button would
// crowd that ceiling (the browser starts dropping the oldest contexts) and
// waste GPU memory on N copies of the same program. Instead every button shares
// this ONE offscreen context: each frame it renders the button's shader into a
// shared drawing buffer, then the result is blitted into the button's own 2D
// canvas (see GlassButton.render). preserveDrawingBuffer keeps the rendered
// pixels valid for that drawImage copy (the shared canvas is never in the DOM,
// so it's never composited and would otherwise be cleared between draws).
// ---------------------------------------------------------------------------
class SharedGL {
  static create() {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    return gl ? new SharedGL(canvas, gl) : null;
  }

  constructor(canvas, gl) {
    this.canvas = canvas;
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    this.program = link(gl, vs, fs);

    this.attribPos = gl.getAttribLocation(this.program, "a_pos");
    this.uSize = gl.getUniformLocation(this.program, "u_size");
    this.uButtonSize = gl.getUniformLocation(this.program, "u_buttonSize");
    this.uDpr = gl.getUniformLocation(this.program, "u_dpr");
    this.uPointer = gl.getUniformLocation(this.program, "u_pointer");
    this.uHover = gl.getUniformLocation(this.program, "u_hover");
    this.uPress = gl.getUniformLocation(this.program, "u_press");
    this.uTime = gl.getUniformLocation(this.program, "u_time");
    this.uClickPos = gl.getUniformLocation(this.program, "u_clickPos");
    this.uClickAge = gl.getUniformLocation(this.program, "u_clickAge");
    this.uClickEnv = gl.getUniformLocation(this.program, "u_clickEnv");
    this.uClickReach = gl.getUniformLocation(this.program, "u_clickReach");
    this.uVariant = gl.getUniformLocation(this.program, "u_variant");

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(this.attribPos);
    gl.vertexAttribPointer(this.attribPos, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;

    // One program + VAO + blend state for the whole app, bound once. Nothing
    // else uses this context, so the bindings persist across every render.
    gl.useProgram(this.program);
    gl.bindVertexArray(vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied
  }

  // Grow the shared buffer to fit the largest button seen so far (never shrinks,
  // so a mix of sizes settles on the max with no per-frame reallocation churn).
  ensureSize(w, h) {
    if (this.canvas.width < w) this.canvas.width = w;
    if (this.canvas.height < h) this.canvas.height = h;
  }

  // Render the shader for one button (drawing-buffer size w×h device px, plus
  // its uniform params `p`) and blit the result into the button's 2D context.
  render(targetCtx, w, h, p) {
    const gl = this.gl;
    this.ensureSize(w, h);
    // WebGL's viewport origin is bottom-left; place the quad in the TOP rows of
    // the buffer (y = height − h) so the rendered region maps to the top-left of
    // the canvas-as-image and the blit below needs no vertical flip.
    const top = this.canvas.height - h;
    gl.viewport(0, top, w, h);
    // gl.clear ignores the viewport but honors scissor — clear only our region
    // so a taller shared buffer (sized for a bigger button) isn't fully wiped.
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, top, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);

    gl.uniform2f(this.uSize, w, h);
    gl.uniform2f(this.uButtonSize, p.btnPxW, p.btnPxH);
    gl.uniform1f(this.uDpr, p.dpr);
    gl.uniform2f(this.uPointer, p.pointerX, p.pointerY);
    gl.uniform1f(this.uHover, p.hover);
    gl.uniform1f(this.uPress, p.press);
    gl.uniform1f(this.uTime, p.time);
    gl.uniform2f(this.uClickPos, p.clickX, p.clickY);
    gl.uniform1f(this.uClickAge, p.clickAge);
    gl.uniform1f(this.uClickEnv, p.clickEnv);
    gl.uniform1f(this.uClickReach, p.clickReach);
    gl.uniform1f(this.uVariant, p.variant);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Copy the rendered top-left region into the button's own canvas. This blit
    // is the only way the offscreen shared buffer's pixels reach the screen.
    targetCtx.clearRect(0, 0, w, h);
    targetCtx.drawImage(this.canvas, 0, 0, w, h, 0, 0, w, h);
  }
}

// Lazily created on the first button; shared by all. Once a creation attempt
// fails (no WebGL2), every button falls back to the CSS-only style.
let shared = null;
let sharedFailed = false;
function getShared() {
  if (shared) return shared;
  if (sharedFailed) return null;
  shared = SharedGL.create();
  if (!shared) sharedFailed = true;
  return shared;
}

class GlassButton {
  constructor(button) {
    this.button = button;
    this.canvas = button.querySelector(".experiment-button__canvas");
    this.variant = button.classList.contains("experiment-button--solid") ? 1 : 0;
    // All glass buttons share ONE WebGL2 context (see SharedGL); this button
    // just owns a 2D canvas that the shared renderer blits into each frame. If
    // WebGL2 is unavailable the effect is disabled and CSS shows the fallback.
    this.shared = getShared();
    this.ctx = this.shared ? this.canvas.getContext("2d") : null;
    if (!this.shared || !this.ctx) {
      console.warn("WebGL2 unavailable; button effect disabled.");
      this.button.classList.add("experiment-button--no-gl");
      return;
    }

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.pointer = { x: -9999, y: -9999 };
    this.hover = 0;
    this.press = 0;
    this.targetHover = 0;
    this.targetPress = 0;
    this.lastFrameMs = null;
    // Click animation state. clickStart is the timestamp (perf.now) of the
    // most recent click; -1 means no active ripple. clickPos is captured in
    // shader pixel space (canvas-centered, y-up, post-DPR) at click time so
    // the ripple stays anchored to the spot the user pressed even if the
    // pointer moves afterwards.
    this.clickStart = -1;
    this.clickPos = { x: 0, y: 0 };
    this.clickReach = 0;
    // Total ripple lifetime: ring travels in ~0.65s, then fades; cut off
    // cleanly after this window so the uniform stops shipping work.
    this.clickDurationMs = 1100;
    // Time-based hover easing so the ramp duration is exact regardless of
    // frame rate. 0.4s for a smoother engagement on enter/leave.
    this.hoverDurationMs = 400;
    // On-demand RAF: the loop only runs while there is animation to draw
    // (hover ramp, press, click ripple). Idle buttons consume zero per-frame
    // work. visible gates rendering when the button is scrolled offscreen.
    this.rafId = 0;
    this.visible = true;

    this.tick = this.tick.bind(this);
    this.resize();
    this.attachEvents();
    this.start = performance.now();
    this.requestFrame();
  }

  requestFrame() {
    if (this.rafId || !this.shared || !this.visible) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  isAnimating() {
    return (
      this.targetHover !== this.hover ||
      this.targetPress !== this.press ||
      this.hover > 0.001 ||
      this.press > 0.001 ||
      this.clickStart >= 0
    );
  }

  resize() {
    // Use the canvas rect (which includes the CSS bleed) for the buffer size,
    // but remember the button rect separately for the SDF.
    const cRect = this.canvas.getBoundingClientRect();
    const bRect = this.button.getBoundingClientRect();
    const w = Math.max(1, Math.round(cRect.width * this.dpr));
    const h = Math.max(1, Math.round(cRect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.cssW = cRect.width;
    this.cssH = cRect.height;
    this.btnPxW = bRect.width * this.dpr;
    this.btnPxH = bRect.height * this.dpr;
    this.btnRect = bRect;
    this.canvasRect = cRect;
  }

  // Store the pointer in shader pixel space (canvas-centered, post-DPR),
  // clamped to the BUTTON rect rather than the canvas (which extends past the
  // pill by --bleed). Touch implicitly captures the pointer to the target on
  // press, so a finger that starts on the button and slides off keeps firing
  // pointermove with coordinates well outside the pill — left unclamped, the
  // hotspot (and the click-anchored ripple it feeds) would track to a point
  // beyond the rim and the effect would read as cut off at the edge. Clamping
  // to ±half the button size pins the hotspot to the nearest point on the pill.
  setPointer(x, y) {
    const hx = this.btnPxW * 0.5;
    const hy = this.btnPxH * 0.5;
    this.pointer.x = Math.max(-hx, Math.min(hx, x));
    this.pointer.y = Math.max(-hy, Math.min(hy, y));
  }

  attachEvents() {
    const b = this.button;
    const onMove = (e) => {
      const cRect = this.canvas.getBoundingClientRect();
      // Pointer in pixel space (post-DPR), origin at canvas center, y-up.
      const cssX = e.clientX - (cRect.left + cRect.width / 2);
      const cssY = e.clientY - (cRect.top + cRect.height / 2);
      this.setPointer(cssX * this.dpr, -cssY * this.dpr);
      this.requestFrame();
    };
    const onEnter = () => {
      this.targetHover = 1;
      this.requestFrame();
    };
    const onLeave = () => {
      // Keep the last pointer position around so the halo can ease out from
      // where the cursor actually was; release it once the fade completes.
      this.targetHover = 0;
      this.targetPress = 0;
      this.requestFrame();
    };
    const onDown = (e) => {
      this.targetPress = 1;
      // Capture click in shader pixel space (canvas-centered, y-up, post-DPR)
      // so the ripple stays anchored even if the cursor drags afterward.
      const cRect = this.canvas.getBoundingClientRect();
      const cssX = e.clientX - (cRect.left + cRect.width / 2);
      const cssY = e.clientY - (cRect.top + cRect.height / 2);
      this.clickPos.x = cssX * this.dpr;
      this.clickPos.y = -cssY * this.dpr;
      // Touch/pen have no hover, so a tap would never light the shader's
      // iridescent halo: pointerenter/pointerleave bracket the tap too tightly
      // for the 400ms hover ramp to climb, and a clean tap may fire no
      // pointermove — leaving u_pointer unset, which the halo branch is gated on
      // (see FRAG: `u_hover > 0.001 && u_pointer.x > -9000`). Drive both directly
      // from the press so the glow lights on tap and eases back out when the
      // finger lifts (onUp/onLeave set targetHover = 0). Mouse is untouched — it
      // keeps its enter/leave-driven hover.
      if (e.pointerType !== "mouse") {
        this.setPointer(this.clickPos.x, this.clickPos.y);
        this.hover = 1;
        this.targetHover = 1;
      }
      // Reach = full pill width (plus the farther-edge slack from the click
      // point) so the ripple visibly traverses the entire button regardless
      // of where the user clicked. Tied to width — the dominant axis of a
      // pill — so the sweep speed reads consistently.
      const halfW = this.btnPxW * 0.5;
      const farX = halfW + Math.abs(this.clickPos.x);
      this.clickReach = Math.max(farX, this.btnPxW);
      this.clickStart = performance.now();
      this.requestFrame();
    };
    const onUp = (e) => {
      this.targetPress = 0;
      // Touch/pen: start easing the hover halo back out on lift (mouse keeps it
      // until pointerleave). Guarded so a call without an event can't throw.
      if (e && e.pointerType !== "mouse") this.targetHover = 0;
      this.requestFrame();
    };

    b.addEventListener("pointermove", onMove);
    b.addEventListener("pointerenter", onEnter);
    b.addEventListener("pointerleave", onLeave);
    b.addEventListener("pointerdown", onDown);
    b.addEventListener("pointerup", onUp);
    b.addEventListener("pointercancel", onLeave);

    const ro = new ResizeObserver(() => {
      this.resize();
      this.requestFrame();
    });
    ro.observe(b);

    // Skip rendering when scrolled offscreen. Drop pointer/hover state on
    // hide so the ramp doesn't restart mid-animation when the button comes
    // back into view.
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          this.visible = entry.isIntersecting;
          if (this.visible) {
            this.requestFrame();
          }
        }
      });
      io.observe(b);
    }

    // Tab hidden: cancel any in-flight click ripple so it doesn't replay
    // from a stale age when the tab resumes.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clickStart = -1;
        this.lastFrameMs = null;
      } else {
        this.requestFrame();
      }
    });
    let resizeRaf = 0;
    window.addEventListener("resize", () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        const newDpr = Math.min(window.devicePixelRatio || 1, 2);
        if (newDpr !== this.dpr) {
          this.dpr = newDpr;
        }
        this.resize();
        this.requestFrame();
      });
    });
  }

  tick(now) {
    this.rafId = 0;
    if (!this.shared || !this.visible) return;
    const t = (now - this.start) / 1000;
    const dt = this.lastFrameMs == null ? 16 : Math.min(now - this.lastFrameMs, 64);
    this.lastFrameMs = now;

    // Hover: time-based ease over hoverDurationMs with a smoothstep curve so
    // the ramp is gentle at both ends. Step linear progress, then shape it.
    const dir = Math.sign(this.targetHover - this.hover) || 0;
    if (dir !== 0) {
      // Recover linear progress from the current eased value, advance it,
      // then re-apply the easing curve.
      const invSmooth = (y) => {
        // Approximate inverse of smoothstep(0,1,x) = 3x^2 - 2x^3 via Newton.
        let x = y;
        for (let i = 0; i < 4; i++) {
          const f = 3 * x * x - 2 * x * x * x - y;
          const df = 6 * x - 6 * x * x;
          if (Math.abs(df) < 1e-6) break;
          x -= f / df;
        }
        return Math.min(1, Math.max(0, x));
      };
      const linear = invSmooth(this.hover);
      const next = Math.min(1, Math.max(0, linear + dir * (dt / this.hoverDurationMs)));
      this.hover = next * next * (3 - 2 * next);
    }

    // Press stays as a quick frame-rate-dependent lerp — short snappy feel.
    const lerp = (a, b, k) => a + (b - a) * k;
    this.press = lerp(this.press, this.targetPress, 0.25);

    // Once the hover has fully faded out, release the cached pointer so the
    // shader treats it as "no pointer" again.
    if (this.targetHover === 0 && this.hover <= 0.001) {
      this.hover = 0;
      this.pointer.x = -9999;
      this.pointer.y = -9999;
    }

    this.render(t);

    // Keep the loop alive only while there is animation to draw. When fully
    // settled we let RAF stop; the next pointer/resize/visibility event will
    // call requestFrame() to wake it.
    if (this.isAnimating()) {
      this.requestFrame();
    } else {
      // Drop the dt baseline so the next wake-up doesn't see a giant gap.
      this.lastFrameMs = null;
    }
  }

  render(t) {
    // Click: compute age (s) and a decaying specular envelope. Negative age
    // signals "no active click" to the shader.
    let clickAge = -1;
    let clickEnv = 0;
    if (this.clickStart >= 0) {
      const ageMs = performance.now() - this.clickStart;
      if (ageMs <= this.clickDurationMs) {
        clickAge = ageMs / 1000;
        // Sharp ramp-up over ~40ms, then exponential decay over the remainder.
        // Peak value of 1.0 fully re-lights the idle specular masks (with the
        // top-biased weights in the shader), creating the bright top burst.
        const ageS = clickAge;
        const rise = Math.min(1, ageS / 0.04);
        const decay = Math.exp(-ageS / 0.32);
        clickEnv = rise * decay;
      } else {
        this.clickStart = -1;
      }
    }

    // Render this button's shader on the shared context and blit the result
    // into its own 2D canvas.
    this.shared.render(this.ctx, this.canvas.width, this.canvas.height, {
      btnPxW: this.btnPxW,
      btnPxH: this.btnPxH,
      dpr: this.dpr,
      pointerX: this.pointer.x,
      pointerY: this.pointer.y,
      hover: this.hover,
      press: this.press,
      time: t,
      clickX: this.clickPos.x,
      clickY: this.clickPos.y,
      clickAge,
      clickEnv,
      clickReach: this.clickReach,
      variant: this.variant,
    });
  }
}

// Each GlassButton creates a WebGL2 context + compiles the shader in its
// constructor, so eagerly constructing all of them at load would put every
// below-the-fold button's init (only the header CTA is above the fold on first
// paint) on the critical path. Instead we lazily construct each button as it
// nears the viewport: a visible button intersects immediately on observe (so
// the header CTA still inits right away), off-screen ones init on approach.
// Idempotent via the WeakSet so the router/modal can re-call after injecting
// markdown.
const wired = new WeakSet();

const lazyIO =
  typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) wire(entry.target);
          }
        },
        // Warm a little before the button scrolls in so its glass effect is
        // ready by the time it's on screen, without paying for it at load.
        { rootMargin: "400px" }
      )
    : null;

function wire(el) {
  if (wired.has(el)) return;
  wired.add(el);
  if (lazyIO) lazyIO.unobserve(el);
  new GlassButton(el);
}

// Lazy by default. Pass { immediate: true } to construct now rather than on
// approach — needed for buttons revealed by JS inside a display:none container
// (the contact modal's SEND button), which an IntersectionObserver can't see
// until the container is shown.
export function initGlassButtons(root = document, { immediate = false } = {}) {
  root.querySelectorAll(".experiment-button").forEach((el) => {
    if (wired.has(el)) return;
    if (immediate || !lazyIO) wire(el);
    else lazyIO.observe(el);
  });
}

initGlassButtons();
