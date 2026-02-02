<script lang="ts">
  import { notes, activeNoteId } from "$lib/stores/notes";
  import { glossaryEntries } from "$lib/stores/glossary";
  import {
    sessionActive,
    sessionDisplay,
    sessionIntention,
    sessionPaused,
    streak,
    togglePause,
    endSession,
  } from "$lib/stores/session";
  export let collapsed = false;
  export let activeView: "notes" | "concepts" | "goals" | "glossary" = "notes";
  export let onNewNote: () => void = () => {};

  const sections = [
    { id: "notes" as const, label: "Notes", icon: "N" },
    { id: "concepts" as const, label: "Concepts", icon: "C" },
    { id: "goals" as const, label: "Goals", icon: "G" },
    { id: "glossary" as const, label: "Glossary", icon: "L" },
  ];

  let confirmingDeleteId: string | null = null;

  function getTitle(content: string): string {
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)/);
      if (match) return match[1].trim();
    }
    // Fallback to first non-empty line
    const first = lines.find((l) => l.trim()) || "Untitled";
    return first.replace(/^#+\s*/, "").trim() || "Untitled";
  }

  function handleDelete(id: string) {
    confirmingDeleteId = id;
  }

  function confirmDelete() {
    if (confirmingDeleteId) {
      notes.remove(confirmingDeleteId);
      if ($activeNoteId === confirmingDeleteId) activeNoteId.set(null);
      confirmingDeleteId = null;
    }
  }

  function cancelDelete() {
    confirmingDeleteId = null;
  }

  $: counts = {
    notes: $notes.length,
    concepts: 0,
    goals: 0,
    glossary: $glossaryEntries.length,
  } as Record<string, number>;
</script>

<aside
  class="h-full flex flex-col border-r border-border-subtle transition-all duration-200 ease-out bg-surface"
  style="width: {collapsed ? '48px' : '240px'}"
>
  <!-- Sections -->
  <nav class="flex-1 overflow-y-auto">
    {#each sections as section}
      <button
        class="w-full text-left px-3 py-1.5 text-sm transition-opacity duration-150 ease-out
          {activeView === section.id ? 'bg-accent-subtle text-text-primary' : 'text-text-secondary hover:opacity-80'}"
        on:click={() => (activeView = section.id)}
      >
        {#if collapsed}
          <span class="text-xs font-medium">{section.icon}</span>
        {:else}
          <span>{section.label}</span>
          <span class="text-text-muted text-xs ml-1">{counts[section.id] || 0}</span>
        {/if}
      </button>

      <!-- Note list under active section -->
      {#if activeView === section.id && section.id === "notes" && !collapsed}
        <div class="mt-1 mb-2">
          <button
            class="w-full text-left px-5 py-1 text-xs text-text-muted hover:text-text-secondary transition-opacity duration-150"
            on:click={onNewNote}
          >
            + New note
          </button>
          {#each $notes as note}
            <div class="flex items-center group">
              <button
                class="flex-1 text-left px-5 py-1 text-sm truncate transition-all duration-150 ease-out
                  {$activeNoteId === note.id ? 'text-text-primary bg-accent-subtle' : 'text-text-secondary hover:opacity-80'}"
                on:click={() => activeNoteId.set(note.id)}
              >
                {getTitle(note.content) || "Untitled"}
              </button>
              <button
                class="px-2 py-1 text-xs shrink-0 text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity duration-150"
                on:click|stopPropagation={() => handleDelete(note.id)}
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  </nav>

  <!-- Session / Streak -->
  <div class="border-t border-border-subtle p-3 shrink-0">
    {#if $sessionActive && !collapsed}
      <div class="text-xs text-text-muted mb-1">Session</div>
      <div class="text-lg font-medium text-text-primary font-mono">{$sessionDisplay}</div>
      <div class="text-xs text-text-secondary truncate mt-0.5">{$sessionIntention}</div>
      <div class="flex gap-2 mt-2">
        <button
          class="text-xs text-text-secondary hover:text-text-primary transition-opacity duration-150"
          on:click={togglePause}
        >
          {$sessionPaused ? "Resume" : "Pause"}
        </button>
        <button
          class="text-xs text-text-secondary hover:text-text-primary transition-opacity duration-150"
          on:click={endSession}
        >
          End
        </button>
      </div>
    {/if}
    {#if !collapsed}
      <div class="text-xs text-text-muted mt-2">{$streak} day streak</div>
    {/if}
  </div>
</aside>

{#if confirmingDeleteId}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" on:click={cancelDelete}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="bg-surface border border-border-subtle rounded-lg p-5 w-72 shadow-xl" on:click|stopPropagation>
      <p class="text-text-primary text-sm mb-1">Delete note?</p>
      <p class="text-text-muted text-xs mb-4">This action cannot be undone.</p>
      <div class="flex justify-end gap-2">
        <button
          class="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded bg-elevated transition-colors duration-150"
          on:click={cancelDelete}
        >
          Cancel
        </button>
        <button
          class="px-3 py-1.5 text-xs text-white rounded bg-danger hover:brightness-90 transition-all duration-150"
          on:click={confirmDelete}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}
