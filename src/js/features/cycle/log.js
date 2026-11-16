export const CYCLE_CONTRACEPTION_METHODS = Object.freeze([
  Object.freeze({ id: 'condom', label: 'Preservativo' }),
  Object.freeze({ id: 'pill', label: 'Pílula' }),
  Object.freeze({ id: 'injection', label: 'Injeção' }),
  Object.freeze({ id: 'iud', label: 'DIU' }),
  Object.freeze({ id: 'implant', label: 'Implante hormonal' }),
  Object.freeze({ id: 'patch-ring', label: 'Adesivo ou anel vaginal' }),
  Object.freeze({ id: 'emergency', label: 'Contracepção de emergência' }),
  Object.freeze({ id: 'other', label: 'Outro método' }),
  Object.freeze({ id: 'none', label: 'Sem método contraceptivo' }),
  Object.freeze({ id: 'undisclosed', label: 'Prefiro não informar' }),
]);

export const CYCLE_SOCIAL_OPTIONS = Object.freeze([
  Object.freeze(['interaction', 'Tive interação social']),
  Object.freeze(['preferred-quiet', 'Preferi ficar mais na minha']),
  Object.freeze(['wanted-socialize', 'Senti vontade de socializar']),
  Object.freeze(['alone-time', 'Precisava de mais tempo a sós']),
  Object.freeze(['interaction-helped', 'Interação me fez bem']),
  Object.freeze(['interaction-tired', 'Interação me cansou']),
]);

export const CYCLE_TEST_RESULTS = Object.freeze([
  Object.freeze(['positive', 'Positivo']),
  Object.freeze(['negative', 'Negativo']),
  Object.freeze(['inconclusive', 'Inconclusivo']),
  Object.freeze(['undisclosed', 'Prefiro não informar']),
]);

const methodIds = new Set(CYCLE_CONTRACEPTION_METHODS.map(({ id }) => id));
const socialOptionIds = new Set(CYCLE_SOCIAL_OPTIONS.map(([id]) => id));
const testResultIds = new Set(CYCLE_TEST_RESULTS.map(([id]) => id));
const exclusiveMethods = new Set(['none', 'undisclosed']);

export function isValidCycleSocialLog(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (!Object.hasOwn(record, 'social')) return true;
  return Array.isArray(record.social)
    && record.social.every((option) => typeof option === 'string' && socialOptionIds.has(option))
    && new Set(record.social).size === record.social.length;
}

export function isValidCycleTrackingLog(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (Object.hasOwn(record, 'weightKg')
    && (!Number.isFinite(record.weightKg) || record.weightKg < 20 || record.weightKg > 400
      || !Number.isInteger(record.weightKg * 10))) return false;
  if (Object.hasOwn(record, 'ovulationTestResult') && !testResultIds.has(record.ovulationTestResult)) return false;
  if (Object.hasOwn(record, 'pregnancyTestResult') && !testResultIds.has(record.pregnancyTestResult)) return false;
  if (Object.hasOwn(record, 'medicationTaken') && typeof record.medicationTaken !== 'boolean') return false;
  return true;
}

export function isValidCycleSexualLog(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (Object.hasOwn(record, 'sexualActivity') && typeof record.sexualActivity !== 'boolean') return false;
  if (Object.hasOwn(record, 'masturbationActivity') && typeof record.masturbationActivity !== 'boolean') return false;
  if (Object.hasOwn(record, 'sexToysUsed') && typeof record.sexToysUsed !== 'boolean') return false;
  if (Object.hasOwn(record, 'orgasmOccurred') && typeof record.orgasmOccurred !== 'boolean') return false;
  if (Object.hasOwn(record, 'libido') && !['high', 'low'].includes(record.libido)) return false;
  if (Object.hasOwn(record, 'orgasmCount')
    && (!Number.isInteger(record.orgasmCount) || record.orgasmCount < 0 || record.orgasmCount > 99)) return false;
  if (!Object.hasOwn(record, 'contraceptionMethods')) return true;

  const methods = record.contraceptionMethods;
  if (!Array.isArray(methods)
    || !methods.every((method) => typeof method === 'string' && methodIds.has(method))
    || new Set(methods).size !== methods.length
    || (methods.length > 0 && record.sexualActivity !== true)) return false;

  return methods.filter((method) => exclusiveMethods.has(method)).length === 0 || methods.length === 1;
}
