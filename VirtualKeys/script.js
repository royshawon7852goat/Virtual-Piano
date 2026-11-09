/**
 * VirtualKeys • Full 88-Key Piano Simulator
 * Complete Web Audio Engine, 88 Playable Keys (A0 - C8), MIDI Parser & Playback,
 * Demo Song Library, Recording System, Real-Time Audio Visualizer
 */

// ============================================================================
// 1. 88-KEY PIANO SPECIFICATION & GENERATION
// ============================================================================
// A0 (MIDI 21) to C8 (MIDI 108) = Exactly 88 Keys (52 White, 36 Black)
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BLACK_SEMITONES = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

function build88KeysData() {
  const keys = [];
  let whiteIndex = 0;

  for (let midi = 21; midi <= 108; midi++) {
    const semitone = midi % 12;
    const noteName = NOTE_NAMES[semitone];
    const octave = Math.floor(midi / 12) - 1;
    const isBlack = BLACK_SEMITONES.includes(semitone);
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const keyObj = {
      midi,
      noteName,
      octave,
      displayName: `${noteName}${octave}`,
      isBlack,
      freq,
      whiteIndex: isBlack ? null : whiteIndex++
    };

    keys.push(keyObj);
  }

  return keys;
}

const ALL_88_KEYS = build88KeysData(); // 88 keys total: 52 white, 36 black

// Computer Keyboard Mapping for a 2-Octave Window (24 keys)
// White keys: A, S, D, F, G, H, J, K, L, ;, ', Z, X, C
// Black keys: W, E, T, Y, U, O, P, ], 8, 9
const COMPUTER_KEY_MAP = [
  // Octave 1 (Lower)
  { relSemitone: 0,  isBlack: false, key: "a", label: "A" },
  { relSemitone: 1,  isBlack: true,  key: "w", label: "W" },
  { relSemitone: 2,  isBlack: false, key: "s", label: "S" },
  { relSemitone: 3,  isBlack: true,  key: "e", label: "E" },
  { relSemitone: 4,  isBlack: false, key: "d", label: "D" },
  { relSemitone: 5,  isBlack: false, key: "f", label: "F" },
  { relSemitone: 6,  isBlack: true,  key: "t", label: "T" },
  { relSemitone: 7,  isBlack: false, key: "g", label: "G" },
  { relSemitone: 8,  isBlack: true,  key: "y", label: "Y" },
  { relSemitone: 9,  isBlack: false, key: "h", label: "H" },
  { relSemitone: 10, isBlack: true,  key: "u", label: "U" },
  { relSemitone: 11, isBlack: false, key: "j", label: "J" },

  // Octave 2 (Upper)
  { relSemitone: 12, isBlack: false, key: "k", label: "K" },
  { relSemitone: 13, isBlack: true,  key: "o", label: "O" },
  { relSemitone: 14, isBlack: false, key: "l", label: "L" },
  { relSemitone: 15, isBlack: true,  key: "p", label: "P" },
  { relSemitone: 16, isBlack: false, key: ";", label: ";" },
  { relSemitone: 17, isBlack: false, key: "'", label: "'" },
  { relSemitone: 18, isBlack: true,  key: "]", label: "]" },
  { relSemitone: 19, isBlack: false, key: "z", label: "Z" },
  { relSemitone: 20, isBlack: true,  key: "8", label: "8" },
  { relSemitone: 21, isBlack: false, key: "x", label: "X" },
  { relSemitone: 22, isBlack: true,  key: "9", label: "9" },
  { relSemitone: 23, isBlack: false, key: "c", label: "C" }
];

// Instrument Sound Presets
const INSTRUMENTS = {
  grand: {
    name: "Grand Piano",
    description: "Concert Grand with harmonic overtones and soundboard resonance",
    coverIcon: "🎹"
  },
  electric: {
    name: "Electric Piano",
    description: "Rhodes & DX7 FM chime with bell harmonic modulation",
    coverIcon: "⚡"
  },
  soft: {
    name: "Soft Piano",
    description: "Felt acoustic piano with intimate warm low-pass decay",
    coverIcon: "☁️"
  },
  synth: {
    name: "Synth Piano",
    description: "80s Polyphonic Sawtooth Brass with resonant Moog filter",
    coverIcon: "🎛️"
  }
};

// ============================================================================
// 2. APPLICATION STATE
// ============================================================================
const state = {
  audioContext: null,
  masterGain: null,
  compressor: null,
  analyser: null,
  reverbNode: null,
  activeVoices: new Map(), // Map<midiNumber, VoiceObject>

  currentInstrument: "grand",
  activeOctaveWindow: 4, // Default Octave 4 (C4 to B5 is active for typing)
  sustainPedal: false,
  sustainLatch: true,
  masterVolume: 0.8,
  isMuted: false,
  previousVolume: 0.8,
  keyLabelMode: "both", // 'both' | 'keys' | 'notes' | 'off'
  whiteKeyWidth: 38,
  isFitMode: false,
  autoScrollPlaying: true,

  // Metronome State
  isMetronomeOn: false,
  metronomeBpm: 120,
  metronomeNextTime: 0,
  metronomeBeat: 0,
  metronomeTimerId: null,

  // Song Playback (MIDI / Demo)
  currentPlayingSong: null,
  isPlaying: false,
  playbackStartTime: 0,
  playbackPauseOffset: 0,
  playbackTimeouts: [],
  playbackRafId: null,
  isLooping: false,

  // Recording System
  isRecording: false,
  recordingStartTime: 0,
  recordingEvents: [],
  recordings: [],
  recordingInterval: null
};

// ============================================================================
// 3. WEB AUDIO ENGINE (POLYPHONIC SYNTHESIS + SAMPLE READY)
// ============================================================================

function initAudioContext() {
  if (state.audioContext) {
    if (state.audioContext.state === "suspended") {
      state.audioContext.resume();
    }
    return;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  state.audioContext = new AudioCtx();

  // Master Gain
  state.masterGain = state.audioContext.createGain();
  state.masterGain.gain.setValueAtTime(state.masterVolume, state.audioContext.currentTime);

  // Dynamics Compressor to prevent clipping during loud polyphony
  state.compressor = state.audioContext.createDynamicsCompressor();
  state.compressor.threshold.setValueAtTime(-14, state.audioContext.currentTime);
  state.compressor.knee.setValueAtTime(30, state.audioContext.currentTime);
  state.compressor.ratio.setValueAtTime(10, state.audioContext.currentTime);
  state.compressor.attack.setValueAtTime(0.003, state.audioContext.currentTime);
  state.compressor.release.setValueAtTime(0.25, state.audioContext.currentTime);

  // Analyser Node for Visualizer
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 256;
  state.analyser.smoothingTimeConstant = 0.82;

  // Reverb Impulse Convolver
  createReverbImpulse();

  // Graph: Voices -> MasterGain -> Compressor -> Analyser -> Output
  state.masterGain.connect(state.compressor);
  state.compressor.connect(state.analyser);
  state.analyser.connect(state.audioContext.destination);

  startVisualizer();
}

/**
 * Creates a synthetic stereo impulse response for acoustic concert hall reverb
 */
function createReverbImpulse() {
  if (!state.audioContext) return;
  const rate = state.audioContext.sampleRate;
  const length = rate * 1.5;
  const decay = 2.4;
  const impulse = state.audioContext.createBuffer(2, length, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i / length;
    const env = Math.exp(-n * decay);
    left[i] = (Math.random() * 2 - 1) * env;
    right[i] = (Math.random() * 2 - 1) * env;
  }

  state.reverbNode = state.audioContext.createConvolver();
  state.reverbNode.buffer = impulse;

  const reverbGain = state.audioContext.createGain();
  reverbGain.gain.setValueAtTime(0.18, state.audioContext.currentTime);
  state.reverbNode.connect(reverbGain);
  reverbGain.connect(state.masterGain);
}

/**
 * Plays a note voice with high quality physical synthesis
 */
function playNoteVoice(midi, velocity = 0.85) {
  initAudioContext();
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  const ctx = state.audioContext;
  const now = ctx.currentTime;
  const keyInfo = ALL_88_KEYS.find(k => k.midi === midi);
  if (!keyInfo) return;
  const freq = keyInfo.freq;

  // If already active, stop cleanly first
  if (state.activeVoices.has(midi)) {
    stopNoteVoice(midi, true);
  }

  const voiceGain = ctx.createGain();
  const oscillators = [];

  switch (state.currentInstrument) {
    case "grand": {
      // Grand Piano: 3 harmonics, slight unison detuning, hammer strike, lowpass filter
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();

      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, now);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 2, now);
      osc2.detune.setValueAtTime(2.2, now);

      osc3.type = "sine";
      osc3.frequency.setValueAtTime(freq * 3, now);
      osc3.detune.setValueAtTime(-2.2, now);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(freq * 6, 8000), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 600), now + 1.2);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(velocity * 0.9, now + 0.005);
      voiceGain.gain.exponentialRampToValueAtTime(velocity * 0.5, now + 0.8);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

      const g1 = ctx.createGain(); g1.gain.value = 0.7;
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      const g3 = ctx.createGain(); g3.gain.value = 0.12;

      osc1.connect(g1); osc2.connect(g2); osc3.connect(g3);
      g1.connect(filter); g2.connect(filter); g3.connect(filter);
      filter.connect(voiceGain);

      [osc1, osc2, osc3].forEach(osc => { osc.start(now); oscillators.push(osc); });
      break;
    }

    case "electric": {
      // Electric Piano: FM Synthesis chime (carrier + modulator)
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();

      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq, now);

      modulator.type = "sine";
      modulator.frequency.setValueAtTime(freq * 4.0, now);

      modGain.gain.setValueAtTime(freq * 2.2, now);
      modGain.gain.exponentialRampToValueAtTime(1, now + 0.9);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(velocity * 0.78, now + 0.008);
      voiceGain.gain.exponentialRampToValueAtTime(velocity * 0.35, now + 0.6);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

      carrier.connect(voiceGain);
      modulator.start(now);
      carrier.start(now);
      oscillators.push(carrier, modulator);
      break;
    }

    case "soft": {
      // Soft Felt Piano: Warm low-pass cutoff at 700Hz with gentle attack
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, now);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(1.5, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(freq * 3, 750), now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 1.5);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(velocity * 0.82, now + 0.035);
      voiceGain.gain.exponentialRampToValueAtTime(velocity * 0.4, now + 1.0);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);

      osc1.start(now);
      osc2.start(now);
      oscillators.push(osc1, osc2);
      break;
    }

    case "synth": {
      // Synth Piano: Detuned Dual Sawtooth with resonant low-pass filter
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(freq, now);
      osc1.detune.setValueAtTime(-8, now);

      osc2.type = "square";
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(8, now);

      filter.type = "lowpass";
      filter.Q.setValueAtTime(4.0, now);
      filter.frequency.setValueAtTime(3800, now);
      filter.frequency.exponentialRampToValueAtTime(700, now + 0.9);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(velocity * 0.7, now + 0.015);
      voiceGain.gain.exponentialRampToValueAtTime(velocity * 0.35, now + 0.5);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);

      osc1.start(now);
      osc2.start(now);
      oscillators.push(osc1, osc2);
      break;
    }
  }

  voiceGain.connect(state.masterGain);
  if (state.reverbNode) {
    voiceGain.connect(state.reverbNode);
  }

  state.activeVoices.set(midi, {
    gainNode: voiceGain,
    oscillators,
    startTime: now,
    sustained: false
  });
}

