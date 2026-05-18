'use client';

import React, { useState } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { HelpCircle, ChevronDown, MessageSquare, Terminal, ShieldCheck } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

export default function Support() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDetails, setTicketDetails] = useState('');
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const faqs: FaqItem[] = [
    {
      q: 'How do I synchronize my Discord roles?',
      a: 'Log into the platform dashboard using Discord OAuth. The syncing service will check your server membership and instantly update roles. Run /sync inside the server if a delay occurs.'
    },
    {
      q: 'My reward code decryption failed. What should I do?',
      a: 'Verify if the code is spelled correctly. Common issues include case mismatches or expired codes. Check the stock catalog to confirm if inventory is depleted, or generate a support ticket.'
    },
    {
      q: 'How does invite tracking register invitees?',
      a: 'Our Discord bot tracks custom invite code usages. When a new user joins through your link, invite tallies sync to the databases instantly, updating leaderboards automatically.'
    },
    {
      q: 'Are claims stored permanently?',
      a: 'Yes. All successfully redeemed game keys and credits are saved securely under your neural dashboard logs, encrypted on our central PostgreSQL ledgers.'
    }
  ];

  const handleOpenTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject || !ticketDetails) return;

    setTicketSuccess(true);
    setTicketSubject('');
    setTicketDetails('');
    setTimeout(() => setTicketSuccess(false), 5000);
  };

  return (
    <ConsoleLayout>
      <div className="space-y-8">
        
        {/* Title */}
        <div className="border-b border-cyber-cyan/15 pb-6">
          <h1 className="font-rajdhani text-3xl md:text-4xl font-extrabold tracking-wider text-white uppercase flex items-center space-x-2">
            <span className="text-cyber-cyan font-mono text-neon-cyan">//</span>
            <span>SUPPORT & KNOWLEDGE NODES</span>
          </h1>
          <p className="text-cyber-light-gray text-sm mt-1">
            Browse knowledge databases or open an encrypted ticket line to system administrators.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left section: FAQs */}
          <div className="space-y-6">
            <div className="flex items-center space-x-2 font-rajdhani text-lg font-bold text-white uppercase tracking-wider">
              <HelpCircle className="text-cyber-cyan" size={20} />
              <span>FREQUENT PROTOCOL INQUIRIES</span>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = openIndex === index;
                return (
                  <div
                    key={index}
                    className="glassmorphism rounded-lg border border-cyber-cyan/10 overflow-hidden transition-all duration-300"
                  >
                    {/* Header */}
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="w-full p-4 flex items-center justify-between text-left font-rajdhani font-semibold text-white tracking-wide hover:bg-white/5 transition"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        size={16}
                        className={`text-cyber-cyan transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Body */}
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isOpen ? 'max-h-40 border-t border-cyber-cyan/10 p-4' : 'max-h-0'
                      }`}
                    >
                      <p className="text-xs text-cyber-light-gray leading-relaxed font-mono">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right section: Ticket form */}
          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/15 space-y-6 h-fit relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyber-cyan/5 via-transparent to-transparent pointer-events-none -z-10" />

            <div className="flex items-center space-x-2 font-rajdhani text-lg font-bold text-white uppercase tracking-wider">
              <MessageSquare className="text-cyber-purple animate-pulse" size={20} />
              <span>ENCRYPTED TICKET PROTOCOL</span>
            </div>

            {ticketSuccess ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 rounded-lg text-center space-y-3 font-mono">
                <ShieldCheck size={36} className="mx-auto text-emerald-400 animate-bounce" />
                <h3 className="font-bold text-white uppercase">TICKET SYSTEM INITIALIZED</h3>
                <p className="text-xs text-cyber-light-gray">
                  Your encrypted query has been delivered to support logs. A moderator will connect shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleOpenTicket} className="space-y-4 font-mono text-xs">
                
                {/* Subject */}
                <div className="space-y-1.5">
                  <label htmlFor="subject-input" className="text-cyber-light-gray/60 uppercase tracking-wider block">SUBJECT DIRECTIVE</label>
                  <input
                    id="subject-input"
                    type="text"
                    placeholder="e.g. MINECRAFT KEY DECRYPTION INCIDENT"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full bg-cyber-black border border-cyber-cyan/20 rounded p-3 text-white focus:outline-none focus:border-cyber-cyan transition"
                    required
                  />
                </div>

                {/* Details */}
                <div className="space-y-1.5">
                  <label htmlFor="details-input" className="text-cyber-light-gray/60 uppercase tracking-wider block">TELEMETRY INCIDENT DETAILS</label>
                  <textarea
                    id="details-input"
                    rows={4}
                    placeholder="Provide full details of your issue, including codes value..."
                    value={ticketDetails}
                    onChange={(e) => setTicketDetails(e.target.value)}
                    className="w-full bg-cyber-black border border-cyber-cyan/20 rounded p-3 text-white focus:outline-none focus:border-cyber-cyan transition resize-none"
                    required
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-3 bg-cyber-cyan hover:bg-white text-black font-rajdhani text-sm font-bold tracking-wider rounded transition flex items-center justify-center space-x-2"
                >
                  <Terminal size={14} />
                  <span>TRANSMIT ENCRYPTED QUERY</span>
                </button>

              </form>
            )}
          </div>

        </div>

      </div>
    </ConsoleLayout>
  );
}
