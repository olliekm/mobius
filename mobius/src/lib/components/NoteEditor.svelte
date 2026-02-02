<script lang="ts">
  import { notes, activeNoteId } from "$lib/stores/notes";
  import { marked, type TokenizerExtension, type RendererExtension } from "marked";
  import katex from "katex";
  import "katex/dist/katex.min.css";
  import { writeFile, mkdir, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
  import { appDataDir } from "@tauri-apps/api/path";
  import { convertFileSrc } from "@tauri-apps/api/core";
  let content = "";
  let saved = true;
  export let editing = false;
  let saveTimeout: ReturnType<typeof setTimeout>;
  let textareaEl: HTMLTextAreaElement;

  // KaTeX marked extensions
  const blockMath = {
    name: "blockMath",
    level: "block" as const,
    start(src: string) { return src.indexOf("$$"); },
    tokenizer(src: string) {
      const match = src.match(/^\$\$([\s\S]+?)\$\$/);
      if (match) {
        return { type: "blockMath", raw: match[0], text: match[1].trim() };
      }
    },
    renderer(token: { text: string }) {
      try {
        return `<div class="katex-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`;
      } catch {
        return `<div class="katex-block katex-error">${token.text}</div>`;
      }
    },
  } as TokenizerExtension & RendererExtension;

  const inlineMath = {
    name: "inlineMath",
    level: "inline" as const,
    start(src: string) { return src.indexOf("$"); },
    tokenizer(src: string) {
      const match = src.match(/^\$([^\$\n]+?)\$/);
      if (match) {
        return { type: "inlineMath", raw: match[0], text: match[1].trim() };
      }
    },
    renderer(token: { text: string }) {
      try {
        return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
      } catch {
        return `<span class="katex-error">${token.text}</span>`;
      }
    },
  } as TokenizerExtension & RendererExtension;

  marked.use({ extensions: [blockMath, inlineMath] });

  $: currentNote = $notes.find((n) => n.id === $activeNoteId);
  $: if (currentNote) {
    content = currentNote.content;
    saved = true;
  }

  $: html = marked.parse(content || "", { async: false }) as string;

  function scheduleSave() {
    saved = false;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if ($activeNoteId) {
        notes.updateContent($activeNoteId, content);
        saved = true;
      }
    }, 500);
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    content = target.value;
    scheduleSave();
  }

  function isInsideCodeBlock(text: string, pos: number): boolean {
    const before = text.substring(0, pos);
    const fenceCount = (before.match(/^```/gm) || []).length;
    return fenceCount % 2 === 1;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const indent = isInsideCodeBlock(content, start) ? "    " : "  ";
      content = content.substring(0, start) + indent + content.substring(end);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + indent.length;
      }, 0);
      scheduleSave();
    }
  }

  async function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        const buffer = await file.arrayBuffer();
        const ext = file.type.split("/")[1] || "png";
        const id = crypto.randomUUID();
        const filename = `${id}.${ext}`;
        const assetsDir = "mobius/assets";

        const dirExists = await exists(assetsDir, { baseDir: BaseDirectory.AppData });
        if (!dirExists) {
          await mkdir(assetsDir, { baseDir: BaseDirectory.AppData, recursive: true });
        }

        await writeFile(`${assetsDir}/${filename}`, new Uint8Array(buffer), { baseDir: BaseDirectory.AppData });

        const dataDir = (await appDataDir()).replace(/\/$/, "");
        const filePath = `${dataDir}/${assetsDir}/${filename}`;
        const assetUrl = convertFileSrc(filePath);

        const target = textareaEl;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const imgMarkdown = `![image](${assetUrl})`;
        content = content.substring(0, start) + imgMarkdown + content.substring(end);
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + imgMarkdown.length;
        }, 0);
        scheduleSave();
        return;
      }
    }
  }

  function startEditing() {
    editing = true;
    setTimeout(() => textareaEl?.focus(), 0);
  }

  function stopEditing() {
    editing = false;
    if ($activeNoteId && !saved) {
      notes.updateContent($activeNoteId, content);
      saved = true;
    }
  }
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden">
  {#if currentNote}
    {#if editing}
      <textarea
        bind:this={textareaEl}
        class="flex-1 w-full bg-transparent text-text-primary text-base resize-none outline-none px-8 py-2 leading-relaxed font-sans placeholder:text-text-muted"
        value={content}
        on:input={handleInput}
        on:keydown={handleKeydown}
        on:paste={handlePaste}
        on:blur={stopEditing}
        placeholder="Start writing..."
        spellcheck={false}
      ></textarea>
    {:else}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div
        class="flex-1 overflow-y-auto px-8 py-2 cursor-text prose-container"
        on:click={startEditing}
      >
        {@html html}
      </div>
    {/if}
  {:else}
    <div class="flex-1 flex items-center justify-center">
      <p class="text-text-muted text-sm">Select a note or create a new one</p>
    </div>
  {/if}
</div>

<style>
  .prose-container :global(h1) {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px 0;
  }
  .prose-container :global(h2) {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 20px 0 10px 0;
  }
  .prose-container :global(h3) {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 16px 0 8px 0;
  }
  .prose-container :global(p) {
    font-size: 16px;
    color: var(--text-primary);
    line-height: 1.7;
    margin: 0 0 10px 0;
  }
  .prose-container :global(ul),
  .prose-container :global(ol) {
    font-size: 16px;
    color: var(--text-primary);
    line-height: 1.7;
    padding-left: 24px;
    margin: 0 0 10px 0;
  }
  .prose-container :global(li) {
    margin: 2px 0;
  }
  .prose-container :global(code) {
    font-family: var(--font-mono);
    font-size: 13px;
    background: var(--bg-elevated);
    padding: 1px 4px;
    border-radius: 3px;
  }
  .prose-container :global(pre) {
    background: var(--bg-elevated);
    border-radius: 6px;
    padding: 12px;
    margin: 8px 0;
    overflow-x: auto;
  }
  .prose-container :global(pre code) {
    background: none;
    padding: 0;
  }
  .prose-container :global(strong) {
    font-weight: 600;
  }
  .prose-container :global(a) {
    color: var(--accent);
    text-decoration: none;
  }
  .prose-container :global(blockquote) {
    border-left: 2px solid var(--border-subtle);
    padding-left: 12px;
    color: var(--text-secondary);
    margin: 8px 0;
  }
  .prose-container :global(img) {
    max-width: 100%;
    border-radius: 6px;
    margin: 8px 0;
  }
  .prose-container :global(.katex-block) {
    text-align: center;
    margin: 12px 0;
  }
  .prose-container :global(.katex-error) {
    color: var(--danger);
    font-family: var(--font-mono);
    font-size: 13px;
  }
</style>
