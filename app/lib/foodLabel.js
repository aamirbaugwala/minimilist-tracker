/**
 * Short display label for a food name, for chips and nudges.
 * "pulao (chicken, 1 bowl)" → "pulao · chicken": keeps a variant that changes
 * the food (chicken vs veg pulao), drops sizes and portions
 * ("banana (medium, 1 pc)" → "banana").
 */
const SIZE = /^(small|medium|large|regular|big|mini|half|full)$/i;

export function foodLabel(name) {
  const m = String(name).match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!m) return name;
  const variant = m[2].split(",")[0].trim();
  return variant && !/\d/.test(variant) && !SIZE.test(variant) ? `${m[1]} · ${variant}` : m[1];
}
