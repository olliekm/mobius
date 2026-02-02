import { writable } from "svelte/store";

export interface Suggestion {
  id: string;
  type: "define" | "tension" | "related";
  text: string;
  action: string;
}

export const suggestions = writable<Suggestion[]>([]);

export function dismissSuggestion(id: string) {
  suggestions.update((s) => s.filter((item) => item.id !== id));
}
