# VirtualKeys — Full 88-Key Piano Simulator

A professional, fully functional, 100% offline Concert Grand Piano Simulator featuring an authentic **88-key piano keyboard (A0 to C8)**, Spotify-inspired dark aesthetic, polyphonic Web Audio API sound engine, and a complete Demo Song Library.

---

## 🎹 Highlights & Specifications

### 1. Genuine Full 88-Key Piano
- **Exact Standard Configuration**:
  - **52 White Keys** (Ivory finish, 3D bottom bevels, responsive press animation).
  - **36 Black Keys** (Ebony finish, glossy reflection, mathematically aligned over white key boundaries).
  - **Range**: Lowest note **A0** (MIDI 21, 27.5 Hz) to Highest note **C8** (MIDI 108, 4186.01 Hz).
  - 7 full octaves plus the 3 sub-contra keys (A0, A#0, B0) and C8.
- **Navigation & View Modes**:
  - **Horizontally Scrollable Viewport**: Smooth scrolling with custom Spotify-themed scrollbar.
  - **Piano Overview Minimap**: Interactive mini strip rendering all 88 keys with a draggable viewport handle indicating the current visible zone.
  - **Zoom In / Zoom Out Controls**: Scale key widths dynamically from 18px to 54px.
  - **Fit 88 Keys Mode**: Toggle full-width mode where all 88 keys fit on screen simultaneously.
  - **Quick Jump Buttons**: One-click jump to Bass (A0), Middle C (C4), or Treble (C8).

### 2. Computer Keyboard Mapping System
- **2-Octave Active Window**: Maps 24 standard computer keys onto the selected octave window (default: Octave 4, C4 to B5):
  - **Lower Octave White Keys**: `A, S, D, F, G, H, J` (C, D, E, F, G, A, B)
  - **Lower Octave Black Keys**: `W, E, T, Y, U` (C#, D#, F#, G#, A#)
  - **Upper Octave White Keys**: `K, L, ;, ', Z, X, C` (C, D, E, F, G, A, B)
  - **Upper Octave Black Keys**: `O, P, ], 8, 9` (C#, D#, F#, G#, A#)
- **Octave Window Shift**: Press `Z` or `X` (or toolbar buttons) to shift the computer keys to any octave from 1 to 6.
- **Visual Key Badges**: The active keys display computer key letters and an illuminated Spotify green accent line.
- **Anti-Stutter & Input Shield**: Ignores key repeat events and typing inside form inputs.

### 3. Polyphonic Web Audio Engine
- **Dynamics Compressor / Limiter**: Ensures polyphonic chords and complex pieces never clip or distort.
- **4 Instruments**:
  1. **Grand Piano**: Triple harmonic overtone synthesis, subtle unison string detuning, percussive hammer strike transient, and soundboard low-pass filter decay.
  2. **Electric Piano**: Bell-like FM synthesis chime (Rhodes & DX7 style) with dynamic carrier/modulator envelope.
  3. **Soft Piano**: Intimate felt acoustic piano with warm low-pass filter (700 Hz) and gentle, dreamy decay.
  4. **Synth Piano**: 80s analog polyphonic synth with dual detuned sawtooth/square oscillators and resonant Moog filter sweep.
- **Acoustic Reverb**: Synthetic stereo room impulse response convolution.
- **Sustain Pedal**: Struck notes ring out naturally until pedal release (`Spacebar` or bottom player button).
- **Extensible Sample Architecture**: Ready for raw recorded samples in `assets/sounds/` with fallback to synthetic audio.

### 4. Spotify-Inspired Demo Song Library & MIDI Playback
- **Demo Songs Included**:
  1. **Für Elise** — Ludwig van Beethoven (Classical, Intermediate)
  2. **Canon in D** — Johann Pachelbel (Classical, Intermediate)
  3. **Happy Birthday** — Traditional (Folk, Beginner)
  4. **Twinkle Twinkle Little Star** — W. A. Mozart / Traditional (Lullaby, Beginner)
  5. **Jingle Bells** — James Lord Pierpont (Holiday, Beginner)
- **Built-in Standard MIDI File (SMF) Parser**:
  - Parses binary `.mid` files directly (MThd chunk, MTrk chunks, delta time decoding, tempo changes, note on/off).
  - Real `.mid` files stored in `assets/demo-songs/`.
  - Built-in offline fallback sequences guarantee immediate playback even when loaded over `file:///`.
  - **User MIDI File Import**: Load or drag-and-drop any standard `.mid` file to play it on the 88-key piano!
- **Interactive Playback**:
  - Visual piano keys physically animate and illuminate in sync with the song.
  - Auto-scroll follows playing notes across bass and treble registers.
  - Interactive scrubber timeline with current elapsed and total time.

### 5. Recording System
- **Record**: Real-time capture of MIDI note numbers (21 to 108), note start time, duration, and velocity.
- **Persistence**: Saved automatically to `localStorage` across page refreshes.
- **Playback**: Instant playback with live key illumination and progress bar.
- **Export**: Export all sessions as structured JSON.

### 6. Real-Time Canvas Audio Spectrum Visualizer
- Connected directly to `AnalyserNode` with 256 FFT bins.
- Renders 64 Spotify green gradient bars with rounded caps, luminescence, and 60 FPS animation.
- Ambient resting wave when silent.

---

## 📁 Exact Project Structure

```text
VirtualKeys/
│
├── index.html                          # Semantic HTML5 Spotify studio layout
├── style.css                           # Spotify dark styling & 88-key CSS
├── script.js                           # Web Audio engine, MIDI parser & controller
├── README.md                           # Documentation
│
└── assets/
    ├── images/
    │   ├── logo.png                    # VirtualKeys logo
    │   └── piano-background.jpg        # Studio atmosphere background
    │
    ├── sounds/
    │   ├── grand-piano/                # Sample directory for Grand Piano
    │   ├── electric-piano/             # Sample directory for Electric Piano
    │   └── soft-piano/                 # Sample directory for Soft Piano
    │
    └── demo-songs/
        ├── fur-elise.mid               # Beethoven - Für Elise (Standard MIDI)
        ├── canon-in-d.mid              # Pachelbel - Canon in D (Standard MIDI)
        ├── happy-birthday.mid          # Traditional - Happy Birthday (Standard MIDI)
        ├── twinkle-twinkle.mid         # Mozart - Twinkle Twinkle (Standard MIDI)
        └── jingle-bells.mid            # Pierpont - Jingle Bells (Standard MIDI)
```

---

## ⌨️ Computer Keyboard Guide

| Command | Action |
| :--- | :--- |
| **A, S, D, F, G, H, J** | Lower Octave White Keys (C, D, E, F, G, A, B) |
| **W, E, T, Y, U** | Lower Octave Black Keys (C#, D#, F#, G#, A#) |
| **K, L, ;, ', Z, X, C** | Upper Octave White Keys (C, D, E, F, G, A, B) |
| **O, P, ], 8, 9** | Upper Octave Black Keys (C#, D#, F#, G#, A#) |
| **Spacebar** | Sustain Pedal Toggle / Hold |
| **Z / X** | Shift Active Keyboard Octave Down / Up |
| **R** | Start / Stop Recording |
| **P** | Play / Pause Song Playback |
| **M** | Toggle Metronome On / Off |
| **F** | Toggle "Fit 88 Keys on Screen" Mode |

---

## 🚀 How to Run

1. Open `index.html` in any web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari, Brave, Opera).
2. Works **100% offline** without web servers, NodeJS, or external APIs.
3. Click **"Enter Studio"** to unlock the Web Audio API context and start playing!
