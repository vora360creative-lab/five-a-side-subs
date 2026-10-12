/*
 * Match sounds (Web Audio API).
 * - The 30-second warning is two synthesised beeps.
 * - Sub and full time use a recorded referee whistle: sounds/whistle.mp3.
 * Each sound function schedules on `ctx` into `dest` at time `t` (seconds,
 * AudioContext clock) and returns the sound's length in seconds.
 */
const Sounds = (function () {
  "use strict";

  const WHISTLE_URL = "sounds/whistle.mp3";

  // The warning beep's level. The whistle is normalised against it: its peak is
  // scaled to this level, and its loudest 100 ms is never louder on average than
  // the beep (a sine at this peak), so the whistle is never louder than the beep.
  const WARNING_LEVEL = 0.16;
  const WARNING_RMS = WARNING_LEVEL / Math.SQRT2;

  const SHORT_WHISTLE = 0.18; // seconds, for the two short full-time blasts

  let whistle = null; // { buffer, start, gain, ctx } once decoded

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

  /** Finds where the sound starts and the gain that matches it to the warning beep. */
  function measure(buffer) {
    const sr = buffer.sampleRate;
    const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    let peak = 0;
    for (const d of chans) for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (!peak) return { start: 0, gain: 0 };

    // Skip any leading near-silence (below -40 dB from the peak).
    let start = buffer.length;
    for (const d of chans) {
      const i = d.findIndex((v) => Math.abs(v) > peak * 0.01);
      if (i >= 0) start = Math.min(start, i);
    }

    // Loudest 100 ms (RMS), per channel.
    const win = Math.round(sr * 0.1);
    let loudest = 0;
    for (const d of chans) {
      for (let i = 0; i + win <= d.length; i += Math.round(sr * 0.01)) {
        let sum = 0;
        for (let j = i; j < i + win; j++) sum += d[j] * d[j];
        loudest = Math.max(loudest, Math.sqrt(sum / win));
      }
    }
    const gain = Math.min(WARNING_LEVEL / peak, loudest ? WARNING_RMS / loudest : Infinity);
    return { start: start / sr, gain, peak, loudest };
  }

  /** Loads and decodes the whistle for this AudioContext (once). Works offline via the service worker. */
  function prepare(ctx) {
    if (whistle && whistle.ctx === ctx) return Promise.resolve(whistle);
    return fetch(WHISTLE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`${WHISTLE_URL}: HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
      .then((buffer) => {
        whistle = Object.assign({ buffer, ctx }, measure(buffer));
        return whistle;
      });
  }

  /** Plays the recorded whistle at `t`; `dur` cuts it short with a quick fade. */
  function playWhistle(ctx, dest, t, dur) {
    if (!whistle || whistle.ctx !== ctx) return 0;
    const full = whistle.buffer.duration - whistle.start;
    const len = dur ? Math.min(dur, full) : full;
    const src = ctx.createBufferSource();
    src.buffer = whistle.buffer;
    const level = ctx.createGain();
    level.gain.setValueAtTime(whistle.gain, t);
    if (dur) {
      level.gain.setValueAtTime(whistle.gain, t + len - 0.03);
      level.gain.linearRampToValueAtTime(0, t + len);
    }
    src.connect(level).connect(dest);
    src.start(t, whistle.start, len);
    return len;
  }

  return {
    prepare,

    /** For checking levels: the measured whistle (peak, loudest, gain) once loaded. */
    whistleInfo: () => whistle && { start: whistle.start, gain: whistle.gain, peak: whistle.peak, loudest: whistle.loudest, duration: whistle.buffer.duration },

    /** 30-second warning: two short, soft, high beeps. */
    warning(ctx, dest, t) {
      beep(ctx, dest, t, 1760, 0.09, WARNING_LEVEL);
      beep(ctx, dest, t + 0.18, 1760, 0.09, WARNING_LEVEL);
      return 0.27;
    },

    /** Sub due: the whistle, once. */
    sub(ctx, dest, t) {
      return playWhistle(ctx, dest, t);
    },

    /** Full time: short, short, then the full whistle. */
    fullTime(ctx, dest, t) {
      const gap = 0.16;
      let at = t;
      at += playWhistle(ctx, dest, at, SHORT_WHISTLE) + gap;
      at += playWhistle(ctx, dest, at, SHORT_WHISTLE) + gap;
      at += playWhistle(ctx, dest, at);
      return at - t;
    },

    /** Tiny blip when sound is switched on, to confirm the volume. */
    check(ctx, dest, t) {
      beep(ctx, dest, t, 1320, 0.07, 0.14);
      return 0.07;
    },
  };
})();

if (typeof module === "object" && module.exports) module.exports = Sounds;
