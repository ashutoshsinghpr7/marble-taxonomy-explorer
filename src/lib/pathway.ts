import { getDependencies, getTopicById } from './data';
import type { Topic } from './types';

export interface PathwayResult {
  frontier: Topic[];
  almostReady: { topic: Topic; missingPrereqs: Topic[] }[];
  comingUp: { topic: Topic; depth: number; unlocksFrom: Topic[] }[];
  stats: {
    totalKnown: number;
    frontierCount: number;
    almostReadyCount: number;
    comingUpCount: number;
    totalReachable: number;
  };
}

export function computePathway(knownIds: string[]): PathwayResult {
  const knownSet = new Set(knownIds);
  const deps = getDependencies();

  const prereqMap = new Map<string, string[]>();
  const unlockMap = new Map<string, string[]>();

  for (const d of deps) {
    if (!prereqMap.has(d.topicId)) prereqMap.set(d.topicId, []);
    prereqMap.get(d.topicId)!.push(d.prerequisiteId);

    if (!unlockMap.has(d.prerequisiteId)) unlockMap.set(d.prerequisiteId, []);
    unlockMap.get(d.prerequisiteId)!.push(d.topicId);
  }

  const knownTopics = knownIds.map((id) => getTopicById(id)).filter(Boolean) as Topic[];

  const allTopicIds = new Set<string>();
  for (const d of deps) {
    allTopicIds.add(d.topicId);
    allTopicIds.add(d.prerequisiteId);
  }

  const frontier: Topic[] = [];
  const almostReady: { topic: Topic; missingPrereqs: Topic[] }[] = [];

  for (const topicId of allTopicIds) {
    if (knownSet.has(topicId)) continue;
    const prereqs = prereqMap.get(topicId) ?? [];
    if (prereqs.length === 0) continue;

    const missing = prereqs.filter((p) => !knownSet.has(p));
    const topic = getTopicById(topicId);
    if (!topic) continue;

    if (missing.length === 0) {
      frontier.push(topic);
    } else if (missing.length <= 2 && prereqs.length >= 2) {
      almostReady.push({
        topic,
        missingPrereqs: missing.map((id) => getTopicById(id)).filter(Boolean) as Topic[],
      });
    }
  }

  const comingUp: { topic: Topic; depth: number; unlocksFrom: Topic[] }[] = [];
  const visited = new Set<string>();
  const comingUpMap = new Map<string, { depth: number; unlocksFrom: Set<string> }>();
  const queue: { id: string; depth: number; from: string }[] = [];

  for (const t of frontier) {
    queue.push({ id: t.id, depth: 1, from: t.id });
    visited.add(t.id);
  }

  while (queue.length > 0) {
    const { id, depth, from } = queue.shift()!;
    const topic = getTopicById(id);
    if (!topic) continue;

    if (!comingUpMap.has(id)) {
      comingUpMap.set(id, { depth: Infinity, unlocksFrom: new Set() });
    }
    const entry = comingUpMap.get(id)!;
    if (depth < entry.depth) {
      entry.depth = depth;
    }
    entry.unlocksFrom.add(from);

    const unlocks = unlockMap.get(id) ?? [];
    for (const nextId of unlocks) {
      if (knownSet.has(nextId)) continue;
      if (depth + 1 <= 3 && !visited.has(nextId)) {
        queue.push({ id: nextId, depth: depth + 1, from: id });
        visited.add(nextId);
      }
    }
  }

  for (const [id, entry] of comingUpMap) {
    const topic = getTopicById(id);
    if (!topic || frontier.some((t) => t.id === id)) continue;
    comingUp.push({
      topic,
      depth: entry.depth,
      unlocksFrom: Array.from(entry.unlocksFrom)
        .map((uid) => getTopicById(uid))
        .filter(Boolean) as Topic[],
    });
  }

  comingUp.sort((a, b) => a.depth - b.depth);

  const allReachable = new Set(frontier.map((t) => t.id));
  for (const cu of comingUp) allReachable.add(cu.topic.id);

  return {
    frontier,
    almostReady,
    comingUp,
    stats: {
      totalKnown: knownTopics.length,
      frontierCount: frontier.length,
      almostReadyCount: almostReady.length,
      comingUpCount: comingUp.length,
      totalReachable: allReachable.size,
    },
  };
}
