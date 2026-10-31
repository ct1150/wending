const mountedScenes = new WeakMap();
const MOTION_KEY = 'wending-title-motion-v1';
const FRAME_INTERVAL = 1000 / 30;
const TAU = Math.PI * 2;

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_mobile;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
float cloud(vec2 p) {
  return noise(p) * 0.57 + noise(p * 2.03 + 7.1) * 0.28 + noise(p * 4.07 + 13.4) * 0.15;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.y = 1.0 - uv.y;
  float edge = mix(smoothstep(0.29, 0.57, uv.x), 1.0, u_mobile);
  edge *= smoothstep(0.13, 0.35, uv.y) * (1.0 - smoothstep(0.70, 0.94, uv.y));
  edge *= mix(1.0, 1.0 - smoothstep(0.35, 0.60, uv.y), u_mobile);
  if (edge < 0.002) { gl_FragColor = vec4(0.0); return; }
  vec2 p = vec2(uv.x * u_resolution.x / u_resolution.y, uv.y) * vec2(3.2, 6.0);
  vec2 drift = vec2(u_time * 0.055, -u_time * 0.012);
  float curl = noise(p * 0.75 - drift * 0.4);
  float density = cloud(p + drift + vec2(curl * 1.4, curl * 0.65));
  float ribbon = cloud(p * vec2(0.65, 1.7) - drift * 0.55 + 12.0);
  float alpha = smoothstep(0.30, 0.82, density) * (0.11 + ribbon * 0.17) * edge;
  vec3 color = mix(vec3(0.66, 0.77, 0.77), vec3(0.96, 0.88, 0.69), smoothstep(0.45, 0.88, uv.x));
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

function fogRenderer(canvas) {
  if (!canvas?.getContext) return null;
  let gl, program, buffer;
  const shaders = [];
  const dispose = (releaseContext = false) => {
    if (!gl) return;
    try {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      for (const shader of shaders) gl.deleteShader(shader);
    } catch { /* A revoked graphics context is already released. */ }
    buffer = program = null;
    if (releaseContext) {
      // The app disposes just before replacing the markup. Wait until that replacement
      // has happened; a same-node remount can reuse its context without losing it.
      Promise.resolve().then(() => {
        try {
          if (!canvas.isConnected && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
        } catch { /* Explicit context release is optional. */ }
      });
    }
  };
  try {
    gl = canvas.getContext('webgl', {alpha:true, antialias:false, depth:false, stencil:false, premultipliedAlpha:true, powerPreference:'low-power'});
    if (!gl) return null;
    program = gl.createProgram();
    if (!program) throw Error('Graphics unavailable');
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER]]) {
      const shader = gl.createShader(type);
      if (!shader) throw Error('Graphics unavailable');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('Shader unavailable');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Shader unavailable');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    if (!buffer) throw Error('Graphics unavailable');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const time = gl.getUniformLocation(program, 'u_time');
    const mobile = gl.getUniformLocation(program, 'u_mobile');
    gl.clearColor(0, 0, 0, 0);
    return {
      resize(width, height, compact) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(resolution, width, height);
        gl.uniform1f(mobile, compact ? 1 : 0);
      },
      draw(seconds) {
        if (gl.isContextLost()) return false;
        gl.uniform1f(time, seconds);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return true;
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function mistTexture(canvas) {
  try {
    const texture = canvas.ownerDocument.createElement('canvas');
    texture.width = 512;
    texture.height = 128;
    const context = texture.getContext('2d', {alpha:true});
    if (!context) return null;
    const pixels = context.createImageData(texture.width, texture.height), random = seededRandom(0x3fa9);
    for (let x = 0; x < texture.width; x++) {
      const u = x / texture.width;
      const edge = Math.pow(Math.sin(u * Math.PI), 1.5);
      const ridge = 0.49 + Math.sin(u * 8) * 0.09 + Math.sin(u * 37) * 0.025;
      const curl = 0.45 + Math.sin(u * 6 + 2) * 0.1;
      for (let y = 0; y < texture.height; y++) {
        const v = y / texture.height, offset = (y * texture.width + x) * 4;
        const density = Math.exp(-(((v - ridge) / 0.17) ** 2)) * 0.65 + Math.exp(-(((v - curl) / 0.08) ** 2)) * 0.35;
        pixels.data[offset] = 223;
        pixels.data[offset + 1] = 224;
        pixels.data[offset + 2] = 207;
        pixels.data[offset + 3] = density * edge * (0.82 + random() * 0.18) * 90;
      }
    }
    context.putImageData(pixels, 0, 0);
    return texture;
  } catch { return null; }
}

function particleRenderer(canvas) {
  if (!canvas?.getContext) return null;
  let context;
  try { context = canvas.getContext('2d', {alpha:true}); } catch { return null; }
  if (!context) return null;
  const random = seededRandom(0x51a7);
  const motes = Array.from({length:44}, (_, index) => ({
    x:random(), y:random(), radius:0.5 + random() * 1.15,
    phase:random() * TAU, speed:0.5 + random(), leaf:index < 5,
  }));
  let width = 1, height = 1, compact = false, mist = null, attemptedMist = false;
  return {
    resize(pixelWidth, pixelHeight, cssWidth, cssHeight, mobile) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      width = cssWidth;
      height = cssHeight;
      compact = mobile;
      context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    },
    draw(seconds, withMist) {
      context.clearRect(0, 0, width, height);
      if (withMist && !attemptedMist) { attemptedMist = true; mist = mistTexture(canvas); }
      if (withMist && mist) {
        context.save();
        context.beginPath();
        context.rect(compact ? 0 : width * 0.34, 0, width, height * (compact ? 0.52 : 0.86));
        context.clip();
        // Reuse a translucent, elongated texture; no gradients or noise are rebuilt per frame.
        for (let bank = 0; bank < 4; bank++) {
          const phase = bank * 1.9;
          const x = width * ((compact ? -0.34 : 0.31) + bank * 0.08 + Math.sin(seconds * 0.035 + phase) * 0.06);
          const y = height * ((compact ? 0.09 : 0.28) + bank * (compact ? 0.075 : 0.11) + Math.sin(seconds * 0.023 + phase) * 0.015);
          context.globalAlpha = (compact ? 0.34 : 0.45) + Math.sin(seconds * 0.08 + phase) * 0.08;
          context.drawImage(mist, x, y, width * (compact ? 1.55 : 0.93), height * (compact ? 0.19 : 0.23));
        }
        context.restore();
      }
      const count = compact ? 18 : motes.length;
      for (let index = 0; index < count; index++) {
        const mote = motes[index];
        const x = ((mote.x + seconds * (mote.leaf ? 0.009 : 0.003) * mote.speed) % 1.2 - 0.1) * width + Math.sin(seconds * 0.24 + mote.phase) * 14;
        const y = ((mote.y - seconds * 0.002 * mote.speed + Math.sin(seconds * 0.15 + mote.phase) * 0.018) % 1 + 1) % 1 * height;
        const menuFade = compact ? Math.max(0, 1 - Math.max(0, y / height - 0.36) * 4) : Math.min(1, Math.max(0.12, (x / width - 0.22) * 3));
        const edgeFade = Math.min(1, y / height * 10, (1 - y / height) * 8);
        const alpha = (0.24 + (Math.sin(seconds * 0.6 + mote.phase) + 1) * 0.14) * menuFade * edgeFade;
        if (alpha < 0.015) continue;
        context.save();
        context.translate(x, y);
        if (mote.leaf) {
          context.rotate(Math.sin(seconds * 0.35 + mote.phase) * 0.8 - 0.4);
          context.fillStyle = `rgba(191,160,99,${alpha * 0.75})`;
          context.beginPath();
          context.moveTo(-5 * mote.radius, 0);
          context.quadraticCurveTo(0, -2 * mote.radius, 5 * mote.radius, 0);
          context.quadraticCurveTo(0, 1.4 * mote.radius, -5 * mote.radius, 0);
          context.fill();
        } else {
          context.globalCompositeOperation = 'lighter';
          context.fillStyle = `rgba(246,211,140,${alpha})`;
          context.shadowColor = 'rgba(255,205,111,0.55)';
          context.shadowBlur = 4;
          context.beginPath();
          context.arc(0, 0, mote.radius, 0, TAU);
          context.fill();
        }
        context.restore();
      }
      return true;
    },
    dispose() {
      canvas.width = canvas.height = 1;
      if (mist) mist.width = mist.height = 1;
      mist = null;
    },
  };
}

function ambientSound(view, onChange) {
  const Audio = view.AudioContext || view.webkitAudioContext;
  let context, timer = null, desired = false, closed = false, operation = Promise.resolve(), note = 0;
  const nodes = [], voices = new Set();
  const dispose = () => {
    if (closed) return;
    closed = true;
    desired = false;
    if (timer !== null) view.clearTimeout(timer);
    timer = null;
    if (context) context.onstatechange = null;
    for (const voice of voices) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch { /* The note may already have ended. */ }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    voices.clear();
    for (const node of nodes) {
      try { if (node.stop) node.stop(); node.disconnect(); } catch { /* Already ended. */ }
    }
    if (context && context.state !== 'closed') context.close().catch(() => {});
  };
  try {
    context = new Audio();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    nodes.push(master);
    const wind = context.createBufferSource();
    const buffer = context.createBuffer(1, context.sampleRate * 6, context.sampleRate);
    const data = buffer.getChannelData(0), random = seededRandom(0x71c3);
    let previous = 0;
    for (let index = 0; index < data.length; index++) {
      previous = (previous + (random() * 2 - 1) * 0.022) / 1.022;
      data[index] = previous * 3.5;
    }
    wind.buffer = buffer;
    wind.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 550;
    filter.Q.value = 0.45;
    const windGain = context.createGain();
    windGain.gain.value = 0.18;
    wind.connect(filter).connect(windGain).connect(master);
    nodes.push(wind, filter, windGain);
    wind.start();
    const scheduleNote = () => {
      timer = null;
      if (closed || !desired || context.state !== 'running') return;
      const oscillator = context.createOscillator(), gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.value = [146.83, 220, 196, 293.66, 164.81][note++ % 5];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);
      oscillator.connect(gain).connect(master);
      const voice = {oscillator, gain};
      voices.add(voice);
      oscillator.onended = () => { voices.delete(voice); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(now);
      oscillator.stop(now + 4.6);
      timer = view.setTimeout(scheduleNote, 6200 + (note % 3) * 1300);
    };
    context.onstatechange = onChange;
    return {
      get running() { return !closed && desired && context.state === 'running'; },
      setPlaying(active) {
        if (closed) return;
        desired = active;
        if (!active && timer !== null) { view.clearTimeout(timer); timer = null; }
        // Serialize resume/suspend so a late user-gesture promise cannot revive a hidden or disposed scene.
        operation = operation.then(async () => {
          if (closed) return;
          if (desired) {
            await context.resume();
            if (closed) return;
            if (!desired) { await context.suspend(); return; }
            master.gain.setTargetAtTime(0.22, context.currentTime, 0.45);
            if (timer === null) scheduleNote();
          } else {
            await context.suspend();
          }
          onChange();
        }).catch(() => { desired = false; onChange(); });
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}

function fitPixels(width, height, scale, budget) {
  const ratio = Math.min(scale, Math.sqrt(budget / (width * height)));
  return [Math.max(1, Math.floor(width * ratio)), Math.max(1, Math.floor(height * ratio))];
}

/** Optional title-screen effects. The menu and its artwork never depend on this renderer. */
export function mountTitleScene(root) {
  if (!root || typeof root.querySelector !== 'function' || typeof window === 'undefined' || typeof document === 'undefined' || !root.style?.setProperty) return () => {};
  mountedScenes.get(root)?.();
  const view = root.ownerDocument?.defaultView || window, doc = root.ownerDocument || document;
  if (!view.addEventListener || !root.addEventListener) return () => {};
  const fogCanvas = root.querySelector('[data-title-fog]'), particlesCanvas = root.querySelector('[data-title-particles]');
  const motionButton = root.querySelector('[data-title-motion]'), soundButton = root.querySelector('[data-title-sound]');
  const motionLabel = motionButton?.querySelector('[data-motion-label]'), soundLabel = soundButton?.querySelector('[data-sound-label]');
  const canSchedule = typeof view.requestAnimationFrame === 'function' && typeof view.cancelAnimationFrame === 'function';
  let media = null, preference = null;
  try { media = view.matchMedia?.('(prefers-reduced-motion: reduce)') || null; } catch { /* Optional browser preference. */ }
  try { preference = view.localStorage.getItem(MOTION_KEY); } catch { /* Private browsing may deny storage. */ }
  let motion = !media?.matches && preference !== 'off';
  let fog = fogRenderer(fogCanvas), particles = particleRenderer(particlesCanvas);
  let disposed = false, frame = null, lastPaint = null, elapsed = 0, width = 0, height = 0, dpr = 0;
  let pointerX = 0, pointerY = 0, sceneX = 0, sceneY = 0, sound = null, soundWanted = false;
  let stateSignature = '', soundSignature = '', writtenX = null, writtenY = null;
  let audioAvailable = Boolean(view.AudioContext || view.webkitAudioContext);
  const removers = [];
  const listen = (target, type, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  const writeParallax = () => {
    const x = Math.abs(sceneX) < 0.005 ? '0px' : sceneX.toFixed(2) + 'px';
    const y = Math.abs(sceneY) < 0.005 ? '0px' : sceneY.toFixed(2) + 'px';
    if (writtenX !== x) { root.style.setProperty('--scene-x', x); writtenX = x; }
    if (writtenY !== y) { root.style.setProperty('--scene-y', y); writtenY = y; }
  };
  const centered = () => {
    pointerX = pointerY = sceneX = sceneY = 0;
    writeParallax();
  };
  const updateSound = () => {
    if (disposed) return;
    const playing = Boolean(soundWanted && !doc.hidden && sound?.running);
    const signature = `${playing}:${audioAvailable}`;
    if (signature === soundSignature) return;
    soundSignature = signature;
    root.dataset.sound = playing ? 'on' : 'off';
    if (soundButton) {
      soundButton.disabled = !audioAvailable;
      soundButton.setAttribute('aria-pressed', String(playing));
      soundButton.setAttribute('aria-label', '环境音');
      soundButton.title = !audioAvailable ? '当前浏览器不支持环境音' : playing ? '关闭环境音' : '开启环境音';
    }
    if (soundLabel) soundLabel.textContent = playing ? '环境音·开' : '环境音·关';
  };
  const sync = () => {
    if (disposed) return;
    const available = Boolean(fog || particles) && canSchedule;
    const enabled = motion && available;
    const running = enabled && !doc.hidden && root.isConnected !== false;
    const renderer = fog ? 'webgl' : particles ? 'canvas' : 'static';
    const signature = `${renderer}:${enabled}:${running}:${available}`;
    if (signature !== stateSignature) {
      stateSignature = signature;
      root.dataset.sceneRenderer = renderer;
      root.dataset.motion = enabled ? 'on' : 'off';
      root.dataset.sceneRunning = String(running);
      if (motionButton) {
        motionButton.disabled = !available;
        motionButton.setAttribute('aria-pressed', String(enabled));
        motionButton.setAttribute('aria-label', '动态画面');
        motionButton.title = !available ? '当前浏览器显示静态画面' : enabled ? '暂停动态画面' : '开启动态画面';
      }
      if (motionLabel) motionLabel.textContent = enabled ? '动态·开' : '动态·关';
    }
    if (running && frame === null) frame = view.requestAnimationFrame(tick);
    if (!running) {
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      lastPaint = null;
      centered();
    }
  };
  const dropFog = () => {
    fog?.dispose();
    fog = null;
    if (fogCanvas) { fogCanvas.width = fogCanvas.height = 1; fogCanvas.style.visibility = 'hidden'; }
  };
  const dropParticles = () => {
    particles?.dispose();
    particles = null;
    if (particlesCanvas) particlesCanvas.style.visibility = 'hidden';
  };
  const paint = () => {
    try { if (fog && !fog.draw(elapsed)) dropFog(); } catch { dropFog(); }
    try { if (particles && !particles.draw(elapsed, !fog)) dropParticles(); } catch { dropParticles(); }
  };
  function tick(now) {
    frame = null;
    if (disposed) return;
    if (root.isConnected === false) { dispose(); return; }
    if (!motion || doc.hidden) { sync(); return; }
    const interval = lastPaint === null ? FRAME_INTERVAL : now - lastPaint;
    if (interval >= FRAME_INTERVAL) {
      const delta = Math.min(interval, 80) / 1000;
      elapsed += delta;
      lastPaint = now - interval % FRAME_INTERVAL;
      const damping = 1 - Math.exp(-delta * 4);
      sceneX += (pointerX - sceneX) * damping;
      sceneY += (pointerY - sceneY) * damping;
      writeParallax();
      paint();
    }
    sync();
  }
  const resize = () => {
    if (disposed) return;
    const rect = root.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width || view.innerWidth || 1));
    const nextHeight = Math.max(1, Math.round(rect.height || view.innerHeight || 1));
    const nextDpr = Math.min(view.devicePixelRatio || 1, 2);
    if (width === nextWidth && height === nextHeight && dpr === nextDpr) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    const compact = width < 680;
    try { fog?.resize(...fitPixels(width, height, Math.min(dpr, 1.5) * 0.6, 900000), compact); } catch { dropFog(); }
    try { particles?.resize(...fitPixels(width, height, Math.min(dpr, 1.5), 1400000), width, height, compact); } catch { dropParticles(); }
    if (!doc.hidden) paint();
    sync();
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    for (const remove of removers) remove();
    fog?.dispose(true);
    particles?.dispose();
    fog = particles = null;
    if (fogCanvas) fogCanvas.width = fogCanvas.height = 1;
    sound?.dispose();
    sound = null;
    centered();
    root.dataset.motion = 'off';
    root.dataset.sceneRunning = 'false';
    root.dataset.sound = 'off';
    motionButton?.setAttribute('aria-pressed', 'false');
    soundButton?.setAttribute('aria-pressed', 'false');
    if (motionLabel) motionLabel.textContent = '动态·关';
    if (soundLabel) soundLabel.textContent = '环境音·关';
    if (mountedScenes.get(root) === dispose) mountedScenes.delete(root);
  }
  mountedScenes.set(root, dispose);
  centered();
  if (fogCanvas) fogCanvas.style.visibility = fog ? 'visible' : 'hidden';
  if (particlesCanvas) particlesCanvas.style.visibility = particles ? 'visible' : 'hidden';
  listen(motionButton, 'click', () => {
    motion = !motion;
    preference = motion ? 'on' : 'off';
    try { view.localStorage.setItem(MOTION_KEY, preference); } catch { /* Session-only preference is sufficient. */ }
    sync();
  });
  listen(soundButton, 'click', () => {
    if (!audioAvailable) return;
    soundWanted = !soundWanted;
    if (soundWanted && !sound) sound = ambientSound(view, updateSound);
    if (!sound) { audioAvailable = false; soundWanted = false; }
    sound?.setPlaying(soundWanted && !doc.hidden);
    updateSound();
  });
  listen(root, 'pointermove', event => {
    if (!motion || doc.hidden || width < 680 || event.pointerType === 'touch') return;
    const rect = root.getBoundingClientRect();
    pointerX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / width * 2 - 1)) * 12;
    pointerY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / height * 2 - 1)) * 12;
  }, {passive:true});
  listen(root, 'pointerleave', () => { pointerX = pointerY = 0; }, {passive:true});
  listen(doc, 'visibilitychange', () => {
    sync();
    sound?.setPlaying(soundWanted && !doc.hidden);
    updateSound();
  });
  const mediaChanged = event => { motion = !event.matches && preference !== 'off'; sync(); };
  if (media?.addEventListener) listen(media, 'change', mediaChanged);
  else if (media?.addListener) {
    media.addListener(mediaChanged);
    removers.push(() => media.removeListener(mediaChanged));
  }
  listen(fogCanvas, 'webglcontextlost', event => { event.preventDefault(); dropFog(); sync(); });
  listen(particlesCanvas, 'contextlost', event => { event.preventDefault(); dropParticles(); sync(); });
  listen(view, 'resize', resize, {passive:true});
  if (view.ResizeObserver) {
    const observer = new view.ResizeObserver(resize);
    observer.observe(root);
    removers.push(() => observer.disconnect());
  }
  resize();
  sync();
  updateSound();
  return dispose;
}
