import { writable, derived } from "svelte/store";
import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

const GLOSSARY_FILE = "mobius/glossary.md";
const NOTES_DIR = "mobius";

let saveTimeout: ReturnType<typeof setTimeout>;

async function persistToDisk(content: string) {
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
    await writeTextFile(GLOSSARY_FILE, content, {
      baseDir: BaseDirectory.AppData,
    });
  } catch (e) {
    console.error("Failed to save glossary:", e);
  }
}

function debouncedPersist(content: string) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => persistToDisk(content), 300);
}

function createGlossaryStore() {
  const { subscribe, set } = writable<string>("");

  return {
    subscribe,
    init: async () => {
      try {
        const fileExists = await exists(GLOSSARY_FILE, {
          baseDir: BaseDirectory.AppData,
        });
        if (fileExists) {
          const raw = await readTextFile(GLOSSARY_FILE, {
            baseDir: BaseDirectory.AppData,
          });
          set(raw);
          return;
        }
      } catch (e) {
        console.error("Failed to load glossary:", e);
      }
      set("");
    },
    update: (content: string) => {
      set(content);
      debouncedPersist(content);
    },
  };
}

export const glossary = createGlossaryStore();

export interface GlossaryEntry {
  term: string;
  definition: string;
  aliases: string[];
}

export function parseGlossary(raw: string): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  const lines = raw.split("\n");
  let current: GlossaryEntry | null = null;
  let defLines: string[] = [];

  function flush() {
    if (current) {
      current.definition = defLines.join("\n").trim();
      entries.push(current);
      current = null;
      defLines = [];
    }
  }

  for (const line of lines) {
    const defMatch = line.match(/^#\s+def:\s*(.+)/i);
    if (defMatch) {
      flush();
      current = { term: defMatch[1].trim(), definition: "", aliases: [] };
      continue;
    }

    const altMatch = line.match(/^#\s+alt\s*=\s*\[([^\]]*)\]/i);
    if (altMatch && current) {
      current.aliases = altMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
      continue;
    }

    if (current) {
      defLines.push(line);
    }
  }
  flush();

  return entries;
}

export const glossaryEntries = derived(glossary, ($g) => parseGlossary($g));