function stopNoteVoice(midi, forceImmediate = false) {
  const voice = state.activeVoices.get(midi);
  if (!voice || !state.audioContext) return;

  const ctx = state.audioContext;
  const now = ctx.currentTime;

  if (state.sustainPedal && !forceImmediate) {
    voice.sustained = true;
    return;
  }

  const releaseDuration = 0.18;
  voice.gainNode.gain.cancelScheduledValues(now);
  voice.gainNode.gain.setValueAtTime(Math.max(voice.gainNode.gain.value, 0.0001), now);
  voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseDuration);

  setTimeout(() => {
    try {
      voice.oscillators.forEach(osc => osc.stop());
      voice.gainNode.disconnect();
    } catch {}
    if (state.activeVoices.get(midi) === voice) {
      state.activeVoices.delete(midi);
    }
  }, releaseDuration * 1000 + 40);
}

function releaseSustainedVoices() {
  state.activeVoices.forEach((voice, midi) => {
    if (voice.sustained) {
      stopNoteVoice(midi, true);
    }
  });
}

// ============================================================================
// 4. 88-KEY DOM RENDERING & PIANO INTERACTION
// ============================================================================

function render88PianoKeyboard() {
  const keyboardContainer = document.getElementById("piano-keyboard-88");
  const minimapTrack = document.getElementById("overview-keys-track");
  if (!keyboardContainer || !minimapTrack) return;

  keyboardContainer.innerHTML = "";
  minimapTrack.innerHTML = "";

  // 1. Render White Keys (52 Total)
  const whiteKeys = ALL_88_KEYS.filter(k => !k.isBlack);
  whiteKeys.forEach(k => {
    // Main white key element
    const keyEl = document.createElement("div");
    keyEl.className = "piano-key white-key";
    keyEl.dataset.midi = k.midi;
    keyEl.dataset.note = k.noteName;
    keyEl.dataset.octave = k.octave;

    keyEl.innerHTML = `
      <div class="key-label-wrapper">
        <span class="key-shortcut"></span>
        <span class="key-note">${k.displayName}</span>
      </div>
    `;

    keyboardContainer.appendChild(keyEl);

    // Minimap white key
    const mini = document.createElement("div");
    mini.className = "mini-key";
    mini.dataset.midi = k.midi;
    minimapTrack.appendChild(mini);
  });

  // 2. Render Black Keys (36 Total) with exact boundary alignment
  const blackKeys = ALL_88_KEYS.filter(k => k.isBlack);
  blackKeys.forEach(k => {
    // Find the adjacent white key before this black key
    const prevWhite = whiteKeys.slice().reverse().find(w => w.midi < k.midi);
    const prevWhiteIndex = prevWhite ? prevWhite.whiteIndex : 0;

    // Main black key
    const keyEl = document.createElement("div");
    keyEl.className = "piano-key black-key";
    keyEl.dataset.midi = k.midi;
    keyEl.dataset.note = k.noteName;
    keyEl.dataset.octave = k.octave;

    // Positioning: Center over the right edge of prevWhite
    // In CSS, black key width is approx 60% of white key width
    // Formula: left = ((prevWhiteIndex + 1) * whiteKeyWidth) - (blackKeyWidth / 2)
    keyEl.style.width = `calc(var(--white-key-width) * 0.62)`;
    keyEl.style.left = `calc(${(prevWhiteIndex + 1)} * var(--white-key-width) - (var(--white-key-width) * 0.31))`;

    keyEl.innerHTML = `
      <div class="key-label-wrapper">
        <span class="key-shortcut"></span>
        <span class="key-note">${k.displayName}</span>
      </div>
    `;

    keyboardContainer.appendChild(keyEl);

    // Minimap black key
    const miniBlack = document.createElement("div");
    miniBlack.className = "mini-black-key";
    miniBlack.dataset.midi = k.midi;
    const boundaryPercent = ((prevWhiteIndex + 1) / 52) * 100;
    miniBlack.style.width = `1.2%`;
    miniBlack.style.left = `calc(${boundaryPercent}% - 0.6%)`;
    minimapTrack.appendChild(miniBlack);
  });

  updateActiveOctaveKeyboardLabels();
  setupPianoInputListeners();
  setupMinimapScrubber();
}

/**
 * Updates keyboard shortcut labels and active octave indicator on the 88 keys
 */
function updateActiveOctaveKeyboardLabels() {
  const baseMidiC = 12 * (state.activeOctaveWindow + 1); // C4 = 60

  // Clear previous shortcuts and active-octave styles
  document.querySelectorAll(".piano-key").forEach(k => {
    k.classList.remove("mapped-active-octave");
    const shortcutEl = k.querySelector(".key-shortcut");
    if (shortcutEl) shortcutEl.textContent = "";
  });

  // Map 24 computer keys onto the active window
  COMPUTER_KEY_MAP.forEach(mapItem => {
    const targetMidi = baseMidiC + mapItem.relSemitone;
    if (targetMidi >= 21 && targetMidi <= 108) {
      const keyEl = document.querySelector(`.piano-key[data-midi="${targetMidi}"]`);
      if (keyEl) {
        keyEl.classList.add("mapped-active-octave");
        const shortcutEl = keyEl.querySelector(".key-shortcut");
        if (shortcutEl) shortcutEl.textContent = mapItem.label;
      }
    }
  });

  // Update header and toolbar labels
  const octaveNum = document.getElementById("octave-number");
  const headerOctaveVal = document.getElementById("header-octave-val");
  const baseName = `C${state.activeOctaveWindow} – B${state.activeOctaveWindow + 1}`;
  if (octaveNum) octaveNum.textContent = `Octave ${state.activeOctaveWindow}`;
  if (headerOctaveVal) headerOctaveVal.textContent = baseName;
}

/**
 * Triggers note down on key
 */
function triggerNoteOn(midi, velocity = 0.85, isPlayback = false) {
  const keyEl = document.querySelector(`.piano-key[data-midi="${midi}"]`);
  const miniEl = document.querySelector(`.mini-key[data-midi="${midi}"], .mini-black-key[data-midi="${midi}"]`);

  if (keyEl) keyEl.classList.add("active");
  if (miniEl) miniEl.classList.add("active");

  playNoteVoice(midi, velocity);

  // Recording
  if (state.isRecording && !isPlayback) {
    recordNoteEvent("down", midi, velocity);
  }

  // Auto-scroll piano viewport during playback if key is out of view
  if (isPlayback && state.autoScrollPlaying && keyEl) {
    scrollKeyIntoViewIfNeeded(keyEl);
  }
}

