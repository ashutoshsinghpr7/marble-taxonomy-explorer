<script>
  import { onMount } from 'svelte';
  import { SUBJECT_COLORS } from '../lib/types';

  const base = import.meta.env.BASE_URL;
  export let allTopics = [];

  let searchQuery = '';
  let searchResults = [];
  let knownIds = [];
  let knownTopics = [];
  let frontier = [];
  let almostReady = [];
  let comingUp = [];
  let stats = { totalKnown: 0, frontierCount: 0, almostReadyCount: 0, comingUpCount: 0, totalReachable: 0 };
  let loading = false;
  let activeTab = 'frontier';

  const byId = new Map();
  $: {
    byId.clear();
    for (const t of allTopics) byId.set(t.id, t);
  }

  function search() {
    if (!searchQuery.trim()) { searchResults = []; return; }
    const q = searchQuery.toLowerCase();
    const scored = [];
    for (const t of allTopics) {
      let s = 0;
      if (t.name.toLowerCase() === q) s += 100;
      else if (t.name.toLowerCase().includes(q)) s += 50;
      if (t.domain.toLowerCase().includes(q)) s += 10;
      if (t.subject.toLowerCase() === q) s += 5;
      if (s > 0) scored.push({ topic: t, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    searchResults = scored.slice(0, 15);
  }

  function addKnown(id) {
    if (knownIds.includes(id)) return;
    knownIds = [...knownIds, id];
    knownTopics = [...knownTopics, byId.get(id)];
    searchQuery = '';
    searchResults = [];
    recompute();
  }

  function removeKnown(id) {
    knownIds = knownIds.filter((i) => i !== id);
    knownTopics = knownTopics.filter((t) => t.id !== id);
    recompute();
  }

  async function recompute() {
    if (knownIds.length === 0) {
      frontier = [];
      almostReady = [];
      comingUp = [];
      stats = { totalKnown: 0, frontierCount: 0, almostReadyCount: 0, comingUpCount: 0, totalReachable: 0 };
      return;
    }
    loading = true;
    try {
      const mod = await import('../lib/pathway');
      const result = mod.computePathway(knownIds);
      frontier = result.frontier.sort((a, b) => a.ageRangeStart - b.ageRangeStart);
      almostReady = result.almostReady.sort((a, b) => a.missingPrereqs.length - b.missingPrereqs.length);
      comingUp = result.comingUp;
      stats = result.stats;
    } catch (e) {
      console.error('Pathway computation failed:', e);
    }
    loading = false;
  }

  function addRandom() {
    const remaining = allTopics.filter((t) => !knownIds.includes(t.id));
    if (remaining.length < 5) return;
    const picks = [];
    const copy = [...remaining];
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picks.push(copy[idx].id);
      copy.splice(idx, 1);
    }
    knownIds = [...knownIds, ...picks];
    knownTopics = knownIds.map((id) => byId.get(id)).filter(Boolean);
    recompute();
  }

  function addYoungest() {
    const remaining = allTopics
      .filter((t) => !knownIds.includes(t.id) && t.ageRangeStart <= 6)
      .sort((a, b) => a.ageRangeStart - b.ageRangeStart)
      .slice(0, 10);
    const picks = remaining.map((t) => t.id);
    knownIds = [...knownIds, ...picks];
    knownTopics = knownIds.map((id) => byId.get(id)).filter(Boolean);
    recompute();
  }

  function getPrereqShort(id) {
    const mod = allTopics.find((t) => t.id === id);
    return mod ? mod.name : id;
  }

  function getTypeBadge(type) {
    const map = { CONCEPTUAL: 'C', PROCEDURAL: 'P', REPRESENTATIONAL: 'R', LANGUAGE: 'L', META: 'M' };
    return map[type] || type[0];
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <a href={base} class="text-sm text-marble-500 hover:text-marble-600 mb-4 inline-block">&larr; Home</a>

  <div class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Learning Pathway</h1>
    <p class="text-gray-600">
      Select what a child already knows — see what they're ready to learn next.
      <span class="text-sm text-gray-400 ml-2">(simulated — no per-child data stored)</span>
    </p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Left: Add known topics -->
    <div class="lg:col-span-5 space-y-4">
      <div class="bg-white rounded-lg border border-gray-200 p-5">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">What They Know</h2>

        <div class="relative mb-4">
          <input
            type="text"
            bind:value={searchQuery}
            on:input={search}
            placeholder="Search topics to add..."
            class="w-full pl-9 pr-3 py-2 text-sm rounded border border-gray-300 focus:border-marble-400 focus:ring-1 focus:ring-marble-200 outline-none"
          />
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>

          {#if searchResults.length > 0}
            <div class="absolute top-full left-0 right-0 mt-1 bg-white rounded shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-50">
              {#each searchResults as { topic, score }}
                <button
                  on:click={() => addKnown(topic.id)}
                  class="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:opacity-40"
                  disabled={knownIds.includes(topic.id)}
                >
                  <div class="font-medium text-gray-800 truncate">{topic.name}</div>
                  <div class="text-xs text-gray-500">{topic.subject} · {topic.domain} · Ages {topic.ageRangeStart}–{topic.ageRangeEnd}</div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="flex gap-2 mb-4">
          <button on:click={addYoungest} class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded transition-colors">
            + Add early primary topics
          </button>
          <button on:click={addRandom} class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded transition-colors">
            + Add 5 random
          </button>
          {#if knownIds.length > 0}
            <button on:click={() => { knownIds = []; knownTopics = []; frontier = []; almostReady = []; comingUp = []; stats = { totalKnown: 0, frontierCount: 0, almostReadyCount: 0, comingUpCount: 0, totalReachable: 0 }; }} class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded transition-colors">
              Clear all
            </button>
          {/if}
        </div>

        {#if knownTopics.length > 0}
          <div class="space-y-1 max-h-96 overflow-y-auto">
            {#each knownTopics as topic (topic.id)}
              <div class="flex items-center justify-between bg-marble-50 rounded px-3 py-1.5 group">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-gray-800 truncate">{topic.name}</div>
                  <div class="text-xs text-gray-500">
                    <span class="px-1 py-0.5 rounded text-white text-xs font-medium" style="background-color: {SUBJECT_COLORS[topic.subject] || '#6b7280'}">{topic.subject}</span>
                    <span class="ml-1">Ages {topic.ageRangeStart}–{topic.ageRangeEnd}</span>
                  </div>
                </div>
                <button on:click={() => removeKnown(topic.id)} class="shrink-0 ml-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-8 text-gray-400">
            <div class="text-3xl mb-2">◆</div>
            <p class="text-sm">Search and add topics a child already knows to see their learning path.</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Results -->
    <div class="lg:col-span-7">
      {#if stats.totalKnown > 0}
        <!-- Stats bar -->
        <div class="grid grid-cols-4 gap-3 mb-4">
          <div class="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <div class="text-xl font-bold text-marble-600">{stats.totalKnown}</div>
            <div class="text-xs text-gray-500">Known</div>
          </div>
          <div class="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
            <div class="text-xl font-bold text-green-600">{stats.frontierCount}</div>
            <div class="text-xs text-green-600 font-medium">Ready Now</div>
          </div>
          <div class="bg-amber-50 rounded-lg border border-amber-200 p-3 text-center">
            <div class="text-xl font-bold text-amber-600">{stats.almostReadyCount}</div>
            <div class="text-xs text-amber-600 font-medium">Almost Ready</div>
          </div>
          <div class="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
            <div class="text-xl font-bold text-blue-600">{stats.totalReachable}</div>
            <div class="text-xs text-blue-600 font-medium">Reachable</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
          <button
            on:click={() => activeTab = 'frontier'}
            class="flex-1 text-sm py-1.5 rounded-md font-medium transition-colors {activeTab === 'frontier' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'}"
          >
            Ready Now ({stats.frontierCount})
          </button>
          <button
            on:click={() => activeTab = 'almost'}
            class="flex-1 text-sm py-1.5 rounded-md font-medium transition-colors {activeTab === 'almost' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500 hover:text-gray-700'}"
          >
            Almost Ready ({stats.almostReadyCount})
          </button>
          <button
            on:click={() => activeTab = 'coming'}
            class="flex-1 text-sm py-1.5 rounded-md font-medium transition-colors {activeTab === 'coming' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}"
          >
            Coming Up ({stats.comingUpCount})
          </button>
        </div>

        <!-- Content -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
          {#if activeTab === 'frontier'}
            <h3 class="font-semibold text-gray-900 mb-1 text-lg">Ready to Learn Now</h3>
            <p class="text-sm text-gray-500 mb-4">Topics where every prerequisite is already known.</p>
            {#if frontier.length > 0}
              <div class="space-y-2">
                {#each frontier as topic (topic.id)}
                  <a href={`${base}topics/${topic.id}`} class="block border border-green-200 rounded-lg p-3 hover:bg-green-50 transition-colors group">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="font-medium text-gray-900 group-hover:text-marble-600 transition-colors">{topic.name}</div>
                        <div class="text-sm text-gray-600 mt-0.5 line-clamp-1">{topic.description}</div>
                        <div class="flex items-center gap-2 mt-1.5">
                          <span class="text-xs px-1.5 py-0.5 rounded text-white font-medium" style="background-color: {SUBJECT_COLORS[topic.subject] || '#6b7280'}">{topic.subject}</span>
                          <span class="text-xs text-gray-500">{topic.domain}</span>
                          <span class="text-xs text-gray-400">Ages {topic.ageRangeStart}–{topic.ageRangeEnd}</span>
                          <span class="topic-type-badge topic-type-{topic.type} text-xs">{getTypeBadge(topic.type)}</span>
                        </div>
                      </div>
                      <span class="shrink-0 text-green-500">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </span>
                    </div>
                  </a>
                {/each}
              </div>
            {:else}
              <div class="text-center py-6 text-gray-400 text-sm">No topics are fully unlocked yet. Try adding more known topics.</div>
            {/if}
          {:else if activeTab === 'almost'}
            <h3 class="font-semibold text-gray-900 mb-1 text-lg">Almost Ready</h3>
            <p class="text-sm text-gray-500 mb-4">Missing only 1–2 prerequisites.</p>
            {#if almostReady.length > 0}
              <div class="space-y-3">
                {#each almostReady as { topic, missingPrereqs } (topic.id)}
                  <a href={`${base}topics/${topic.id}`} class="block border border-amber-200 rounded-lg p-3 hover:bg-amber-50 transition-colors group">
                    <div class="font-medium text-gray-900 group-hover:text-marble-600">{topic.name}</div>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-xs px-1.5 py-0.5 rounded text-white font-medium" style="background-color: {SUBJECT_COLORS[topic.subject] || '#6b7280'}">{topic.subject}</span>
                      <span class="text-xs text-gray-500">{topic.domain}</span>
                    </div>
                    <div class="mt-2 text-xs text-amber-700">
                      <span class="font-medium">Missing:</span>
                      {#each missingPrereqs as mp}
                        <span class="ml-1 bg-amber-100 px-1 py-0.5 rounded">{mp.name}</span>
                      {/each}
                    </div>
                  </a>
                {/each}
              </div>
            {:else}
              <div class="text-center py-6 text-gray-400 text-sm">No topics in the "almost ready" range.</div>
            {/if}
          {:else}
            <h3 class="font-semibold text-gray-900 mb-1 text-lg">Coming Up</h3>
            <p class="text-sm text-gray-500 mb-4">What unlocks after the frontier, up to 3 layers deep.</p>
            {#if comingUp.length > 0}
              <div class="space-y-2">
                {#each comingUp as { topic, depth } (topic.id)}
                  <a href={`${base}topics/${topic.id}`} class="block border border-blue-100 rounded-lg p-3 hover:bg-blue-50 transition-colors group">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="font-medium text-gray-900 group-hover:text-marble-600">{topic.name}</div>
                        <div class="flex items-center gap-2 mt-1">
                          <span class="text-xs px-1.5 py-0.5 rounded text-white font-medium" style="background-color: {SUBJECT_COLORS[topic.subject] || '#6b7280'}">{topic.subject}</span>
                          <span class="text-xs text-gray-500">{topic.domain}</span>
                          <span class="text-xs text-gray-400">Ages {topic.ageRangeStart}–{topic.ageRangeEnd}</span>
                        </div>
                      </div>
                      <span class="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        Layer {depth}
                      </span>
                    </div>
                  </a>
                {/each}
              </div>
            {:else}
              <div class="text-center py-6 text-gray-400 text-sm">No topics further out. Add more known topics to see more.</div>
            {/if}
          {/if}
        </div>
      {:else}
        <div class="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div class="text-5xl mb-4">◆</div>
          <h2 class="text-xl font-semibold text-gray-700 mb-2">Learning Pathway Tool</h2>
          <p class="text-gray-500 max-w-md mx-auto">
            Mark topics a child already knows in the left panel.
            This tool finds every topic whose prerequisites are fully met —
            the "zone of proximal development" frontier.
          </p>
          <div class="mt-6 text-sm text-gray-400 space-y-1">
            <div>Try <strong>"Add early primary topics"</strong> to see a realistic scenario</div>
            <div>or search for specific topics like "counting" or "reading"</div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
