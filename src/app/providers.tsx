'use client';
import { useEffect } from 'react';
import { makeServer } from '@/mirage/server';
import { ensureSeed } from '@/lib/db';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    ensureSeed().then(() => makeServer());
  }, []);
  return children as any;
}