import type { Dependency, Topic } from './types';
import { getDependencies, getTopicById } from './data';

let _prereqs: Map<string, Dependency[]> | null = null;
let _unlocks: Map<string, Dependency[]> | null = null;

function buildIndex() {
  if (_prereqs && _unlocks) return;

  const deps = getDependencies();
  _prereqs = new Map<string, Dependency[]>();
  _unlocks = new Map<string, Dependency[]>();

  for (const dep of deps) {
    if (!_prereqs.has(dep.topicId)) _prereqs.set(dep.topicId, []);
    _prereqs.get(dep.topicId)!.push(dep);

    if (!_unlocks.has(dep.prerequisiteId)) _unlocks.set(dep.prerequisiteId, []);
    _unlocks.get(dep.prerequisiteId)!.push(dep);
  }
}

export function getPrerequisites(topicId: string): { topic: Topic; dependency: Dependency }[] {
  buildIndex();
  const deps = _prereqs!.get(topicId) ?? [];
  return deps
    .map((d) => {
      const topic = getTopicById(d.prerequisiteId);
      return topic ? { topic, dependency: d } : null;
    })
    .filter(Boolean) as { topic: Topic; dependency: Dependency }[];
}

export function getUnlocks(topicId: string): { topic: Topic; dependency: Dependency }[] {
  buildIndex();
  const deps = _unlocks!.get(topicId) ?? [];
  return deps
    .map((d) => {
      const topic = getTopicById(d.topicId);
      return topic ? { topic, dependency: d } : null;
    })
    .filter(Boolean) as { topic: Topic; dependency: Dependency }[];
}

export function getPrereqChain(
  topicId: string,
  visited: Set<string> = new Set(),
  depth: number = 0
): { topic: Topic; dependency: Dependency; children: ReturnType<typeof getPrereqChain> }[] {
  if (visited.has(topicId) || depth > 10) return [];
  visited.add(topicId);

  const prereqs = getPrerequisites(topicId);
  return prereqs.map(({ topic, dependency }) => ({
    topic,
    dependency,
    children: getPrereqChain(topic.id, new Set(visited), depth + 1),
  }));
}

export function hasPrerequisites(topicId: string): boolean {
  buildIndex();
  return (_prereqs!.get(topicId)?.length ?? 0) > 0;
}

export function hasUnlocks(topicId: string): boolean {
  buildIndex();
  return (_unlocks!.get(topicId)?.length ?? 0) > 0;
}

export function getTopologySorted(): Topic[] {
  buildIndex();
  const deps = getDependencies();
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  const allIds = new Set<string>();
  for (const d of deps) {
    allIds.add(d.topicId);
    allIds.add(d.prerequisiteId);
  }

  for (const id of allIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const d of deps) {
    inDegree.set(d.topicId, (inDegree.get(d.topicId) ?? 0) + 1);
    adj.get(d.prerequisiteId)!.push(d.topicId);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: Topic[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const topic = getTopicById(id);
    if (topic) result.push(topic);
    for (const next of adj.get(id) ?? []) {
      const deg = inDegree.get(next)! - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  return result;
}
