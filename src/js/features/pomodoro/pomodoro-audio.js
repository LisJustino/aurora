export const DEFAULT_POMODORO_SOUND_VOLUME = 75;
export const POMODORO_SOUND_TONES = Object.freeze({
  classic: Object.freeze({
    label: 'Clássico',
    type: 'sine',
    frequencies: Object.freeze([880, 660, 880]),
    spacing: 0.24,
    duration: 0.2,
  }),
  bell: Object.freeze({
    label: 'Sino',
    type: 'triangle',
    frequencies: Object.freeze([1046, 1318, 1568]),
    spacing: 0.2,
    duration: 0.24,
  }),
  digital: Object.freeze({
    label: 'Digital',
    type: 'square',
    frequencies: Object.freeze([784, 784, 1046]),
    spacing: 0.22,
    duration: 0.14,
  }),
});

export function resumePomodoroAudioContext(context) {
  return context.state === 'running' ? Promise.resolve() : context.resume();
}

export function playPomodoroChime(context, {
  tone = 'classic',
  volume = DEFAULT_POMODORO_SOUND_VOLUME,
} = {}) {
  const sound = Object.hasOwn(POMODORO_SOUND_TONES, tone)
    ? POMODORO_SOUND_TONES[tone]
    : POMODORO_SOUND_TONES.classic;
  const safeVolume = Number.isFinite(volume)
    ? Math.max(0, Math.min(100, volume))
    : DEFAULT_POMODORO_SOUND_VOLUME;
  if (safeVolume === 0) return;
  const peakGain = safeVolume / 100 * 0.8;

  sound.frequencies.forEach((frequency, index) => {
    const startAt = context.currentTime + index * sound.spacing;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = sound.type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + sound.duration - 0.01);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + sound.duration);
  });
}
