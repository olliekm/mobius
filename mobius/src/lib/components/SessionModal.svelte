<script lang="ts">
  import { startSession } from "$lib/stores/session";

  export let open = false;
  export let onClose: () => void = () => {};

  let intention = "";
  let inputEl: HTMLInputElement;

  const recentIntentions = ["transformers", "RLHF", "backprop"];

  $: if (open && inputEl) {
    setTimeout(() => inputEl?.focus(), 10);
  }

  function submit() {
    startSession(intention || "open-ended");
    intention = "";
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      onClose();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" on:click={onClose}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="w-full max-w-[500px] bg-surface border border-border-subtle rounded-lg p-8" on:click|stopPropagation>
      <p class="text-lg text-text-primary mb-4">What do you want to focus on?</p>

      <input
        bind:this={inputEl}
        bind:value={intention}
        on:keydown={handleKeydown}
        class="w-full bg-elevated border border-border-subtle rounded-md px-4 py-3 text-lg text-text-primary outline-none placeholder:text-text-muted focus:border-accent/30 transition-colors duration-150"
        placeholder="I want to deeply understand..."
      />

      <div class="flex items-center justify-between mt-4">
        <div class="flex gap-2">
          {#each recentIntentions as recent}
            <button
              class="text-xs text-text-muted hover:text-text-secondary px-2 py-1 rounded bg-elevated/50 transition-opacity duration-150"
              on:click={() => (intention = recent)}
            >
              {recent}
            </button>
          {/each}
        </div>
        <button
          class="text-sm text-accent hover:text-text-primary px-3 py-1.5 rounded transition-opacity duration-150"
          on:click={submit}
        >
          Start
        </button>
      </div>
    </div>
  </div>
{/if}
