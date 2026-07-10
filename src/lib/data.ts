import type { Topic, Dependency, Curriculum, Cluster, Manifest } from './types';
import topicsData from '../data/taxonomy/data/topics.json';
import depsData from '../data/taxonomy/data/dependencies.json';
import standardsData from '../data/taxonomy/data/curriculum-standards.json';
import clustersData from '../data/taxonomy/data/clusters.json';
import manifestData from '../data/taxonomy/data/manifest.json';

let _topics: Topic[] | null = null;
let _deps: Dependency[] | null = null;
let _curricula: Curriculum[] | null = null;
let _clusters: Cluster[] | null = null;
let _manifest: Manifest | null = null;

export function getTopics(): Topic[] {
  if (!_topics) _topics = (topicsData as any).topics;
  return _topics;
}

export function getDependencies(): Dependency[] {
  if (!_deps) _deps = (depsData as any).dependencies;
  return _deps;
}

export function getCurricula(): Curriculum[] {
  if (!_curricula) _curricula = (standardsData as any).curricula;
  return _curricula;
}

export function getClusters(): Cluster[] {
  if (!_clusters) _clusters = (clustersData as any).clusters;
  return _clusters;
}

export function getManifest(): Manifest {
  if (!_manifest) _manifest = {
    dataset: (manifestData as any).dataset,
    taxonomyVersion: (manifestData as any).taxonomyVersion,
    generatedAt: (manifestData as any).generatedAt,
    counts: (manifestData as any).counts,
  };
  return _manifest;
}

export function getTopicById(id: string): Topic | undefined {
  return getTopics().find((t) => t.id === id);
}

export function getTopicsBySubject(subject: string): Topic[] {
  return getTopics().filter((t) => t.subject === subject);
}

export function getTopicsByAge(minAge: number, maxAge: number): Topic[] {
  return getTopics().filter(
    (t) => t.ageRangeStart <= maxAge && t.ageRangeEnd >= minAge
  );
}

export function getTopicsByDomain(subject: string, domain: string): Topic[] {
  return getTopics().filter((t) => t.subject === subject && t.domain === domain);
}

export function getDomainsForSubject(subject: string): string[] {
  const domains = new Set<string>();
  getTopics()
    .filter((t) => t.subject === subject)
    .forEach((t) => domains.add(t.domain));
  return Array.from(domains).sort();
}

export function getCurriculumBySlug(slug: string): Curriculum | undefined {
  return getCurricula().find((c) => c.slug === slug);
}

export function getStandardsForTopic(topic: Topic): { curriculum: Curriculum; standard: any }[] {
  if (!topic.standards.length) return [];
  const allCurricula = getCurricula();
  const curriculumMap = new Map<string, Map<string, any>>();
  for (const c of allCurricula) {
    const m = new Map<string, any>();
    for (const st of c.topics) {
      m.set(st.key, st);
    }
    curriculumMap.set(c.slug, m);
  }

  return topic.standards
    .map((key) => {
      const [slug] = key.split(':');
      const rest = key.slice(slug.length + 1);
      const m = curriculumMap.get(slug);
      const st = m?.get(key);
      if (!st) return null;
      return { curriculum: allCurricula.find((c) => c.slug === slug)!, standard: st };
    })
    .filter(Boolean) as { curriculum: Curriculum; standard: any }[];
}
