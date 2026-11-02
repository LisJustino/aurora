export const PROFILE_SEX_OPTIONS = Object.freeze([
  Object.freeze(['f', 'Mulher']),
  Object.freeze(['m', 'Homem']),
  Object.freeze(['nb', 'Pessoa não binária']),
  Object.freeze(['o', 'Outra identidade de gênero']),
  Object.freeze(['n', 'Prefiro não informar']),
]);

export const PROFILE_SEX = Object.freeze(Object.fromEntries(PROFILE_SEX_OPTIONS));

export const PROFILE_AVATARS = Object.freeze([
  Object.freeze(['user', 'Pessoa']),
  Object.freeze(['sparkles', 'Brilhos']),
  Object.freeze(['heart', 'Coração']),
  Object.freeze(['leaf', 'Folha']),
  Object.freeze(['flower', 'Flor']),
  Object.freeze(['activity', 'Energia']),
]);

export const PROFILE_AVATAR_COLORS = Object.freeze([
  Object.freeze(['rose', 'Rosé']),
  Object.freeze(['coral', 'Coral']),
  Object.freeze(['plum', 'Ameixa']),
  Object.freeze(['lavender', 'Lavanda']),
  Object.freeze(['ocean', 'Oceano']),
  Object.freeze(['teal', 'Turquesa']),
  Object.freeze(['sage', 'Sálvia']),
  Object.freeze(['amber', 'Âmbar']),
]);

export const PROFILE_GREETING_STYLES = Object.freeze([
  Object.freeze(['dynamic', 'Variável']),
  Object.freeze(['hello', 'Olá']),
  Object.freeze(['oi', 'Oi']),
]);

export const PROFILE_APPEARANCE_DEFAULT = Object.freeze({
  avatar: 'user',
  avatarColor: 'rose',
  greeting: 'dynamic',
});

export function normalizeProfileAppearance(value) {
  const appearance = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const avatars = new Set(PROFILE_AVATARS.map(([id]) => id));
  const colors = new Set(PROFILE_AVATAR_COLORS.map(([id]) => id));
  const greetings = new Set(PROFILE_GREETING_STYLES.map(([id]) => id));
  return {
    ...PROFILE_APPEARANCE_DEFAULT,
    ...appearance,
    avatar: avatars.has(appearance.avatar) ? appearance.avatar : PROFILE_APPEARANCE_DEFAULT.avatar,
    avatarColor: colors.has(appearance.avatarColor) ? appearance.avatarColor : PROFILE_APPEARANCE_DEFAULT.avatarColor,
    greeting: greetings.has(appearance.greeting) ? appearance.greeting : PROFILE_APPEARANCE_DEFAULT.greeting,
  };
}
