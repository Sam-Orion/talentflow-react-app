'use client';
import { useEffect } from 'react';
import { makeServer } from '@/mirage/server';
import { ensureSeed } from '@/lib/db';

// Start Mirage immediately on module load so fetch() is intercepted before any page effects run
if (typeof window !== 'undefined') {
  try { makeServer(); } catch {}
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Seed in the background; each route also guards with ensureSeed
    ensureSeed();
  }, []);
  return children as any;
}