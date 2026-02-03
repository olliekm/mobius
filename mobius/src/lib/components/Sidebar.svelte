<script lang="ts">
  import { notes, activeNoteId, folders, addFolder, deleteFolderWithContents, type Note } from "$lib/stores/notes";
  import { glossaryEntries } from "$lib/stores/glossary";

  export let collapsed = false;
  export let activeView: "notes" | "concepts" | "glossary" = "notes";
  export let onNewNote: () => void = () => {};

  const sections = [
    { id: "notes" as const, label: "Notes", icon: "N" },
    { id: "concepts" as const, label: "Concepts", icon: "C" },
    { id: "glossary" as const, label: "Glossary", icon: "L" },
  ];

  let confirmingDeleteId: string | null = null;
  let confirmingDeleteFolder: string | null = null;
  let openFolders: Record<string, boolean> = {};

  function getTitle(content: string): string {
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)/);
      if (match) return match[1].trim();
    }
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

  function toggleFolder(folder: string) {
    openFolders[folder] = !openFolders[folder];
    openFolders = openFolders;
  }

  $: groupedNotes = (() => {
    const folderMap: Record<string, Note[]> = {};
    const unfiled: Note[] = [];
    for (const note of $notes) {
      if (note.folder) {
        if (!folderMap[note.folder]) folderMap[note.folder] = [];
        folderMap[note.folder].push(note);
      } else {
        unfiled.push(note);
      }
    }
    return { folders: folderMap, unfiled };
  })();

  $: folderNames = [...$folders].sort();

  $: counts = {
    notes: $notes.length,
    concepts: 0,
    glossary: $glossaryEntries.length,
  } as Record<string, number>;

  let renamingFolder: string | null = null;
  let renameValue = "";

  function startRenameFolder(folder: string) {
    renamingFolder = folder;
    renameValue = folder;
  }

  function commitRenameFolder() {
    if (renamingFolder && renameValue.trim() && renameValue !== renamingFolder) {
      notes.renameFolder(renamingFolder, renameValue.trim());
      openFolders[renameValue.trim()] = openFolders[renamingFolder] ?? true;
      delete openFolders[renamingFolder];
      openFolders = openFolders;
    }
    renamingFolder = null;
  }

  function handleNewFolder() {
    const base = "New Folder";
    let name = base;
    let i = 1;
    while ($folders.includes(name)) {
      name = `${base} (${i})`;
      i++;
    }
    addFolder(name);
    openFolders[name] = true;
    openFolders = openFolders;
    renamingFolder = name;
    renameValue = name;
  }

  // Custom mouse-based drag and drop (HTML5 DnD doesn't work in Tauri's WKWebView)
  let draggingNoteId: string | null = null;
  let dropTarget: string | null = null;
  let dragGhost: HTMLDivElement | null = null;
  let isDragging = false;
  let dragStartY = 0;
  let dragStartX = 0;

  // Map of drop zone elements keyed by target name
  let dropZoneEls: Map<string, HTMLElement> = new Map();

  function registerDropZone(node: HTMLElement, key: string) {
    dropZoneEls.set(key, node);
    return {
      update(newKey: string) {
        dropZoneEls.delete(key);
        key = newKey;
        dropZoneEls.set(key, node);
      },
      destroy() {
        dropZoneEls.delete(key);
      },
    };
  }

  function onNoteMouseDown(e: MouseEvent, noteId: string) {
    // Only left click, ignore if on delete button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-delete-btn]')) return;

    draggingNoteId = noteId;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    isDragging = false;

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e: MouseEvent) {
    if (!draggingNoteId) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    // Start drag after 4px threshold
    if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isDragging = true;
      // Create ghost element
      const note = $notes.find((n) => n.id === draggingNoteId);
      if (note) {
        dragGhost = document.createElement("div");
        dragGhost.textContent = getTitle(note.content) || "Untitled";
        dragGhost.style.cssText = `
          position: fixed; z-index: 9999; pointer-events: none;
          padding: 4px 12px; font-size: 13px; border-radius: 4px;
          background: var(--bg-elevated); color: var(--text-primary);
          border: 1px solid var(--accent); opacity: 0.9;
          white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis;
        `;
        document.body.appendChild(dragGhost);
      }
    }

    if (isDragging && dragGhost) {
      dragGhost.style.left = `${e.clientX + 12}px`;
      dragGhost.style.top = `${e.clientY - 10}px`;

      // Hit test drop zones
      let found: string | null = null;
      for (const [key, el] of dropZoneEls) {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          found = key;
        }
      }
      dropTarget = found;
    }
  }

  function onMouseUp(_e: MouseEvent) {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);

    if (isDragging && draggingNoteId && dropTarget) {
      // Determine target folder
      const targetFolder = dropTarget === "__unfiled__" ? undefined : dropTarget;

      // Check current folder
      const note = $notes.find((n) => n.id === draggingNoteId);
      const currentFolder = note?.folder;

      if (currentFolder !== targetFolder) {
        notes.moveToFolder(draggingNoteId, targetFolder);
        if (targetFolder) {
          openFolders[targetFolder] = true;
          openFolders = openFolders;
        }
      }
    } else if (!isDragging && draggingNoteId) {
      // It was a click, not a drag — select the note
      activeNoteId.set(draggingNoteId);
    }

    // Cleanup
    if (dragGhost) {
      dragGhost.remove();
      dragGhost = null;
    }
    draggingNoteId = null;
    dropTarget = null;
    isDragging = false;
  }
