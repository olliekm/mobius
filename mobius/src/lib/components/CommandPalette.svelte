<script lang="ts">
  import { notes, activeNoteId } from "$lib/stores/notes";

  export let open = false;
  export let onClose: () => void = () => {};
  export let onNewNote: () => void = () => {};
  let query = "";
  let inputEl: HTMLInputElement;
  let selectedIndex = 0;

  interface PaletteItem {
    id: string;
    label: string;
    section: string;
    shortcut?: string;
    action: () => void;
  }

  $: actions = [
    { id: "new", label: "New note", section: "Actions", shortcut: "\u2318N", action: onNewNote },
  ] as PaletteItem[];

  $: noteItems = $notes.map((n) => ({
    id: n.id,
    label: n.content.split("\n")[0]?.replace(/^#+\s*/, "") || "Untitled",
    section: "Notes",
    action: () => {
      activeNoteId.set(n.id);
      onClose();
    },
  })) as PaletteItem[];

  $: allItems = [...noteItems, ...actions];

  $: filtered = query
    ? allItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  $: selectedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  $: if (open && inputEl) {
    setTimeout(() => inputEl?.focus(), 10);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      query = "";
      onClose();
    } else if (e.key === "Escape") {
      query = "";
      onClose();
    }
  }

  function groupBy(items: PaletteItem[]): Record<string, PaletteItem[]> {
    const groups: Record<string, PaletteItem[]> = {};
    for (const item of items) {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    }
    return groups;
  }

  $: groups = groupBy(filtered);
</script>

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh]" on:click={onClose}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      class="w-full max-w-lg bg-surface border border-border-subtle rounded-lg shadow-2xl overflow-hidden"
      on:click|stopPropagation
    >
      <div class="p-3 border-b border-border-subtle">
        <input
          bind:this={inputEl}
          bind:value={query}
          on:keydown={handleKeydown}
          class="w-full bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted"
          placeholder="> search notes, commands..."
        />
      </div>
      <div class="max-h-72 overflow-y-auto p-1">
        {#each Object.entries(groups) as [section, items]}
          <div class="px-2 py-1.5 text-xs text-text-muted">{section}</div>
          {#each items as item, i}
            {@const globalIdx = filtered.indexOf(item)}
            <button
              class="w-full text-left px-3 py-1.5 text-sm rounded flex items-center justify-between transition-colors duration-150
                {globalIdx === selectedIndex ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated/50'}"
              on:click={() => { item.action(); query = ""; onClose(); }}
              on:mouseenter={() => (selectedIndex = globalIdx)}
            >
              <span>{item.label}</span>
              {#if item.shortcut}
                <span class="text-xs text-text-muted">{item.shortcut}</span>
              {/if}
            </button>
          {/each}
        {/each}
      </div>
    </div>
  </div>
{/if}
