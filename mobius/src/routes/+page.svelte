<script lang="ts">
  import Sidebar from "$lib/components/Sidebar.svelte";
  import NoteEditor from "$lib/components/NoteEditor.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import SuggestionQueue from "$lib/components/SuggestionQueue.svelte";
  import SessionModal from "$lib/components/SessionModal.svelte";
  import GlossaryEditor from "$lib/components/GlossaryEditor.svelte";
  import { notes, activeNoteId } from "$lib/stores/notes";
  import { glossary } from "$lib/stores/glossary";
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  const appWindow = getCurrentWindow();

  function startDrag(e: MouseEvent) {
    if (e.button === 0 && e.detail === 1) {
      appWindow.startDragging();
    }
  }

  function closeWindow() { appWindow.close(); }
  function minimizeWindow() { appWindow.minimize(); }
  function toggleMaximize() { appWindow.toggleMaximize(); }

  let sidebarCollapsed = false;
  let activeView: "notes" | "concepts" | "goals" | "glossary" = "notes";
  let commandPaletteOpen = false;
  let sessionModalOpen = false;
  let noteEditing = false;

  onMount(() => {
    notes.init();
    glossary.init();
  });

  function handleNewNote() {
    const id = notes.add();
    activeNoteId.set(id);
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
    if (e.metaKey && e.shiftKey && e.key === "S") {
      e.preventDefault();
      sessionModalOpen = true;
    }
    if (e.metaKey && e.key === "e") {
      e.preventDefault();
      noteEditing = !noteEditing;
    }
    if (e.metaKey && e.key === "b") {
      e.preventDefault();
      sidebarCollapsed = !sidebarCollapsed;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex flex-col h-screen w-full bg-deepest" style="border-radius: 10px; overflow: hidden;">
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="h-10 shrink-0 flex items-center justify-between px-4" on:mousedown={startDrag}>
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <button
          class="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-90 transition-all duration-150"
          on:mousedown|stopPropagation
          on:click={closeWindow}
          title="Close"
        ></button>
        <button
          class="w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-90 transition-all duration-150"
          on:mousedown|stopPropagation
          on:click={minimizeWindow}
          title="Minimize"
        ></button>
        <button
          class="w-3 h-3 rounded-full bg-[#28c840] hover:brightness-90 transition-all duration-150"
          on:mousedown|stopPropagation
          on:click={toggleMaximize}
          title="Maximize"
        ></button>
      </div>
      <span class="text-xs text-text-muted select-none">mobius v0.0.1</span>
    </div>
  </div>

  <div class="flex flex-1 min-h-0">
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
</div>

<CommandPalette
  bind:open={commandPaletteOpen}
  onClose={() => (commandPaletteOpen = false)}
  onNewNote={handleNewNote}
  onStartSession={() => { commandPaletteOpen = false; sessionModalOpen = true; }}
/>

<SessionModal
  bind:open={sessionModalOpen}
  onClose={() => (sessionModalOpen = false)}
/>
