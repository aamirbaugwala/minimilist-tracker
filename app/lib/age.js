/**
 * app/lib/age.js — age from a birthday, so it stays right every year.
 *
 * user_profiles.birth_date (YYYY-MM-DD) is the source of truth. The old
 * user_profiles.age column is still written alongside it (age as of the save)
 * for older readers, and is the fallback for people who only ever typed an age.
 */

export const MIN_AGE = 13;
export const MAX_AGE = 110;

/** Whole years between a YYYY-MM-DD birthday and `now`, or null if invalid. */
export function ageFromBirthDate(birthDate, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDate || ""));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age -= 1;
  return age >= 0 && age <= MAX_AGE ? age : null;
}

/** The age to use for a profile: from birth_date when set, else the stored age. */
export function profileAge(profile, now = new Date()) {
  const fromBirthday = ageFromBirthDate(profile?.birth_date, now);
  if (fromBirthday != null) return fromBirthday;
  const n = Number(profile?.age);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A birthday a form can accept: a real date, not in the future, age MIN–MAX. */
export function isValidBirthDate(birthDate, now = new Date()) {
  const age = ageFromBirthDate(birthDate, now);
  return age != null && age >= MIN_AGE && age <= MAX_AGE;
}

/** min/max for <input type="date"> (local dates). */
export function birthDateBounds(now = new Date()) {
  const iso = (y) => `${y}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { min: iso(now.getFullYear() - MAX_AGE), max: iso(now.getFullYear() - MIN_AGE) };
}

/**
 * Profile fields to write: keeps `age` in step with `birth_date` so readers
 * that still use the age column get today's value.
 */
export function withAgeFromBirthday(profile, now = new Date()) {
  const age = ageFromBirthDate(profile?.birth_date, now);
  return age != null ? { ...profile, age } : profile;
}
