export interface Topic {
  id: string;
  type: TopicType;
  subject: string;
  domain: string;
  name: string;
  description: string;
  ageRangeStart: number;
  ageRangeEnd: number;
  centrality: number;
  evidence: string[];
  assessmentPrompt: string;
  standards: string[];
}

export type TopicType = 'CONCEPTUAL' | 'PROCEDURAL' | 'REPRESENTATIONAL' | 'LANGUAGE' | 'META';

export interface Dependency {
  topicId: string;
  prerequisiteId: string;
  strength: 'hard' | 'soft';
  reason: string;
}

export interface CurriculumData {
  note: string;
  codesOnlySources: string[];
  curriculumCount: number;
  curricula: Curriculum[];
}

export interface Curriculum {
  slug: string;
  country: string;
  name: string;
  version: string;
  sourceUrl: string;
  textIncluded: boolean;
  license: string;
  topicCount: number;
  topics: CurriculumTopic[];
}

export interface CurriculumTopic {
  key: string;
  code: string;
  data: {
    title: string;
    domain: string;
    subject: string;
    keyStage?: string;
    description: string;
  };
}

export interface Cluster {
  subject: string;
  domain: string;
  ageRangeStart: number;
  summary: string;
}

export interface Manifest {
  dataset: string;
  taxonomyVersion: string;
  generatedAt: string;
  counts: {
    topics: number;
    topicsBySubject: Record<string, number>;
    dependencies: number;
    curricula: number;
    curriculumStandards: number;
    topicStandardLinks: number;
    clusters: number;
  };
}

export const SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'History',
  'Personal & Social Development',
  'Life Skills',
  'Computing',
  'Learning to Learn',
] as const;

export const SUBJECT_COLORS: Record<string, string> = {
  'Mathematics': '#3b82f6',
  'Science': '#22c55e',
  'English': '#f59e0b',
  'History': '#a855f7',
  'Personal & Social Development': '#ec4899',
  'Life Skills': '#14b8a6',
  'Computing': '#6366f1',
  'Learning to Learn': '#f43f5e',
};

export const AGE_RANGES = [
  { label: 'Ages 4–6', start: 4, end: 6 },
  { label: 'Ages 6–8', start: 6, end: 8 },
  { label: 'Ages 8–10', start: 8, end: 10 },
  { label: 'Ages 10–12', start: 10, end: 12 },
];
