import type { Topic, Dependency } from './types';
import { getTopics, getDependencies } from './data';

export interface GraphNode {
  id: string;
  label: string;
  subject: string;
  domain: string;
  type: string;
  ageStart: number;
  ageEnd: number;
  centrality: number;
  prereqCount: number;
  unlockCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  strength: 'hard' | 'soft';
  reason: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildGraphData(): GraphData {
  const topics = getTopics();
  const deps = getDependencies();

  const prereqCount = new Map<string, number>();
  const unlockCount = new Map<string, number>();

  for (const d of deps) {
    prereqCount.set(d.topicId, (prereqCount.get(d.topicId) ?? 0) + 1);
    unlockCount.set(d.prerequisiteId, (unlockCount.get(d.prerequisiteId) ?? 0) + 1);
  }

  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const nodes: GraphNode[] = topics.map((t) => ({
    id: t.id,
    label: t.name,
    subject: t.subject,
    domain: t.domain,
    type: t.type,
    ageStart: t.ageRangeStart,
    ageEnd: t.ageRangeEnd,
    centrality: t.centrality,
    prereqCount: prereqCount.get(t.id) ?? 0,
    unlockCount: unlockCount.get(t.id) ?? 0,
  }));

  const edges: GraphEdge[] = deps
    .filter((d) => topicMap.has(d.topicId) && topicMap.has(d.prerequisiteId))
    .map((d, i) => ({
      id: `e${i}`,
      source: d.topicId,
      target: d.prerequisiteId,
      strength: d.strength,
      reason: d.reason,
    }));

  return { nodes, edges };
}
