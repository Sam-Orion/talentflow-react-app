import { createServer, Response } from 'miragejs';
import { db, ensureSeed, paginate, type Job, type Candidate, type Assessment } from '@/lib/db';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function makeServer() {
  if (typeof window === 'undefined') return;
  // prevent duplicate servers during HMR
  if ((window as any)._mirageRunning) return;
  (window as any)._mirageRunning = true;

  createServer({
    routes() {
      this.urlPrefix = '';
      this.namespace = '';

      // Jobs
      this.get('/jobs', async (schema, request) => {
        await ensureSeed();
        const searchParam = request.queryParams['search'];
        const search = Array.isArray(searchParam) ? searchParam[0] || '' : searchParam || '';
        const searchLower = search.toLowerCase();
        const statusParam = request.queryParams['status'];
        const status = Array.isArray(statusParam) ? statusParam[0] || '' : statusParam || '';
        const pageParam = request.queryParams['page'];
        const page = parseInt(Array.isArray(pageParam) ? pageParam[0] || '1' : pageParam || '1', 10);
        const pageSizeParam = request.queryParams['pageSize'];
        const pageSize = parseInt(Array.isArray(pageSizeParam) ? pageSizeParam[0] || '10' : pageSizeParam || '10', 10);
        const sortParam = request.queryParams['sort'];
        const sort = Array.isArray(sortParam) ? sortParam[0] || 'order' : sortParam || 'order';
        const tagsParamRaw = request.queryParams['tags'];
        const tagsParam = Array.isArray(tagsParamRaw) ? tagsParamRaw[0] || '' : tagsParamRaw || '';
        const tagsParamTrimmed = tagsParam.trim();
        const tags = tagsParamTrimmed ? tagsParamTrimmed.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

        const all = await db.jobs.toArray();
        let items = all
          .filter((j) => (status ? j.status === status : true))
          .filter((j) => (searchLower ? j.title.toLowerCase().includes(searchLower) || j.slug.includes(searchLower) : true))
          .filter((j) => (tags.length ? j.tags.some((t) => tags.includes(t)) : true));

        if (sort === 'order') items.sort((a, b) => a.order - b.order);
        if (sort === 'createdAt:desc') items.sort((a, b) => b.createdAt - a.createdAt);

        const result = paginate(items, page, pageSize);
        await sleep(200 + Math.random() * 1000);
        return result;
      });

      this.post('/jobs', async (_schema, request) => {
        await ensureSeed();
        const body = JSON.parse(request.requestBody || '{}');
        const now = Date.now();
        const last = (await db.jobs.orderBy('order').last()) as Job | undefined;
        const id = (await db.jobs.count()) + 1;
        // validate slug uniqueness
        const existing = await db.jobs.where('slug').equals(body.slug).first();
        if (existing) {
          return new Response(400, {}, { message: 'Slug must be unique' });
        }
        const job: Job = {
          id,
          title: body.title,
          slug: body.slug,
          status: 'active',
          tags: body.tags ?? [],
          order: (last?.order ?? -1) + 1,
          createdAt: now,
          updatedAt: now,
        };
        if (Math.random() < 0.08) {
          await sleep(400);
          return new Response(500, {}, { message: 'Random failure (simulated)' });
        }
        await db.jobs.add(job);
        await sleep(200 + Math.random() * 1000);
        return job;
      });

      this.patch('/jobs/:id', async (_schema, request) => {
        await ensureSeed();
        const id = Number(request.params.id);
        const patch = JSON.parse(request.requestBody || '{}');
        const job = await db.jobs.get(id);
        if (!job) return new Response(404, {}, { message: 'Not found' });
        const updated = { ...job, ...patch, updatedAt: Date.now() } as Job;
        if (patch.slug && patch.slug !== job.slug) {
          const existing = await db.jobs.where('slug').equals(patch.slug).first();
          if (existing) return new Response(400, {}, { message: 'Slug must be unique' });
        }
        if (Math.random() < 0.08) return new Response(500, {}, { message: 'Random failure (simulated)' });
        await db.jobs.put(updated);
        await sleep(200 + Math.random() * 1000);
        return updated;
      });

      this.patch('/jobs/:id/reorder', async (_schema, request) => {
        await ensureSeed();
        const id = Number(request.params.id);
        const { fromOrder, toOrder } = JSON.parse(request.requestBody || '{}');
        if (Math.random() < 0.1) return new Response(500, {}, { message: 'Reorder failed (simulated)' });
        const all = await db.jobs.orderBy('order').toArray();
        const moved = all.find((j) => j.id === id);
        if (!moved) return new Response(404, {}, { message: 'Not found' });
        // reorder by removing and inserting
        const others = all.filter((j) => j.id !== id).sort((a, b) => a.order - b.order);
        others.splice(toOrder, 0, moved);
        await db.transaction('rw', db.jobs, async () => {
          await Promise.all(others.map((j, idx) => db.jobs.update(j.id, { order: idx })));
        });
        await sleep(200 + Math.random() * 1000);
        return { ok: true };
      });

      // Candidates list
      this.get('/candidates', async (_schema, request) => {
        await ensureSeed();
        const searchParam = request.queryParams['search'];
        const search = Array.isArray(searchParam) ? searchParam[0] || '' : searchParam || '';
        const searchLower = search.toLowerCase();
        const stageParam = request.queryParams['stage'];
        const stage = Array.isArray(stageParam) ? stageParam[0] || '' : stageParam || '';
        const pageParam = request.queryParams['page'];
        const page = parseInt(Array.isArray(pageParam) ? pageParam[0] || '1' : pageParam || '1', 10);
        const pageSizeParam = request.queryParams['pageSize'];
        const pageSize = parseInt(Array.isArray(pageSizeParam) ? pageSizeParam[0] || '25' : pageSizeParam || '25', 10);
        let all = await db.candidates.toArray();
        if (stage) all = all.filter((c) => c.stage === stage);
        if (searchLower) all = all.filter((c) => c.name.toLowerCase().includes(searchLower) || c.email.toLowerCase().includes(searchLower));
        all.sort((a, b) => b.createdAt - a.createdAt);
        const result = paginate(all, page, pageSize);
        await sleep(200 + Math.random() * 1000);
        return result;
      });

      this.post('/candidates', async (_schema, request) => {
        await ensureSeed();
        const body = JSON.parse(request.requestBody || '{}');
        const id = (await db.candidates.count()) + 1;
        const cand: Candidate = {
          id,
          jobId: body.jobId ?? null,
          name: body.name,
          email: body.email,
          stage: 'applied',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        if (Math.random() < 0.08) return new Response(500, {}, { message: 'Random failure (simulated)' });
        await db.candidates.add(cand);
        await db.timelines.add({ candidateId: id, type: 'stage_change', from: null, to: 'applied', at: Date.now() });
        await sleep(200 + Math.random() * 1000);
        return cand;
      });

      this.patch('/candidates/:id', async (_schema, request) => {
        await ensureSeed();
        const id = Number(request.params.id);
        const patch = JSON.parse(request.requestBody || '{}');
        const cand = await db.candidates.get(id);
        if (!cand) return new Response(404, {}, { message: 'Not found' });
        if (patch.stage && patch.stage !== cand.stage) {
          await db.timelines.add({ candidateId: id, type: 'stage_change', from: cand.stage, to: patch.stage, at: Date.now() });
        }
        if (Math.random() < 0.08) return new Response(500, {}, { message: 'Random failure (simulated)' });
        const updated = { ...cand, ...patch, updatedAt: Date.now() };
        await db.candidates.put(updated);
        await sleep(200 + Math.random() * 1000);
        return updated;
      });

      this.get('/candidates/:id/timeline', async (_schema, request) => {
        await ensureSeed();
        const id = Number(request.params.id);
        const events = await db.timelines.where('candidateId').equals(id).sortBy('at');
        await sleep(200 + Math.random() * 1000);
        return events;
      });

      // add note to candidate timeline
      this.post('/candidates/:id/notes', async (_schema, request) => {
        await ensureSeed();
        const id = Number(request.params.id);
        const { note } = JSON.parse(request.requestBody || '{}');
        if (!note || String(note).trim() === '') {
          return new Response(400, {}, { message: 'Note is required' });
        }
        await db.timelines.add({ candidateId: id, type: 'note', note, at: Date.now() });
        await sleep(200 + Math.random() * 1000);
        return { ok: true };
      });

      // Assessments
      this.get('/assessments/:jobId', async (_schema, request) => {
        await ensureSeed();
        const jobId = Number(request.params.jobId);
        const a = await db.assessments.get(jobId);
        await sleep(200 + Math.random() * 1000);
        if (!a) return new Response(404, {}, { message: 'Not found' });
        return a;
      });

      this.put('/assessments/:jobId', async (_schema, request) => {
        await ensureSeed();
        const jobId = Number(request.params.jobId);
        const body = JSON.parse(request.requestBody || '{}') as Assessment;
        if (Math.random() < 0.08) return new Response(500, {}, { message: 'Random failure (simulated)' });
        await db.assessments.put({ ...body, id: jobId, jobId, updatedAt: Date.now() });
        await sleep(200 + Math.random() * 1000);
        return { ok: true };
      });

      this.post('/assessments/:jobId/submit', async (_schema, request) => {
        await ensureSeed();
        const jobId = Number(request.params.jobId);
        const { candidateId, responses } = JSON.parse(request.requestBody || '{}');
        await db.assessmentResponses.add({ jobId, candidateId, responses, submittedAt: Date.now() });
        await sleep(200 + Math.random() * 1000);
        return { ok: true };
      });
    },
  });
}