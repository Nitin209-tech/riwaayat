'use client';

import React from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import Link from 'next/link';

export default function Shop() {
  const features = [
    { ico: '🎮', title: 'Direct Game Keys', desc: 'Buy game keys and gift cards directly without needing a referral code.' },
    { ico: '⚡', title: 'Instant Delivery', desc: 'Most purchases will deliver instantly to your account or inbox.' },
    { ico: '🪙', title: 'Pay with IQCoins', desc: 'Use your earned IQCoins as currency alongside regular payment methods.' },
    { ico: '🎁', title: 'Member Exclusives', desc: 'Discord members will get early access to drops and special discounts.' }
  ];

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto py-12 text-center space-y-12">
        
        <div className="space-y-6">
          <span className="text-6xl block animate-bounce" role="img" aria-label="Shopping Cart">🛒</span>
          
          <div className="inline-flex items-center gap-2 bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4.5 py-1.8 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[var(--p)] animate-ping" />
            Under Construction
          </div>

          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)]">Shop — Coming Soon</h1>
          
          <p className="text-xs md:text-sm text-[var(--t2)] max-w-xl mx-auto leading-relaxed">
            We're building something special. The Rewards Portal Shop will let you browse, buy, and unlock premium gaming items directly — no codes, no hassle. Exclusive drops, limited editions, and member-only deals await.
          </p>
          
          <p className="text-[11px] text-[var(--t3)] max-w-sm mx-auto leading-relaxed">
            While we finish building, you can still earn IQCoins and redeem codes through the usual pages. Big things are on the way — stay tuned.
          </p>
        </div>

        {/* Feature list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {features.map((feat, idx) => (
            <div key={idx} className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-6 text-left hover:border-[var(--border2)] hover:shadow-[var(--s2)] transition">
              <span className="text-2xl block mb-3">{feat.ico}</span>
              <h3 className="font-serif text-xs font-bold text-[var(--t)] mb-1">{feat.title}</h3>
              <p className="text-[10px] text-[var(--t2)] leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

        <div className="pt-6">
          <Link
            href="/earn"
            className="inline-block bg-gradient-to-br from-[var(--p)] to-[#5b35e8] text-white rounded-full px-8 py-3.5 text-xs font-bold shadow-[var(--s2)] hover:scale-105 transition no-underline"
          >
            🪙 Earn IQCoins While You Wait
          </Link>
        </div>

      </div>
    </ConsoleLayout>
  );
}
