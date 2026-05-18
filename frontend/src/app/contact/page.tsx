'use client';

import React from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';

export default function Contact() {
  return (
    <ConsoleLayout>
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* Hero header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            📩 Contact
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            Get in <span className="text-[var(--p)] italic font-normal">Touch</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            Have a question, issue, or just want to say hi? We respond fast.
          </p>
        </div>

        {/* Support Mailbox card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--p)] to-transparent" />
          
          <h3 className="font-serif text-lg font-bold text-[var(--t)] mb-2">📧 Email Support</h3>
          <p className="text-xs text-[var(--t2)] mb-6">For all inquiries including order issues, account help, and general questions:</p>
          
          <a
            href="mailto:mojangstudio908@gmail.com"
            className="inline-flex items-center gap-2 bg-[var(--pd)] border border-[var(--border2)] rounded-xl px-5 py-3.5 text-xs font-bold text-[var(--p)] no-underline hover:brightness-105 transition"
          >
            ✉️ mojangstudio908@gmail.com
          </a>
          
          <p className="text-[10px] text-[var(--t3)] font-semibold mt-4.5">We typically respond within 2–12 hours. Available 24/7.</p>
        </div>

        {/* Discord Invite card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5865f2] to-transparent" />
          
          <h3 className="font-serif text-lg font-bold text-[var(--t)] mb-2">💬 Discord Community</h3>
          <p className="text-xs text-[var(--t2)] mb-5">Join our server for live chat, giveaways, and the fastest support.</p>
          
          <a
            href="https://discord.com/channels/1411327756968661125"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#5865f2] text-white rounded-full px-8 py-3.5 text-xs font-bold hover:brightness-110 shadow-md transition no-underline"
          >
            Join Discord Server →
          </a>
        </div>

      </div>
    </ConsoleLayout>
  );
}
