<script lang="ts">
  import { onDestroy } from "svelte";
  import { glossary } from "$lib/stores/glossary";
  import { marked, type TokenizerExtension, type RendererExtension } from "marked";
  import katex from "katex";
  import "katex/dist/katex.min.css";

  import { EditorState } from "@codemirror/state";
  import { EditorView, Decoration, WidgetType, ViewPlugin, type DecorationSet, type ViewUpdate, keymap } from "@codemirror/view";
  import { markdown } from "@codemirror/lang-markdown";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { languages } from "@codemirror/language-data";
  import { search, searchKeymap } from "@codemirror/search";

  export let editing = false;

  let editorContainer: HTMLDivElement;
  let editorView: EditorView | null = null;
  let content = "";

  // KaTeX extensions for preview
  const blockMath = {
    name: "blockMath",
    level: "block" as const,
    start(src: string) { return src.indexOf("$$"); },
    tokenizer(src: string) {
      const match = src.match(/^\$\$([\s\S]+?)\$\$/);
      if (match) return { type: "blockMath", raw: match[0], text: match[1].trim() };
    },
    renderer(token: { text: string }) {
      try {
        return `<div class="katex-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`;
      } catch { return `<div class="katex-block katex-error">${token.text}</div>`; }
    },
  } as TokenizerExtension & RendererExtension;

  const inlineMath = {
    name: "inlineMath",
    level: "inline" as const,
    start(src: string) { return src.indexOf("$"); },
    tokenizer(src: string) {
      const match = src.match(/^\$([^\$\n]+?)\$/);
      if (match) return { type: "inlineMath", raw: match[0], text: match[1].trim() };
    },
    renderer(token: { text: string }) {
      try {
        return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
      } catch { return `<span class="katex-error">${token.text}</span>`; }
    },
  } as TokenizerExtension & RendererExtension;

  marked.use({ extensions: [blockMath, inlineMath] });

  let html = "";
  $: resolveHtml(content);

  async function resolveHtml(src: string) {
    html = marked.parse(src || "", { async: false }) as string;
  }

  // Subscribe to store
  const unsub = glossary.subscribe((val) => {
    content = val;
    if (editorView && editorView.state.doc.toString() !== val) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: val },
      });
    }
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
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      overflow: "auto",
      padding: "8px 32px",
      lineHeight: "1.7",
      flex: "1",
    },
    ".cm-content": { caretColor: "var(--text-primary)" },
    ".cm-line": { padding: "0" },
    ".cm-cursor": { borderLeftColor: "var(--text-primary)" },
    ".cm-selectionBackground": { backgroundColor: "var(--accent-subtle) !important" },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: "var(--accent-subtle) !important" },
    ".cm-gutters": { display: "none" },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-activeLineGutter": { backgroundColor: "transparent" },
  }, { dark: true });

  // Tab handling
  const tabKeymap = keymap.of([{
    key: "Tab",
    run(view: EditorView) {
      const pos = view.state.selection.main.head;
      const doc = view.state.doc.toString();
      const before = doc.substring(0, pos);
      const fenceCount = (before.match(/^```/gm) || []).length;
      const indent = fenceCount % 2 === 1 ? "    " : "  ";
      view.dispatch({
        changes: { from: pos, insert: indent },
        selection: { anchor: pos + indent.length },
      });
      return true;
    },
  }]);

  // Update listener
  const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.docChanged) {
      content = update.state.doc.toString();
      glossary.update(content);
    }
  });

  function createEditor(doc: string) {
    if (editorView) editorView.destroy();

    const state = EditorState.create({
      doc,
      extensions: [
        darkTheme,
        tabKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        history(),
        search(),
        markdown({ codeLanguages: languages }),
        updateListener,
        EditorView.lineWrapping,
        EditorState.tabSize.of(4),
      ],
    });

    editorView = new EditorView({ state, parent: editorContainer });
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

  onDestroy(() => {
    unsub();
    editorView?.destroy();
    editorView = null;
  });
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden">
  {#if editing}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      class="flex-1 overflow-y-auto px-8 py-2 cursor-text prose-container"
      on:click={() => (editing = false)}
    >
      {@html html}
    </div>
  {:else}
    <div class="flex-1 overflow-hidden cm-wrapper" use:mountEditor></div>
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
    font-size: 20px;
    font-weight: 600;
    color: var(--accent);
    margin: 24px 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .prose-container :global(h2) {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 16px 0 6px 0;
  }
  .prose-container :global(p) {
    font-size: 16px;
    color: var(--text-primary);
    line-height: 1.7;
    margin: 0 0 8px 0;
  }
  .prose-container :global(ul),
  .prose-container :global(ol) {
    font-size: 16px;
    color: var(--text-primary);
    line-height: 1.7;
    padding-left: 24px;
    margin: 0 0 8px 0;
    list-style: disc;
  }
  .prose-container :global(ol) {
    list-style: decimal;
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
  .prose-container :global(blockquote) {
    border-left: 2px solid var(--border-subtle);
    padding-left: 12px;
    color: var(--text-secondary);
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