function triggerNoteOff(midi, isPlayback = false) {
  const keyEl = document.querySelector(`.piano-key[data-midi="${midi}"]`);
  const miniEl = document.querySelector(`.mini-key[data-midi="${midi}"], .mini-black-key[data-midi="${midi}"]`);

  if (keyEl) keyEl.classList.remove("active");
  if (miniEl) miniEl.classList.remove("active");

  stopNoteVoice(midi);

  if (state.isRecording && !isPlayback) {
    recordNoteEvent("up", midi, 0);
  }
}

function scrollKeyIntoViewIfNeeded(keyEl) {
  const viewport = document.getElementById("piano-scroll-viewport");
  if (!viewport || state.isFitMode) return;

  const vpRect = viewport.getBoundingClientRect();
  const keyRect = keyEl.getBoundingClientRect();

  if (keyRect.left < vpRect.left + 40 || keyRect.right > vpRect.right - 40) {
    const targetScroll = keyEl.offsetLeft - (viewport.clientWidth / 2) + (keyEl.clientWidth / 2);
    viewport.scrollTo({ left: targetScroll, behavior: "smooth" });
  }
}

/**
 * Mouse & Touch pointer listeners for piano keys (with glissando drag)
 */
function setupPianoInputListeners() {
  const container = document.getElementById("piano-keyboard-88");
  let isPointerDown = false;
  let activeKey = null;

  container.addEventListener("pointerdown", (e) => {
    const key = e.target.closest(".piano-key");
    if (!key) return;
    initAudioContext();
    isPointerDown = true;
    activeKey = key;
    const midi = parseInt(key.dataset.midi, 10);
    triggerNoteOn(midi);
    try { key.setPointerCapture(e.pointerId); } catch {}
  });

  container.addEventListener("pointermove", (e) => {
    if (!isPointerDown) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const key = el ? el.closest(".piano-key") : null;
    if (key && key !== activeKey) {
      if (activeKey) {
        triggerNoteOff(parseInt(activeKey.dataset.midi, 10));
      }
      activeKey = key;
      triggerNoteOn(parseInt(key.dataset.midi, 10));
    }
  });

  const stopPointer = () => {
    if (isPointerDown && activeKey) {
      triggerNoteOff(parseInt(activeKey.dataset.midi, 10));
    }
    isPointerDown = false;
    activeKey = null;
  };

  window.addEventListener("pointerup", stopPointer);
  window.addEventListener("pointercancel", stopPointer);

  // Multi-Touch Support (Chords)
  const activeTouches = new Map();
  container.addEventListener("touchstart", (e) => {
    e.preventDefault();
    initAudioContext();
    Array.from(e.changedTouches).forEach(touch => {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const key = el ? el.closest(".piano-key") : null;
      if (key) {
        const midi = parseInt(key.dataset.midi, 10);
        activeTouches.set(touch.identifier, midi);
        triggerNoteOn(midi);
      }
    });
  }, { passive: false });

  container.addEventListener("touchmove", (e) => {
    e.preventDefault();
    Array.from(e.changedTouches).forEach(touch => {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const key = el ? el.closest(".piano-key") : null;
      const prevMidi = activeTouches.get(touch.identifier);
      if (key) {
        const currMidi = parseInt(key.dataset.midi, 10);
        if (prevMidi !== undefined && prevMidi !== currMidi) {
          triggerNoteOff(prevMidi);
          activeTouches.set(touch.identifier, currMidi);
          triggerNoteOn(currMidi);
        }
      } else if (prevMidi !== undefined) {
        triggerNoteOff(prevMidi);
        activeTouches.delete(touch.identifier);
      }
    });
  }, { passive: false });

  const endTouch = (e) => {
    Array.from(e.changedTouches).forEach(touch => {
      const prevMidi = activeTouches.get(touch.identifier);
      if (prevMidi !== undefined) {
        triggerNoteOff(prevMidi);
        activeTouches.delete(touch.identifier);
      }
    });
  };

  container.addEventListener("touchend", endTouch);
  container.addEventListener("touchcancel", endTouch);
}

/**
 * Minimap overview strip synchronization and drag navigation
 */
function setupMinimapScrubber() {
  const minimap = document.getElementById("piano-overview-strip");
  const handle = document.getElementById("overview-viewport-handle");
  const viewport = document.getElementById("piano-scroll-viewport");
  if (!minimap || !handle || !viewport) return;

  const updateMinimapHandle = () => {
    if (state.isFitMode) {
      handle.style.left = "0%";
      handle.style.width = "100%";
      return;
    }
    const scrollLeft = viewport.scrollLeft;
    const scrollWidth = viewport.scrollWidth;
    const clientWidth = viewport.clientWidth;

    const widthPercent = (clientWidth / scrollWidth) * 100;
    const leftPercent = (scrollLeft / scrollWidth) * 100;

    handle.style.width = `${Math.min(widthPercent, 100)}%`;
    handle.style.left = `${Math.max(0, leftPercent)}%`;
  };

  viewport.addEventListener("scroll", updateMinimapHandle);
  window.addEventListener("resize", updateMinimapHandle);
  setTimeout(updateMinimapHandle, 100);

  // Click / Drag on Minimap
  let isDraggingMinimap = false;

  const handleMinimapSeek = (e) => {
    const rect = minimap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetScroll = ratio * viewport.scrollWidth - (viewport.clientWidth / 2);
    viewport.scrollTo({ left: targetScroll, behavior: "auto" });
  };

  minimap.addEventListener("mousedown", (e) => {
    isDraggingMinimap = true;
    handleMinimapSeek(e);
  });

  window.addEventListener("mousemove", (e) => {
    if (isDraggingMinimap) handleMinimapSeek(e);
  });

  window.addEventListener("mouseup", () => {
    isDraggingMinimap = false;
  });
}

// ============================================================================
// 5. COMPUTER KEYBOARD CONTROLLER
// ============================================================================
const activeComputerKeys = new Set();

function setupKeyboardListeners() {
  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.repeat) return; // Prevent stutter when holding down a key

    const key = e.key;

    // Sustain Pedal: Spacebar
    if (key === " " || key === "Spacebar") {
      e.preventDefault();
      toggleSustainPedal();
      return;
    }

    // Octave Shift: Z (down), X (up)
    if (key.toLowerCase() === "z" && !e.ctrlKey) {
      shiftActiveOctave(-1);
      return;
    }
    if (key.toLowerCase() === "x" && !e.ctrlKey) {
      shiftActiveOctave(1);
      return;
    }

    // Hotkeys: R (Record), P (Play/Pause), M (Metronome), F (Fit)
    if (key.toLowerCase() === "r" && !e.ctrlKey) {
      e.preventDefault();
      toggleRecording();
      return;
    }
    if (key.toLowerCase() === "p" && !e.ctrlKey) {
      e.preventDefault();
      togglePlayback();
      return;
    }
    if (key.toLowerCase() === "m" && !e.ctrlKey) {
      e.preventDefault();
      toggleMetronome();
      return;
    }
    if (key.toLowerCase() === "f" && !e.ctrlKey) {
      e.preventDefault();
      toggleFitFullKeyboard();
      return;
    }

    // Check Computer Key Map
    const mapped = COMPUTER_KEY_MAP.find(m => m.key.toLowerCase() === key.toLowerCase());
    if (mapped) {
      const baseMidiC = 12 * (state.activeOctaveWindow + 1);
      const targetMidi = baseMidiC + mapped.relSemitone;
      if (targetMidi >= 21 && targetMidi <= 108 && !activeComputerKeys.has(targetMidi)) {
        initAudioContext();
        activeComputerKeys.add(targetMidi);
        triggerNoteOn(targetMidi);
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.target.matches("input, textarea, select")) return;

    const key = e.key;

    if ((key === " " || key === "Spacebar") && !state.sustainLatch) {
      setSustainPedal(false);
      return;
    }

    const mapped = COMPUTER_KEY_MAP.find(m => m.key.toLowerCase() === key.toLowerCase());
    if (mapped) {
      const baseMidiC = 12 * (state.activeOctaveWindow + 1);
      const targetMidi = baseMidiC + mapped.relSemitone;
      if (activeComputerKeys.has(targetMidi)) {
        activeComputerKeys.delete(targetMidi);
        triggerNoteOff(targetMidi);
      }
    }
  });

  window.addEventListener("blur", () => {
    activeComputerKeys.forEach(m => triggerNoteOff(m));
    activeComputerKeys.clear();
  });
}

function shiftActiveOctave(delta) {
  const newOctave = state.activeOctaveWindow + delta;
  if (newOctave >= 1 && newOctave <= 6) {
    state.activeOctaveWindow = newOctave;
    updateActiveOctaveKeyboardLabels();

    // Scroll piano to center the new octave
    const baseMidi = 12 * (state.activeOctaveWindow + 1);
    const keyEl = document.querySelector(`.piano-key[data-midi="${baseMidi}"]`);
    if (keyEl) scrollKeyIntoViewIfNeeded(keyEl);
  }
}

// ============================================================================
// 6. DEMO SONG LIBRARY & LIGHTWEIGHT MIDI PARSER
// ============================================================================

