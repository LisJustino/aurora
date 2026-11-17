export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;
export const LEGACY_PASSWORD_MIN_LENGTH = 6;

export const PASSWORD_REQUIREMENTS_MESSAGE = `A senha deve ter entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres.`;
export const PASSWORD_REJECTED_MESSAGE = `${PASSWORD_REQUIREMENTS_MESSAGE} Escolha outra senha e tente novamente.`;

export const PASSWORD_REQUIREMENTS = [
  ['length', `entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres`, (value) => (
    value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH
  )],
];

export function validatePassword(value) {
  const isString = typeof value === 'string';
  const password = isString ? value : '';
  const criteria = Object.fromEntries(PASSWORD_REQUIREMENTS.map(([key, , test]) => [
    key,
    isString && test(password),
  ]));
  return {
    valid: isString && Object.values(criteria).every(Boolean),
    criteria,
  };
}
