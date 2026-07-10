import type { Topic } from './types';
import { getTopics } from './data';

let _index: Topic[] | null = null;

export function getSearchIndex(): Topic[] {
  if (!_index) _index = getTopics();
  return _index;
}

export function search(query: string): Topic[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const topics = getSearchIndex();
  const results: { topic: Topic; score: number }[] = [];

  for (const topic of topics) {
    let score = 0;
    const nameL = topic.name.toLowerCase();
    const descL = topic.description.toLowerCase();
    const domainL = topic.domain.toLowerCase();
    const subjectL = topic.subject.toLowerCase();

    if (nameL === q) score += 100;
    else if (nameL.includes(q)) score += 60;
    else if (nameL.startsWith(q)) score += 40;

    if (descL.includes(q)) score += 20;
    if (domainL.includes(q)) score += 10;
    if (subjectL === q) score += 5;

    const words = q.split(/\s+/);
    for (const word of words) {
      if (nameL.includes(word)) score += 15;
      if (descL.includes(word)) score += 5;
    }

    if (score > 0) results.push({ topic, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 50).map((r) => r.topic);
}
