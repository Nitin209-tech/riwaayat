'use client';

import React from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';

export default function Privacy() {
  const sections = [
    { title: '1. Information We Collect', content: 'When you use Rewards Portal, we may collect: Discord Account Info (username, User ID, avatar), IQCoins Activity (balance, earning & redemption history), Order Details (game type, plan, invoice info), and basic Usage Data.' },
    { title: '2. How We Use Your Data', content: 'Your data is used solely for processing rewards, tracking IQCoins balance, providing customer support, improving the website, and fraud prevention.' },
    { title: '3. Data Sharing', content: 'We never sell your personal data. Data is only shared with Discord API (login), MongoDB Atlas (secure storage), and when required by law.' },
    { title: '4. Data Security', content: 'Your data is stored securely in MongoDB Atlas using industry-standard encryption. We never store your gaming passwords.' },
    { title: '5. Cookies & Local Storage', content: 'We use browser localStorage to store your session and coin balance locally on your device. You can clear it at any time through your browser settings.' },
    { title: '6. Your Rights', content: 'You have the right to access, correct, or delete your personal data. Contact us at support@rewardsportal.com.' },
    { title: '7. Google AdSense', content: 'We use Google AdSense to display ads. Google may use cookies to serve ads based on your visits. You can opt out at google.com/settings/ads.' }
  ];

  return (
    <ConsoleLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Hero header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            🔒 Legal
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            Privacy <span className="text-[var(--p)] italic font-normal">Policy</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            Last updated: January 2026 — Your privacy is our top priority.
          </p>
        </div>

        {/* Prose details */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--p)] to-transparent" />
          
          <div className="space-y-6">
            {sections.map((sect, idx) => (
              <div key={idx} className="space-y-2">
                <h2 className="font-serif text-sm font-bold text-[var(--t)]">{sect.title}</h2>
                <p className="text-xs text-[var(--t2)] leading-relaxed">{sect.content}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
