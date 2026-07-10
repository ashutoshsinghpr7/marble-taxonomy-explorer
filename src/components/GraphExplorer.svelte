<script>
  import cytoscape from 'cytoscape';
  import { onMount, onDestroy } from 'svelte';

  const base = import.meta.env.BASE_URL;
  export let nodes = [];
  export let edges = [];

  let cy;
  let container;
  let mode = 'explore';
  let searchQuery = '';
  let searchResults = [];
  let selectedLayout = 'cose';
  let hoveredEdge = null;
  let hoverPos = { x: 0, y: 0 };
  let showLabels = false;
  let exploreHistory = [];
  let exploreCenter = null;
  let nodeCount = 0;
  let edgeCount = 0;
  let showAllWarning = false;
  let computing = false;
  let layoutRunning = false;
  let fullSelectedSubjects = [];
  let minAge = 4;
  let maxAge = 12;
  let pathFromId = null;
  let pathToId = null;
  let pathFromQuery = '';
  let pathToQuery = '';
  let pathFromResults = [];
  let pathToResults = [];
  let pathNodes = [];

  const KNOWN_COLORS = {
    'Mathematics': '#3b82f6',
    'Science': '#22c55e',
    'English': '#f59e0b',
    'History': '#a855f7',
    'Personal & Social Development': '#ec4899',
    'Life Skills': '#14b8a6',
    'Computing': '#6366f1',
    'Learning to Learn': '#f43f5e',
  };
  const FALLBACK_PALETTE = [
    '#84cc16', '#06b6d4', '#f97316', '#8b5cf6',
    '#e11d48', '#0ea5e9', '#d946ef', '#10b981',
    '#a3e635', '#2dd4bf', '#fb923c', '#c084fc',
  ];

  function getSubjectColor(subj, idx) {
    return KNOWN_COLORS[subj] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
  }

  const nodeById = new Map();
  const prereqMap = new Map();
  const unlockMap = new Map();
  let allSubjects = [];
  const subjectElements = new Map();
  const visibleSubjects = new Set();
  const visibleNodeIds = new Set();

  $: {
    nodeById.clear();
    prereqMap.clear();
    unlockMap.clear();
    for (const n of nodes) nodeById.set(n.id, n);
    for (const e of edges) {
      if (!prereqMap.has(e.source)) prereqMap.set(e.source, []);
      prereqMap.get(e.source).push(e);
      if (!unlockMap.has(e.target)) unlockMap.set(e.target, []);
      unlockMap.get(e.target).push(e);
    }

    allSubjects = [...new Set(nodes.map(n => n.subject))].sort();

    if (fullSelectedSubjects.length === 0 && allSubjects.length > 0) {
      fullSelectedSubjects = [allSubjects[0]];
    }

    subjectElements.clear();
    for (const subj of allSubjects) {
      const subjNodes = nodes.filter(n => n.subject === subj);
      const subjNodeIds = new Set(subjNodes.map(n => n.id));
      subjectElements.set(subj, {
        nodes: subjNodes.map(n => ({
          data: {
            id: n.id, label: n.label, subject: n.subject, domain: n.domain,
            type: n.type, centrality: n.centrality, ageStart: n.ageStart, ageEnd: n.ageEnd,
            prereqCount: n.prereqCount, unlockCount: n.unlockCount,
          },
          classes: `no-label subject-${n.subject.replace(/\s+/g, '-')}`,
        })),
        edges: edges
          .filter(e => subjNodeIds.has(e.source) || subjNodeIds.has(e.target))
          .map(e => ({
            data: { id: e.id, source: e.source, target: e.target, strength: e.strength, reason: e.reason },
            classes: `strength-${e.strength}`,
          })),
      });
    }
  }

  function buildCyStyle() {
    const styles = [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'font-size': '9px',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'color': '#374151',
          'text-wrap': 'wrap',
          'text-max-width': '80px',
          'width': 14,
          'height': 14,
          'background-color': '#6b7280',
          'border-width': 1,
          'border-color': '#fff',
          'transition-property': 'background-color, width, height, border-width',
          'transition-duration': '0.2s',
        },
      },
      { selector: 'edge', style: { 'width': 1.2, 'line-color': '#d1d5db', 'target-arrow-color': '#d1d5db', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 0.7, 'opacity': 0.5 } },
      { selector: 'node.dimmed', style: { 'opacity': 0.08 } },
      { selector: 'node.ancestor', style: { 'background-color': '#6366f1', 'width': 18, 'height': 18, 'opacity': 0.9 } },
      { selector: 'node.selected', style: { 'background-color': '#dc2626', 'width': 26, 'height': 26, 'border-width': 3, 'border-color': '#991b1b' } },
      { selector: 'node.highlighted', style: { 'background-color': '#22c55e', 'width': 18, 'height': 18, 'opacity': 1 } },
      { selector: 'edge.dull', style: { 'opacity': 0.03 } },
      { selector: 'edge.highlighted', style: { 'width': 2.5, 'opacity': 1, 'line-color': '#6366f1', 'target-arrow-color': '#6366f1' } },
      { selector: 'node.center-node', style: { 'width': 30, 'height': 30, 'border-width': 3, 'border-color': '#fff', 'font-size': '12px', 'font-weight': 'bold', 'text-outline-width': 2, 'text-outline-color': '#fff' } },
      { selector: 'node.prereq-depth-1', style: { 'width': 20, 'height': 20, 'opacity': 0.9, 'font-size': '10px' } },
      { selector: 'node.prereq-depth-2', style: { 'width': 16, 'height': 16, 'opacity': 0.75, 'font-size': '9px' } },
      { selector: 'node.prereq-depth-3', style: { 'width': 13, 'height': 13, 'opacity': 0.55, 'font-size': '8px' } },
      { selector: 'node.unlock-node', style: { 'width': 20, 'height': 20, 'border-width': 2, 'border-style': 'dashed', 'border-color': '#fff', 'font-size': '10px' } },
      { selector: 'node.no-label', style: { 'label': '', 'text-outline-width': 0 } },
      { selector: 'edge.explore-edge', style: { 'label': 'data(label)', 'font-size': '7px', 'color': '#6b7280', 'text-rotation': 'autorotate', 'text-margin-y': '-4', 'text-background-color': '#fff', 'text-background-opacity': 0.8, 'text-background-padding': '2' } },
    ];

    const uniqueStrengths = new Set(edges.map(e => e.strength));
    const STRENGTH_STYLES = {
      'hard': { 'line-color': '#fca5a5', 'target-arrow-color': '#fca5a5', 'width': 2, 'opacity': 0.8 },
      'soft': { 'line-color': '#d1d5db', 'target-arrow-color': '#d1d5db', 'opacity': 0.3, 'line-style': 'dashed' },
    };
    const DEFAULT_STRENGTH = { 'line-color': '#93c5fd', 'target-arrow-color': '#93c5fd', 'opacity': 0.6, 'line-style': 'dotted' };
    for (const s of uniqueStrengths) {
      styles.push({ selector: `edge.strength-${s}`, style: STRENGTH_STYLES[s] || DEFAULT_STRENGTH });
    }

    for (const subj of allSubjects) {
      const slug = subj.replace(/\s+/g, '-');
      const color = getSubjectColor(subj, allSubjects.indexOf(subj));
      styles.push({ selector: `node.subject-${slug}`, style: { 'background-color': color } });
    }

    return styles;
  }

  function initCy() {
    cy = cytoscape({
      container,
      style: buildCyStyle(),
      minZoom: 0.05,
      maxZoom: 5,
      wheelSensitivity: 0.2,
    });

    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      if (mode === 'explore') {
        exploreNeighborhood(id);
      } else {
        highlightPrereqChain(id);
      }
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        hoveredEdge = null;
        if (mode === 'full') clearHighlights();
      }
    });

    cy.on('mouseover', 'edge', (evt) => {
      const edge = evt.target;
      const pos = evt.renderedPosition;
      hoveredEdge = {
        strength: edge.data('strength'),
        reason: edge.data('reason'),
        source: edge.data('source'),
        target: edge.data('target'),
        sourceLabel: nodeById.get(edge.data('source'))?.label ?? edge.data('source'),
        targetLabel: nodeById.get(edge.data('target'))?.label ?? edge.data('target'),
      };
      hoverPos = { x: pos.x, y: pos.y };
    });

    cy.on('mouseout', 'edge', () => { hoveredEdge = null; });

    cy.on('dblclick', 'node', (evt) => {
      window.location.href = `${base}topics/${evt.target.id()}`;
    });

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const pos = evt.renderedPosition;
      const data = nodeById.get(node.id());
      if (data && !showLabels) {
        hoveredEdge = {
          strength: 'topic',
          reason: `${data.subject} · ${data.domain} · Ages ${data.ageStart}–${data.ageEnd}${data.prereqCount ? ` · ${data.prereqCount} prereqs` : ''}${data.unlockCount ? ` · ${data.unlockCount} unlocks` : ''}`,
          source: node.id(),
          target: '',
          sourceLabel: data.label,
          targetLabel: '',
        };
        hoverPos = { x: pos.x, y: pos.y };
      }
    });

    cy.on('mouseout', 'node', () => {
      if (hoveredEdge?.strength === 'topic') hoveredEdge = null;
    });
  }

  // ========= EXPLORE MODE =========

  function exploreNeighborhood(topicId) {
    if (!cy) return;
    const centerData = nodeById.get(topicId);
    if (!centerData) return;
    exploreCenter = centerData;
    exploreHistory = [...exploreHistory, topicId];

    const included = new Set([topicId]);
    const els = [];

    els.push({
      data: {
        id: centerData.id,
        label: centerData.label,
        subject: centerData.subject,
        domain: centerData.domain,
        type: centerData.type,
        centrality: centerData.centrality,
        ageStart: centerData.ageStart,
        ageEnd: centerData.ageEnd,
        prereqCount: centerData.prereqCount,
        unlockCount: centerData.unlockCount,
      },
      classes: `center-node subject-${centerData.subject.replace(/\s+/g, '-')}`,
    });

    const MAX_PREREQ_DEPTH = 3;
    const prereqQueue = [{ id: topicId, depth: 0 }];
    while (prereqQueue.length > 0) {
      const { id, depth } = prereqQueue.shift();
      if (depth >= MAX_PREREQ_DEPTH) continue;
      const incoming = prereqMap.get(id) ?? [];
      for (const e of incoming) {
        const parentId = e.target;
        if (included.has(parentId)) continue;
        const parent = nodeById.get(parentId);
        if (!parent) continue;
        included.add(parentId);
        const reasonShort = e.reason.length > 35 ? e.reason.slice(0, 35) + '…' : e.reason;
        els.push({
          data: {
            id: parent.id, label: parent.label, subject: parent.subject, domain: parent.domain,
            type: parent.type, centrality: parent.centrality, ageStart: parent.ageStart, ageEnd: parent.ageEnd,
            prereqCount: parent.prereqCount, unlockCount: parent.unlockCount,
          },
          classes: `prereq-depth-${depth + 1} subject-${parent.subject.replace(/\s+/g, '-')}`,
        });
        els.push({
          data: { id: `e_${parentId}_${id}`, source: id, target: parentId, strength: e.strength, reason: e.reason, label: reasonShort },
          classes: `strength-${e.strength} explore-edge`,
        });
        prereqQueue.push({ id: parentId, depth: depth + 1 });
      }
    }

    const outgoingEdges = unlockMap.get(topicId) ?? [];
    for (const e of outgoingEdges) {
      const tgt = nodeById.get(e.source);
      if (!tgt || included.has(e.source)) continue;
      included.add(e.source);
      const reasonShort = e.reason.length > 35 ? e.reason.slice(0, 35) + '…' : e.reason;
      els.push({
        data: {
          id: tgt.id, label: tgt.label, subject: tgt.subject, domain: tgt.domain,
          type: tgt.type, centrality: tgt.centrality, ageStart: tgt.ageStart, ageEnd: tgt.ageEnd,
          prereqCount: tgt.prereqCount, unlockCount: tgt.unlockCount,
        },
        classes: `unlock-node subject-${tgt.subject.replace(/\s+/g, '-')}`,
      });
      els.push({
        data: { id: `e_${topicId}_${tgt.id}`, source: tgt.id, target: topicId, strength: e.strength, reason: e.reason, label: reasonShort },
        classes: `strength-${e.strength} explore-edge`,
      });
    }

    nodeCount = els.filter((e) => !e.data.source).length;
    edgeCount = els.filter((e) => e.data.source).length;

    cy.elements().remove();
    cy.add(els);
    cy.layout({ name: 'breadthfirst', directed: true, spacingFactor: 1.5, animate: true, animationDuration: 400 }).run();
    cy.fit(cy.elements(), 60);
  }

  // ========= FULL GRAPH (INCREMENTAL) =========

  function addSubject(subj) {
    if (!cy || mode !== 'full' || visibleSubjects.has(subj)) return;
    const cached = subjectElements.get(subj);
    if (!cached) return;

    const subjNodeIds = new Set(cached.nodes.map(e => e.data.id));

    for (const n of cached.nodes) {
      cy.add({ group: 'nodes', data: n.data, classes: n.classes });
      visibleNodeIds.add(n.data.id);
    }

    for (const e of cached.edges) {
      const srcIncluded = visibleNodeIds.has(e.data.source) || subjNodeIds.has(e.data.source);
      const tgtIncluded = visibleNodeIds.has(e.data.target) || subjNodeIds.has(e.data.target);
      if (srcIncluded && tgtIncluded) {
        cy.add({ group: 'edges', data: e.data, classes: e.classes });
      }
    }

    if (!showLabels) {
      cy.nodes().filter(n => subjNodeIds.has(n.id())).addClass('no-label');
    }

    visibleSubjects.add(subj);
    updateCounts();
  }

  function removeSubject(subj) {
    if (!cy || mode !== 'full' || !visibleSubjects.has(subj)) return;
    const cached = subjectElements.get(subj);
    if (!cached) return;

    const subjNodeIds = new Set(cached.nodes.map(e => e.data.id));

    cy.edges().forEach(e => {
      if (subjNodeIds.has(e.data('source')) || subjNodeIds.has(e.data('target'))) {
        e.remove();
      }
    });

    for (const id of subjNodeIds) {
      const el = cy.getElementById(id);
      if (el.length) el.remove();
      visibleNodeIds.delete(id);
    }

    visibleSubjects.delete(subj);
    updateCounts();
  }

  function updateCounts() {
    nodeCount = cy.nodes().length;
    edgeCount = cy.edges().length;
  }

  function runFullLayout() {
    if (!cy || mode !== 'full' || layoutRunning) return;
    layoutRunning = true;
    computing = true;
    const layout = cy.layout({
      name: selectedLayout,
      directed: true,
      spacingFactor: 1.2,
      animate: false,
    });
    if (selectedLayout === 'cose') {
      layout.options.nodeRepulsion = 8000;
      layout.options.idealEdgeLength = 50;
      layout.options.gravity = 0.3;
    }
    layout.promiseOn('layoutstop').then(() => { layoutRunning = false; computing = false; });
    layout.run();
  }

  function activateFullMode() {
    mode = 'full';
    exploreCenter = null;
    exploreHistory = [];
    showAllWarning = false;
    visibleSubjects.clear();
    visibleNodeIds.clear();
    cy.elements().remove();
    nodeCount = 0;
    edgeCount = 0;
    computing = true;
    requestAnimationFrame(() => {
      addSubject(fullSelectedSubjects[0]);
      if (fullSelectedSubjects.length >= 6) showAllWarning = true;
      runFullLayout();
      cy.fit(undefined, 30);
    });
  }

  function activateExploreMode() {
    mode = 'explore';
    exploreCenter = null;
    exploreHistory = [];
    cy.elements().remove();
    visibleSubjects.clear();
    visibleNodeIds.clear();
    nodeCount = 0;
    edgeCount = 0;
  }

  function toggleSubject(subj) {
    if (fullSelectedSubjects.includes(subj)) {
      if (fullSelectedSubjects.length > 1) {
        fullSelectedSubjects = fullSelectedSubjects.filter(s => s !== subj);
        computing = true;
        requestAnimationFrame(() => {
          removeSubject(subj);
          runFullLayout();
        });
      }
    } else {
      fullSelectedSubjects = [...fullSelectedSubjects, subj];
      showAllWarning = fullSelectedSubjects.length >= 6;
      computing = true;
      requestAnimationFrame(() => {
        addSubject(subj);
        runFullLayout();
      });
    }
  }

  // ========= SHARED =========

  function search() {
    if (!searchQuery.trim()) { searchResults = []; return; }
    const q = searchQuery.toLowerCase();
    const scored = nodes.map((n) => {
      let s = 0;
      if (n.label.toLowerCase() === q) s += 100;
      else if (n.label.toLowerCase().startsWith(q)) s += 60;
      else if (n.label.toLowerCase().includes(q)) s += 40;
      if (n.domain.toLowerCase().includes(q)) s += 10;
      return { node: n, score: s };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
    searchResults = scored.slice(0, 15);
  }

  function pickTopic(id) {
    searchResults = [];
    searchQuery = '';
    if (mode === 'explore') {
      exploreNeighborhood(id);
    } else {
      const node = cy.getElementById(id);
      if (node.length) {
        cy.animate({ center: { eles: node }, zoom: 2 }, { duration: 400 });
        highlightPrereqChain(id);
      }
    }
  }

  function highlightPrereqChain(nodeId) {
    if (!cy) return;
    const allNodes = cy.nodes();
    const allEdges = cy.edges();
    allNodes.removeClass('dimmed highlighted ancestor descendant selected');
    allEdges.removeClass('highlighted dull');
    const ancestors = new Set();
    const queue = [nodeId];
    const ancestorEdges = new Set();
    while (queue.length > 0) {
      const id = queue.shift();
      if (ancestors.has(id)) continue;
      ancestors.add(id);
      cy.getElementById(id).incomers('edge').forEach((e) => {
        ancestorEdges.add(e.id());
        queue.push(e.source().id());
      });
    }
    allNodes.forEach((n) => {
      if (n.id() === nodeId) n.addClass('selected');
      else if (ancestors.has(n.id())) n.addClass('ancestor');
      else n.addClass('dimmed');
    });
    allEdges.forEach((e) => {
      if (ancestorEdges.has(e.id())) e.addClass('highlighted');
      else e.addClass('dull');
    });
  }

  function clearHighlights() {
    if (!cy) return;
    cy.nodes().removeClass('dimmed highlighted ancestor descendant selected');
    cy.edges().removeClass('highlighted dull');
    pathNodes = [];
    pathFromId = null;
    pathToId = null;
  }

  function findPath() {
    if (!cy || !pathFromId || !pathToId) return;
    const adj = new Map();
    edges.forEach((e) => {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source).push(e.target);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.target).push(e.source);
    });
    const visited = new Set([pathFromId]);
    const parent = new Map();
    const queue = [pathFromId];
    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr === pathToId) break;
      for (const n of (adj.get(curr) ?? [])) {
        if (!visited.has(n)) { visited.add(n); parent.set(n, curr); queue.push(n); }
      }
    }
    pathNodes = [];
    if (parent.has(pathToId) || pathFromId === pathToId) {
      let curr = pathToId;
      while (curr !== pathFromId) { pathNodes.unshift(curr); curr = parent.get(curr); }
      pathNodes.unshift(pathFromId);
    }
    if (pathNodes.length > 0) {
      cy.nodes().addClass('dimmed');
      cy.edges().addClass('dull');
      const pathSet = new Set(pathNodes);
      cy.nodes().forEach((n) => {
        if (pathSet.has(n.id())) n.removeClass('dimmed').addClass('highlighted');
      });
      for (let i = 0; i < pathNodes.length - 1; i++) {
        const a = pathNodes[i], b = pathNodes[i + 1];
        cy.edges().forEach((e) => {
          if ((e.data('source') === a && e.data('target') === b) || (e.data('source') === b && e.data('target') === a))
            e.removeClass('dull').addClass('highlighted');
        });
      }
    }
  }

  function searchPathFrom() {
    if (!pathFromQuery.trim()) { pathFromResults = []; return; }
    const q = pathFromQuery.toLowerCase();
    pathFromResults = nodes.filter(n => n.label.toLowerCase().includes(q)).slice(0, 10);
  }

  function searchPathTo() {
    if (!pathToQuery.trim()) { pathToResults = []; return; }
    const q = pathToQuery.toLowerCase();
    pathToResults = nodes.filter(n => n.label.toLowerCase().includes(q)).slice(0, 10);
  }

  function pickPathFrom(node) {
    pathFromId = node.id;
    pathFromQuery = node.label;
    pathFromResults = [];
  }

  function pickPathTo(node) {
    pathToId = node.id;
    pathToQuery = node.label;
    pathToResults = [];
  }

  function goToExploreHistory(idx) {
    const id = exploreHistory[idx];
    exploreHistory = exploreHistory.slice(0, idx + 1);
    exploreNeighborhood(id);
  }

  let layoutTimeout;
  $: {
    const _ = selectedLayout;
    if (cy && mode === 'full') {
      clearTimeout(layoutTimeout);
      computing = true;
      layoutTimeout = setTimeout(() => runFullLayout(), 80);
    }
  }

  $: if (cy && mode === 'full') {
    if (showLabels) {
      cy.nodes().removeClass('no-label');
    } else {
      cy.nodes().addClass('no-label');
    }
  }

  onMount(() => initCy());
  onDestroy(() => { if (cy) cy.destroy(); });
