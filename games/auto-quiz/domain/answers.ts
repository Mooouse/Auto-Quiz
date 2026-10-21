import type { Car } from './types.ts';
/** Punctuation/case/spacing are formatting. Token order is NEVER guessed or sorted. */
export function normalizeAnswer(value: string): string {
 return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');
}
export function acceptedAnswers(car: Car): Set<string> {
 return new Set([car.fullName, ...car.aliases].map(normalizeAnswer));
}
export function checkAnswer(car: Car, answer: string): boolean {
 const key = normalizeAnswer(answer);
 return key.length > 0 && acceptedAnswers(car).has(key);
}
