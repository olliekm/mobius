import { writable, get } from "svelte/store";
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
  folder?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesData {
  notes: Note[];
  folders: string[];
}

const DATA_FILE = "mobius/notes.json";
const DATA_DIR = "mobius";

let currentId = 1;
let saveTimeout: ReturnType<typeof setTimeout>;

async function persistToDisk(data: NotesData) {
  try {
    const dirExists = await exists(DATA_DIR, {
      baseDir: BaseDirectory.AppData,
    });
    if (!dirExists) {
      await mkdir(DATA_DIR, {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });
    }
    await writeTextFile(DATA_FILE, JSON.stringify(data, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch (e) {
    console.error("Failed to save notes:", e);
  }
}

function debouncedPersist(data: NotesData) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => persistToDisk(data), 300);
}

const notesList = writable<Note[]>([]);
const foldersList = writable<string[]>([]);

function getCurrentData(): NotesData {
  return { notes: get(notesList), folders: get(foldersList) };
}

function createNotesStore() {
  return {
    subscribe: notesList.subscribe,
    init: async () => {
      try {
        const fileExists = await exists(DATA_FILE, {
          baseDir: BaseDirectory.AppData,
        });
        if (fileExists) {
          const raw = await readTextFile(DATA_FILE, {
            baseDir: BaseDirectory.AppData,
          });
          const parsed = JSON.parse(raw);
          // Support old format (plain array) and new format ({notes, folders})
          if (Array.isArray(parsed)) {
            notesList.set(parsed);
            const allFolders = [...new Set(parsed.filter((n: Note) => n.folder).map((n: Note) => n.folder!))];
            foldersList.set(allFolders);
          } else {
            notesList.set(parsed.notes || []);
            foldersList.set(parsed.folders || []);
          }
          const loaded = get(notesList);
          if (loaded.length > 0) {
            const maxId = Math.max(...loaded.map((n) => parseInt(n.id, 10)));
            currentId = maxId + 1;
          }
          return;
        }
      } catch (e) {
        console.error("Failed to load notes:", e);
      }
      persistToDisk({ notes: [], folders: [] });
    },
    add: () => {
      const note: Note = {
        id: String(currentId++),
        content: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      notesList.update((notes) => [note, ...notes]);
      debouncedPersist(getCurrentData());
      return note.id;
    },
    addToFolder: (folder: string) => {
      const note: Note = {
        id: String(currentId++),
        content: "",
        folder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      notesList.update((notes) => [note, ...notes]);
      debouncedPersist(getCurrentData());
      return note.id;
    },
    updateContent: (id: string, content: string) => {
      notesList.update((notes) =>
        notes.map((n) =>
          n.id === id
            ? { ...n, content, updatedAt: new Date().toISOString() }
            : n
        )
      );
      debouncedPersist(getCurrentData());
    },
    renameFolder: (oldName: string, newName: string) => {
      notesList.update((notes) =>
        notes.map((n) =>
          n.folder === oldName ? { ...n, folder: newName } : n
        )
      );
      foldersList.update((f) => f.map((name) => (name === oldName ? newName : name)));
      debouncedPersist(getCurrentData());
    },
    moveToFolder: (id: string, folder: string | undefined) => {
      notesList.update((notes) =>
        notes.map((n) => (n.id === id ? { ...n, folder } : n))
      );
      debouncedPersist(getCurrentData());
    },
    remove: (id: string) => {
      notesList.update((notes) => notes.filter((n) => n.id !== id));
      debouncedPersist(getCurrentData());
    },
  };
}

export function addFolder(name: string) {
  foldersList.update((f) => [...f, name]);
  debouncedPersist(getCurrentData());
}

export function deleteFolderWithContents(name: string) {
  notesList.update((notes) => notes.filter((n) => n.folder !== name));
  foldersList.update((f) => f.filter((fn) => fn !== name));
  debouncedPersist(getCurrentData());
}

export const folders = { subscribe: foldersList.subscribe };

export const notes = createNotesStore();

export const activeNoteId = writable<string | null>(null);
