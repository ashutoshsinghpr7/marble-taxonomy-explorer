<script>
  const base = import.meta.env.BASE_URL;
  export let tree = [];
  export let depth = 0;


</script>

{#if tree.length > 0}
  <ul class="pl-4 border-l-2 border-gray-200 space-y-1 mt-1">
    {#each tree as node}
      <li class="relative">
        <div class="flex items-start gap-2 py-1">
          <span class="shrink-0 w-2 h-2 mt-2 rounded-full {node.dependency.strength === 'hard' ? 'bg-red-400' : 'bg-gray-300'}" title={node.dependency.strength}></span>
          <div>
            <a href={`${base}topics/${node.topic.id}`} class="text-sm font-medium text-marble-600 hover:text-marble-700 hover:underline transition-colors">
              {node.topic.name}
            </a>
            <span class="text-xs ml-2 dep-strength-{node.dependency.strength}">
              {node.dependency.strength}
            </span>
            <p class="text-xs text-gray-500 mt-0.5">
              {node.dependency.reason}
            </p>
          </div>
        </div>
        {#if node.children.length > 0}
          <svelte:self tree={node.children} depth={depth + 1} />
        {/if}
      </li>
    {/each}
  </ul>
{/if}
