'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [stats, setStats] = useState<{ jobs: number | null; candidates: number | null }>({ jobs: null, candidates: null });
  useEffect(() => {
    Promise.all([
      fetch('/jobs?page=1&pageSize=1').then((r) => r.json()).then((d) => d.total).catch(() => 0),
      fetch('/candidates?page=1&pageSize=1').then((r) => r.json()).then((d) => d.total).catch(() => 0),
    ]).then(([jobs, candidates]) => setStats({ jobs, candidates }));
  }, []);

  return (
    <main className="min-h-[calc(100vh-56px)]">
      <section className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Create, edit, archive, filter, and reorder job postings.</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total: {stats.jobs ?? '—'}</span>
                <Button asChild size="sm">
                  <Link href="/jobs">Open</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Candidates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Browse 1,000+ candidates, search, filter, and manage stages.</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total: {stats.candidates ?? '—'}</span>
                <Button asChild size="sm">
                  <Link href="/candidates">Open</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assessments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Build per-job assessments with live preview and validations.</p>
              <div className="flex items-center justify-end">
                <Button asChild size="sm">
                  <Link href="/assessments">Open</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 rounded-lg overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1600&auto=format&fit=crop"
            alt="Team collaborating"
            className="w-full h-56 object-cover"
          />
        </div>
      </section>
    </main>
  );
}