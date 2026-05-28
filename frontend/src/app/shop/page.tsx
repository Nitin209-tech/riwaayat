'use client';

import React, { useState } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import Link from 'next/link';

export default function Shop() {
  const [copied, setCopied] = useState(false);
  const upiId = "riwaayat@upi";

  const handleCopy = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rentalPlans = [
    {
      title: "Discord Reward Bot",
      price: "₹299",
      period: "Month",
      badge: "Popular Selection",
      description: "Deploy our high-fidelity premium rewards Discord bot directly into your community server.",
      features: [
        "Interactive Event & Claim Panels",
        "Admin /checkinvites Audit Logs",
        "30s Close Warnings with stop buttons",
        "Verification Timeout Controls",
        "Vouch system with /stoptimer commands",
        "24/7 Premium Server Telemetry"
      ],
      icon: (
        <svg viewBox="0 0 24 24" className="w-12 h-12 fill-current text-[var(--p)]" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
        </svg>
      )
    },
    {
      title: "Bot + Web Bundle",
      price: "₹799",
      period: "Month",
      badge: "Complete Solution",
      description: "Our comprehensive premium gaming suite. Get the premium Discord bot and your own tailored web platform.",
      features: [
        "Fully Managed Gray-Lavender Web Portal",
        "Integrated Discord OAuth2 Authentication",
        "Secure Microsoft Email Validation UI",
        "Includes Discord Reward Bot Package",
        "Automated Coupon Keys Telemetry",
        "Full Setup & Installation Support"
      ],
      icon: (
        <svg viewBox="0 0 24 24" className="w-12 h-12 stroke-current text-[var(--p3)] fill-none" strokeWidth="1.8" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="21" x2="16" y2="21" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="17" x2="12" y2="21" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
  ];

  return (
    <ConsoleLayout>
      <div className="max-w-5xl mx-auto py-10 space-y-16">
        
        {/* Intro Header */}
        <div className="text-center space-y-4">
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-[var(--p)] font-mono">Premium Services</span>
          <h1 className="text-4xl md:text-5xl font-black text-[var(--t)] tracking-tight uppercase">SYNQO Rental Store</h1>
          <p className="text-xs md:text-sm text-[var(--t3)] max-w-xl mx-auto leading-relaxed">
            Deploy your own state-of-the-art rewards ecosystem. Rent our high-fidelity automated Discord bot or host a complete OAuth2 web authentication panel styled with Gray-Lavender design tokens.
          </p>
        </div>

        {/* UPI Warning Alert Banner */}
        <div className="bg-gradient-to-r from-[rgba(183,148,244,0.1)] to-[rgba(163,191,250,0.1)] border border-[var(--border2)] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[var(--s2)] max-w-4xl mx-auto relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--border2)] flex items-center justify-center text-xl shrink-0 shadow-[var(--s1)]">
              ℹ️
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--t)] uppercase tracking-wider">Payments via UPI Only</h3>
              <p className="text-xs text-[var(--t2)] leading-relaxed mt-1">
                To keep setup processing quick and secure, we accept payments exclusively via Unified Payments Interface (UPI). Immediate activation upon transaction confirmation.
              </p>
            </div>
          </div>
          <div className="bg-[var(--surface)]/90 border border-[var(--border)] rounded-2xl p-4.5 text-center shrink-0 w-full md:w-auto shadow-[var(--s1)]">
            <span className="text-[10px] font-extrabold text-[var(--t3)] tracking-widest uppercase block mb-1">Accepted Payment App</span>
            <span className="text-xs font-black text-[var(--t)] uppercase tracking-wider">UPI / GPay / PhonePe / Paytm</span>
          </div>
        </div>

        {/* Rental Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {rentalPlans.map((plan, idx) => (
            <div key={idx} className="bg-[var(--surface)]/65 border border-[var(--border)] rounded-[32px] p-8 md:p-10 flex flex-col justify-between hover:border-[var(--border2)] hover:shadow-[var(--s3)] transition-all duration-300 relative group overflow-hidden">
              
              {/* Badge element */}
              <div className="absolute top-5 right-5 bg-[var(--pd)] border border-[var(--border3)] rounded-full px-3.5 py-1.5 text-[9px] font-black text-[var(--p3)] uppercase tracking-widest">
                {plan.badge}
              </div>

              <div className="space-y-8">
                {/* Header info */}
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shadow-[var(--s1)] group-hover:border-[var(--border2)] transition duration-300">
                    {plan.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[var(--t)] uppercase tracking-tight">{plan.title}</h2>
                    <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">{plan.description}</p>
                  </div>
                </div>

                {/* Pricing info */}
                <div className="flex items-baseline gap-2 border-t border-[var(--border)] pt-6">
                  <span className="text-4xl md:text-5xl font-black text-[var(--t)] tracking-tight font-mono">{plan.price}</span>
                  <span className="text-xs font-bold text-[var(--t3)] uppercase tracking-wider">/ {plan.period}</span>
                </div>

                {/* Features Checklist */}
                <div className="space-y-3.5 pt-2">
                  <span className="text-[10px] font-extrabold text-[var(--t3)] tracking-widest uppercase block mb-1">Features Included</span>
                  {plan.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[var(--p)] fill-none stroke-current shrink-0" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-xs text-[var(--t2)] tracking-wide font-medium">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-8 mt-8 border-t border-[var(--border)]">
                <a
                  href="#upi-checkout"
                  className="w-full py-4 bg-gradient-to-r from-[var(--p)] to-[var(--p3)] text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all duration-300 hover:scale-[1.02] hover:shadow-[var(--s2)] text-center block"
                >
                  Configure & Rent Now
                </a>
              </div>

            </div>
          ))}
        </div>

        {/* UPI Checkout Guide Panel */}
        <section id="upi-checkout" className="max-w-4xl mx-auto bg-[var(--surface)]/90 border border-[var(--border2)] rounded-[36px] p-8 md:p-12 shadow-[var(--s3)] relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(183,148,244,0.06),transparent_70%)] blur-[100px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
            
            {/* Payment Details Form */}
            <div className="lg:col-span-3 space-y-6">
              <div className="space-y-2">
                <span className="text-[9px] font-extrabold tracking-widest text-[var(--p)] uppercase font-mono">Secure Payment Desk</span>
                <h2 className="text-2xl font-black text-[var(--t)] uppercase tracking-tight">UPI Transaction Desk</h2>
                <p className="text-xs text-[var(--t3)] leading-relaxed">
                  Transfer the exact plan amount to our official UPI gateway address and capture the reference receipt.
                </p>
              </div>

              {/* Copy UPI ID Field */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-[var(--t3)] tracking-widest uppercase block font-mono">Official UPI Address</span>
                <div className="flex bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-1.5 items-center justify-between gap-4">
                  <span className="font-mono text-sm font-bold text-[var(--t)] pl-4.5 truncate select-all">{upiId}</span>
                  <button
                    onClick={handleCopy}
                    className={`px-5 py-3.5 rounded-xl text-xs font-black tracking-wider uppercase transition duration-300 ${
                      copied 
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400" 
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--t)] hover:bg-[var(--border2)]"
                    }`}
                  >
                    {copied ? "✓ Copied" : "📋 Copy ID"}
                  </button>
                </div>
              </div>

              {/* Steps to deploy */}
              <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                <span className="text-[10px] font-extrabold text-[var(--t3)] tracking-widest uppercase block font-mono">Activation Checklist</span>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--pd)] border border-[var(--border2)] text-[10px] font-black text-[var(--p)] flex items-center justify-center shrink-0">1</span>
                    <span className="text-xs text-[var(--t2)]">Send payment using GPay, PhonePe, Paytm, or BHIM.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--pd)] border border-[var(--border2)] text-[10px] font-black text-[var(--p)] flex items-center justify-center shrink-0">2</span>
                    <span className="text-xs text-[var(--t2)]">Take a screenshot of the successful transaction page.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--pd)] border border-[var(--border2)] text-[10px] font-black text-[var(--p)] flex items-center justify-center shrink-0">3</span>
                    <span className="text-xs text-[var(--t2)]">Open a support ticket inside our server and send the receipt screenshot. Our staff will deploy your system instantly!</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Telemetry Screen Mockup */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center bg-[var(--bg)]/90 border border-[var(--border)] rounded-3xl p-6.5 text-center relative shadow-[var(--s1)] space-y-6">
              
              {/* Fake QR Scanner design */}
              <div className="w-40 h-40 border border-dashed border-[var(--border2)] rounded-2xl flex items-center justify-center relative p-3.5 bg-[var(--surface)]">
                <div className="absolute inset-2 border-2 border-[var(--p)] rounded-xl opacity-30 animate-pulse" />
                
                {/* Simulated Gray-Lavender styled stylized QR code logo */}
                <div className="w-full h-full rounded-lg bg-gradient-to-tr from-[var(--p)] to-[var(--p3)] p-[1.5px]">
                  <div className="w-full h-full bg-[var(--bg)] rounded-md flex flex-col items-center justify-center gap-1.5">
                    <span className="text-2xl">📱</span>
                    <span className="text-[9px] font-extrabold tracking-wider text-[var(--t3)] uppercase font-mono">Scan via Pay App</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-black text-[var(--t)] uppercase tracking-wide block">Scan To Pay Directly</span>
                <span className="text-[10px] font-medium text-[var(--t3)] leading-relaxed mt-1 block">
                  Verify transaction reference (UTR) for prompt server configuration updates.
                </span>
              </div>

              <div className="w-full border-t border-[var(--border)] pt-4">
                <Link
                  href="/"
                  className="px-5 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[10px] font-extrabold tracking-widest uppercase hover:bg-[var(--border2)] text-[var(--t)] transition no-underline block"
                >
                  ← Return to Home
                </Link>
              </div>

            </div>

          </div>

        </section>

      </div>
    </ConsoleLayout>
  );
}
