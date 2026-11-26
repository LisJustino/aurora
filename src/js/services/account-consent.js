import { isValidBirthdayReference } from '../features/profile/birthday.js';

export {
  CYCLE_DATA_CONSENT_VERSION,
  createCycleDataConsentMetadata,
  createCycleDataConsentRevocationMetadata,
  hasCurrentCycleDataConsent,
} from './cycle-consent.js';

export const TERMS_DOCUMENT_VERSION = '2.0';

export const PRIVACY_POLICY_VERSION = '2.3';

export const MINIMUM_ACCOUNT_AGE = 16;

export function createLegalConsentMetadata(acceptedAt = new Date()) {
  if (!(acceptedAt instanceof Date) || Number.isNaN(acceptedAt.getTime())) {
    throw new TypeError('A data de aceite dos documentos legais é inválida.');
  }
  return {
    terms_accepted_at: acceptedAt.toISOString(),
    terms_version: TERMS_DOCUMENT_VERSION,
    privacy_policy_version: PRIVACY_POLICY_VERSION,
  };
}

export function hasCurrentLegalConsent(user) {
  const metadata = user?.user_metadata;
  return Boolean(
    metadata &&
    metadata.terms_version === TERMS_DOCUMENT_VERSION &&
    metadata.privacy_policy_version === PRIVACY_POLICY_VERSION &&
    typeof metadata.terms_accepted_at === 'string' &&
    Number.isFinite(Date.parse(metadata.terms_accepted_at)),
  );
}

export function hasCompleteProfile(user) {
  const metadata = user?.user_metadata;
  return Boolean(
    metadata &&
    typeof metadata.name === 'string' &&
    metadata.name.trim() &&
    typeof metadata.preferred_name === 'string' &&
    metadata.preferred_name.trim() &&
    (metadata.age_confirmed === true ||
      isValidBirthdayReference({
        month: metadata.birthday_month,
        day: metadata.birthday_day,
        ageAtReference: metadata.age,
        referenceDate: metadata.birthday_reference_date,
      })),
  );
}

export function hasSocialIdentity(user) {
  const providers = [
    user?.app_metadata?.provider,
    ...(Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : []),
    ...(Array.isArray(user?.identities) ? user.identities.map((identity) => identity?.provider) : []),
  ];
  return providers.some((provider) => provider === 'google' || provider === 'apple');
}

export function getOAuthRedirectUrl(origin) {
  return new URL('/', origin).href;
}
