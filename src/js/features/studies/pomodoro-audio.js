export function resumePomodoroAudioContext(context) {
  return context.state === 'running' ? Promise.resolve() : context.resume();
}

export function playPomodoroChime(context) {
  [880, 660, 880].forEach((frequency, index) => {
    const startAt = context.currentTime + index * 0.24;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.19);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.2);
  });
}
