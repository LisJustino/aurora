export const CYCLE_DATA_CONSENT_VERSION = '2.1';

export function createCycleDataConsentMetadata(acceptedAt = new Date()) {
  if (!(acceptedAt instanceof Date) || Number.isNaN(acceptedAt.getTime())) {
    throw new TypeError('A data de consentimento para dados de Ciclo é inválida.');
  }
  return {
    cycle_data_consent_at: acceptedAt.toISOString(),
    cycle_data_consent_version: CYCLE_DATA_CONSENT_VERSION,
    cycle_data_consent_revoked_at: null,
  };
}

export function createCycleDataConsentRevocationMetadata(revokedAt = new Date()) {
  if (!(revokedAt instanceof Date) || Number.isNaN(revokedAt.getTime())) {
    throw new TypeError('A data de revogação do consentimento para dados de Ciclo é inválida.');
  }
  return { cycle_data_consent_revoked_at: revokedAt.toISOString() };
}

export function hasCurrentCycleDataConsent(user) {
  const metadata = user?.user_metadata;
  return Boolean(
    metadata &&
    metadata.cycle_data_consent_version === CYCLE_DATA_CONSENT_VERSION &&
    typeof metadata.cycle_data_consent_at === 'string' &&
    Number.isFinite(Date.parse(metadata.cycle_data_consent_at)) &&
    !metadata.cycle_data_consent_revoked_at,
  );
}
