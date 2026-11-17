// Synthesized sound for SOLMARA: no audio files, everything is built with the
// WebAudio API — engine hum, two-tone police siren, gunshots, pickup chimes and a
// looping bassline that plays on the title screen and while driving. The context
// is created lazily on the first user gesture (browsers require that).
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  // A short descending bassline loop (A minor groove) that keeps the city moving.
  const BASSLINE = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4, 55, 0, 55, 65.4, 98, 82.4, 73.4, 65.4];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const freq = BASSLINE[musicStep % BASSLINE.length];
      musicStep += 1;
      if (freq > 0) tone(freq, 0.22, 'triangle', 0.16);
      if (musicStep % 4 === 0) tone(220, 0.08, 'square', 0.03);
    }, 190);
  }
  function stopMusic() {
    if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    startMusic,
    stopMusic,
    blip() { tone(880, 0.08, 'sine', 0.18, 1320); },
    pickup() { tone(523, 0.1, 'sine', 0.22); window.setTimeout(() => tone(784, 0.16, 'sine', 0.22), 90); },
    cash() { tone(659, 0.1, 'triangle', 0.22); window.setTimeout(() => tone(988, 0.2, 'triangle', 0.22), 100); },
    shot() { noise(0.14, 0.5, 2400); tone(160, 0.1, 'square', 0.2, 60); },
    punch() { noise(0.08, 0.3, 700); },
    crash() { noise(0.3, 0.45, 500); tone(70, 0.25, 'sawtooth', 0.2, 40); },
    sirenOn() {
      if (!ensure() || sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain.gain.value = 0.0;
      sirenGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.4);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let high = false;
      sirenTimer = window.setInterval(() => {
        if (!sirenOsc) return;
        high = !high;
        sirenOsc.frequency.linearRampToValueAtTime(high ? 950 : 650, ctx.currentTime + 0.35);
      }, 400);
    },
    sirenOff() {
      if (sirenTimer) { window.clearInterval(sirenTimer); sirenTimer = null; }
      if (sirenOsc) { try { sirenOsc.stop(); } catch { /* already stopped */ } sirenOsc = null; sirenGain = null; }
    },
    // Continuous engine note; call every frame with speed 0..1 (0 = silent/off).
    engine(speed, on) {
      if (!ensure()) return;
      if (!on || speed <= 0.02) {
        if (engineOsc) { try { engineOsc.stop(); } catch { /* gone */ } engineOsc = null; engineGain = null; }
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const target = 55 + speed * 130;
      engineOsc.frequency.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + speed * 0.05, ctx.currentTime, 0.1);
    },
  };
}
