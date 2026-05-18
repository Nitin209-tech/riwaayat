'use client';

import React, { useState } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import Link from 'next/link';

export default function HowItWorks() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const steps = [
    {
      num: 1,
      title: '🎮 Join Our Discord Server',
      desc: 'Start by joining the official Rewards Portal Discord server. This is your hub for earning IQCoins through invites, messages, daily rewards, and more — all tracked automatically by our bot.',
      tag: 'Completely free — takes under 30 seconds'
    },
    {
      num: 2,
      title: '🪙 Earn IQCoins',
      desc: 'Stack up your IQCoins through multiple free methods:',
      bullets: [
        { label: '📅 Daily Claim', desc: '1,000 free coins every 24 hours' },
        { label: '💬 50 Messages', desc: '5,000 coins via Discord bot' },
        { label: '👥 5 Invites', desc: '10,000 coins per 5 members invited' }
      ],
      tag: 'Coins never expire — earn at your own pace'
    },
    {
      num: 3,
      title: '🎫 Redeem With Code or Coins',
      desc: 'Two ways to get your reward:',
      bullets: [
        { label: 'Redeem a Code', desc: 'Minecraft ₹899, Roblox ₹1,499+, Xbox ₹1,999, Nitro ₹1,199+' },
        { label: 'Coin Rewards', desc: 'Exchange IQCoins directly for rewards, no code needed' }
      ],
      tag: 'Both options are fully secure and verified'
    },
    {
      num: 4,
      title: '✅ Activated Within 72 Hours',
      desc: 'After redemption, your reward is activated to your account within 72 hours. Track status in real time on the Track Order page. Download your PDF invoice for records.',
      tag: 'Average activation time: 12–24 hours'
    }
  ];

  const faqs = [
    {
      q: 'Do IQCoins expire?',
      a: 'No! Your IQCoins never expire. Earn them at your own pace and redeem whenever you\'re ready.'
    },
    {
      q: 'My reward hasn\'t arrived within 72 hours — what do I do?',
      a: 'If your reward hasn\'t been activated after 72 hours, email us at support@rewardsportal.com with your invoice number. We\'ll resolve it on priority.'
    },
    {
      q: 'Is this site safe and legitimate?',
      a: 'Yes! We use Discord OAuth for secure login. Your passwords are never seen or stored by us. Every transaction is logged and invoiced for full transparency.'
    },
    {
      q: 'How many IQCoins do I need for each reward?',
      a: 'Minecraft requires 5 Crore IQCoins, Roblox $50 requires 8 Crore IQCoins, Xbox Game Pass needs 7 Crore IQCoins, and Discord Nitro starts from 6 Crore IQCoins.'
    },
    {
      q: 'Can I transfer my IQCoins to another user?',
      a: 'IQCoins are tied to your Discord account and cannot be transferred to other users. They can only be redeemed for rewards on the portal.'
    }
  ];

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Hero header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            📖 Guide
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            How It <span className="text-[var(--p)] italic font-normal">Works</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            Getting your gaming reward is simple — just 4 easy steps to claim what you deserve.
          </p>
        </div>

        {/* Steps walkthrough vertical blocks */}
        <div className="space-y-6">
          {steps.map((st, idx) => (
            <div key={idx} className="flex gap-4 md:gap-6 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 hover:border-[var(--border2)] transition">
              <span className="w-10 h-10 rounded-full bg-[var(--p4)] text-[var(--p)] font-bold text-lg flex items-center justify-center shrink-0">
                {st.num}
              </span>
              
              <div className="space-y-3 flex-1">
                <h3 className="font-serif text-lg font-bold text-[var(--t)]">{st.title}</h3>
                <p className="text-xs text-[var(--t2)] leading-relaxed">{st.desc}</p>
                
                {st.bullets && (
                  <ul className="space-y-2 list-disc list-inside text-xs pl-2 text-[var(--t2)]">
                    {st.bullets.map((b, bIdx) => (
                      <li key={bIdx}>
                        <strong className="text-[#b45309] dark:text-[#f59e0b]">{b.label}</strong> — {b.desc}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="inline-block bg-[var(--bg2)] text-[var(--t3)] text-[10px] font-bold rounded-full px-3 py-1 border border-[var(--border)]">
                  {st.tag}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--p)] to-transparent" />
          <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">🙋 Frequently Asked Questions</h3>
          <p className="text-xs text-[var(--t2)] mb-6">Quick answers to common questions:</p>

          <div className="space-y-2">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left px-5 py-4 font-serif text-xs font-bold text-[var(--t)] flex justify-between items-center"
                  >
                    <span>{faq.q}</span>
                    <span className="text-[10px] text-[var(--t3)] transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                      ▼
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4.5 text-xs text-[var(--t2)] leading-relaxed border-t border-[var(--border)] pt-3 animate-fadeIn">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Call to Actions buttons */}
        <div className="text-center pt-4">
          <Link
            href="/earn"
            className="inline-block bg-gradient-to-br from-[var(--p)] to-[#5b35e8] text-white rounded-full px-8 py-3.5 text-xs font-bold shadow-[var(--s2)] hover:scale-105 transition no-underline mr-4"
          >
            Start Earning →
          </Link>
          <Link
            href="/redeem/verify?category=minecraft"
            className="inline-block bg-[var(--bg2)] text-[var(--t)] rounded-full px-8 py-3.5 text-xs font-bold hover:brightness-95 border border-[var(--border)] transition no-underline"
          >
            I Have a Code
          </Link>
        </div>

      </div>
    </ConsoleLayout>
  );
}
