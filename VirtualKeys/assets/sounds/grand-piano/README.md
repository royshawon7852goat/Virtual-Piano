# Piano Audio Samples Directory

VirtualKeys uses an advanced Web Audio synthesizer engine by default, ensuring instant offline capability and low latency with zero loading time.

To integrate raw audio samples (e.g. WAV or MP3 multi-velocity recordings):
Place sample files named by MIDI note (e.g. `60.mp3`, `64.mp3`, `67.mp3`) in this directory. The sound engine architecture includes an extensible sample loader interface (`SampleAudioSource`) that automatically bridges realistic recorded samples when present.
