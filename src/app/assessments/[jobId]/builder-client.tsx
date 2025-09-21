'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// Types matching our DB
export type QuestionType = 'single' | 'multi' | 'short' | 'long' | 'numeric' | 'file';
export interface Question { id: string; type: QuestionType; label: string; required?: boolean; options?: string[]; maxLength?: number; min?: number; max?: number; showIf?: { questionId: string; equals: any } }
export interface Section { id: string; title: string; questions: Question[] }
export interface Assessment { id: number; jobId: number; title: string; sections: Section[]; updatedAt: number }

interface Props { jobId: number }

export const AssessmentBuilderClient = ({ jobId }: Props) => {
  const [data, setData] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [candidateId, setCandidateId] = useState<string>('1');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      // if invalid jobId, start with a blank assessment immediately
      if (!Number.isFinite(jobId)) {
        const blank: Assessment = { id: 0, jobId: 0, title: 'New Assessment', sections: [], updatedAt: Date.now() };
        if (!cancelled) setData(blank);
        setLoading(false);
        return;
      }
      // wait for Mirage to boot in the browser (max ~3s)
      if (typeof window !== 'undefined') {
        const start = Date.now();
        while (!(window as any)._mirageRunning && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      try {
        const res = await fetch(`/assessments/${jobId}`);
        if (res.ok) {
          const a: Assessment = await res.json();
          if (!cancelled) setData(a);
        } else if (res.status === 404) {
          // Initialize a blank assessment for this job
          const blank: Assessment = { id: jobId, jobId, title: 'New Assessment', sections: [], updatedAt: Date.now() };
          if (!cancelled) setData(blank);
        } else {
          // Fallback: start with a blank assessment if any unexpected response
          const blank: Assessment = { id: jobId, jobId, title: 'New Assessment', sections: [], updatedAt: Date.now() };
          if (!cancelled) {
            setData(blank);
            toast.info('Starting a new assessment for this job');
          }
        }
      } catch {
        // Network or other failure: start with a blank assessment
        const blank: Assessment = { id: jobId, jobId, title: 'New Assessment', sections: [], updatedAt: Date.now() };
        if (!cancelled) {
          setData(blank);
          toast.info('Starting a new assessment for this job');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [jobId]);

  const addSection = () => {
    if (!data) return;
    const id = crypto.randomUUID();
    setData({ ...data, sections: [...data.sections, { id, title: `Section ${data.sections.length + 1}`, questions: [] }] });
  };

  const addQuestion = (sectionId: string, type: QuestionType) => {
    if (!data) return;
    const id = crypto.randomUUID();
    const q: Question = { id, type, label: 'New question', required: false };
    const next = data.sections.map(s => s.id === sectionId ? { ...s, questions: [...s.questions, q] } : s);
    setData({ ...data, sections: next });
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    if (!data) return;
    const next = data.sections.map(s => s.id === sectionId ? { ...s, title } : s);
    setData({ ...data, sections: next });
  };

  const updateQuestion = (sectionId: string, qid: string, patch: Partial<Question>) => {
    if (!data) return;
    const next = data.sections.map(s => s.id === sectionId ? { ...s, questions: s.questions.map(q => q.id === qid ? { ...q, ...patch } : q) } : s);
    setData({ ...data, sections: next });
  };

  const removeQuestion = (sectionId: string, qid: string) => {
    if (!data) return;
    const next = data.sections.map(s => s.id === sectionId ? { ...s, questions: s.questions.filter(q => q.id !== qid) } : s);
    setData({ ...data, sections: next });
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`/assessments/${jobId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Assessment saved');
    } catch (e) {
      toast.error('Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  // Live preview form state
  const allQuestions = useMemo(() => data?.sections.flatMap(s => s.questions) ?? [], [data]);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const isVisible = (q: Question) => {
    if (!q.showIf) return true;
    const v = answers[q.showIf.questionId];
    return v === q.showIf.equals;
    };

  const validate = () => {
    const errors: string[] = [];
    for (const s of data?.sections ?? []) {
      for (const q of s.questions) {
        if (!isVisible(q)) continue;
        const v = answers[q.id];
        if (q.required && (v === undefined || v === '' || (Array.isArray(v) && v.length === 0))) {
          errors.push(`${q.label} is required`);
          continue;
        }
        if (q.type === 'numeric' && v !== undefined) {
          const num = Number(v);
          if (Number.isNaN(num)) errors.push(`${q.label} must be a number`);
          if (q.min !== undefined && num < q.min) errors.push(`${q.label} must be >= ${q.min}`);
          if (q.max !== undefined && num > q.max) errors.push(`${q.label} must be <= ${q.max}`);
        }
        if ((q.type === 'short' || q.type === 'long') && q.maxLength && typeof v === 'string' && v.length > q.maxLength) {
          errors.push(`${q.label} exceeds max length`);
        }
      }
    }
    return errors;
  };

  const submitResponse = async () => {
    const errs = validate();
    if (errs.length > 0) {
      toast.error('Please fix the form', { description: errs.join('\n') });
      return;
    }
    try {
      await fetch(`/assessments/${jobId}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: Number(candidateId) || 1, responses: answers }) });
      toast.success('Response submitted locally');
      setAnswers({});
    } catch {
      toast.error('Failed to submit response');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link className="underline text-sm" href={`/jobs/${jobId}`}>← Back to Job</Link>
          <h1 className="text-2xl font-semibold">Assessment Builder (Job #{jobId})</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addSection}>Add Section</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {data && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Builder */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm">Assessment Title</label>
              <Input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} />
            </div>

            {data.sections.map((s) => (
              <div key={s.id} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Input value={s.title} onChange={(e) => updateSectionTitle(s.id, e.target.value)} />
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(v) => addQuestion(s.id, v as QuestionType)}>
                      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Add question" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single choice</SelectItem>
                        <SelectItem value="multi">Multi choice</SelectItem>
                        <SelectItem value="short">Short text</SelectItem>
                        <SelectItem value="long">Long text</SelectItem>
                        <SelectItem value="numeric">Numeric</SelectItem>
                        <SelectItem value="file">File upload</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  {s.questions.map((q) => (
                    <div key={q.id} className="rounded border p-2 space-y-2">
                      <div className="grid gap-2 md:grid-cols-2 items-start">
                        <div className="space-y-1">
                          <label className="text-xs">Label</label>
                          <Input value={q.label} onChange={(e) => updateQuestion(s.id, q.id, { label: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs">Type</label>
                          <Select value={q.type} onValueChange={(v) => updateQuestion(s.id, q.id, { type: v as QuestionType })}>
                            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">Single</SelectItem>
                              <SelectItem value="multi">Multi</SelectItem>
                              <SelectItem value="short">Short</SelectItem>
                              <SelectItem value="long">Long</SelectItem>
                              <SelectItem value="numeric">Numeric</SelectItem>
                              <SelectItem value="file">File</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs">Required</label>
                          <Select value={q.required ? 'yes' : 'no'} onValueChange={(v) => updateQuestion(s.id, q.id, { required: v === 'yes' })}>
                            <SelectTrigger><SelectValue placeholder="Required" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(q.type === 'single' || q.type === 'multi') && (
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs">Options (comma separated)</label>
                            <Input value={(q.options ?? []).join(', ')} onChange={(e) => updateQuestion(s.id, q.id, { options: e.target.value.split(',').map(t => t.trim()) })} />
                          </div>
                        )}
                        {(q.type === 'short' || q.type === 'long') && (
                          <div className="space-y-1">
                            <label className="text-xs">Max length</label>
                            <Input type="number" value={q.maxLength ?? ''} onChange={(e) => updateQuestion(s.id, q.id, { maxLength: Number(e.target.value) || undefined })} />
                          </div>
                        )}
                        {q.type === 'numeric' && (
                          <>
                            <div className="space-y-1">
                              <label className="text-xs">Min</label>
                              <Input type="number" value={q.min ?? ''} onChange={(e) => updateQuestion(s.id, q.id, { min: Number(e.target.value) || undefined })} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs">Max</label>
                              <Input type="number" value={q.max ?? ''} onChange={(e) => updateQuestion(s.id, q.id, { max: Number(e.target.value) || undefined })} />
                            </div>
                          </>
                        )}
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs">Conditional (show if questionId equals value)</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="questionId" value={q.showIf?.questionId ?? ''} onChange={(e) => updateQuestion(s.id, q.id, { showIf: { questionId: e.target.value, equals: q.showIf?.equals } })} />
                            <Input placeholder="equals" value={q.showIf?.equals ?? ''} onChange={(e) => updateQuestion(s.id, q.id, { showIf: { questionId: q.showIf?.questionId ?? '', equals: e.target.value } })} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => removeQuestion(s.id, q.id)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Live preview */}
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Live Preview</h2>
                <div className="flex items-center gap-2">
                  <Input className="w-28" placeholder="Candidate ID" value={candidateId} onChange={(e) => setCandidateId(e.target.value)} />
                  <Button size="sm" onClick={submitResponse}>Submit</Button>
                </div>
              </div>
            </div>
            {data.sections.map((s) => (
              <div key={s.id} className="rounded-md border p-3 space-y-3">
                <div className="font-medium">{s.title}</div>
                {s.questions.map((q) => isVisible(q) && (
                  <div key={q.id} className="space-y-1">
                    <label className="text-sm">{q.label}{q.required ? ' *' : ''}</label>
                    {q.type === 'short' && (
                      <Input value={answers[q.id] ?? ''} onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                    )}
                    {q.type === 'long' && (
                      <Textarea value={answers[q.id] ?? ''} onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                    )}
                    {q.type === 'numeric' && (
                      <Input type="number" value={answers[q.id] ?? ''} onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                    )}
                    {q.type === 'single' && (
                      <Select value={answers[q.id] ?? ''} onValueChange={(v) => setAnswers(a => ({ ...a, [q.id]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(q.options ?? []).map((opt, i) => (<SelectItem key={opt + i} value={opt}>{opt}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    )}
                    {q.type === 'multi' && (
                      <div className="flex flex-wrap gap-2">
                        {(q.options ?? []).map((opt, i) => {
                          const arr: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                          const checked = arr.includes(opt);
                          return (
                            <button key={opt + i} type="button" className={`text-xs rounded px-2 py-1 border ${checked ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => {
                              setAnswers((a) => {
                                const current: string[] = Array.isArray(a[q.id]) ? a[q.id] : [];
                                const next = checked ? current.filter(x => x !== opt) : [...current, opt];
                                return { ...a, [q.id]: next };
                              });
                            }}>{opt}</button>
                          );
                        })}
                      </div>
                    )}
                    {q.type === 'file' && (
                      <Input type="file" onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.files?.[0]?.name ?? '' }))} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};