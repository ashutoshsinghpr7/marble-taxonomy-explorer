import { getTopics, getDependencies, getManifest, getCurricula } from './data';
import type { Topic } from './types';

export interface StatsData {
  manifest: ReturnType<typeof getManifest>;
  subjectDistribution: { name: string; count: number; color: string; pct: number }[];
  typeDistribution: { name: string; count: number; pct: number }[];
  mostCentral: { id: string; name: string; subject: string; centrality: number }[];
  mostPrerequisites: { id: string; name: string; subject: string; prereqCount: number; unlockCount: number }[];
  ageDistribution: { range: string; count: number }[];
  curriculumCoverage: { name: string; count: number; linkedCount: number; pct: number }[];
  deepestChains: { id: string; name: string; subject: string; depth: number }[];
  domainCount: number;
  clusterCount: number;
  avgCentrality: number;
  avgPrereqs: number;
}

const COLORS: Record<string, string> = {
  'Mathematics': '#3b82f6',
  'Science': '#22c55e',
  'English': '#f59e0b',
  'History': '#a855f7',
  'Personal & Social Development': '#ec4899',
  'Life Skills': '#14b8a6',
  'Computing': '#6366f1',
  'Learning to Learn': '#f43f5e',
};

export function computeStats(): StatsData {
  const topics = getTopics();
  const deps = getDependencies();
  const manifest = getManifest();
  const curricula = getCurricula();

  const totalTopics = topics.length;

  const subjectCounts = new Map<string, number>();
  for (const t of topics) {
    subjectCounts.set(t.subject, (subjectCounts.get(t.subject) ?? 0) + 1);
  }
  const subjectDistribution = Array.from(subjectCounts.entries())
    .map(([name, count]) => ({ name, count, color: COLORS[name] ?? '#6b7280', pct: Math.round((count / totalTopics) * 100) }))
    .sort((a, b) => b.count - a.count);

  const typeCounts = new Map<string, number>();
  for (const t of topics) {
    typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);
  }
  const typeDistribution = Array.from(typeCounts.entries())
    .map(([name, count]) => ({ name, count, pct: Math.round((count / totalTopics) * 100) }))
    .sort((a, b) => b.count - a.count);

  const mostCentral = topics
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, 15)
    .map((t) => ({ id: t.id, name: t.name, subject: t.subject, centrality: Math.round(t.centrality * 1000) / 1000 }));

  const prereqCounts = new Map<string, number>();
  const unlockCounts = new Map<string, number>();
  for (const d of deps) {
    prereqCounts.set(d.topicId, (prereqCounts.get(d.topicId) ?? 0) + 1);
    unlockCounts.set(d.prerequisiteId, (unlockCounts.get(d.prerequisiteId) ?? 0) + 1);
  }

  const mostPrerequisites = topics
    .map((t) => ({
      id: t.id, name: t.name, subject: t.subject,
      prereqCount: prereqCounts.get(t.id) ?? 0,
      unlockCount: unlockCounts.get(t.id) ?? 0,
    }))
    .filter((t) => t.prereqCount > 0 || t.unlockCount > 0)
    .sort((a, b) => (b.prereqCount + b.unlockCount) - (a.prereqCount + a.unlockCount))
    .slice(0, 15);

  const ageDistribution = [
    { range: '4–5', count: topics.filter((t) => t.ageRangeStart <= 5 && t.ageRangeEnd >= 4).length },
    { range: '5–6', count: topics.filter((t) => t.ageRangeStart <= 6 && t.ageRangeEnd >= 5).length },
    { range: '6–7', count: topics.filter((t) => t.ageRangeStart <= 7 && t.ageRangeEnd >= 6).length },
    { range: '7–8', count: topics.filter((t) => t.ageRangeStart <= 8 && t.ageRangeEnd >= 7).length },
    { range: '8–9', count: topics.filter((t) => t.ageRangeStart <= 9 && t.ageRangeEnd >= 8).length },
    { range: '9–10', count: topics.filter((t) => t.ageRangeStart <= 10 && t.ageRangeEnd >= 9).length },
    { range: '10–11', count: topics.filter((t) => t.ageRangeStart <= 11 && t.ageRangeEnd >= 10).length },
    { range: '11–12', count: topics.filter((t) => t.ageRangeStart <= 12 && t.ageRangeEnd >= 11).length },
  ];

  const allStandardKeys = new Set<string>();
  for (const t of topics) {
    for (const s of t.standards) allStandardKeys.add(s);
  }

  const curriculumCoverage = curricula.map((c) => {
    const linkedCount = c.topics.filter((st) => allStandardKeys.has(st.key)).length;
    return {
      name: c.name.split(':')[0].trim(),
      count: c.topicCount,
      linkedCount,
      pct: c.topicCount > 0 ? Math.round((linkedCount / c.topicCount) * 100) : 0,
    };
  });

  const adj = new Map<string, string[]>();
  for (const d of deps) {
    if (!adj.has(d.topicId)) adj.set(d.topicId, []);
    adj.get(d.topicId)!.push(d.prerequisiteId);
  }

  function computeDepth(id: string, visited: Set<string> = new Set()): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    const prereqs = adj.get(id) ?? [];
    if (prereqs.length === 0) return 1;
    let maxChild = 0;
    for (const p of prereqs) {
      maxChild = Math.max(maxChild, computeDepth(p, new Set(visited)));
    }
    return maxChild + 1;
  }

  const deepestChains = topics
    .filter((t) => (prereqCounts.get(t.id) ?? 0) > 2)
    .map((t) => ({ id: t.id, name: t.name, subject: t.subject, depth: computeDepth(t.id) }))
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 15);

  const domainSet = new Set(topics.map((t) => `${t.subject}/${t.domain}`));
  const avgCentrality = Math.round(topics.reduce((s, t) => s + t.centrality, 0) / totalTopics * 1000) / 1000;
  const topicWithPrereqs = topics.filter((t) => (prereqCounts.get(t.id) ?? 0) > 0).length;
  const avgPrereqs = Math.round((deps.length / topicWithPrereqs) * 10) / 10;

  return {
    manifest,
    subjectDistribution,
    typeDistribution,
    mostCentral,
    mostPrerequisites,
    ageDistribution,
    curriculumCoverage,
    deepestChains,
    domainCount: domainSet.size,
    clusterCount: manifest.counts.clusters,
    avgCentrality,
    avgPrereqs,
  };
}
