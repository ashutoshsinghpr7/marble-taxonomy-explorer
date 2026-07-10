<script>
  import { SUBJECT_COLORS } from '../lib/types';

  const base = import.meta.env.BASE_URL;
  export let topics = [];
  export let placeholder = 'Search 1,590 micro-topics...';

  let query = '';
  let results = [];
  let searching = false;

  function doSearch() {
    if (!query.trim()) {
      results = [];
      return;
    }
    searching = true;
    const q = query.toLowerCase().trim();
    const scored = [];
    for (const topic of topics) {
      let score = 0;
      const nl = topic.name.toLowerCase();
      const dl = topic.description.toLowerCase();
      const doml = topic.domain.toLowerCase();

      if (nl === q) score += 100;
      else if (nl.includes(q)) score += 60;
      else if (nl.startsWith(q)) score += 40;
      if (dl.includes(q)) score += 20;
      if (doml.includes(q)) score += 10;
      const words = q.split(/\s+/);
      for (const word of words) {
        if (nl.includes(word)) score += 15;
        if (dl.includes(word)) score += 5;
      }
      if (score > 0) scored.push({ topic, score });
    }
    scored.sort((a, b) => b.score - a.score);
    results = scored.slice(0, 20);
    searching = false;
  }

  let debounce;
  function onInput(e) {
    query = e.target.value;
    clearTimeout(debounce);
    debounce = setTimeout(doSearch, 150);
  }

  function getSubjectColor(subject) {
    return SUBJECT_COLORS[subject] || '#6b7280';
  }

  function getTypeAbbr(type) {
    const map = {
      CONCEPTUAL: 'C',
      PROCEDURAL: 'P',
      REPRESENTATIONAL: 'R',
      LANGUAGE: 'L',
      META: 'M',
    };
    return map[type] || type[0];
  }
</script>

<div class="relative w-full">
  <div class="relative">
    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
    </svg>
    <input
      type="text"
      bind:value={query}
      on:input={onInput}
      placeholder={placeholder}
      class="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:border-marble-400 focus:ring-2 focus:ring-marble-200 outline-none text-gray-900 placeholder-gray-400 transition-shadow"
    />
  </div>

  {#if results.length > 0}
    <div class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
      {#each results as { topic, score }}
        <a
          href={`${base}topics/${topic.id}`}
          class="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-medium text-gray-900 truncate">{topic.name}</div>
              <div class="text-sm text-gray-500 mt-0.5 line-clamp-1">{topic.description}</div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-xs px-1.5 py-0.5 rounded font-medium text-white" style="background-color: {getSubjectColor(topic.subject)}">
                {topic.subject}
              </span>
              <span class="topic-type-badge topic-type-{topic.type}">{getTypeAbbr(topic.type)}</span>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {:else if query}
    <div class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div class="px-4 py-3 text-sm text-gray-500">No results found.</div>
    </div>
  {/if}
</div>
