/**
 * Camera background blur, fully on-device, in the offscreen document.
 *
 * A bundled MediaPipe segmentation model finds the person in each camera frame. A WebGL2 pass
 * then blurs everything else:
 * - the mask is smoothed over time, so edges do not flicker;
 * - its edges are refined against the full-resolution frame (joint bilateral), so the cut
 *   follows hair and shoulders instead of the model's 256-pixel grid;
 * - the background blur excludes the person (premultiplied by the background weight), so no halo
 *   of skin or clothing bleeds into the blur.
 *
 * Camera frames and masks never leave this document. The screen capture is never analyzed.
 */

/** The bundled model and runtime, served from the extension itself (MV3: no remote code). */
export const BLUR_ASSETS = {
  model: "/mediapipe/selfie_multiclass_256x256.tflite",
  loader: "/mediapipe/vision_wasm_internal.js",
  binary: "/mediapipe/vision_wasm_internal.wasm",
} as const;

export interface BlurEffect {
  /** Returns a new, blurred frame. The caller still owns (and closes) the input frame. */
  process(frame: VideoFrame): VideoFrame;
  readonly delegate: "GPU" | "CPU";
  close(): void;
}

/** Person confidence (0..1) from the model's confidence masks. */
export function personConfidence(
  masks: Float32Array[],
  model: "multiclass" | "selfie",
): Float32Array {
  const first = masks[0];
  if (!first) return new Float32Array(0);
  // Multiclass: mask 0 is the background. The selfie model's single mask is the person.
  if (model === "selfie" || masks.length === 1) return first;
  const person = new Float32Array(first.length);
  for (let i = 0; i < first.length; i++) person[i] = 1 - (first[i] ?? 0);
  return person;
}

/**
 * Exponential smoothing over time, written into `previous` and returned as bytes for an R8
 * texture. A sharp change (a new person, a large move) wins quickly; jitter does not.
 */
export function smoothMask(
  current: Float32Array,
  previous: Float32Array | null,
  out: Uint8Array,
  weight = 0.6,
): Float32Array {
  const next = previous && previous.length === current.length ? previous : null;
  const result = next ?? new Float32Array(current.length);
  for (let i = 0; i < current.length; i++) {
    const value = Math.min(1, Math.max(0, current[i] ?? 0));
    const blended = next ? (next[i] ?? 0) * (1 - weight) + value * weight : value;
    result[i] = blended;
    out[i] = Math.round(blended * 255);
  }
  return result;
}

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
/** Downsample, keeping only the background: rgb * bg, with bg in alpha. */
const DOWNSAMPLE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFrame;
uniform sampler2D uMask;
out vec4 color;
void main() {
  float background = 1.0 - smoothstep(0.25, 0.6, texture(uMask, vUv).r);
  color = vec4(texture(uFrame, vUv).rgb * background, background);
}`;
const BLUR = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uStep;
out vec4 color;
void main() {
  // 13-tap Gaussian (sigma ~ 4 texels) on the premultiplied background.
  float w[7] = float[7](0.1585, 0.1465, 0.1157, 0.0781, 0.0451, 0.0222, 0.0094);
  vec4 sum = texture(uSource, vUv) * w[0];
  for (int i = 1; i < 7; i++) {
    sum += texture(uSource, vUv + uStep * float(i)) * w[i];
    sum += texture(uSource, vUv - uStep * float(i)) * w[i];
  }
  color = sum;
}`;
const COMPOSE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFrame;
uniform sampler2D uMask;
uniform sampler2D uBlur;
uniform vec2 uMaskTexel;
out vec4 color;
void main() {
  // Canvas row 0 is the top of the frame.
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 center = texture(uFrame, uv).rgb;
  // Joint bilateral upsampling: mask samples whose colour matches this pixel count more.
  float sum = 0.0;
  float weights = 0.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 offset = vec2(float(x), float(y)) * uMaskTexel;
      vec3 neighbour = texture(uFrame, uv + offset).rgb;
      vec3 d = neighbour - center;
      float w = exp(-dot(d, d) * 18.0) * exp(-float(x * x + y * y) / 4.5);
      sum += texture(uMask, uv + offset).r * w;
      weights += w;
    }
  }
  float person = smoothstep(0.3, 0.7, sum / max(weights, 1e-4));
  vec4 blurred = texture(uBlur, uv);
  // Deep inside the person the background weight is ~0; use the frame there.
  vec3 background = blurred.a > 0.02 ? blurred.rgb / blurred.a : center;
  color = vec4(mix(background, center, person), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, fragment: string) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("BLUR_UNSUPPORTED");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error("BLUR_UNSUPPORTED");
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error("BLUR_UNSUPPORTED");
  return program;
}
function texture(gl: WebGL2RenderingContext) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
function target(gl: WebGL2RenderingContext, width: number, height: number) {
  const tex = texture(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo };
}

