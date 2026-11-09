export function canAccessCycle(profile, preview = false) {
  return preview === true || profile?.sex === 'f';
}
