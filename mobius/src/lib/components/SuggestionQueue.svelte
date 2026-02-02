<script lang="ts">
  import { suggestions, dismissSuggestion } from "$lib/stores/suggestions";

  let expanded = false;
</script>

{#if $suggestions.length > 0}
  <div class="border-t border-border-subtle bg-surface">
    <button
      class="w-full px-4 py-2 text-left text-xs text-text-muted hover:text-text-secondary flex items-center gap-1.5 transition-opacity duration-150"
      on:click={() => (expanded = !expanded)}
    >
      <span class="text-[10px]">{expanded ? "\u25be" : "\u25b8"}</span>
      {#if expanded}
        Suggestions
      {:else}
        {$suggestions.length} suggestion{$suggestions.length > 1 ? "s" : ""}
      {/if}
    </button>

    {#if expanded}
      <div class="px-2 pb-2">
        {#each $suggestions as suggestion}
          <div class="flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-elevated/50 transition-colors duration-150 group">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0"
                style="background: {suggestion.type === 'tension' ? 'var(--warning)' : suggestion.type === 'define' ? 'var(--accent)' : 'var(--text-muted)'}"
              ></span>
              <span class="text-text-secondary truncate">{suggestion.text}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button class="text-xs text-accent hover:text-text-primary transition-opacity duration-150">
                {suggestion.action}
              </button>
              <button
                class="text-xs text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                on:click={() => dismissSuggestion(suggestion.id)}
              >
                &times;
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
