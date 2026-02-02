<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { notes, activeNoteId } from "$lib/stores/notes";
  import { marked, type TokenizerExtension, type RendererExtension } from "marked";
  import katex from "katex";
  import "katex/dist/katex.min.css";
  import { writeFile, readFile, mkdir, exists, BaseDirectory } from "@tauri-apps/plugin-fs";

  import { EditorState, type Extension } from "@codemirror/state";
  import { EditorView, Decoration, WidgetType, ViewPlugin, type DecorationSet, type ViewUpdate, keymap, hoverTooltip } from "@codemirror/view";
  import { markdown } from "@codemirror/lang-markdown";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { languages } from "@codemirror/language-data";
  import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
  import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
  import { glossaryEntries, type GlossaryEntry } from "$lib/stores/glossary";
  import { get } from "svelte/store";

  export let editing = false;
  const dispatch = createEventDispatcher<{ navigateGlossary: string }>();

  let editorContainer: HTMLDivElement;
  let editorView: EditorView | null = null;
  let content = "";
  let saved = true;
  let saveTimeout: ReturnType<typeof setTimeout>;
  let lastActiveNoteId: string | null = null;

  // KaTeX marked extensions for preview mode
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

  let html = "";
  $: resolveHtml(content);

  async function resolveHtml(src: string) {
    let raw = marked.parse(src || "", { async: false }) as string;
    // Replace all mobius-asset:// URLs with blob URLs
    const assetRegex = /mobius-asset:\/\/([^")\s]+)/g;
    const matches = [...raw.matchAll(assetRegex)];
    for (const match of matches) {
      const resolved = await resolveImageUrl(`mobius-asset://${match[1]}`);
      if (resolved) {
        raw = raw.replace(match[0], resolved);
      }
    }
    // Replace {Term} with styled glossary references
    const entries = get(glossaryEntries);
    raw = raw.replace(/\{([^}]+)\}/g, (_match, term) => {
      const lower = term.toLowerCase();
      const entry = entries.find(
        (e) => e.term.toLowerCase() === lower || e.aliases.some((a: string) => a.toLowerCase() === lower)
      );
      if (!entry) return `{${term}}`;
      const escaped = entry.definition.replace(/"/g, "&quot;").replace(/</g, "&lt;");
      return `<span class="glossary-ref" data-term="${entry.term}" data-definition="${escaped}" style="color: var(--accent); font-weight: 600; cursor: pointer;">${term}</span>`;
    });
    html = raw;
  }

  // Sync content when note changes
  $: if (currentNote && currentNote.id !== lastActiveNoteId) {
    content = currentNote.content;
    saved = true;
    lastActiveNoteId = currentNote.id;
    if (editorView) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: content },
      });
    }
  }

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

  // Blob URL cache to avoid re-reading files
  const blobCache = new Map<string, string>();

  async function resolveImageUrl(url: string): Promise<string> {
    // Handle our custom mobius-asset:// scheme
    if (url.startsWith("mobius-asset://")) {
      const relativePath = url.replace("mobius-asset://", "");
      if (blobCache.has(relativePath)) return blobCache.get(relativePath)!;
      try {
        const data = await readFile(`mobius/assets/${relativePath}`, { baseDir: BaseDirectory.AppData });
        const ext = relativePath.split(".").pop() || "png";
        const mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
        const blob = new Blob([data], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        blobCache.set(relativePath, blobUrl);
        return blobUrl;
      } catch {
        return "";
      }
    }
    return url;
  }

  // Image widget that renders inline
  class ImageWidget extends WidgetType {
    url: string;
    alt: string;
    constructor(url: string, alt: string) { super(); this.url = url; this.alt = alt; }

    toDOM() {
      const wrapper = document.createElement("div");
      wrapper.style.margin = "4px 0";
      const img = document.createElement("img");
      img.alt = this.alt;
      img.style.maxWidth = "100%";
      img.style.borderRadius = "6px";
      img.style.display = "block";

      resolveImageUrl(this.url).then((resolved) => {
        if (resolved) img.src = resolved;
      });

      wrapper.appendChild(img);
      return wrapper;
    }

    eq(other: ImageWidget) {
      return this.url === other.url && this.alt === other.alt;
    }

    ignoreEvent() { return false; }
  }

  // Regex for markdown images
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  // Plugin that decorates image lines with rendered images when cursor is elsewhere
  function imageDecorations(view: EditorView): DecorationSet {
    const widgets: any[] = [];
    const doc = view.state.doc;
    const cursorLine = doc.lineAt(view.state.selection.main.head).number;

    for (let i = 1; i <= doc.lines; i++) {
      if (i === cursorLine) continue;
      const line = doc.line(i);
      const text = line.text;
      let match;
      imageRegex.lastIndex = 0;
      while ((match = imageRegex.exec(text)) !== null) {
        const alt = match[1];
        const url = match[2];
        // Only replace if the entire line is just the image markdown
        if (text.trim() === match[0]) {
          widgets.push(
            Decoration.replace({
              widget: new ImageWidget(url, alt),
            }).range(line.from, line.to)
          );
        } else {
          // Inline image within text — place widget after the match
          const from = line.from + match.index;
          const to = from + match[0].length;
          widgets.push(
            Decoration.replace({
              widget: new ImageWidget(url, alt),
            }).range(from, to)
          );
        }
      }
    }

    return Decoration.set(widgets, true);
  }

  const imagePlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = imageDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.decorations = imageDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );

  // Image paste handler for CodeMirror
  const pasteHandler = EditorView.domEventHandlers({
    paste(e: ClipboardEvent, view: EditorView) {
      const items = e.clipboardData?.items;
      if (!items) return false;

      let hasImage = false;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          hasImage = true;
          break;
        }
      }
      if (!hasImage) return false;

      // Found an image — prevent default and handle async
      e.preventDefault();
      (async () => {
        for (const item of items) {
          if (item.type.startsWith("image/")) {
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

            const assetUrl = `mobius-asset://${filename}`;

            const pos = view.state.selection.main.head;
            const imgMarkdown = `![image](${assetUrl})`;
            view.dispatch({
              changes: { from: pos, insert: imgMarkdown },
              selection: { anchor: pos + imgMarkdown.length },
            });
            return;
          }
        }
      })();
      return true;
    },
  });

  // Dark theme
  const darkTheme = EditorView.theme({
    "&": {
      backgroundColor: "var(--bg-deepest)",
      color: "var(--text-primary)",
      fontSize: "16px",
      fontFamily: "var(--font-sans)",
      flex: "1",
      overflow: "hidden",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      padding: "8px 32px",
      lineHeight: "1.7",
      flex: "1",
    },
    ".cm-content": {
      caretColor: "var(--text-primary)",
    },
    ".cm-line": {
      padding: "0",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--text-primary)",
    },
    ".cm-selectionBackground": {
      backgroundColor: "var(--accent-subtle) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--accent-subtle) !important",
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
    },
  }, { dark: true });

  // Tab handling
  const tabKeymap = keymap.of([
    {
      key: "Tab",
      run(view: EditorView) {
        const pos = view.state.selection.main.head;
        const doc = view.state.doc.toString();
        const before = doc.substring(0, pos);
        const fenceCount = (before.match(/^```/gm) || []).length;
        const inCodeBlock = fenceCount % 2 === 1;
        const indent = inCodeBlock ? "    " : "  ";
        view.dispatch({
          changes: { from: pos, insert: indent },
          selection: { anchor: pos + indent.length },
        });
        return true;
      },
    },
  ]);

  // Update listener for auto-save
  const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.docChanged) {
      content = update.state.doc.toString();
      scheduleSave();
    }
  });

  // Glossary autocomplete — triggers on {
  function glossaryCompletion(context: CompletionContext): CompletionResult | null {
    const before = context.matchBefore(/\{[^}]*/);
    if (!before) return null;

    const query = before.text.slice(1).toLowerCase(); // strip leading {
    const entries = get(glossaryEntries);

    const options = entries
      .filter((e) => {
        if (!query) return true;
        return (
          e.term.toLowerCase().includes(query) ||
          e.aliases.some((a) => a.toLowerCase().includes(query))
        );
      })
      .map((e) => ({
        label: e.term,
        detail: e.aliases.length ? `[${e.aliases.join(", ")}]` : undefined,
        info: e.definition.slice(0, 120) + (e.definition.length > 120 ? "…" : ""),
        apply: `{${e.term}}`,
      }));

    if (options.length === 0) return null;

    return {
      from: before.from,
      options,
      filter: false,
    };
  }

  const glossaryAutocomplete = autocompletion({
    override: [glossaryCompletion],
    activateOnTyping: true,
  });

  // Glossary hover tooltip — shows definition on {Term}
  function findGlossaryEntry(term: string): GlossaryEntry | undefined {
    const entries = get(glossaryEntries);
    const lower = term.toLowerCase();
    return entries.find(
      (e) =>
        e.term.toLowerCase() === lower ||
        e.aliases.some((a) => a.toLowerCase() === lower)
    );
  }

  const glossaryTooltip = hoverTooltip((view, pos) => {
    const doc = view.state.doc;
    const line = doc.lineAt(pos);
    const text = line.text;
    const offset = pos - line.from;

    // Find {term} surrounding the hover position
    let start = -1;
    let end = -1;
    for (let i = offset; i >= 0; i--) {
      if (text[i] === "{") { start = i; break; }
      if (text[i] === "}") break;
    }
    for (let i = offset; i < text.length; i++) {
      if (text[i] === "}") { end = i; break; }
      if (text[i] === "{" && i !== start) break;
    }

    if (start === -1 || end === -1) return null;

    const term = text.slice(start + 1, end);
    const entry = findGlossaryEntry(term);
    if (!entry) return null;

    return {
      pos: line.from + start,
      end: line.from + end + 1,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.style.cssText = `
          padding: 8px 12px;
          max-width: 360px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
          line-height: 1.5;
        `;

        const title = document.createElement("div");
        title.style.cssText = "font-weight: 600; margin-bottom: 4px; color: var(--accent); cursor: pointer;";
        title.textContent = entry.term;
        title.addEventListener("click", () => {
          dispatch("navigateGlossary", entry.term);
        });
        if (entry.aliases.length) {
          const aliasSpan = document.createElement("span");
          aliasSpan.style.cssText = "font-weight: 400; color: var(--text-muted); margin-left: 6px;";
          aliasSpan.textContent = `[${entry.aliases.join(", ")}]`;
          title.appendChild(aliasSpan);
        }

        const body = document.createElement("div");
        body.style.color = "var(--text-secondary)";
        // Render definition through marked (with KaTeX support)
        body.innerHTML = marked.parse(entry.definition, { async: false }) as string;

        dom.appendChild(title);
        dom.appendChild(body);
        return { dom };
      },
    };
  });

  function createEditor(doc: string) {
    if (editorView) {
      editorView.destroy();
    }

    const state = EditorState.create({
      doc,
      extensions: [
        darkTheme,
        tabKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        history(),
        search(),
        markdown({ codeLanguages: languages }),
        imagePlugin,
        pasteHandler,
        updateListener,
        glossaryAutocomplete,
        glossaryTooltip,
        EditorView.lineWrapping,
        EditorState.tabSize.of(4),
      ],
    });

    editorView = new EditorView({
      state,
      parent: editorContainer,
    });
  }

  function startEditing() {
    editing = true;
  }

  onDestroy(() => {
    editorView?.destroy();
    editorView = null;
    clearTimeout(saveTimeout);
    if (previewTooltip) { previewTooltip.remove(); previewTooltip = null; }
  });

  let previewTooltip: HTMLDivElement | null = null;

  function handlePreviewMouseover(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("glossary-ref")) return;
    const term = target.dataset.term || "";
    const entry = findGlossaryEntry(term);
    if (!entry) return;

    if (previewTooltip) previewTooltip.remove();
    const tip = document.createElement("div");
    tip.className = "glossary-preview-tooltip";
    tip.style.cssText = `
      position: fixed; z-index: 100; padding: 8px 12px; max-width: 360px;
      background: var(--bg-elevated); border: 1px solid var(--border-subtle);
      border-radius: 6px; color: var(--text-primary); font-size: 13px; line-height: 1.5;
      pointer-events: none;
    `;
    const title = document.createElement("div");
    title.style.cssText = "font-weight: 600; margin-bottom: 4px; color: var(--accent);";
    title.textContent = entry.term;
    if (entry.aliases.length) {
      const aliasSpan = document.createElement("span");
      aliasSpan.style.cssText = "font-weight: 400; color: var(--text-muted); margin-left: 6px;";
      aliasSpan.textContent = `[${entry.aliases.join(", ")}]`;
      title.appendChild(aliasSpan);
    }
    const body = document.createElement("div");
    body.style.color = "var(--text-secondary)";
    body.innerHTML = marked.parse(entry.definition, { async: false }) as string;
    tip.appendChild(title);
    tip.appendChild(body);
    document.body.appendChild(tip);
    previewTooltip = tip;

    const rect = target.getBoundingClientRect();
    tip.style.left = `${rect.left}px`;
    tip.style.top = `${rect.top - tip.offsetHeight - 6}px`;
  }

  function handlePreviewMouseout(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("glossary-ref")) return;
    if (previewTooltip) { previewTooltip.remove(); previewTooltip = null; }
  }

  function mountEditor(node: HTMLDivElement) {
    editorContainer = node;
    createEditor(content);
    return {
      destroy() {
        editorView?.destroy();
        editorView = null;
      },
    };
  }
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden">
  {#if currentNote}
    {#if editing}
      <!-- Full rendered preview mode -->
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div
        class="flex-1 overflow-y-auto px-8 py-2 cursor-text prose-container"
        on:click={(e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains("glossary-ref")) {
            e.stopPropagation();
            dispatch("navigateGlossary", target.dataset.term || "");
            return;
          }
          editing = false;
        }}
        on:mouseover={handlePreviewMouseover}
        on:mouseout={handlePreviewMouseout}
      >
        {@html html}
      </div>
    {:else}
      <!-- CodeMirror editor with inline images -->
      <div class="flex-1 overflow-hidden cm-wrapper" use:mountEditor></div>
    {/if}
  {:else}
    <div class="flex-1 flex items-center justify-center">
      <p class="text-text-muted text-sm">Select a note or create a new one</p>
    </div>
  {/if}
</div>

<style>
  .cm-wrapper {
    display: flex;
    flex-direction: column;
  }
  .cm-wrapper :global(.cm-editor) {
    flex: 1;
    overflow: hidden;
  }
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
  .prose-container :global(ul) {
    font-size: 16px;
    color: var(--text-primary);
    line-height: 1.7;
    padding-left: 24px;
    margin: 0 0 10px 0;
    list-style: disc;
  }
  .prose-container :global(ol) {
    font-size: 16px;
    color: var(--text-primary);
    line-height: 1.7;
    padding-left: 24px;
    margin: 0 0 10px 0;
    list-style: decimal;
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