</script>

<aside
  class="h-full flex flex-col border-r border-border-subtle transition-all duration-200 ease-out bg-surface select-none"
  style="width: {collapsed ? '48px' : '240px'}"
>
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

      {#if activeView === section.id && section.id === "notes" && !collapsed}
        <div class="mt-1 mb-2">
          <div class="flex items-center px-5 py-1 gap-1">
            <button
              class="text-xs text-text-muted hover:text-text-secondary transition-opacity duration-150"
              on:click={onNewNote}
            >
              + Note
            </button>
            <span class="text-text-muted text-xs">|</span>
            <button
              class="text-xs text-text-muted hover:text-text-secondary transition-opacity duration-150"
              on:click={handleNewFolder}
            >
              + Folder
            </button>
          </div>

          <!-- Folders -->
          {#each folderNames as folder}
            <div
              use:registerDropZone={folder}
              class="relative rounded-sm transition-all duration-100
                {dropTarget === folder ? 'bg-accent/20 outline outline-1 outline-accent/40' : ''}"
            >
              <div class="flex items-center group">
                <button
                  class="flex-1 text-left px-4 py-1 text-xs font-medium text-text-muted hover:text-text-secondary flex items-center gap-1 transition-opacity duration-150"
                  on:click={() => toggleFolder(folder)}
                >
                  <span class="text-[10px] inline-block transition-transform duration-150" style="transform: rotate({openFolders[folder] ? '90deg' : '0deg'})">&#9654;</span>
                  {#if renamingFolder === folder}
                    <!-- svelte-ignore a11y-autofocus -->
                    <input
                      class="bg-transparent text-text-primary text-xs outline-none border-b border-accent w-full"
                      bind:value={renameValue}
                      on:blur={commitRenameFolder}
                      on:keydown={(e) => { if (e.key === 'Enter') commitRenameFolder(); if (e.key === 'Escape') { renamingFolder = null; } }}
                      on:click|stopPropagation
                      autofocus
                    />
                  {:else}
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <span on:dblclick|stopPropagation={() => startRenameFolder(folder)}>{folder}</span>
                  {/if}
                </button>
                <button
                  class="px-2 py-1 text-xs shrink-0 text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity duration-150"
                  on:click|stopPropagation={() => { confirmingDeleteFolder = folder; }}
                >
                  &times;
                </button>
              </div>
              {#if openFolders[folder]}
                {#each groupedNotes.folders[folder] || [] as note}
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <div
                    class="flex items-center group cursor-grab active:cursor-grabbing
                      {isDragging && draggingNoteId === note.id ? 'opacity-30' : ''}"
                    on:mousedown={(e) => onNoteMouseDown(e, note.id)}
                  >
                    <div
                      class="flex-1 text-left px-7 py-1 text-sm truncate transition-all duration-150 ease-out
                        {$activeNoteId === note.id ? 'text-text-primary bg-accent-subtle' : 'text-text-secondary hover:opacity-80'}"
                    >
                      {getTitle(note.content) || "Untitled"}
                    </div>
                    <button
                      data-delete-btn
                      class="px-2 py-1 text-xs shrink-0 text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity duration-150"
                      on:click|stopPropagation={() => handleDelete(note.id)}
                    >
                      &times;
                    </button>
                  </div>
                {/each}
                {#if !(groupedNotes.folders[folder]?.length)}
                  <div class="px-7 py-1 text-xs text-text-muted italic">Empty</div>
                {/if}
              {/if}
            </div>
          {/each}

          <!-- Unfiled notes drop zone -->
          <div
            use:registerDropZone={"__unfiled__"}
            class="rounded-sm transition-all duration-100
              {isDragging ? 'min-h-[40px] border border-dashed border-border-subtle mt-1' : 'min-h-[8px]'}
              {dropTarget === '__unfiled__' ? 'bg-accent/20 !border-accent/40' : ''}"
          >
            {#if isDragging && groupedNotes.unfiled.length === 0}
              <div class="px-5 py-2 text-xs text-text-muted text-center">Remove from folder</div>
            {/if}
            {#each groupedNotes.unfiled as note}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="flex items-center group cursor-grab active:cursor-grabbing
                  {isDragging && draggingNoteId === note.id ? 'opacity-30' : ''}"
                on:mousedown={(e) => onNoteMouseDown(e, note.id)}
              >
                <div
                  class="flex-1 text-left px-5 py-1 text-sm truncate transition-all duration-150 ease-out
                    {$activeNoteId === note.id ? 'text-text-primary bg-accent-subtle' : 'text-text-secondary hover:opacity-80'}"
                >
                  {getTitle(note.content) || "Untitled"}
                </div>
                <button
                  data-delete-btn
                  class="px-2 py-1 text-xs shrink-0 text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity duration-150"
                  on:click|stopPropagation={() => handleDelete(note.id)}
                >
                  &times;
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </nav>
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

{#if confirmingDeleteFolder}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" on:click={() => { confirmingDeleteFolder = null; }}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="bg-surface border border-border-subtle rounded-lg p-5 w-80 shadow-xl" on:click|stopPropagation>
      <p class="text-text-primary text-sm mb-1">Delete folder "{confirmingDeleteFolder}"?</p>
      <p class="text-text-muted text-xs mb-4">This will permanently delete the folder and all {(groupedNotes.folders[confirmingDeleteFolder] || []).length} note{(groupedNotes.folders[confirmingDeleteFolder] || []).length === 1 ? '' : 's'} inside it.</p>
      <div class="flex justify-end gap-2">
        <button
          class="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded bg-elevated transition-colors duration-150"
          on:click={() => { confirmingDeleteFolder = null; }}
        >
          Cancel
        </button>
        <button
          class="px-3 py-1.5 text-xs text-white rounded bg-danger hover:brightness-90 transition-all duration-150"
          on:click={() => {
            if (confirmingDeleteFolder) {
              // Deselect if active note is in this folder
              const folderNotes = groupedNotes.folders[confirmingDeleteFolder] || [];
              if (folderNotes.some((n) => n.id === $activeNoteId)) {
                activeNoteId.set(null);
              }
              deleteFolderWithContents(confirmingDeleteFolder);
              confirmingDeleteFolder = null;
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}
