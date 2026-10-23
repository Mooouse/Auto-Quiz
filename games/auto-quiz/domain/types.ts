export type Mode = 'photo' | 'expert' | 'silhouette' | 'master';
export type Format = 'classic' | 'marathon' | 'timed';
export type Language = 'ru' | 'en';
export interface Car {
 id: string; brand: string; model: string; generation: string; modification: string;
 fullName: string; aliases: string[]; image: string; categories: string[]; difficulty: number;
 years?: string; info?: string;
}
export interface Filters { category: string; brand: string }
export interface SessionConfig extends Filters { mode: Mode; format: Format }
export interface Question { id: string; car: Car; options: Car[] }
export interface AnswerResult { questionId: string; carId: string; correct: boolean; submitted: string; points: number; xp: number; streak: number; responseMs: number }
export type EndReason = 'complete' | 'mistakes' | 'time' | 'exhausted' | 'quit' | 'image';
export interface SessionSummary { id: string; config: SessionConfig; score: number; correct: number; errors: number; answered: number; maxStreak: number; elapsedMs: number; reason: EndReason; answers: AnswerResult[] }
export interface SessionSnapshot { phase: 'question' | 'feedback' | 'finished'; question: Question | null; index: number; score: number; correct: number; errors: number; streak: number; remainingMs: number; answer: AnswerResult | null; paused: boolean }
/** The UI uses this contract, never the implementation. A future RemoteSession may resolve server snapshots. */
export interface SessionController {
 snapshot(): SessionSnapshot;
 submit(answer: string, now: number): AnswerResult | null;
 next(now: number): boolean;
 tick(now: number): void;
 pause(now: number): void;
 resume(now: number): void;
 finish(reason: EndReason, now: number): SessionSummary;
 summary(): SessionSummary | null;
 peekNext(): Car | null;
}
export interface CarStats { attempts: number; correct: number; unlockedAt?: number }
export interface ModeStats { sessions: number; answered: number; correct: number; points: number; best: number; bestCorrect: number }
export type Theme = 'light' | 'dark';
export interface Settings { theme: Theme; language: Language; sound: boolean; volume: number; reducedMotion: boolean; autoNext: boolean }
export interface Profile {
 version: 1; onboardingCompleted: boolean; nickname: string; xp: number; points: number; sessions: number; answered: number; correct: number;
 streak: number; bestStreak: number; silhouetteCorrect: number; perfectSessions: number;
 cars: Record<string, CarStats>; achievements: Record<string, number>;
 modes: Record<string, ModeStats>; recent: string[]; settings: Settings; completedSessions: string[];
}
export const MODES: Mode[] = ['photo','expert','silhouette','master'];
export const FORMATS: Format[] = ['classic','marathon','timed'];
export const BASE_POINTS: Record<Mode, number> = {photo:100,expert:150,silhouette:175,master:250};
export const isChoice = (mode: Mode) => mode === 'photo' || mode === 'silhouette';
export const isSilhouette = (mode: Mode) => mode === 'silhouette' || mode === 'master';
