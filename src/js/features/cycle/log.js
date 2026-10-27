export const CYCLE_CONTRACEPTION_METHODS = Object.freeze([
  Object.freeze({ id: 'condom', label: 'Preservativo' }),
  Object.freeze({ id: 'pill', label: 'Pílula' }),
  Object.freeze({ id: 'injection', label: 'Injeção' }),
  Object.freeze({ id: 'iud', label: 'DIU' }),
  Object.freeze({ id: 'implant', label: 'Implante hormonal' }),
  Object.freeze({ id: 'patch-ring', label: 'Adesivo ou anel vaginal' }),
  Object.freeze({ id: 'emergency', label: 'Contracepção de emergência' }),
  Object.freeze({ id: 'other', label: 'Outro método' }),
  Object.freeze({ id: 'none', label: 'Nenhum método' }),
  Object.freeze({ id: 'undisclosed', label: 'Prefiro não informar' }),
]);

const methodIds = new Set(CYCLE_CONTRACEPTION_METHODS.map(({ id }) => id));
const exclusiveMethods = new Set(['none', 'undisclosed']);

export function isValidCycleSexualLog(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (Object.hasOwn(record, 'sexualActivity') && typeof record.sexualActivity !== 'boolean') return false;
  if (!Object.hasOwn(record, 'contraceptionMethods')) return true;

  const methods = record.contraceptionMethods;
  if (!Array.isArray(methods)
    || !methods.every((method) => typeof method === 'string' && methodIds.has(method))
    || new Set(methods).size !== methods.length
    || (methods.length > 0 && record.sexualActivity !== true)) return false;

  return methods.filter((method) => exclusiveMethods.has(method)).length === 0 || methods.length === 1;
}
