'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Job { id: number; title: string; slug: string; status: 'active'|'archived'; tags: string[]; order: number }

export default function JobDetailPage({ params }: { params: { jobId: string } }) {
  const id = Number(params.jobId);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load one page and pick the job (no single get endpoint in mock, keep simple)
    fetch(`/jobs?page=1&pageSize=1000`)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.data as Job[]).find((j) => j.id === id) || null;
        setJob(found);
        if (!found) setError('Not found');
      })
      .catch(() => setError('Failed to load job'));
  }, [id]);

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <Link className="underline text-sm" href="/jobs">← Back to Jobs</Link>
      {!job && !error && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {job && (
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <div className="text-sm text-muted-foreground">Slug: /{job.slug} • Status: {job.status}</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {job.tags.map((t) => <span key={t} className="text-[10px] rounded bg-muted px-2 py-0.5">{t}</span>)}
          </div>
          <div className="mt-6">
            <Link className="text-sm underline" href={`/assessments/${job.id}`}>Open Assessment Builder →</Link>
          </div>
        </div>
      )}
    </div>
  );
}