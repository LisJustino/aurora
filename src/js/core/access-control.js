const PROFILE_SETUP_EXEMPT_ACTIONS = new Set(['open-profile-setup', 'skip', 'wipe-home']);
const PROFILE_SETUP_ACTIONS = new Set([
  'ob-next',
  'ob-back',
  'ob-theme',
  'ob-area',
  'ob-finish',
]);

export function actionNeedsProfileSetup(action, onboardingActive = false) {
  return !PROFILE_SETUP_EXEMPT_ACTIONS.has(action)
    && !(onboardingActive && PROFILE_SETUP_ACTIONS.has(action));
}
