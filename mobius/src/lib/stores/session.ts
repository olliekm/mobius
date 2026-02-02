import { writable, derived } from "svelte/store";

export const sessionActive = writable(false);
export const sessionIntention = writable("");
export const sessionSeconds = writable(25 * 60);
export const sessionPaused = writable(false);
export const streak = writable(0);

export const sessionDisplay = derived(sessionSeconds, ($s) => {
  const m = Math.floor($s / 60);
  const s = $s % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
});

let interval: ReturnType<typeof setInterval> | null = null;

export function startSession(intention: string) {
  sessionActive.set(true);
  sessionIntention.set(intention);
  sessionSeconds.set(25 * 60);
  sessionPaused.set(false);
  if (interval) clearInterval(interval);
  interval = setInterval(() => {
    let paused = false;
    sessionPaused.subscribe((v) => (paused = v))();
    if (!paused) {
      sessionSeconds.update((s) => {
        if (s <= 0) {
          endSession();
          return 0;
        }
        return s - 1;
      });
    }
  }, 1000);
}

export function togglePause() {
  sessionPaused.update((p) => !p);
}

export function endSession() {
  sessionActive.set(false);
  sessionIntention.set("");
  if (interval) clearInterval(interval);
  interval = null;
  streak.update((s) => s + 1);
}