// 5 Complete Built-In Demo Sequences (with accurate note timings)
const DEMO_SONGS = [
  {
    id: "fur-elise",
    title: "Für Elise",
    composer: "Ludwig van Beethoven",
    difficulty: "Intermediate",
    duration: 12500,
    coverIcon: "🎼",
    midiFile: "assets/demo-songs/fur-elise.mid",
    notes: [
      { midi: 76, time: 200, dur: 220 },  // E5
      { midi: 75, time: 440, dur: 220 },  // D#5
      { midi: 76, time: 680, dur: 220 },  // E5
      { midi: 75, time: 920, dur: 220 },  // D#5
      { midi: 76, time: 1160, dur: 220 }, // E5
      { midi: 71, time: 1400, dur: 220 }, // B4
      { midi: 74, time: 1640, dur: 220 }, // D5
      { midi: 72, time: 1880, dur: 220 }, // C5
      { midi: 69, time: 2120, dur: 500 }, // A4
      { midi: 57, time: 2120, dur: 500 }, // Bass A3
      { midi: 60, time: 2700, dur: 220 }, // C4
      { midi: 64, time: 2940, dur: 220 }, // E4
      { midi: 69, time: 3180, dur: 220 }, // A4
      { midi: 71, time: 3420, dur: 500 }, // B4
      { midi: 52, time: 3420, dur: 500 }, // Bass E3
      { midi: 64, time: 4000, dur: 220 }, // E4
      { midi: 68, time: 4240, dur: 220 }, // G#4
      { midi: 71, time: 4480, dur: 220 }, // B4
      { midi: 72, time: 4720, dur: 500 }, // C5
      { midi: 57, time: 4720, dur: 500 }, // Bass A3
      { midi: 64, time: 5300, dur: 220 }, // E4
      { midi: 76, time: 5540, dur: 220 }, // E5
      { midi: 75, time: 5780, dur: 220 }, // D#5
      { midi: 76, time: 6020, dur: 220 }, // E5
      { midi: 75, time: 6260, dur: 220 }, // D#5
      { midi: 76, time: 6500, dur: 220 }, // E5
      { midi: 71, time: 6740, dur: 220 }, // B4
      { midi: 74, time: 6980, dur: 220 }, // D5
      { midi: 72, time: 7220, dur: 220 }, // C5
      { midi: 69, time: 7460, dur: 600 }  // A4
    ]
  },
  {
    id: "canon-in-d",
    title: "Canon in D",
    composer: "Johann Pachelbel",
    difficulty: "Intermediate",
    duration: 14000,
    coverIcon: "🎻",
    midiFile: "assets/demo-songs/canon-in-d.mid",
    notes: [
      { midi: 74, time: 300, dur: 600 }, { midi: 50, time: 300, dur: 1200 }, // D5, Bass D3
      { midi: 73, time: 1000, dur: 600 }, { midi: 45, time: 1000, dur: 1200 }, // C#5, Bass A2
      { midi: 71, time: 1700, dur: 600 }, { midi: 47, time: 1700, dur: 1200 }, // B4, Bass B2
      { midi: 69, time: 2400, dur: 600 }, { midi: 42, time: 2400, dur: 1200 }, // A4, Bass F#2
      { midi: 67, time: 3100, dur: 600 }, { midi: 43, time: 3100, dur: 1200 }, // G4, Bass G2
      { midi: 66, time: 3800, dur: 600 }, { midi: 38, time: 3800, dur: 1200 }, // F#4, Bass D2
      { midi: 67, time: 4500, dur: 600 }, { midi: 43, time: 4500, dur: 1200 }, // G4, Bass G2
      { midi: 69, time: 5200, dur: 600 }, { midi: 45, time: 5200, dur: 1200 }, // A4, Bass A2
      { midi: 74, time: 5900, dur: 300 }, { midi: 73, time: 6250, dur: 300 },
      { midi: 71, time: 6600, dur: 300 }, { midi: 69, time: 6950, dur: 300 },
      { midi: 67, time: 7300, dur: 300 }, { midi: 66, time: 7650, dur: 300 },
      { midi: 67, time: 8000, dur: 300 }, { midi: 69, time: 8350, dur: 600 }
    ]
  },
  {
    id: "happy-birthday",
    title: "Happy Birthday",
    composer: "Traditional",
    difficulty: "Beginner",
    duration: 9500,
    coverIcon: "🎂",
    midiFile: "assets/demo-songs/happy-birthday.mid",
    notes: [
      { midi: 60, time: 200, dur: 250 }, { midi: 60, time: 500, dur: 200 },
      { midi: 62, time: 750, dur: 450 }, { midi: 60, time: 1250, dur: 450 },
      { midi: 65, time: 1750, dur: 450 }, { midi: 64, time: 2250, dur: 850 },
      { midi: 60, time: 3200, dur: 250 }, { midi: 60, time: 3500, dur: 200 },
      { midi: 62, time: 3750, dur: 450 }, { midi: 60, time: 4250, dur: 450 },
      { midi: 67, time: 4750, dur: 450 }, { midi: 65, time: 5250, dur: 850 },
      { midi: 60, time: 6200, dur: 250 }, { midi: 60, time: 6500, dur: 200 },
      { midi: 72, time: 6750, dur: 450 }, { midi: 69, time: 7250, dur: 450 },
      { midi: 65, time: 7750, dur: 450 }, { midi: 64, time: 8250, dur: 450 },
      { midi: 62, time: 8750, dur: 600 }
    ]
  },
  {
    id: "twinkle-twinkle",
    title: "Twinkle Twinkle Little Star",
    composer: "W. A. Mozart / Traditional",
    difficulty: "Beginner",
    duration: 9000,
    coverIcon: "⭐",
    midiFile: "assets/demo-songs/twinkle-twinkle.mid",
    notes: [
      { midi: 60, time: 200, dur: 400 }, { midi: 60, time: 650, dur: 400 },
      { midi: 67, time: 1100, dur: 400 }, { midi: 67, time: 1550, dur: 400 },
      { midi: 69, time: 2000, dur: 400 }, { midi: 69, time: 2450, dur: 400 },
      { midi: 67, time: 2900, dur: 800 },
      { midi: 65, time: 3800, dur: 400 }, { midi: 65, time: 4250, dur: 400 },
      { midi: 64, time: 4700, dur: 400 }, { midi: 64, time: 5150, dur: 400 },
      { midi: 62, time: 5600, dur: 400 }, { midi: 62, time: 6050, dur: 400 },
      { midi: 60, time: 6500, dur: 850 }
    ]
  },
  {
    id: "jingle-bells",
    title: "Jingle Bells",
    composer: "James Lord Pierpont",
    difficulty: "Beginner",
    duration: 8500,
    coverIcon: "🔔",
    midiFile: "assets/demo-songs/jingle-bells.mid",
    notes: [
      { midi: 64, time: 200, dur: 220 }, { midi: 64, time: 460, dur: 220 }, { midi: 64, time: 720, dur: 450 },
      { midi: 64, time: 1250, dur: 220 }, { midi: 64, time: 1510, dur: 220 }, { midi: 64, time: 1770, dur: 450 },
      { midi: 64, time: 2300, dur: 220 }, { midi: 67, time: 2560, dur: 220 }, { midi: 60, time: 2820, dur: 320 },
      { midi: 62, time: 3180, dur: 150 }, { midi: 64, time: 3370, dur: 850 },
      { midi: 65, time: 4300, dur: 220 }, { midi: 65, time: 4560, dur: 220 }, { midi: 65, time: 4820, dur: 320 },
      { midi: 65, time: 5180, dur: 150 }, { midi: 65, time: 5370, dur: 220 }, { midi: 64, time: 5630, dur: 220 },
      { midi: 64, time: 5890, dur: 220 }, { midi: 67, time: 6150, dur: 220 }, { midi: 67, time: 6410, dur: 220 },
      { midi: 65, time: 6670, dur: 220 }, { midi: 62, time: 6930, dur: 220 }, { midi: 60, time: 7190, dur: 900 }
    ]
  }
];

/**
 * Lightweight Standard MIDI File (SMF) Parser
 * Decodes .mid binary ArrayBuffer into note events
 */
