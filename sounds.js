/*
 * Match sounds, synthesised with the Web Audio API (no audio files).
 * Each function schedules its sound on `ctx` into `dest`, starting at time `t`
 * (seconds, AudioContext clock), and returns the sound's length in seconds.
 */
const Sounds = (function () {
  "use strict";

  let noise = null; // shared 1s of white noise for the whistle's breath

  function noiseBuffer(ctx) {
    if (noise && noise.sampleRate === ctx.sampleRate) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  /** Attack / hold / release envelope on a fresh gain node. */
  function envelope(ctx, t, dur, peak, attack, release) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  function beep(ctx, dest, t, freq, dur, peak) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const env = envelope(ctx, t, dur, peak, 0.008, 0.04);
    osc.connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /**
   * Pea whistle: a ~3 kHz tone whose pitch and loudness flutter ~30 times a
   * second (the pea rattling), a quick upward chirp at the start, a touch of
   * second harmonic for bite, and band-passed breath noise.
   */
  function whistle(ctx, dest, t, dur) {
    const end = t + dur + 0.05;
    const env = envelope(ctx, t, dur, 0.55, 0.012, Math.min(0.08, dur / 3));
    env.connect(dest);

    // Flutter: fast trill plus a slower drift so it never sounds mechanical.
    const trill = ctx.createOscillator();
    trill.frequency.setValueAtTime(29, t);
    trill.frequency.linearRampToValueAtTime(33, end);
    const drift = ctx.createOscillator();
    drift.frequency.value = 5.5;

    // Amplitude flutter: gain swings roughly 0.45 .. 1.0
    const flutter = ctx.createGain();
    flutter.gain.value = 0.72;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.28;
    trill.connect(flutterDepth).connect(flutter.gain);
    flutter.connect(env);

    // Fundamental ~2.65-3.35 kHz with fast pitch wobble
    const tone = ctx.createOscillator();
    tone.type = "sine";
    tone.frequency.setValueAtTime(2650, t);
    tone.frequency.exponentialRampToValueAtTime(3000, t + 0.06);
    const wobble = ctx.createGain();
    wobble.gain.value = 300;
    trill.connect(wobble).connect(tone.frequency);
    const wander = ctx.createGain();
    wander.gain.value = 60;
    drift.connect(wander).connect(tone.frequency);
    tone.connect(flutter);

    // Second harmonic, following the same wobble
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.setValueAtTime(5300, t);
    harm.frequency.exponentialRampToValueAtTime(6000, t + 0.06);
    const harmWobble = ctx.createGain();
    harmWobble.gain.value = 600;
    trill.connect(harmWobble).connect(harm.frequency);
    const harmLevel = ctx.createGain();
    harmLevel.gain.value = 0.12;
    harm.connect(harmLevel).connect(flutter);

    // Breath
    const air = ctx.createBufferSource();
    air.buffer = noiseBuffer(ctx);
    air.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 3000;
    band.Q.value = 5;
    const airLevel = ctx.createGain();
    airLevel.gain.value = 0.35;
    air.connect(band).connect(airLevel).connect(flutter);

    for (const src of [trill, drift, tone, harm, air]) {
      src.start(t);
      src.stop(end);
    }
    return dur;
  }

  return {
    /** 30-second warning: two short, soft, high beeps. */
    warning(ctx, dest, t) {
      beep(ctx, dest, t, 1760, 0.09, 0.16);
      beep(ctx, dest, t + 0.18, 1760, 0.09, 0.16);
      return 0.27;
    },

    /** Sub due: one referee whistle, about 0.8 s. */
    sub(ctx, dest, t) {
      return whistle(ctx, dest, t, 0.8);
    },

    /** Full time: three whistles, short, short, long. */
    fullTime(ctx, dest, t) {
      whistle(ctx, dest, t, 0.28);
      whistle(ctx, dest, t + 0.45, 0.28);
      whistle(ctx, dest, t + 0.9, 1.2);
      return 2.1;
    },

    /** Tiny blip when sound is switched on, to confirm the volume. */
    check(ctx, dest, t) {
      beep(ctx, dest, t, 1320, 0.07, 0.14);
      return 0.07;
    },
  };
})();

if (typeof module === "object" && module.exports) module.exports = Sounds;
