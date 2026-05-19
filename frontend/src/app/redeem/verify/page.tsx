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
  const [verifiedCode, setVerifiedCode] = useState('');
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
        return <Tv className="w-6 h-6 text-zinc-400" />;
      case 'roblox':
        return <Sparkles className="w-6 h-6 text-zinc-400" />;
      case 'nitro':
        return <Award className="w-6 h-6 text-zinc-400" />;
      default:
        return <Gamepad2 className="w-6 h-6 text-zinc-400" />;
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

  const handleDownloadPDF = () => {
    // Dynamically import jsPDF to work nicely with SSR Next.js
    import('jspdf').then((module) => {
      const doc = new module.jsPDF();
      
      // Cyberpunk dark background theme styling
      doc.setFillColor(15, 15, 19);
      doc.rect(0, 0, 210, 297, 'F');
      
      // Neon header block
      doc.setFillColor(37, 99, 235);
      doc.rect(20, 20, 170, 3, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('RIWAAYAT SECURE CORE', 20, 35);
      
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text('OFFICIAL SYSTEM LICENSE & DEPLOYMENT STATEMENT', 20, 42);
      
      doc.setDrawColor(255, 255, 255, 0.05);
      doc.line(20, 48, 190, 48);
      
      doc.setFontSize(11);
      doc.setTextColor(229, 231, 235);
      doc.text(`Invoice ID: ${invoiceNumber}`, 20, 58);
      doc.text(`Verification Date: ${new Date().toLocaleString('en-US')}`, 20, 65);
      doc.text(`Status: LICENSED & PROVISIONED`, 20, 72);
      
      doc.line(20, 80, 190, 80);
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Product Description', 20, 92);
      doc.text('Gamer Details', 90, 92);
      doc.text('Secure Voucher Key', 150, 92);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(209, 213, 219);
      doc.text(`${getCategoryLabel()} Bundle`, 20, 102);
      doc.text(`User: @${username}`, 90, 102);
      
      // Masked or formatted key
      doc.text(code, 150, 102);
      
      doc.text(`Email: ${email}`, 90, 109);
      doc.text(`Plan Tier: ${plan}`, 90, 116);
      
      doc.line(20, 126, 190, 126);
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Deployment Statement', 20, 138);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(9.5);
      doc.text(`Approximate Bundle Value: ${plan}`, 20, 146);
      doc.text(`Provisioning Speed: Telemetry queue execution within 72 hours.`, 20, 153);
      doc.text(`Delivery Destination: System tokens dispatched directly to your Outlook handle: ${email}`, 20, 160);
      
      doc.line(20, 172, 190, 172);
      
      // Digital signature block
      doc.setFontSize(9);
      doc.setTextColor(99, 102, 241);
      doc.text('SIGNATURE SYSTEM SECURITY STAMP:', 20, 185);
      doc.setFont('Courier', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('RIWAAYAT-SECURE-TELEMETRY-VALID-LOG', 20, 192);
      
      doc.save(`Riwaayat-Premium-Invoice.pdf`);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawCode = code.replace(/-/g, '');
    if (rawCode.length !== 25) {
      setError('Please enter a valid 25-character promo key.');
      return;
    }

    setLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://riwaayat-production.up.railway.app';
      const cleanApiBase = apiBase.replace(/\/$/, "");
      const res = await fetch(`${cleanApiBase}/api/rewards/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          code: rawCode,
          email: email,
          username: username,
          category: category
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'This activation code is invalid. Please try another key.');
        setLoading(false);
        return;
      }

      setLoading(false);
      setVerifiedCode(data.payload || code);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Failed to connect to verification server. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-zinc-700 selection:text-white font-sans relative flex flex-col justify-between overflow-hidden">
      
      {/* Background patterns */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.03),transparent_70%)] blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.01),transparent_70%)] blur-[150px]" />
        <div className="absolute inset-0 bg-grid opacity-5" />
      </div>

      {/* Simple Header */}
      <nav className="border-b border-white/5 bg-[#09090b]/75 backdrop-blur-2xl py-4 px-8 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-zinc-700 to-zinc-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
              R
            </div>
            <span className="font-extrabold text-sm tracking-wider text-white">RIWAAYAT</span>
          </Link>
          <Link href="/" className="text-xs font-bold text-zinc-400 hover:text-white transition duration-200 no-underline">
            ← Back to Home
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-md w-full mx-auto px-6 py-12 flex flex-col justify-center space-y-8 relative z-10">
        
        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center mx-auto">
            {getCategoryIcon()}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            {getCategoryLabel()} VERIFICATION
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Apply your 25-character voucher coupon below to process the activation queue.
          </p>
        </div>

        {/* Credentials Summary Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block border-b border-white/5 pb-2 font-mono">
            Verified Session Credentials
          </span>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Gamer Handle</span>
              <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                <User size={13} className="text-zinc-400" /> {username}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Outlook/Email</span>
              <span className="font-bold text-white flex items-center gap-1.5 mt-0.5 truncate">
                <Mail size={13} className="text-zinc-400" /> {email}
              </span>
            </div>
            <div className="col-span-2 border-t border-white/5 pt-3.5">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Selected Tier</span>
              <span className="font-bold text-zinc-300 block mt-0.5">
                {plan}
              </span>
            </div>
          </div>
        </div>

        {/* Action Form card */}
        <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-8 shadow-[0_30px_90px_rgba(0,0,0,0.8)] space-y-6">
          <h2 className="text-xs font-black tracking-widest text-zinc-400 uppercase text-center border-b border-white/5 pb-3">
            ENTER PROMO REDEEM CODE
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Promo Code input */}
            <div className="space-y-2">
              <label htmlFor="code" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                25-Character Key
              </label>
              <div className="relative">
                <input
                  id="code"
                  type="text"
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3.5 pl-11 text-xs font-mono text-white focus:outline-none focus:border-zinc-500 transition tracking-widest"
                  required
                />
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[11px] flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-zinc-700 to-zinc-500 text-white hover:brightness-110 rounded-xl text-xs font-black tracking-widest uppercase transition duration-300 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,255,255,0.05)]"
            >
              <span>{loading ? 'COMPILING TELEMETRY...' : 'EXECUTE CLAIM'}</span>
            </button>

          </form>
        </div>

      </main>

      {/* Simple Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-600 relative z-10">
        © 2026 Riwaayat • Premium Rewards Platform
      </footer>

      {/* POPUP MODAL: LARGE SUCCESS INVOICE RECEIPT */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0f0f13] border border-white/10 rounded-3xl p-8 space-y-6 text-center relative shadow-[0_30px_90px_rgba(0,0,0,0.8)] my-8">
            
            <button
              onClick={() => setSuccess(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white transition"
            >
              <X size={18} />
            </button>

            {/* Glowing success circle */}
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.15)]">
              <ShieldCheck size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                Voucher Claim Verified!
              </h3>
              <p className="text-xs text-zinc-400">
                Your luxury prize has been successfully registered and queued for dispatch.
              </p>
            </div>

            {/* HIGH-END MINIMAL VERCEL INVOICE BOX */}
            <div className="border border-white/5 rounded-2xl overflow-hidden text-left text-xs bg-white/[0.01] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
              
              {/* Invoice Top header */}
              <div className="bg-white/[0.02] border-b border-white/5 p-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block font-mono">VOUCHER INVOICE</span>
                  <span className="font-mono font-bold text-xs text-white">{invoiceNumber}</span>
                </div>
                <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  PAID
                </span>
              </div>

              {/* Invoice Body details */}
              <div className="p-5 space-y-4">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-3.5">
                  <div>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Date Issued</span>
                    <span className="font-semibold text-white mt-0.5 block">May 18, 2026, 09:12 PM</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Provisioning Node</span>
                    <span className="font-semibold text-zinc-400 mt-0.5 block font-mono">RIWAAYAT-US-NODE-09</span>
                  </div>
                </div>

                {/* Account Details */}
                <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-3.5">
                  <div>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Bill To Gamer</span>
                    <span className="font-bold text-white mt-0.5 block">@{username}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Outlook Email ID</span>
                    <span className="font-bold text-white mt-0.5 block truncate">{email}</span>
                  </div>
                </div>

                {/* Enrolled voucher line items */}
                <div className="border-b border-white/5 pb-3.5">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block mb-2 font-mono">Item Statement</span>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">{getCategoryLabel()} Bundle</span>
                      <span className="text-[10px] text-zinc-400">{plan} Activation</span>
                    </div>
                    <span className="font-mono font-bold text-white">$0.00</span>
                  </div>
                </div>

                {/* Secure Code Key Delivery */}
                <div className="bg-[#10b981]/5 border border-[#10b981]/15 rounded-xl p-4 text-center space-y-2">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block font-mono">🔑 SECURE ACTIVATION KEY</span>
                  <div className="font-mono font-bold text-base text-white select-all bg-[#09090b] border border-white/5 py-2.5 rounded-lg tracking-wider">
                    {verifiedCode}
                  </div>
                  <span className="text-[8.5px] text-zinc-400 block">Copy this activation code and use it on the provider's platform to claim your reward.</span>
                </div>

                {/* Totals */}
                <div className="flex items-center justify-between font-bold pt-1 text-sm">
                  <span className="text-zinc-400 uppercase text-xs tracking-wider font-mono">Total Charge</span>
                  <span className="font-mono text-white">$0.00 USD</span>
                </div>

                {/* Delivery message */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-[10px] text-zinc-400 leading-relaxed">
                  📢 **Delivery Status Notification**: Activation voucher codes and Microsoft login validation certificates will be delivered directly to <span className="font-bold text-white">{email}</span> within <span className="font-bold text-zinc-400">72 Hours</span>.
                </div>

              </div>

            </div>

            {/* Bottom Actions inside popup */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleDownloadPDF}
                className="flex-1 py-3 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/5 text-white flex items-center justify-center gap-2 transition"
              >
                <Download size={14} className="text-zinc-400" /> Download Invoice
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  window.location.href = '/';
                }}
                className="flex-1 py-3 bg-gradient-to-r from-zinc-700 to-zinc-500 text-white hover:brightness-110 rounded-xl text-xs font-black tracking-widest uppercase transition duration-200"
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