function parseMidiFile(arrayBuffer) {
  const data = new DataView(arrayBuffer);
  let pos = 0;

  // Header chunk check: 'MThd' (0x4D546864)
  const headerTag = String.fromCharCode(data.getUint8(pos), data.getUint8(pos + 1), data.getUint8(pos + 2), data.getUint8(pos + 3));
  if (headerTag !== "MThd") {
    throw new Error("Invalid MIDI: missing MThd chunk");
  }
  pos += 4;
  const headerLen = data.getUint32(pos); pos += 4;
  const format = data.getUint16(pos); pos += 2;
  const numTracks = data.getUint16(pos); pos += 2;
  const division = data.getUint16(pos); pos += 2;
  pos += (headerLen - 6); // skip extra header bytes if any

  let tempoBpm = 120;
  let microsecPerBeat = 500000;
  const noteEvents = [];

  for (let t = 0; t < numTracks; t++) {
    if (pos >= data.byteLength) break;
    const trackTag = String.fromCharCode(data.getUint8(pos), data.getUint8(pos + 1), data.getUint8(pos + 2), data.getUint8(pos + 3));
    pos += 4;
    const trackLen = data.getUint32(pos); pos += 4;
    const trackEnd = pos + trackLen;

    let currentTick = 0;
    let lastStatus = 0;
    const activeNotes = new Map(); // Map<note, startTick>

    while (pos < trackEnd && pos < data.byteLength) {
      // Variable-length delta time
      let delta = 0;
      while (true) {
        const b = data.getUint8(pos++);
        delta = (delta << 7) | (b & 0x7F);
        if (!(b & 0x80)) break;
      }
      currentTick += delta;

      let status = data.getUint8(pos);
      if (status >= 0x80) {
        pos++;
        lastStatus = status;
      } else {
        status = lastStatus; // running status
      }

      if (status === 0xFF) {
        // Meta Event
        const metaType = data.getUint8(pos++);
        let metaLen = 0;
        while (true) {
          const b = data.getUint8(pos++);
          metaLen = (metaLen << 7) | (b & 0x7F);
          if (!(b & 0x80)) break;
        }
        if (metaType === 0x51 && metaLen === 3) {
          // Set Tempo: 3 bytes microseconds per quarter note
          microsecPerBeat = (data.getUint8(pos) << 16) | (data.getUint8(pos + 1) << 8) | data.getUint8(pos + 2);
          tempoBpm = Math.round(60000000 / microsecPerBeat);
        }
        pos += metaLen;
      } else if (status === 0xF0 || status === 0xF7) {
        // SysEx
        let sysLen = 0;
        while (true) {
          const b = data.getUint8(pos++);
          sysLen = (sysLen << 7) | (b & 0x7F);
          if (!(b & 0x80)) break;
        }
        pos += sysLen;
      } else {
        // Channel Message
        const msgType = status & 0xF0;
        if (msgType === 0x90) { // Note On
          const note = data.getUint8(pos++);
          const velocity = data.getUint8(pos++);
          if (velocity > 0) {
            activeNotes.set(note, currentTick);
          } else {
            // Velocity 0 is Note Off
            const startTick = activeNotes.get(note);
            if (startTick !== undefined) {
              const durTicks = currentTick - startTick;
              noteEvents.push({ midi: note, tick: startTick, durTicks, velocity: 85 });
              activeNotes.delete(note);
            }
          }
        } else if (msgType === 0x80) { // Note Off
          const note = data.getUint8(pos++);
          pos++; // skip velocity
          const startTick = activeNotes.get(note);
          if (startTick !== undefined) {
            const durTicks = currentTick - startTick;
            noteEvents.push({ midi: note, tick: startTick, durTicks, velocity: 85 });
            activeNotes.delete(note);
          }
        } else if (msgType === 0xC0 || msgType === 0xD0) {
          pos += 1;
        } else {
          pos += 2;
        }
      }
    }
  }

  // Convert ticks to milliseconds
  const ticksPerBeat = division || 480;
  const msPerTick = (microsecPerBeat / 1000) / ticksPerBeat;

  const finalNotes = noteEvents.map(e => ({
    midi: e.midi,
    time: Math.round(e.tick * msPerTick),
    dur: Math.max(Math.round(e.durTicks * msPerTick), 150),
    velocity: 0.85
  }));

  finalNotes.sort((a, b) => a.time - b.time);
  return finalNotes;
}

