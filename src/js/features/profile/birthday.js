function localDateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseCivilDate(value) {
  if (typeof value !== 'string' || !/^(\d{4})-(\d{2})-(\d{2})$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function calculateAge(birthDate, today = new Date()) {
  const date = parseCivilDate(birthDate);
  if (!date || date.getFullYear() < 1900 || !(today instanceof Date) || Number.isNaN(today.getTime())
    || date > today) return null;
  const age = today.getFullYear() - date.getFullYear()
    - (today.getMonth() < date.getMonth()
      || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate()) ? 1 : 0);
  return age >= 0 && age <= 120 ? age : null;
}

export function isValidBirthdayReference(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { month, day, ageAtReference, referenceDate } = value;
  if (!Number.isInteger(month) || month < 1 || month > 12
    || !Number.isInteger(day) || day < 1 || day > new Date(2000, month, 0).getDate()
    || !Number.isInteger(ageAtReference) || ageAtReference < 0 || ageAtReference > 120) return false;
  const reference = parseCivilDate(referenceDate);
  return Boolean(reference && reference.getFullYear() >= 1900 && reference <= new Date());
}

export function createBirthdayReferenceFromParts({ month, day, ageAtReference, referenceDate }) {
  const value = { month, day, ageAtReference, referenceDate };
  return isValidBirthdayReference(value) ? value : null;
}

export function createBirthdayReference(birthDate, referenceDate = new Date()) {
  const ageAtReference = calculateAge(birthDate, referenceDate);
  const parsedBirthDate = parseCivilDate(birthDate);
  if (ageAtReference === null || !parsedBirthDate
    || !(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) return null;
  return {
    month: parsedBirthDate.getMonth() + 1,
    day: parsedBirthDate.getDate(),
    ageAtReference,
    referenceDate: localDateValue(referenceDate),
  };
}

export function formatBirthday(value) {
  if (!isValidBirthdayReference(value)) return '';
  return `${String(value.day).padStart(2, '0')}/${String(value.month).padStart(2, '0')}`;
}

export function ageFromBirthdayReference(value, today = new Date()) {
  if (!isValidBirthdayReference(value) || !(today instanceof Date) || Number.isNaN(today.getTime())) return null;
  const referenceDate = parseCivilDate(value.referenceDate);
  const currentDate = parseCivilDate(localDateValue(today));
  if (!referenceDate || !currentDate || currentDate < referenceDate) return value.ageAtReference;

  let age = value.ageAtReference;
  for (let year = referenceDate.getFullYear(); year <= currentDate.getFullYear(); year += 1) {
    const lastDay = new Date(year, value.month, 0).getDate();
    const anniversary = new Date(year, value.month - 1, Math.min(value.day, lastDay));
    if (anniversary > referenceDate && anniversary <= currentDate) age += 1;
  }
  return Math.min(age, 120);
}
