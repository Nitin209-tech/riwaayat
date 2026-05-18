'use client';

import React from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';

export default function Terms() {
  const sections = [
    { title: '1. Acceptance of Terms', content: 'By accessing Rewards Portal, you agree to be bound by these Terms of Service and our Privacy Policy.' },
    { title: '2. IQCoins', content: 'IQCoins have no real monetary value and cannot be exchanged for cash. They can only be used within Rewards Portal to redeem rewards. Coin balances are non-transferable.' },
    { title: '3. Rewards & Redemptions', content: 'All rewards are activated within 72 hours of successful redemption. Rewards Portal reserves the right to cancel any redemption if fraudulent activity is detected. Codes are single-use only.' },
    { title: '4. Account Responsibility', content: 'You are responsible for maintaining the confidentiality of your account information. Rewards Portal is not liable for any loss resulting from unauthorized access to your account.' },
    { title: '5. Prohibited Activities', content: 'You may not exploit bugs, use bots or automation to earn IQCoins, share codes publicly, or attempt to defraud the system. Violations result in immediate account suspension.' },
    { title: '6. Changes to Terms', content: 'Rewards Portal reserves the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.' },
    { title: '7. Limitation of Liability', content: 'Rewards Portal is not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our maximum liability is limited to the value of your unredeemed IQCoins.' }
  ];

  return (
    <ConsoleLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Hero header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            📋 Legal
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            Terms of <span className="text-[var(--p)] italic font-normal">Service</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            Last updated: January 2026 — Please read these terms carefully before using Rewards Portal.
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
