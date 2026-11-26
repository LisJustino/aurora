export const CURATED_RELEASE = Object.freeze({
  id: '2026-11-26',
  dateLabel: '26 de novembro',
  title: 'O que há de novo no Aurora',
  intro: 'Preparamos melhorias para deixar sua rotina mais simples de acompanhar no celular e no computador.',
  items: Object.freeze([
    Object.freeze({
      icon: 'sparkles',
      badge: 'Novidade',
      tone: 'new',
      title: 'Hábitos mais fáceis de controlar',
      description:
        'Edite, pule o dia, pause ou abra o histórico direto pelo menu ⋯ em cada hábito, e veja os hábitos de outros dias na mesma tela.',
    }),
    Object.freeze({
      icon: 'droplet',
      badge: 'Melhoria',
      tone: 'improvement',
      title: 'Água e registro de outros dias',
      description:
        'Acompanhe sua meta de água em um único cartão e marque vários hábitos de uma data anterior de uma só vez.',
    }),
    Object.freeze({
      icon: 'sliders',
      badge: 'Melhoria',
      tone: 'improvement',
      title: 'Menu de Ajustes mais prático no celular',
      description:
        'Toque na barra no topo de Ajustes para abrir todas as seções organizadas por grupo, sem precisar rolar para o lado.',
    }),
    Object.freeze({
      icon: 'help',
      badge: 'Novidade',
      tone: 'new',
      title: 'Guias “Como usar?” refeitos',
      description:
        'Toque no ícone ? no canto superior direito de qualquer área para conhecer tudo o que você pode fazer ali, com dicas rápidas.',
    }),
    Object.freeze({
      icon: 'calendarCheck',
      badge: 'Correção',
      tone: 'fix',
      title: 'Resumo do dia mais preciso',
      description:
        'A tela inicial agora contabiliza corretamente tarefas de hoje, atrasadas e concluídas, inclusive quando a data é escolhida no celular.',
    }),
  ]),
});

const rawMetadata = typeof __AURORA_RELEASE_METADATA__ === 'undefined' ? null : __AURORA_RELEASE_METADATA__;

function explicitReleaseFromMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || !metadata.id) return null;
  if (Array.isArray(metadata.items) && metadata.items.length > 0) {
    return {
      id: metadata.id,
      dateLabel: metadata.dateLabel || '',
      title: metadata.title || 'O que há de novo no Aurora',
      intro: metadata.intro || 'Veja as melhorias mais recentes desta atualização.',
      items: metadata.items.map((item) => ({
        icon: item.icon || 'sparkles',
        badge: item.badge || 'Novidade',
        tone: item.tone || 'new',
        title: item.title,
        description: item.description || '',
      })),
    };
  }
  return null;
}

const activeRelease = explicitReleaseFromMetadata(rawMetadata) || CURATED_RELEASE;

export const RELEASE_VERSION = activeRelease.id;

export function getReleaseNotes(version = RELEASE_VERSION) {
  if (version !== activeRelease.id || !activeRelease.items.length) return null;
  return {
    dateLabel: activeRelease.dateLabel,
    title: activeRelease.title,
    intro: activeRelease.intro,
    items: activeRelease.items.map((item) => ({ ...item })),
  };
}

export function shouldShowReleaseNotes(settings, version = RELEASE_VERSION) {
  if (!getReleaseNotes(version)) return false;
  return settings?.prefs?.releaseNotesSeen !== version;
}

export function markReleaseNotesSeen(settings, version = RELEASE_VERSION) {
  if (!getReleaseNotes(version) || !settings?.prefs || typeof settings.prefs !== 'object') return false;
  settings.prefs.releaseNotesSeen = version;
  return true;
}
