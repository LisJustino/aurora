export function filterWeightInput(value) {
  let hasSeparator = false;
  return String(value).split('').filter((character) => {
    if (character >= '0' && character <= '9') return true;
    if ((character === '.' || character === ',') && !hasSeparator) {
      hasSeparator = true;
      return true;
    }
    return false;
  }).join('');
}
