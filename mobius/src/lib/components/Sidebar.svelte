<script lang="ts">
  import { notes, activeNoteId } from "$lib/stores/notes";
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

  function getTitle(content: string): string {
    const first = content.split("\n")[0] || "Untitled";
    return first.replace(/^#+\s*/, "");
  }

  function getCounts(section: string): number {
    if (section === "notes") return $notes.length;
    return 0;
  }
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
          <span class="text-text-muted text-xs ml-1">{getCounts(section.id)}</span>
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
            <button
              class="w-full text-left px-5 py-1 text-sm truncate transition-all duration-150 ease-out
                {$activeNoteId === note.id ? 'text-text-primary bg-accent-subtle' : 'text-text-secondary hover:opacity-80'}"
              on:click={() => activeNoteId.set(note.id)}
            >
              {getTitle(note.content) || "Untitled"}
            </button>
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
