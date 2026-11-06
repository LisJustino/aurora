const tutorial = (name) => ({
  webm: new URL(`../../../assets/tutorials/${name}.webm`, import.meta.url).href,
  mp4: new URL(`../../../assets/tutorials/${name}.mp4`, import.meta.url).href,
});

const FEATURE_VIDEOS = {
  planejar: tutorial('planejar'),
  pomodoro: tutorial('pomodoro'),
  habitos: tutorial('habitos'),
  financas: tutorial('financas'),
  ciclo: tutorial('ciclo'),
};

function motionAllowed() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return navigator.connection?.saveData !== true;
}

function mountVideo(slot) {
  const sources = FEATURE_VIDEOS[slot.dataset.landingVideo];
  if (!sources || slot.querySelector('video')) return null;
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.tabIndex = -1;
  video.setAttribute('aria-hidden', 'true');
  [['video/webm', sources.webm], ['video/mp4', sources.mp4]].forEach(([type, src]) => {
    const source = document.createElement('source');
    source.src = src;
    source.type = type;
    video.append(source);
  });
  slot.append(video);
  return video;
}

// Os vídeos só são criados quando o cartão se aproxima da tela e pausam ao sair dela.
export function initializeFeatureVideos(root) {
  const slots = [...root.querySelectorAll('[data-landing-video]')];
  if (!slots.length) return;
  if (!motionAllowed() || typeof IntersectionObserver !== 'function') {
    slots.forEach((slot) => { slot.hidden = true; });
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = mountVideo(entry.target) || entry.target.querySelector('video');
      if (!video) return;
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
  }, { rootMargin: '200px 0px', threshold: 0.25 });
  slots.forEach((slot) => observer.observe(slot));
}
