'use client';

import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Link from 'next/link';

function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('riwaayat_theme') || 'light';
    setTheme(saved as 'light' | 'dark');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('riwaayat_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden font-sans">
      
      {/* Dynamic Background Mesh Grids */}
      <div className="bg-mesh">
        <div className="bg-orb o1" />
        <div className="bg-orb o2" />
        <div className="bg-orb o3" />
        <div className="bg-grid" />
      </div>

      {/* Navigation Header */}
      <Navbar />

      {/* Main Wrapper */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 relative z-10 page-body">
        {children}
      </main>

      {/* Floating Theme Button */}
      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-[var(--pd)] border border-[var(--border)] hover:bg-[var(--border2)] hover:scale-105 flex items-center justify-center cursor-pointer shadow-[var(--s2)] text-base transition-all duration-200"
        title="Toggle Theme"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {/* Standard Footer */}
      <footer className="w-full bg-[var(--surface)] border-t border-[var(--border)] relative z-20">
        <div className="max-w-7xl mx-auto px-6 py-9 flex flex-col items-center gap-4 text-center">
          
          <div className="font-serif text-lg font-bold text-[var(--t)] select-none">
            Riwaayat<span className="text-[var(--p)]">Rewards</span>
          </div>

          {/* Footer links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs font-semibold">
            <Link href="/howitworks" className="text-[var(--t2)] hover:text-[var(--p)] transition no-underline">How It Works</Link>
            <Link href="/shop" className="text-[var(--t2)] hover:text-[var(--p)] transition no-underline">Shop</Link>
            <Link href="/about" className="text-[var(--t2)] hover:text-[var(--p)] transition no-underline">About</Link>
            <Link href="/contact" className="text-[var(--t2)] hover:text-[var(--p)] transition no-underline">Contact</Link>
            <Link href="/privacy" className="text-[var(--t2)] hover:text-[var(--p)] transition no-underline">Privacy</Link>
            <Link href="/terms" className="text-[var(--t2)] hover:text-[var(--p)] transition no-underline">Terms</Link>
          </div>

          <div className="text-xs text-[var(--t2)]">
            Support: <a href="mailto:mojangstudio908@gmail.com" className="text-[var(--p)] font-semibold hover:underline">mojangstudio908@gmail.com</a>
          </div>

          <div className="text-[11px] text-[var(--t3)] leading-relaxed max-w-2xl">
            Riwaayat is an independent community platform and is not affiliated with third-party brands or services referenced on the platform.
            <span className="block mt-1 font-mono text-[10px]">© 2026 Riwaayat Rewards Portal — All rights reserved</span>
          </div>

        </div>
      </footer>

    </div>
  );
}

// Named export for sub-pages that import { ConsoleLayout }
export { ConsoleLayout };

// Default export
export default React.memo(ConsoleLayout);