/** Loads the model and builds the GL pipeline. Rejects when the device cannot run it. */
export async function createBlurEffect(
  resolveUrl: (path: string) => string,
): Promise<BlurEffect> {
  const vision = await import("@mediapipe/tasks-vision");
  const fileset = {
    wasmLoaderPath: resolveUrl(BLUR_ASSETS.loader),
    wasmBinaryPath: resolveUrl(BLUR_ASSETS.binary),
  };
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: resolveUrl(BLUR_ASSETS.model), delegate },
    runningMode: "VIDEO" as const,
    outputConfidenceMasks: true,
    outputCategoryMask: false,
    canvas: new OffscreenCanvas(1, 1),
  });
  let delegate: "GPU" | "CPU" = "GPU";
  let segmenter: import("@mediapipe/tasks-vision").ImageSegmenter;
  try {
    segmenter = await vision.ImageSegmenter.createFromOptions(fileset, options("GPU"));
  } catch (error) {
    console.warn("upwin: background blur GPU delegate failed, trying CPU", error);
    delegate = "CPU";
    segmenter = await vision.ImageSegmenter.createFromOptions(fileset, options("CPU"));
  }

  const canvas = new OffscreenCanvas(2, 2);
  const gl = canvas.getContext("webgl2", {
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    antialias: false,
  });
  if (!gl) {
    segmenter.close();
    throw new Error("BLUR_UNSUPPORTED");
  }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const programs = {
    down: compile(gl, DOWNSAMPLE),
    blur: compile(gl, BLUR),
    compose: compile(gl, COMPOSE),
  };
  const frameTex = texture(gl),
    maskTex = texture(gl);
  let size = { w: 0, h: 0 },
    small = { w: 0, h: 0 };
  let a: ReturnType<typeof target> | null = null,
    b: ReturnType<typeof target> | null = null;
  let previous: Float32Array | null = null,
    maskBytes = new Uint8Array(0),
    maskSize = { w: 0, h: 0 },
    lastTimestamp = -1,
    frames = 0,
    segmentMs = 0;

  function resize(w: number, h: number) {
    if (w === size.w && h === size.h) return;
    size = { w, h };
    small = { w: Math.max(8, Math.round(w / 4)), h: Math.max(8, Math.round(h / 4)) };
    canvas.width = w;
    canvas.height = h;
    for (const t of [a, b]) {
      if (!t) continue;
      gl!.deleteTexture(t.tex);
      gl!.deleteFramebuffer(t.fbo);
    }
    a = target(gl!, small.w, small.h);
    b = target(gl!, small.w, small.h);
  }
  function draw(program: WebGLProgram, fbo: WebGLFramebuffer | null, w: number, h: number) {
    gl!.useProgram(program);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.viewport(0, 0, w, h);
    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }
  function bind(program: WebGLProgram, name: string, unit: number, tex: WebGLTexture | null) {
    gl!.activeTexture(gl!.TEXTURE0 + unit);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.uniform1i(gl!.getUniformLocation(program, name), unit);
  }

  return {
    delegate,
    process(frame) {
      const w = frame.displayWidth,
        h = frame.displayHeight;
      resize(w, h);
      // Timestamps must strictly increase for VIDEO mode.
      const timestamp = Math.max(lastTimestamp + 1, Math.round((frame.timestamp ?? 0) / 1000));
      lastTimestamp = timestamp;
      // A slow device segments every other frame; each frame is still composited fresh, and the
      // temporal smoothing hides the 15 Hz mask (Edge on a MacBook Air measured ~22 fps without).
      frames++;
      if (segmentMs <= 20 || frames % 2 === 0 || !maskSize.w) {
        const started = performance.now();
        const result = segmenter.segmentForVideo(frame, timestamp);
        try {
          const masks = result.confidenceMasks ?? [];
          maskSize = { w: masks[0]?.width ?? 0, h: masks[0]?.height ?? 0 };
          const person = personConfidence(
            masks.map((m) => m.getAsFloat32Array()),
            masks.length > 1 ? "multiclass" : "selfie",
          );
          if (maskBytes.length !== person.length) {
            maskBytes = new Uint8Array(person.length);
            previous = null;
          }
          previous = smoothMask(person, previous, maskBytes);
        } finally {
          result.close();
        }
        segmentMs = segmentMs * 0.8 + (performance.now() - started) * 0.2;
        gl!.bindTexture(gl!.TEXTURE_2D, maskTex);
        gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1);
        gl!.texImage2D(
          gl!.TEXTURE_2D,
          0,
          gl!.R8,
          maskSize.w,
          maskSize.h,
          0,
          gl!.RED,
          gl!.UNSIGNED_BYTE,
          maskBytes,
        );
      }
      const mw = maskSize.w,
        mh = maskSize.h;
      {
        gl!.bindTexture(gl!.TEXTURE_2D, frameTex);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, frame);

        // 1. Background only, at quarter size.
        gl!.useProgram(programs.down);
        bind(programs.down, "uFrame", 0, frameTex);
        bind(programs.down, "uMask", 1, maskTex);
        draw(programs.down, a!.fbo, small.w, small.h);
        // 2. Two separable blur rounds: a -> b -> a -> b -> a.
        gl!.useProgram(programs.blur);
        const step = gl!.getUniformLocation(programs.blur, "uStep");
        for (let round = 0; round < 2; round++) {
          bind(programs.blur, "uSource", 0, a!.tex);
          gl!.uniform2f(step, 1 / small.w, 0);
          draw(programs.blur, b!.fbo, small.w, small.h);
          bind(programs.blur, "uSource", 0, b!.tex);
          gl!.uniform2f(step, 0, 1 / small.h);
          draw(programs.blur, a!.fbo, small.w, small.h);
        }
        // 3. Refine the mask edges against the frame and compose onto the canvas.
        gl!.useProgram(programs.compose);
        bind(programs.compose, "uFrame", 0, frameTex);
        bind(programs.compose, "uMask", 1, maskTex);
        bind(programs.compose, "uBlur", 2, a!.tex);
        gl!.uniform2f(
          gl!.getUniformLocation(programs.compose, "uMaskTexel"),
          1 / Math.max(1, mw),
          1 / Math.max(1, mh),
        );
        draw(programs.compose, null, w, h);
      }
      return new VideoFrame(canvas, { timestamp: frame.timestamp ?? 0 });
    },
    close() {
      segmenter.close();
      gl!.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
