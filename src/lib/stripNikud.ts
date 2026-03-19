/**
 * Strip Hebrew nikud (vowel marks) from text.
 * Keeps the consonants, removes diacritical marks (U+0591-U+05C7).
 */
export function stripNikud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}
