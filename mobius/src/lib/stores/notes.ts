import { writable } from "svelte/store";
import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const NOTES_FILE = "mobius/notes.json";
const NOTES_DIR = "mobius";

const defaultNotes: Note[] = [];

let currentId = 1;
let saveTimeout: ReturnType<typeof setTimeout>;

async function persistToDisk(data: Note[]) {
  try {
    const dirExists = await exists(NOTES_DIR, {
      baseDir: BaseDirectory.AppData,
    });
    if (!dirExists) {
      await mkdir(NOTES_DIR, {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });
    }
    await writeTextFile(NOTES_FILE, JSON.stringify(data, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch (e) {
    console.error("Failed to save notes:", e);
  }
}

function debouncedPersist(data: Note[]) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => persistToDisk(data), 300);
}

function createNotesStore() {
  const { subscribe, set, update } = writable<Note[]>(defaultNotes);

  return {
    subscribe,
    init: async () => {
      try {
        const fileExists = await exists(NOTES_FILE, {
          baseDir: BaseDirectory.AppData,
        });
        if (fileExists) {
          const raw = await readTextFile(NOTES_FILE, {
            baseDir: BaseDirectory.AppData,
          });
          const loaded: Note[] = JSON.parse(raw);
          if (loaded.length > 0) {
            set(loaded);
            const maxId = Math.max(...loaded.map((n) => parseInt(n.id, 10)));
            currentId = maxId + 1;
            return;
          }
        }
      } catch (e) {
        console.error("Failed to load notes:", e);
      }
      // First run — persist defaults
      persistToDisk(defaultNotes);
    },
    add: () => {
      const note: Note = {
        id: String(currentId++),
        content: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      update((notes) => {
        const updated = [note, ...notes];
        debouncedPersist(updated);
        return updated;
      });
      return note.id;
    },
    updateContent: (id: string, content: string) => {
      update((notes) => {
        const updated = notes.map((n) =>
          n.id === id
            ? { ...n, content, updatedAt: new Date().toISOString() }
            : n
        );
        debouncedPersist(updated);
        return updated;
      });
    },
    remove: (id: string) => {
      update((notes) => {
        const updated = notes.filter((n) => n.id !== id);
        debouncedPersist(updated);
        return updated;
      });
    },
  };
}

export const notes = createNotesStore();

export const activeNoteId = writable<string | null>(null);