// Render Demo Songs into UI
function renderDemoSongs() {
  const cardsContainer = document.getElementById("demo-songs-cards-container");
  const tableBody = document.getElementById("demo-songs-table-body");
  const sidebarList = document.getElementById("sidebar-tracks-list");

  if (cardsContainer) cardsContainer.innerHTML = "";
  if (tableBody) tableBody.innerHTML = "";
  if (sidebarList) sidebarList.innerHTML = "";

  DEMO_SONGS.forEach((song, idx) => {
    // 1. Grid Card
    if (cardsContainer) {
      const card = document.createElement("div");
      card.className = "song-card";
      card.dataset.id = song.id;
      card.innerHTML = `
        <div class="song-card-cover">
          <span class="cover-art-inner">${song.coverIcon}</span>
          <button class="btn-card-play" title="Play ${song.title}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
        <div class="song-card-title">${escapeHtml(song.title)}</div>
        <div class="song-card-meta">
          <span>${escapeHtml(song.composer)}</span>
          <span class="difficulty-badge ${song.difficulty.toLowerCase()}">${song.difficulty}</span>
        </div>
      `;

      card.addEventListener("click", () => {
        playSelectedSong(song);
      });

      cardsContainer.appendChild(card);
    }

    // 2. Table Row
    if (tableBody) {
      const row = document.createElement("tr");
      row.className = "song-table-row";
      row.dataset.id = song.id;
      row.innerHTML = `
        <td style="color: #727272;">${idx + 1}</td>
        <td style="font-weight: 700;">${escapeHtml(song.title)}</td>
        <td style="color: #b3b3b3;">${escapeHtml(song.composer)}</td>
        <td><span class="difficulty-badge ${song.difficulty.toLowerCase()}">${song.difficulty}</span></td>
        <td style="color: #727272;">${formatTime(song.duration / 1000)}</td>
        <td style="text-align: right;">
          <button class="btn-spotify-secondary" style="padding: 6px 14px; font-size: 12px;">Play</button>
        </td>
      `;

      row.addEventListener("click", () => {
        playSelectedSong(song);
      });

      tableBody.appendChild(row);
    }

    // 3. Sidebar Quick Item
    if (sidebarList) {
      const sItem = document.createElement("div");
      sItem.className = "sidebar-track-item";
      sItem.dataset.id = song.id;
      sItem.innerHTML = `
        <div class="sidebar-track-info">
          <span class="sidebar-track-title">${escapeHtml(song.title)}</span>
          <span class="sidebar-track-sub">${escapeHtml(song.composer)}</span>
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="color: #727272;">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;

      sItem.addEventListener("click", () => {
        playSelectedSong(song);
      });

      sidebarList.appendChild(sItem);
    }
  });
}

function playSelectedSong(song) {
  initAudioContext();
  loadSongIntoPlayer(song);
  startPlayback();
}

function loadSongIntoPlayer(song) {
  state.currentPlayingSong = song;

  const trackTitle = document.getElementById("player-track-title");
  const trackSubtitle = document.getElementById("player-track-subtitle");
  const totalTimeEl = document.getElementById("playback-total-time");
  const curTimeEl = document.getElementById("playback-current-time");
  const progressFill = document.getElementById("player-progress-fill");

  if (trackTitle) trackTitle.textContent = song.title;
  if (trackSubtitle) trackSubtitle.textContent = `${song.composer} • VirtualKeys MIDI`;
  if (totalTimeEl) totalTimeEl.textContent = formatTime(song.duration / 1000);
  if (curTimeEl) curTimeEl.textContent = "0:00";
  if (progressFill) progressFill.style.width = "0%";

  // Highlight active card / row
  document.querySelectorAll(".song-card, .song-table-row, .sidebar-track-item").forEach(el => {
    el.classList.toggle("playing", el.dataset.id === song.id);
  });

  stopPlayback();
}

// ============================================================================
// 7. SONG PLAYBACK ENGINE
// ============================================================================

function togglePlayback() {
  if (!state.currentPlayingSong) {
    if (DEMO_SONGS.length > 0) {
      loadSongIntoPlayer(DEMO_SONGS[0]);
    } else {
      return;
    }
  }

  initAudioContext();
  if (state.isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  if (!state.currentPlayingSong) return;
  if (state.isRecording) stopRecording();

  state.isPlaying = true;
  updatePlayButtonUI(true);

  const song = state.currentPlayingSong;
  const startOffset = state.playbackPauseOffset;
  state.playbackStartTime = performance.now() - startOffset;

  clearPlaybackSchedules();

  // Schedule each note
  song.notes.forEach(noteItem => {
    if (noteItem.time >= startOffset) {
      const delay = noteItem.time - startOffset;
      const tidDown = setTimeout(() => {
        if (!state.isPlaying) return;
        triggerNoteOn(noteItem.midi, noteItem.velocity || 0.85, true);
      }, delay);
      state.playbackTimeouts.push(tidDown);

      const tidUp = setTimeout(() => {
        if (!state.isPlaying) return;
        triggerNoteOff(noteItem.midi, true);
      }, delay + noteItem.dur);
      state.playbackTimeouts.push(tidUp);
    }
  });

  // End of song callback
  const remainingTotal = Math.max(song.duration - startOffset, 0);
  const endTid = setTimeout(() => {
    if (state.isLooping) {
      state.playbackPauseOffset = 0;
      startPlayback();
    } else {
      stopPlayback();
    }
  }, remainingTotal + 200);
  state.playbackTimeouts.push(endTid);

  animatePlaybackTimeline();
}

function pausePlayback() {
  state.isPlaying = false;
  state.playbackPauseOffset = performance.now() - state.playbackStartTime;
  clearPlaybackSchedules();
  releaseAllKeysVisual();
  updatePlayButtonUI(false);
  if (state.playbackRafId) cancelAnimationFrame(state.playbackRafId);
}

function stopPlayback() {
  state.isPlaying = false;
  state.playbackPauseOffset = 0;
  clearPlaybackSchedules();
  releaseAllKeysVisual();
  updatePlayButtonUI(false);
  if (state.playbackRafId) cancelAnimationFrame(state.playbackRafId);

  const curTimeEl = document.getElementById("playback-current-time");
  const progressFill = document.getElementById("player-progress-fill");
  const scrubber = document.getElementById("player-progress-scrubber");
  if (curTimeEl) curTimeEl.textContent = "0:00";
  if (progressFill) progressFill.style.width = "0%";
  if (scrubber) scrubber.style.left = "0%";
}

function clearPlaybackSchedules() {
  state.playbackTimeouts.forEach(t => clearTimeout(t));
  state.playbackTimeouts = [];
}

function releaseAllKeysVisual() {
  ALL_88_KEYS.forEach(k => triggerNoteOff(k.midi, true));
}

function animatePlaybackTimeline() {
  if (!state.isPlaying || !state.currentPlayingSong) return;

  const elapsed = performance.now() - state.playbackStartTime;
  const duration = state.currentPlayingSong.duration;
  const progress = Math.min(elapsed / duration, 1);

  const curTimeEl = document.getElementById("playback-current-time");
  const progressFill = document.getElementById("player-progress-fill");
  const scrubber = document.getElementById("player-progress-scrubber");

  if (curTimeEl) curTimeEl.textContent = formatTime(elapsed / 1000);
  if (progressFill) progressFill.style.width = `${progress * 100}%`;
  if (scrubber) scrubber.style.left = `${progress * 100}%`;

  if (progress < 1) {
    state.playbackRafId = requestAnimationFrame(animatePlaybackTimeline);
  }
}

function updatePlayButtonUI(isPlaying) {
  const playIcon = document.getElementById("play-icon");
  const pauseIcon = document.getElementById("pause-icon");
  if (playIcon && pauseIcon) {
    playIcon.style.display = isPlaying ? "none" : "block";
    pauseIcon.style.display = isPlaying ? "block" : "none";
  }
}

function playNextSong() {
  if (!state.currentPlayingSong) {
    loadSongIntoPlayer(DEMO_SONGS[0]);
    startPlayback();
    return;
  }
  const currIdx = DEMO_SONGS.findIndex(s => s.id === state.currentPlayingSong.id);
  const nextIdx = (currIdx + 1) % DEMO_SONGS.length;
  loadSongIntoPlayer(DEMO_SONGS[nextIdx]);
  startPlayback();
}

function playPrevSong() {
  if (!state.currentPlayingSong) return;
  const currIdx = DEMO_SONGS.findIndex(s => s.id === state.currentPlayingSong.id);
  const prevIdx = (currIdx - 1 + DEMO_SONGS.length) % DEMO_SONGS.length;
  loadSongIntoPlayer(DEMO_SONGS[prevIdx]);
  startPlayback();
}

// ============================================================================
// 8. RECORDING SYSTEM (LOCALSTORAGE)
// ============================================================================

function recordNoteEvent(type, midi, velocity) {
  if (!state.isRecording) return;
  const elapsed = performance.now() - state.recordingStartTime;
  state.recordingEvents.push({
    type, // 'down' or 'up'
    midi,
    velocity: velocity || 0.85,
    time: Math.round(elapsed)
  });
}

function toggleRecording() {
  initAudioContext();
  if (!state.isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
}

function startRecording() {
  if (state.isPlaying) stopPlayback();

  state.isRecording = true;
  state.recordingStartTime = performance.now();
  state.recordingEvents = [];

  updateRecordingUI(true);

  const curTimeEl = document.getElementById("playback-current-time");
  state.recordingInterval = setInterval(() => {
    const elapsedMs = performance.now() - state.recordingStartTime;
    if (curTimeEl) curTimeEl.textContent = formatTime(elapsedMs / 1000);
  }, 100);
}

function stopRecording() {
  if (!state.isRecording) return;

  state.isRecording = false;
  clearInterval(state.recordingInterval);
  updateRecordingUI(false);

  const durationMs = performance.now() - state.recordingStartTime;
  if (state.recordingEvents.length === 0) return;

  // Process raw down/up events into structured note durations
  const processedNotes = [];
  const downMap = new Map();

  state.recordingEvents.forEach(evt => {
    if (evt.type === "down") {
      downMap.set(evt.midi, { time: evt.time, velocity: evt.velocity });
    } else if (evt.type === "up") {
      const downInfo = downMap.get(evt.midi);
      if (downInfo) {
        processedNotes.push({
          midi: evt.midi,
          time: downInfo.time,
          dur: Math.max(evt.time - downInfo.time, 150),
          velocity: downInfo.velocity
        });
        downMap.delete(evt.midi);
      }
    }
  });

  // Handle any notes still down when stopped
  downMap.forEach((downInfo, midi) => {
    processedNotes.push({
      midi,
      time: downInfo.time,
      dur: Math.max(durationMs - downInfo.time, 200),
      velocity: downInfo.velocity
    });
  });

  processedNotes.sort((a, b) => a.time - b.time);

  const newSession = {
    id: "rec_" + Date.now(),
    title: `Piano Recording #${state.recordings.length + 1}`,
    composer: "User Performance",
    timestamp: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    duration: Math.max(Math.round(durationMs), 500),
    instrument: INSTRUMENTS[state.currentInstrument].name,
    notes: processedNotes
  };

  state.recordings.unshift(newSession);
  saveRecordingsToStorage();
  renderRecordingsList();

  // Load into player so user can immediately listen
  loadSongIntoPlayer(newSession);
}

function updateRecordingUI(isRec) {
  const headerRecBtn = document.getElementById("btn-header-record");
  const headerRecText = document.getElementById("header-rec-text");
  const playerRecBtn = document.getElementById("btn-player-record");

  if (headerRecBtn) headerRecBtn.classList.toggle("recording", isRec);
  if (headerRecText) headerRecText.textContent = isRec ? "Stop" : "Record";
  if (playerRecBtn) playerRecBtn.classList.toggle("recording", isRec);
}

function saveRecordingsToStorage() {
  try {
    localStorage.setItem("virtualkeys_88_recordings", JSON.stringify(state.recordings));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

function loadRecordingsFromStorage() {
  try {
    const raw = localStorage.getItem("virtualkeys_88_recordings");
    if (raw) {
      state.recordings = JSON.parse(raw);
    }
  } catch {
    state.recordings = [];
  }
  renderRecordingsList();
}

function renderRecordingsList() {
  const container = document.getElementById("recordings-list-container");
  const countBadge = document.getElementById("recordings-count-badge");
  if (countBadge) countBadge.textContent = state.recordings.length;
  if (!container) return;

  container.innerHTML = "";

  if (state.recordings.length === 0) {
    container.innerHTML = `<div style="color: #727272; font-size: 13px; padding: 20px 0; text-align: center;">No recorded sessions yet. Click the red Record button to capture your piano playing!</div>`;
    return;
  }

  state.recordings.forEach((rec, idx) => {
    const row = document.createElement("div");
    row.className = "rec-item-row";
    row.innerHTML = `
      <div class="rec-left-info">
        <div class="rec-badge-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
        </div>
        <div>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(rec.title)}</div>
          <div style="font-size: 11px; color: #727272;">${rec.timestamp} • ${formatTime(rec.duration / 1000)} • ${escapeHtml(rec.instrument)}</div>
        </div>
      </div>
      <div class="rec-actions-group">
        <button class="btn-spotify-secondary btn-play-rec" style="padding: 6px 16px; font-size: 12px;">Play</button>
        <button class="btn-icon-subtle btn-delete-rec" title="Delete" style="color: #e22134;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>
    `;

    row.querySelector(".btn-play-rec").addEventListener("click", () => {
      loadSongIntoPlayer(rec);
      startPlayback();
    });

    row.querySelector(".btn-delete-rec").addEventListener("click", () => {
      deleteRecording(rec.id);
    });

    container.appendChild(row);
  });
}

function deleteRecording(id) {
  state.recordings = state.recordings.filter(r => r.id !== id);
  saveRecordingsToStorage();
  renderRecordingsList();
  if (state.currentPlayingSong && state.currentPlayingSong.id === id) {
    stopPlayback();
    state.currentPlayingSong = null;
  }
}

// ============================================================================
// 9. REAL-TIME CANVAS AUDIO VISUALIZER
// ============================================================================

function startVisualizer() {
  const canvas = document.getElementById("visualizer-canvas");
  if (!canvas || !state.analyser) return;
  const ctx = canvas.getContext("2d");

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  };

  resize();
  window.addEventListener("resize", resize);

  const bufferLength = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  let idlePhase = 0;

  function draw() {
    requestAnimationFrame(draw);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    state.analyser.getByteFrequencyData(dataArray);

    let energy = 0;
    for (let i = 0; i < bufferLength; i++) energy += dataArray[i];
    const isAudible = energy > 50;

    const barCount = 64;
    const barSpacing = 4;
    const barWidth = Math.max((width - (barCount - 1) * barSpacing) / barCount, 2);

    for (let i = 0; i < barCount; i++) {
      let barHeight;
      if (isAudible) {
        const binIndex = Math.floor((i / barCount) * (bufferLength * 0.7));
        barHeight = (dataArray[binIndex] / 255) * (height - 12) + 4;
      } else {
        idlePhase += 0.0006;
        const wave = Math.sin(idlePhase * 4 + i * 0.2) * 0.5 + 0.5;
        barHeight = 4 + wave * 8;
      }

      const x = i * (barWidth + barSpacing);
      const y = height - barHeight;

      const grad = ctx.createLinearGradient(0, y, 0, height);
      grad.addColorStop(0, "#1ed760");
      grad.addColorStop(0.6, "#1DB954");
      grad.addColorStop(1, "#0d5926");

      ctx.fillStyle = grad;
      ctx.shadowBlur = isAudible ? 8 : 0;
      ctx.shadowColor = "#1DB954";

      // Rounded rectangle
      const radius = Math.min(barWidth / 2, 4);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + height);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  draw();
}

// ============================================================================
// 10. METRONOME ENGINE
// ============================================================================

function toggleMetronome() {
  initAudioContext();
  state.isMetronomeOn = !state.isMetronomeOn;

  const metroBtn = document.getElementById("btn-player-metro");
  if (metroBtn) metroBtn.classList.toggle("active", state.isMetronomeOn);

  if (state.isMetronomeOn) {
    state.metronomeBeat = 0;
    state.metronomeNextTime = state.audioContext.currentTime + 0.05;
    runMetronomeSchedule();
  } else {
    clearTimeout(state.metronomeTimerId);
  }
}

function runMetronomeSchedule() {
  if (!state.isMetronomeOn || !state.audioContext) return;

  while (state.metronomeNextTime < state.audioContext.currentTime + 0.1) {
    scheduleMetroTick(state.metronomeNextTime, state.metronomeBeat % 4 === 0);
    const secsPerBeat = 60.0 / state.metronomeBpm;
    state.metronomeNextTime += secsPerBeat;
    state.metronomeBeat++;
  }

  state.metronomeTimerId = setTimeout(runMetronomeSchedule, 25);
}

function scheduleMetroTick(time, isAccent) {
  const osc = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(isAccent ? 1000 : 600, time);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(isAccent ? 0.35 : 0.2, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

  osc.connect(gain);
  gain.connect(state.masterGain);

  osc.start(time);
  osc.stop(time + 0.05);

  const delayMs = Math.max((time - state.audioContext.currentTime) * 1000, 0);
  setTimeout(() => {
    const dot = document.getElementById("metronome-beat-dot");
    if (dot) {
      dot.classList.add("flash");
      setTimeout(() => dot.classList.remove("flash"), 90);
    }
  }, delayMs);
}

// ============================================================================
// 11. SUSTAIN PEDAL & ZOOM CONTROLS
// ============================================================================

function toggleSustainPedal() {
  setSustainPedal(!state.sustainPedal);
}

function setSustainPedal(isActive) {
  state.sustainPedal = isActive;
  const sustainBtn = document.getElementById("btn-player-sustain");
  if (sustainBtn) sustainBtn.classList.toggle("active", isActive);

  if (!isActive) releaseSustainedVoices();
}

function setZoomLevel(newWidth) {
  state.isFitMode = false;
  state.whiteKeyWidth = Math.max(18, Math.min(newWidth, 54));
  document.documentElement.style.setProperty("--white-key-width", `${state.whiteKeyWidth}px`);
  document.getElementById("piano-stage-container").classList.remove("fit-mode");
  document.getElementById("btn-fit-full-keyboard").classList.remove("active");

  // Re-adjust black key positions
  recalculateBlackKeyPositions();
}

function toggleFitFullKeyboard() {
  state.isFitMode = !state.isFitMode;
  const stage = document.getElementById("piano-stage-container");
  const fitBtn = document.getElementById("btn-fit-full-keyboard");

  if (state.isFitMode) {
    stage.classList.add("fit-mode");
    fitBtn.classList.add("active");
  } else {
    stage.classList.remove("fit-mode");
    fitBtn.classList.remove("active");
  }

  recalculateBlackKeyPositions();
}

function recalculateBlackKeyPositions() {
  const whiteKeys = ALL_88_KEYS.filter(k => !k.isBlack);
  const blackKeys = ALL_88_KEYS.filter(k => k.isBlack);

  blackKeys.forEach(k => {
    const prevWhite = whiteKeys.slice().reverse().find(w => w.midi < k.midi);
    const prevWhiteIndex = prevWhite ? prevWhite.whiteIndex : 0;
    const keyEl = document.querySelector(`.piano-key.black-key[data-midi="${k.midi}"]`);

    if (keyEl) {
      if (state.isFitMode) {
        const boundaryPercent = ((prevWhiteIndex + 1) / 52) * 100;
        keyEl.style.width = `1.2%`;
        keyEl.style.left = `calc(${boundaryPercent}% - 0.6%)`;
      } else {
        keyEl.style.width = `calc(var(--white-key-width) * 0.62)`;
        keyEl.style.left = `calc(${(prevWhiteIndex + 1)} * var(--white-key-width) - (var(--white-key-width) * 0.31))`;
      }
    }
  });
}

// ============================================================================
// 12. UI CONTROLS & EVENT BINDINGS
// ============================================================================

function setupUIBindings() {
  // Unlock Audio Button
  const unlockBtn = document.getElementById("btn-unlock-audio");
  const overlay = document.getElementById("audio-init-overlay");
  if (unlockBtn && overlay) {
    unlockBtn.addEventListener("click", () => {
      initAudioContext();
      overlay.classList.add("hidden");
    });
  }

  // Instrument Pills
  const instrumentPills = document.querySelectorAll("#instrument-pills .pill-btn");
  instrumentPills.forEach(pill => {
    pill.addEventListener("click", () => {
      instrumentPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const key = pill.dataset.sound;
      state.currentInstrument = key;

      const headerName = document.getElementById("header-instrument-name");
      const trackTitle = document.getElementById("player-track-title");
      if (headerName) headerName.textContent = INSTRUMENTS[key].name;
      if (trackTitle && !state.isPlaying) {
        trackTitle.textContent = INSTRUMENTS[key].name;
      }
    });
  });

  // Octave Shift Buttons
  const btnOctDown = document.getElementById("btn-octave-down");
  const btnOctUp = document.getElementById("btn-octave-up");
  if (btnOctDown) btnOctDown.addEventListener("click", () => shiftActiveOctave(-1));
  if (btnOctUp) btnOctUp.addEventListener("click", () => shiftActiveOctave(1));

  // Zoom Controls
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnFit = document.getElementById("btn-fit-full-keyboard");
  if (btnZoomIn) btnZoomIn.addEventListener("click", () => setZoomLevel(state.whiteKeyWidth + 6));
  if (btnZoomOut) btnZoomOut.addEventListener("click", () => setZoomLevel(state.whiteKeyWidth - 6));
  if (btnFit) btnFit.addEventListener("click", toggleFitFullKeyboard);

  // Piano Viewport Quick Jump Buttons
  const btnScrollLeft = document.getElementById("btn-scroll-piano-left");
  const btnScrollMiddle = document.getElementById("btn-scroll-piano-middle");
  const btnScrollRight = document.getElementById("btn-scroll-piano-right");
  const viewport = document.getElementById("piano-scroll-viewport");

  if (btnScrollLeft && viewport) {
    btnScrollLeft.addEventListener("click", () => viewport.scrollTo({ left: 0, behavior: "smooth" }));
  }
  if (btnScrollMiddle && viewport) {
    btnScrollMiddle.addEventListener("click", () => {
      const middleC = document.querySelector(`.piano-key[data-midi="60"]`);
      if (middleC) scrollKeyIntoViewIfNeeded(middleC);
    });
  }
  if (btnScrollRight && viewport) {
    btnScrollRight.addEventListener("click", () => viewport.scrollTo({ left: viewport.scrollWidth, behavior: "smooth" }));
  }

  // Key Labels Toggle
  const labelButtons = document.querySelectorAll(".pill-switch-btn[data-mode]");
  const pianoKeyboard = document.getElementById("piano-keyboard-88");
  labelButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      labelButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.mode;
      state.keyLabelMode = mode;

      if (pianoKeyboard) {
        pianoKeyboard.classList.remove("hide-notes", "hide-keys", "hide-all");
        if (mode === "keys") pianoKeyboard.classList.add("hide-notes");
        if (mode === "notes") pianoKeyboard.classList.add("hide-keys");
        if (mode === "off") pianoKeyboard.classList.add("hide-all");
      }
    });
  });

  // Banner Action Buttons
  const btnBannerPlay = document.getElementById("btn-banner-play-piano");
  const btnBannerDemo = document.getElementById("btn-banner-demo-list");
  if (btnBannerPlay) {
    btnBannerPlay.addEventListener("click", () => {
      initAudioContext();
      document.getElementById("piano-stage-container").scrollIntoView({ behavior: "smooth" });
    });
  }
  if (btnBannerDemo) {
    btnBannerDemo.addEventListener("click", () => {
      document.getElementById("demo-songs-section").scrollIntoView({ behavior: "smooth" });
    });
  }

  // Player Controls
  const btnPlay = document.getElementById("btn-player-play");
  const btnStop = document.getElementById("btn-player-stop");
  const btnPrev = document.getElementById("btn-player-prev");
  const btnNext = document.getElementById("btn-player-next");
  const btnShuffle = document.getElementById("btn-player-shuffle");
  const btnLoop = document.getElementById("btn-player-loop");
  const btnPlayerRecord = document.getElementById("btn-player-record");
  const btnHeaderRecord = document.getElementById("btn-header-record");
  const btnPlayerSustain = document.getElementById("btn-player-sustain");
  const btnPlayerMetro = document.getElementById("btn-player-metro");
  const btnFavorite = document.getElementById("btn-player-favorite");

  if (btnPlay) btnPlay.addEventListener("click", togglePlayback);
  if (btnStop) btnStop.addEventListener("click", stopPlayback);
  if (btnPrev) btnPrev.addEventListener("click", playPrevSong);
  if (btnNext) btnNext.addEventListener("click", playNextSong);
  if (btnShuffle) {
    btnShuffle.addEventListener("click", () => {
      const randIdx = Math.floor(Math.random() * DEMO_SONGS.length);
      loadSongIntoPlayer(DEMO_SONGS[randIdx]);
      startPlayback();
    });
  }
  if (btnLoop) {
    btnLoop.addEventListener("click", () => {
      state.isLooping = !state.isLooping;
      btnLoop.classList.toggle("active", state.isLooping);
    });
  }
  if (btnPlayerRecord) btnPlayerRecord.addEventListener("click", toggleRecording);
  if (btnHeaderRecord) btnHeaderRecord.addEventListener("click", toggleRecording);
  if (btnPlayerSustain) btnPlayerSustain.addEventListener("click", toggleSustainPedal);
  if (btnPlayerMetro) btnPlayerMetro.addEventListener("click", toggleMetronome);
  if (btnFavorite) {
    btnFavorite.addEventListener("click", () => {
      btnFavorite.classList.toggle("liked");
    });
  }

  // Scrubber / Progress Bar
  const progressContainer = document.getElementById("player-progress-container");
  if (progressContainer) {
    progressContainer.addEventListener("click", (e) => {
      if (!state.currentPlayingSong) return;
      const rect = progressContainer.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTimeMs = ratio * state.currentPlayingSong.duration;

      state.playbackPauseOffset = targetTimeMs;
      if (state.isPlaying) {
        startPlayback();
      } else {
        const curTimeEl = document.getElementById("playback-current-time");
        const progressFill = document.getElementById("player-progress-fill");
        const scrubber = document.getElementById("player-progress-scrubber");
        if (curTimeEl) curTimeEl.textContent = formatTime(targetTimeMs / 1000);
        if (progressFill) progressFill.style.width = `${ratio * 100}%`;
        if (scrubber) scrubber.style.left = `${ratio * 100}%`;
      }
    });
  }

  // Volume Controls
  const volSlider = document.getElementById("master-volume-slider");
  const btnVolIcon = document.getElementById("btn-player-volume-icon");
  const volIconHigh = document.getElementById("vol-icon-high");
  const volIconMute = document.getElementById("vol-icon-mute");

  if (volSlider) {
    volSlider.addEventListener("input", (e) => {
      initAudioContext();
      const val = parseInt(e.target.value, 10) / 100;
      state.masterVolume = val;
      state.isMuted = val === 0;
      if (state.masterGain) {
        state.masterGain.gain.setValueAtTime(val, state.audioContext.currentTime);
      }
      if (volIconHigh && volIconMute) {
        volIconHigh.style.display = state.isMuted ? "none" : "block";
        volIconMute.style.display = state.isMuted ? "block" : "none";
      }
    });
  }

  if (btnVolIcon) {
    btnVolIcon.addEventListener("click", () => {
      initAudioContext();
      state.isMuted = !state.isMuted;
      if (state.isMuted) {
        state.previousVolume = state.masterVolume;
        state.masterVolume = 0;
      } else {
        state.masterVolume = state.previousVolume || 0.8;
      }
      if (volSlider) volSlider.value = Math.round(state.masterVolume * 100);
      if (state.masterGain) {
        state.masterGain.gain.setValueAtTime(state.masterVolume, state.audioContext.currentTime);
      }
      if (volIconHigh && volIconMute) {
        volIconHigh.style.display = state.isMuted ? "none" : "block";
        volIconMute.style.display = state.isMuted ? "block" : "none";
      }
    });
  }

  // Custom MIDI File Upload Input
  const fileInput = document.getElementById("input-midi-file");
  const sidebarUploadBtn = document.getElementById("btn-sidebar-upload-midi");
  if (sidebarUploadBtn && fileInput) {
    sidebarUploadBtn.addEventListener("click", () => fileInput.click());
  }
  if (fileInput) {
    fileInput.addEventListener("change", handleUserMidiUpload);
  }

  // Navigation Links & Modals
  setupNavAndModals();
}

function handleUserMidiUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const buffer = evt.target.result;
      const parsedNotes = parseMidiFile(buffer);
      if (parsedNotes.length === 0) {
        alert("The uploaded MIDI file contains no readable note events.");
        return;
      }

      const totalDuration = parsedNotes[parsedNotes.length - 1].time + parsedNotes[parsedNotes.length - 1].dur + 500;
      const customSong = {
        id: "midi_upload_" + Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        composer: "Uploaded MIDI",
        difficulty: "Custom",
        duration: totalDuration,
        coverIcon: "📁",
        notes: parsedNotes
      };

      DEMO_SONGS.unshift(customSong);
      renderDemoSongs();
      playSelectedSong(customSong);
    } catch (err) {
      console.error("MIDI Parse Error:", err);
      alert("Could not parse this MIDI file: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function setupNavAndModals() {
  const navHome = document.getElementById("nav-home");
  const navPlayPiano = document.getElementById("nav-play-piano");
  const navDemoSongs = document.getElementById("nav-demo-songs");
  const navMyRecordings = document.getElementById("nav-my-recordings");
  const navSettings = document.getElementById("nav-settings");
  const btnToggleShortcuts = document.getElementById("btn-toggle-shortcuts-modal");
  const brandHome = document.getElementById("brand-home-btn");

  const scrollToEl = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  if (navHome || brandHome) {
    const goHome = () => {
      document.querySelector(".studio-scrollable").scrollTo({ top: 0, behavior: "smooth" });
    };
    if (navHome) navHome.addEventListener("click", goHome);
    if (brandHome) brandHome.addEventListener("click", goHome);
  }

  if (navPlayPiano) navPlayPiano.addEventListener("click", () => scrollToEl("piano-stage-container"));
  if (navDemoSongs) navDemoSongs.addEventListener("click", () => scrollToEl("demo-songs-section"));
  if (navMyRecordings) navMyRecordings.addEventListener("click", () => scrollToEl("recordings-section"));
  if (navSettings) navSettings.addEventListener("click", () => openModal("settings-modal"));
  if (btnToggleShortcuts) btnToggleShortcuts.addEventListener("click", () => openModal("shortcuts-modal"));

  // Modals Close
  document.getElementById("btn-close-shortcuts-modal").addEventListener("click", () => closeModal("shortcuts-modal"));
  document.getElementById("btn-close-settings-modal").addEventListener("click", () => closeModal("settings-modal"));
  document.querySelectorAll(".modal-backdrop").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  // Settings Toggles
  const settingReverb = document.getElementById("setting-reverb");
  const settingAutoScroll = document.getElementById("setting-autoscroll");
  const settingSustainLatch = document.getElementById("setting-sustain-latch");

  if (settingAutoScroll) {
    settingAutoScroll.addEventListener("change", (e) => {
      state.autoScrollPlaying = e.target.checked;
    });
  }
  if (settingSustainLatch) {
    settingSustainLatch.addEventListener("change", (e) => {
      state.sustainLatch = e.target.checked;
    });
  }

  // Export JSON
  const btnExport = document.getElementById("btn-export-all-rec");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.recordings, null, 2));
      const a = document.createElement("a");
      a.href = dataStr;
      a.download = `virtualkeys-recordings-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("open");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("open");
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ============================================================================
// 13. INITIALIZATION ON DOM READY
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  render88PianoKeyboard();
  renderDemoSongs();
  setupKeyboardListeners();
  setupUIBindings();
  loadRecordingsFromStorage();

  // Load first demo song into player ready to play
  if (DEMO_SONGS.length > 0) {
    loadSongIntoPlayer(DEMO_SONGS[0]);
  }

  // Center the Middle C (C4) on first load
  setTimeout(() => {
    const middleC = document.querySelector(`.piano-key[data-midi="60"]`);
    if (middleC) scrollKeyIntoViewIfNeeded(middleC);
  }, 250);

  // Global first-click audio unlock
  const unlockFirstClick = () => {
    initAudioContext();
    const overlay = document.getElementById("audio-init-overlay");
    if (overlay) overlay.classList.add("hidden");
    window.removeEventListener("click", unlockFirstClick);
    window.removeEventListener("keydown", unlockFirstClick);
  };
  window.addEventListener("click", unlockFirstClick, { once: true });
  window.addEventListener("keydown", unlockFirstClick, { once: true });
});
