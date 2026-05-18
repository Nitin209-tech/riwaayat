'use client';

import React from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';

export default function About() {
  const stats = [
    { n: '12K+', l: 'Discord Members' },
    { n: '2026', l: 'Founded' },
    { n: '4', l: 'Reward Types' },
    { n: '72h', l: 'Max Delivery' }
  ];

  const team = [
    { initial: 'S', name: 'Support Team', role: 'Customer Support', desc: 'Available 24/7 to help with any issue — orders, accounts, or anything else you need.', gradient: 'from-[#10b981] to-[#059669]' },
    { initial: 'D', name: 'Dev Team', role: 'Tech & Bots', desc: 'Keeps the website, Discord bots, and backend running smoothly around the clock.', gradient: 'from-[#f59e0b] to-[#d97706]' }
  ];

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Hero header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            ℹ️ About Us
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            About <span className="text-[var(--p)] italic font-normal">Rewards Portal</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            A community-driven gaming rewards platform built to make premium gaming rewards accessible to everyone.
          </p>
        </div>

        {/* Metric counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((st, idx) => (
            <div key={idx} className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-5 text-center shadow-[var(--s1)]">
              <div className="font-serif text-3xl font-extrabold text-[var(--p)] mb-1">{st.n}</div>
              <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">{st.l}</div>
            </div>
          ))}
        </div>

        {/* Details Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--p)] to-transparent" />
          
          <h3 className="font-serif text-xl font-bold text-[var(--t)] mb-4">Our Mission</h3>
          <p className="text-xs text-[var(--t2)] leading-relaxed mb-6">
            Rewards Portal was born from a simple idea: gaming rewards should be accessible to everyone, not just those with deep pockets. We built a system where community engagement is rewarded — the more you participate, the more you earn.
          </p>

          <h3 className="font-serif text-base font-bold text-[var(--t)] mb-3">What Makes Us Different</h3>
          <ul className="space-y-3.5 pl-2 text-xs text-[var(--t2)] leading-relaxed">
            <li><strong>Earn Without Spending</strong> — Accumulate IQCoins through free activities on our Discord server.</li>
            <li><strong>Multiple Reward Options</strong> — Minecraft, Roblox, Xbox Game Pass, Discord Nitro, and more.</li>
            <li><strong>Fast Activation</strong> — All rewards are activated within 72 hours, usually much faster.</li>
            <li><strong>Secure &amp; Safe</strong> — Verified via Discord OAuth. Your data stays protected.</li>
            <li><strong>Free to Join</strong> — No membership fees, no subscriptions. Just earn and redeem.</li>
          </ul>

          <h3 className="font-serif text-base font-bold text-[var(--t)] mt-6 mb-3">Our Values</h3>
          <p className="text-xs text-[var(--t2)] leading-relaxed">
            We believe in transparency, security, and putting the community first. Every transaction is logged and invoiced. Our support team is available around the clock to help resolve any issues quickly.
          </p>
        </div>

        {/* Team Section */}
        <div className="space-y-6">
          <h3 className="font-serif text-2xl font-semibold text-[var(--t)]">👥 Our Team</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {team.map((tm, idx) => (
              <div key={idx} className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 flex flex-col items-center text-center space-y-4 hover:border-[var(--border2)] transition">
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${tm.gradient} flex items-center justify-center font-serif text-2xl font-bold text-white shadow-md`}>
                  {tm.initial}
                </div>
                <div>
                  <h4 className="font-serif text-sm font-bold text-[var(--t)]">{tm.name}</h4>
                  <div className="text-[10px] text-[var(--t3)] font-bold uppercase tracking-wider mt-0.5">{tm.role}</div>
                </div>
                <p className="text-[11px] text-[var(--t2)] leading-relaxed max-w-xs">{tm.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
