<script lang="ts">
  import Sidebar from "$lib/components/Sidebar.svelte";
  import NoteEditor from "$lib/components/NoteEditor.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import SuggestionQueue from "$lib/components/SuggestionQueue.svelte";
  import GlossaryEditor from "$lib/components/GlossaryEditor.svelte";
  import { notes, activeNoteId } from "$lib/stores/notes";
  import { glossary } from "$lib/stores/glossary";
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";

  let sidebarCollapsed = false;
  let activeView: "notes" | "concepts" | "glossary" = "notes";
  let commandPaletteOpen = false;
  let noteEditing = false;

  onMount(async () => {
    await Promise.all([notes.init(), glossary.init()]);
    invoke("show_window");
  });

  function handleNewNote() {
    const id = notes.add();
    activeNoteId.set(id);
    noteEditing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.metaKey && e.key === "k") {
      e.preventDefault();
      commandPaletteOpen = !commandPaletteOpen;
    }
    if (e.metaKey && e.key === "n") {
      e.preventDefault();
      handleNewNote();
    }
    if (e.metaKey && e.key === "e") {
      e.preventDefault();
      noteEditing = !noteEditing;
    }
    if (e.metaKey && e.key === "w") {
      e.preventDefault();
      activeNoteId.set(null);
    }
    if (e.metaKey && e.key === "b") {
      e.preventDefault();
      sidebarCollapsed = !sidebarCollapsed;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex h-screen w-full bg-deepest">
  <Sidebar
    bind:collapsed={sidebarCollapsed}
    bind:activeView
    onNewNote={handleNewNote}
  />

  <div class="flex-1 flex flex-col min-w-0">
    {#if activeView === "glossary"}
      <GlossaryEditor bind:editing={noteEditing} />
    {:else}
      <NoteEditor bind:editing={noteEditing} on:navigateGlossary={() => (activeView = "glossary")} />
    {/if}
    <SuggestionQueue />
  </div>
</div>

<CommandPalette
  bind:open={commandPaletteOpen}
  onClose={() => (commandPaletteOpen = false)}
  onNewNote={handleNewNote}
/>
