"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Job { id: number; title: string; status: "active"|"archived"; slug: string; tags: string[]; order: number; createdAt: number; updatedAt: number }
interface Page<T> { data: T[]; total: number; page: number; pageSize: number; pages: number }

export default function AssessmentsIndex() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      // wait for Mirage to be ready
      const start = Date.now();
      try {
        while (typeof window !== "undefined" && !(window as any)._mirageRunning && Date.now() - start < 3000) {
          await new Promise(r => setTimeout(r, 50));
        }
        const res = await fetch(`/jobs?page=1&pageSize=100&status=active`);
        if (!res.ok) throw new Error("Failed");
        const data: Page<Job> = await res.json();
        const list = Array.isArray((data as any).data) ? (data as any).data as Job[] : [];
        if (!cancelled) setJobs(list);
      } catch (e) {
        if (!cancelled) setError("Failed to load jobs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const src = Array.isArray(jobs) ? jobs : [];
    const q = search.trim().toLowerCase();
    if (!q) return src;
    return src.filter(j => j.title.toLowerCase().includes(q) || j.slug.toLowerCase().includes(q));
  }, [jobs, search]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Assessments</h1>
      </div>

      <div className="flex items-center gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs…" className="max-w-sm" />
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading jobs…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((j) => (
          <Card key={j.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{j.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{j.status}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Slug: {j.slug}</div>
              <Button asChild size="sm"><Link href={`/assessments/${j.id}`}>Open Builder</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && !error && filtered.length === 0 && (
        <div className="text-sm text-muted-foreground">No jobs found.</div>
      )}
    </main>
  );
}