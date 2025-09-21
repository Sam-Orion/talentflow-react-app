import Dexie, { type EntityTable } from 'dexie';
import { faker } from '@faker-js/faker';

export type JobStatus = 'active' | 'archived';
export interface Job {
  id: number;
  title: string;
  slug: string;
  status: JobStatus;
  tags: string[];
  order: number;
  createdAt: number;
  updatedAt: number;
}

export type CandidateStage = 'applied' | 'screen' | 'tech' | 'offer' | 'hired' | 'rejected';
export interface Candidate {
  id: number;
  jobId: number | null;
  name: string;
  email: string;
  stage: CandidateStage;
  createdAt: number;
  updatedAt: number;
}

export interface CandidateTimelineEvent {
  id?: number;
  candidateId: number;
  type: 'stage_change' | 'note';
  from?: CandidateStage | null;
  to?: CandidateStage | null;
  note?: string;
  at: number;
}

export type QuestionType = 'single' | 'multi' | 'short' | 'long' | 'numeric' | 'file';
export interface AssessmentQuestion {
  id: string; // uuid
  type: QuestionType;
  label: string;
  required?: boolean;
  options?: string[]; // for choice types
  maxLength?: number; // for text types
  min?: number; // for numeric
  max?: number; // for numeric
  // conditional logic
  showIf?: {
    questionId: string;
    equals: string | number | boolean;
  };
}

export interface AssessmentSection {
  id: string; // uuid
  title: string;
  questions: AssessmentQuestion[];
}

export interface Assessment {
  id: number; // same as jobId for simplicity
  jobId: number;
  title: string;
  sections: AssessmentSection[];
  updatedAt: number;
}

export interface AssessmentResponse {
  id?: number;
  jobId: number;
  candidateId: number;
  responses: Record<string, any>; // keyed by questionId
  submittedAt: number;
}

export class TalentFlowDB extends Dexie {
  jobs!: EntityTable<Job, 'id'>;
  candidates!: EntityTable<Candidate, 'id'>;
  timelines!: EntityTable<CandidateTimelineEvent, 'id'>;
  assessments!: EntityTable<Assessment, 'id'>;
  assessmentResponses!: EntityTable<AssessmentResponse, 'id'>;
  meta!: EntityTable<{ key: string; value: any }, 'key'>;

  constructor() {
    super('talentflow');
    this.version(1).stores({
      jobs: '++id, slug, status, order, createdAt',
      candidates: '++id, jobId, email, stage, createdAt',
      timelines: '++id, candidateId, at',
      assessments: 'id, jobId, updatedAt',
      assessmentResponses: '++id, jobId, candidateId, submittedAt',
      meta: 'key',
    });
  }
}

export const db = new TalentFlowDB();

const TAGS = ['remote', 'hybrid', 'onsite', 'full-time', 'contract', 'urgent', 'junior', 'senior'];
const STAGES: CandidateStage[] = ['applied', 'screen', 'tech', 'offer', 'hired', 'rejected'];

export async function ensureSeed() {
  const seeded = await db.meta.get('seeded');
  if (seeded?.value) return; // already seeded

  const now = Date.now();

  // 25 jobs
  const jobs: Job[] = Array.from({ length: 25 }).map((_, i) => {
    const title = faker.person.jobTitle();
    const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${slugBase}-${i + 1}`;
    return {
      id: i + 1,
      title,
      slug,
      status: Math.random() < 0.75 ? 'active' : 'archived',
      tags: faker.helpers.arrayElements(TAGS, { min: 1, max: 3 }),
      order: i,
      createdAt: now - faker.number.int({ min: 0, max: 1000 * 60 * 60 * 24 * 30 }),
      updatedAt: now,
    };
  });

  await db.jobs.bulkPut(jobs);

  // 1000 candidates
  const candidates: Candidate[] = Array.from({ length: 1000 }).map((_, i) => {
    const job = faker.helpers.arrayElement(jobs);
    const name = faker.person.fullName();
    const email = faker.internet.email({ firstName: name.split(' ')[0], lastName: name.split(' ').slice(-1)[0] }).toLowerCase();
    const stage = faker.helpers.arrayElement(STAGES);
    return {
      id: i + 1,
      jobId: Math.random() < 0.9 ? job.id : null,
      name,
      email,
      stage,
      createdAt: now - faker.number.int({ min: 0, max: 1000 * 60 * 60 * 24 * 60 }),
      updatedAt: now,
    };
  });

  await db.candidates.bulkPut(candidates);

  // timeline per candidate
  const timelineEvents: CandidateTimelineEvent[] = [];
  for (const c of candidates) {
    const hops = faker.number.int({ min: 1, max: 4 });
    let current: CandidateStage = 'applied';
    timelineEvents.push({ candidateId: c.id, type: 'stage_change', from: null, to: current, at: c.createdAt });
    for (let h = 0; h < hops; h++) {
      const next = faker.helpers.arrayElement(STAGES);
      timelineEvents.push({ candidateId: c.id, type: 'stage_change', from: current, to: next, at: c.createdAt + (h + 1) * 86_400_000 / 2 });
      current = next;
    }
  }
  await db.timelines.bulkAdd(timelineEvents);

  // 3 assessments with 10+ questions each (tie to first 3 jobs)
  const assessments: Assessment[] = jobs.slice(0, 3).map((job, idx) => {
    const sectionCount = 2 + (idx % 2);
    const sections: AssessmentSection[] = Array.from({ length: sectionCount }).map((_, sidx) => {
      const qs: AssessmentQuestion[] = [];
      for (let q = 0; q < 5; q++) {
        const qtype: QuestionType = faker.helpers.arrayElement(['single', 'multi', 'short', 'long', 'numeric']);
        const id = faker.string.uuid();
        const label = `${faker.hacker.verb()} ${faker.hacker.noun()}?`;
        const base: AssessmentQuestion = { id, type: qtype, label, required: Math.random() < 0.6 };
        if (qtype === 'single' || qtype === 'multi') {
          base.options = faker.helpers.uniqueArray(() => faker.commerce.productAdjective(), 4);
        }
        if (qtype === 'short' || qtype === 'long') {
          base.maxLength = qtype === 'short' ? 120 : 600;
        }
        if (qtype === 'numeric') {
          base.min = 0; base.max = 10;
        }
        qs.push(base);
      }
      // add a conditional question
      if (qs.length > 2) {
        const dep = qs[0];
        const id = faker.string.uuid();
        qs.push({ id, type: 'short', label: 'Why?', required: true, showIf: { questionId: dep.id, equals: (dep.options?.[0] ?? 'Yes') } });
      }
      return { id: faker.string.uuid(), title: `Section ${sidx + 1}`, questions: qs };
    });
    return { id: job.id, jobId: job.id, title: `${job.title} Assessment`, sections, updatedAt: now };
  });
  await db.assessments.bulkPut(assessments);

  await db.meta.put({ key: 'seeded', value: true });
}

// Utility: pagination helper
export function paginate<T>(items: T[], page = 1, pageSize = 10) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return { data: items.slice(start, end), page, pageSize, total, pages };
}