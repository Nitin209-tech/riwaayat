'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Gamepad2, Tv, Sparkles, Award, Key, Mail, User, ShieldCheck, Download, Check, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';

function VerifyRedeemContent() {
  const searchParams = useSearchParams();
  
  const [category, setCategory] = useState('minecraft');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [plan, setPlan] = useState('');
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    setCategory(searchParams.get('category') || 'minecraft');
    setEmail(searchParams.get('email') || 'gamer@outlook.com');
    setUsername(searchParams.get('username') || 'SteveThePro');
    setPlan(searchParams.get('plan') || 'Premium Plan');
    
    // Generate a random high-end invoice number
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    setInvoiceNumber(`RIW-INV-${randomNum}-2026`);
  }, [searchParams]);

  // Auto-format coupon code to XXXXX-XXXXX-XXXXX-XXXXX-XXXXX format
  const handleCodeChange = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25);
    const formatted = cleaned.match(/.{1,5}/g)?.join('-') || cleaned;
    setCode(formatted.toUpperCase());
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'youtube':
        return <Tv className="w-6 h-6 text-[#1d4ed8]" />;
      case 'roblox':
        return <Sparkles className="w-6 h-6 text-[#1d4ed8]" />;
      case 'nitro':
        return <Award className="w-6 h-6 text-[#1d4ed8]" />;
      default:
        return <Gamepad2 className="w-6 h-6 text-[#1d4ed8]" />;
    }
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'youtube':
        return 'YouTube Subscribers';
      case 'roblox':
        return 'Roblox Giftcard';
      case 'nitro':
        return 'Discord Nitro';
      default:
        return 'Minecraft Premium';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawCode = code.replace(/-/g, '');
    if (rawCode.length !== 25) {
      setError('Please enter a valid 25-character promo key.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-[#ffffff] text-black selection:bg-black/10 selection:text-black font-sans relative flex flex-col justify-between">
      
      {/* Background patterns */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.04),transparent_70%)] blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.03),transparent_70%)] blur-[150px]" />
        <div className="absolute inset-0 bg-grid opacity-50" />
      </div>

      {/* Simple Header */}
      <nav className="border-b border-black/5 bg-white/75 backdrop-blur-2xl py-4 px-8 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-bold text-xs shadow-md">
              R
            </div>
            <span className="font-extrabold text-sm tracking-wider text-black">RIWAAYAT</span>
          </Link>
          <Link href="/" className="text-xs font-bold text-[#1d4ed8] hover:underline no-underline">
            ← Back to Home
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-md w-full mx-auto px-6 py-12 flex flex-col justify-center space-y-8 relative z-10">
        
        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-black/[0.02] border border-black/10 flex items-center justify-center mx-auto">
            {getCategoryIcon()}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-black uppercase">
            {getCategoryLabel()} VERIFICATION
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Apply your 25-character voucher coupon below to process the activation queue.
          </p>
        </div>

        {/* Credentials Summary Card */}
        <div className="bg-black/[0.02] border border-black/5 rounded-2xl p-5 space-y-3">
          <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block border-b border-black/5 pb-2">
            Verified Session Credentials
          </span>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[9px] font-bold text-zinc-400 uppercase block">Gamer Handle</span>
              <span className="font-bold text-black flex items-center gap-1 mt-0.5">
                <User size={12} className="text-[#1d4ed8]" /> {username}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-zinc-400 uppercase block">Outlook/Email</span>
              <span className="font-bold text-black flex items-center gap-1 mt-0.5 truncate">
                <Mail size={12} className="text-[#1d4ed8]" /> {email}
              </span>
            </div>
            <div className="col-span-2 border-t border-black/5 pt-2">
              <span className="text-[9px] font-bold text-zinc-400 uppercase block">Selected Tier</span>
              <span className="font-bold text-[#1d4ed8] block mt-0.5">
                {plan}
              </span>
            </div>
          </div>
        </div>

        {/* Action Form card */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.03)] space-y-6">
          <h2 className="text-xs font-black tracking-widest text-[#1d4ed8] uppercase text-center border-b border-zinc-100 pb-3">
            ENTER PROMO REDEEM CODE
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Promo Code input */}
            <div className="space-y-1.5">
              <label htmlFor="code" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                25-Character Key
              </label>
              <div className="relative">
                <input
                  id="code"
                  type="text"
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="w-full bg-black/[0.01] border border-zinc-200 rounded-lg p-3 pl-10 text-xs font-mono text-black focus:outline-none focus:border-black transition tracking-widest"
                  required
                />
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-500 rounded-lg text-[11px] flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-black tracking-widest uppercase transition duration-200 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'COMPILING TELEMETRY...' : 'EXECUTE CLAIM'}</span>
            </button>

          </form>
        </div>

      </main>

      {/* Simple Footer */}
      <footer className="border-t border-black/5 py-6 text-center text-xs text-zinc-400 relative z-10">
        © 2026 Riwaayat • Premium Rewards Platform
      </footer>

      {/* POPUP MODAL: LARGE SUCCESS INVOICE RECEIPT */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-8 space-y-6 text-center relative shadow-[0_30px_90px_rgba(0,0,0,0.15)] my-8">
            
            <button
              onClick={() => setSuccess(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-black transition"
            >
              <X size={18} />
            </button>

            {/* Glowing success circle */}
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-[0_4px_12px_rgba(16,185,129,0.1)]">
              <ShieldCheck size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-black uppercase tracking-tight">
                Voucher Claim Verified!
              </h3>
              <p className="text-xs text-zinc-400">
                Your luxury prize has been successfully registered and queued for dispatch.
              </p>
            </div>

            {/* HIGH-END MINIMAL VERCEL INVOICE BOX */}
            <div className="border border-zinc-200 rounded-2xl overflow-hidden text-left text-xs bg-zinc-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]">
              
              {/* Invoice Top header */}
              <div className="bg-black text-white p-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold text-[#1d4ed8] uppercase tracking-widest block">VOUCHER INVOICE</span>
                  <span className="font-mono font-bold text-xs">{invoiceNumber}</span>
                </div>
                <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  PAID
                </span>
              </div>

              {/* Invoice Body details */}
              <div className="p-5 space-y-4">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 border-b border-zinc-200/60 pb-3.5">
                  <div>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">Date Issued</span>
                    <span className="font-semibold text-black mt-0.5 block">May 18, 2026, 09:12 PM</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">Provisioning Node</span>
                    <span className="font-semibold text-[#1d4ed8] mt-0.5 block font-mono">RIWAAYAT-US-NODE-09</span>
                  </div>
                </div>

                {/* Account Details */}
                <div className="grid grid-cols-2 gap-4 border-b border-zinc-200/60 pb-3.5">
                  <div>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">Bill To Gamer</span>
                    <span className="font-bold text-black mt-0.5 block">@{username}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">Outlook Email ID</span>
                    <span className="font-bold text-black mt-0.5 block truncate">{email}</span>
                  </div>
                </div>

                {/* Enrolled voucher line items */}
                <div>
                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Item Statement</span>
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <div>
                      <span className="font-bold text-black block">{getCategoryLabel()} Bundle</span>
                      <span className="text-[10px] text-zinc-400">{plan} Activation</span>
                    </div>
                    <span className="font-mono font-bold text-black">$0.00</span>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex items-center justify-between font-bold pt-1 text-sm">
                  <span className="text-zinc-500 uppercase text-xs tracking-wider">Total Charge</span>
                  <span className="font-mono text-black">$0.00 USD</span>
                </div>

                {/* Delivery message */}
                <div className="bg-black/5 border border-black/5 rounded-xl p-3 text-[10px] text-zinc-600 leading-relaxed">
                  📢 **Delivery Status Notification**: Activation voucher codes and Microsoft login validation certificates will be delivered directly to <span className="font-bold text-black">{email}</span> within <span className="font-bold text-[#1d4ed8]">72 Hours</span>.
                </div>

              </div>

            </div>

            {/* Bottom Actions inside popup */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => alert('Invoice receipt details downloaded to system documents.')}
                className="flex-1 py-3 border border-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-50 text-black flex items-center justify-center gap-2 transition"
              >
                <Download size={14} className="text-[#1d4ed8]" /> Download Invoice
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  window.location.href = '/';
                }}
                className="flex-1 py-3 bg-black text-white hover:bg-zinc-800 rounded-xl text-xs font-black tracking-widest uppercase transition duration-200"
              >
                Done — Return Home
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function VerifyRedeem() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white text-black flex items-center justify-center font-sans text-xs">
        Loading verification terminal...
      </div>
    }>
      <VerifyRedeemContent />
    </Suspense>
  );
}