</script>

<div class="flex flex-col h-screen">
  <!-- Toolbar -->
  <div class="border-b border-gray-200 bg-white px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
    <a href={base} class="text-sm text-marble-500 hover:text-marble-600 font-medium shrink-0">&larr; Home</a>
    <span class="text-gray-300 shrink-0">|</span>

    <!-- Mode toggle -->
    <div class="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
      <button on:click={activateExploreMode} class="text-xs px-3 py-1 rounded-md font-medium transition-all {mode === 'explore' ? 'bg-white shadow-sm text-marble-700' : 'text-gray-500 hover:text-gray-700'}">
        Explore
      </button>
      <button on:click={activateFullMode} class="text-xs px-3 py-1 rounded-md font-medium transition-all {mode === 'full' ? 'bg-white shadow-sm text-marble-700' : 'text-gray-500 hover:text-gray-700'}">
        Full Graph
      </button>
    </div>

    <!-- Search -->
    <div class="relative flex-1 min-w-[180px] max-w-sm">
      <input type="text" bind:value={searchQuery} on:input={search}
        placeholder={mode === 'explore' ? "Search a topic to explore its connections..." : "Search & focus on a topic..."}
        class="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-gray-300 focus:border-marble-400 focus:ring-1 focus:ring-marble-200 outline-none" />
      <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      {#if searchResults.length > 0}
        <div class="absolute top-full left-0 right-0 mt-1 bg-white rounded shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-50">
          {#each searchResults as { node, score }}
            <button on:click={() => pickTopic(node.id)} class="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
              <div class="font-medium text-gray-800 truncate">{node.label}</div>
              <div class="text-xs text-gray-500">{node.subject} · {node.domain} · Ages {node.ageStart}–{node.ageEnd}</div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Full graph controls -->
    {#if mode === 'full'}
      <select bind:value={selectedLayout} class="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white shrink-0">
        <option value="cose">Force-Directed</option>
        <option value="concentric">Concentric</option>
        <option value="grid">Grid</option>
      </select>

      <!-- Path finder (searchable) -->
      <div class="flex items-center gap-1 shrink-0">
        <div class="relative">
          <input type="text" bind:value={pathFromQuery} on:input={searchPathFrom}
            placeholder="From topic..." class="w-28 text-xs border border-gray-300 rounded px-2 py-1.5" />
          {#if pathFromResults.length > 0}
            <div class="absolute top-full left-0 mt-1 bg-white rounded shadow-lg border border-gray-200 max-h-48 overflow-y-auto z-50 min-w-[200px]">
              {#each pathFromResults as node}
                <button on:click={() => pickPathFrom(node)} class="block w-full text-left px-2 py-1 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                  <span class="font-medium">{node.label}</span>
                  <span class="text-gray-400 ml-1">· {node.subject}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <span class="text-gray-400 text-xs">&rarr;</span>
        <div class="relative">
          <input type="text" bind:value={pathToQuery} on:input={searchPathTo}
            placeholder="To topic..." class="w-28 text-xs border border-gray-300 rounded px-2 py-1.5" />
          {#if pathToResults.length > 0}
            <div class="absolute top-full left-0 mt-1 bg-white rounded shadow-lg border border-gray-200 max-h-48 overflow-y-auto z-50 min-w-[200px]">
              {#each pathToResults as node}
                <button on:click={() => pickPathTo(node)} class="block w-full text-left px-2 py-1 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                  <span class="font-medium">{node.label}</span>
                  <span class="text-gray-400 ml-1">· {node.subject}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <button on:click={findPath} class="text-xs bg-marble-500 text-white px-2 py-1.5 rounded hover:bg-marble-600">Path</button>
      </div>
      <button on:click={clearHighlights} class="text-xs text-gray-500 hover:text-gray-700 shrink-0">Clear</button>

      <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer shrink-0 ml-1">
        <input type="checkbox" bind:checked={showLabels} class="w-3.5 h-3.5" />
        Labels
      </label>

      <!-- Subject toggles -->
      <div class="flex flex-wrap items-center gap-0.5 shrink-0">
        {#each allSubjects as subj, idx}
          {@const color = getSubjectColor(subj, idx)}
          <button on:click={() => toggleSubject(subj)}
            class="text-[10px] px-1.5 py-0.5 rounded-full border transition-colors leading-none"
            style="border-color: {color}; background: {fullSelectedSubjects.includes(subj) ? color : 'transparent'}; color: {fullSelectedSubjects.includes(subj) ? '#fff' : color}"
          >{subj.split(' ')[0]}</button>
        {/each}
      </div>
    {/if}

    <!-- Explore history breadcrumbs -->
    {#if mode === 'explore' && exploreHistory.length > 1}
      <div class="flex items-center gap-1 text-xs text-gray-500 overflow-x-auto">
        {#each exploreHistory as id, i}
          {#if i > 0}<span class="text-gray-300">&rarr;</span>{/if}
          <button on:click={() => goToExploreHistory(i)} class="hover:text-marble-600 hover:underline whitespace-nowrap {i === exploreHistory.length - 1 ? 'font-semibold text-marble-700' : ''}">
            {nodeById.get(id)?.label?.slice(0, 20) ?? id.slice(0, 10)}
          </button>
        {/each}
      </div>
    {/if}

    <span class="text-xs text-gray-400 ml-auto shrink-0">
      {nodeCount.toLocaleString()} nodes · {edgeCount.toLocaleString()} edges
    </span>
  </div>

  <!-- Canvas -->
  <div class="flex-1 relative bg-gray-100" bind:this={container}>
    {#if computing}
      <div class="absolute inset-0 bg-white/50 z-30 flex items-center justify-center">
        <div class="bg-white rounded-lg shadow-lg border border-gray-200 px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Computing layout...
        </div>
      </div>
    {/if}

    {#if mode === 'explore' && !exploreCenter}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div class="text-center bg-white/90 rounded-xl px-10 py-8 shadow-sm border border-gray-200">
          <div class="text-5xl mb-4">◆</div>
          <h2 class="text-xl font-semibold text-gray-700 mb-2">Topic Neighborhood Explorer</h2>
          <p class="text-gray-500 text-sm max-w-sm mx-auto">
            Search for any topic above to see its prerequisite chain — up to 3 levels deep.
            Prerequisites show what you must learn first, unlocks show what comes next.
          </p>
          <p class="text-gray-400 text-xs mt-4">Double-click any node to open the full topic detail in a new tab.</p>
        </div>
      </div>
    {/if}

    {#if mode === 'full' && showAllWarning}
      <div class="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-300 text-amber-800 text-xs px-4 py-2 rounded-lg shadow-sm">
        Showing {nodeCount.toLocaleString()} nodes — labels hidden for performance.
        <button on:click={() => showAllWarning = false} class="ml-2 underline font-medium">Dismiss</button>
      </div>
    {/if}

    {#if hoveredEdge}
      <div class="absolute z-50 bg-gray-900 text-white text-xs rounded px-2.5 py-2 max-w-xs shadow-lg pointer-events-none"
        style="left: {Math.min(hoverPos.x + 12, (container?.clientWidth ?? 800) - 260)}px; top: {Math.min(hoverPos.y - 30, (container?.clientHeight ?? 600) - 80)}px;">
        {#if hoveredEdge.strength === 'topic'}
          <div class="font-medium text-sm">{hoveredEdge.sourceLabel}</div>
          <div class="text-gray-300 mt-0.5">{hoveredEdge.reason}</div>
        {:else}
          <span class="font-medium uppercase {hoveredEdge.strength === 'hard' ? 'text-red-400' : 'text-gray-400'}">{hoveredEdge.strength}</span>
          <span class="text-gray-500 ml-1">&mdash; {hoveredEdge.sourceLabel?.slice(0, 30)}</span>
          <p class="mt-1 text-gray-300">{hoveredEdge.reason}</p>
        {/if}
      </div>
    {/if}

    {#if pathNodes.length > 0}
      <div class="absolute bottom-4 left-4 z-50 bg-white rounded shadow-lg border border-gray-200 px-3 py-2 text-xs max-w-md">
        <div class="font-medium text-gray-800 mb-1">Path ({pathNodes.length} topics)</div>
        <div class="text-gray-500 truncate">
          {#each pathNodes as id, i}
            {i > 0 ? ' → ' : ''}<a href={`${base}topics/${id}`} class="text-marble-600 hover:underline">{nodeById.get(id)?.label?.slice(0, 20) ?? id.slice(0, 10)}</a>
          {/each}
        </div>
      </div>
    {/if}

    {#if mode === 'full' && nodeCount > 0}
      <div class="absolute top-3 right-3 z-50 bg-white/90 backdrop-blur rounded shadow-lg border border-gray-200 px-3 py-2 text-[10px] space-y-0.5">
        <div class="font-medium text-gray-700 mb-1">Click a node to trace prerequisites</div>
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-red-400"></span> Hard prereq</div>
        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-gray-300"></span> Soft prereq</div>
      </div>
    {/if}
  </div>
</div>
