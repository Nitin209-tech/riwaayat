'use client';

import React, { useState, useEffect } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { useApp } from '@/components/AppContext';

interface Invoice {
  redeemType: 'coins';
  type: string;
  game: string;
  plan: string | null;
  account: string;
  email: string;
  coinsSpent: number;
  inrPrice: string;
  date: string;
  invoiceNo: string;
  ts: number;
}

export default function Coins() {
  const { user, coins, spendCoins, claimDailyCoins } = useApp();
  const [activeTab, setActiveTab] = useState<'TILES' | 'FORM' | 'SUCCESS'>('TILES');
  
  // Selection states
  const [selectedReward, setSelectedReward] = useState<{
    key: string;
    cost: number;
    name: string;
    type: string;
    inrPrice: string;
  } | null>(null);

  // Form states
  const [accountName, setAccountName] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: '!' | '✕' | '🪙'; text: string } | null>(null);

  const triggerToast = (type: '!' | '✕' | '🪙', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const rewards = [
    { key: 'mc', cost: 50000000, name: 'Minecraft Reward', type: 'mc', inrPrice: '₹899', desc: 'Server exclusive Minecraft reward.', icon: '⛏', badge: 'Minecraft', badgeStyle: 'rgba(16,185,129,0.1)' },
    { key: 'rb50', cost: 80000000, name: 'Roblox $50 Plan', type: 'rb', inrPrice: '₹1,499', desc: '$50 plan credits added to your account.', icon: '🎮', badge: 'Roblox $50', badgeStyle: 'rgba(239,68,68,0.1)' },
    { key: 'rb100', cost: 120000000, name: 'Roblox $100 Plan', type: 'rb', inrPrice: '₹2,499', desc: '$100 plan credits for your account.', icon: '🎮', badge: 'Roblox $100', badgeStyle: 'rgba(239,68,68,0.1)' },
    { key: 'xbox', cost: 70000000, name: 'Xbox Game Pass', type: 'xbox', inrPrice: '₹1,999', desc: 'Ultimate activation for your account.', icon: '🎯', badge: 'Xbox', badgeStyle: 'rgba(16,185,129,0.1)' },
    { key: 'nitrobasic', cost: 60000000, name: 'Discord Nitro Basic Yearly', type: 'nitro', inrPrice: '₹1,199/yr', desc: 'Nitro Basic yearly plan gifted to account.', icon: '💎', badge: 'Basic Yearly', badgeStyle: 'rgba(88,101,242,0.1)' },
    { key: 'nitroboost', cost: 200000000, name: 'Discord Nitro Boost Yearly', type: 'nitro', inrPrice: '₹5,999/yr', desc: 'Nitro Boost yearly + 2 server boosts gifted.', icon: '💎', badge: 'Boost Yearly', badgeStyle: 'rgba(88,101,242,0.1)' }
  ];

  const handleTileSelect = (reward: typeof rewards[0]) => {
    if (!user) {
      triggerToast('!', 'Please login with Discord first');
      return;
    }
    if (coins < reward.cost) {
      triggerToast('✕', `Need ${(reward.cost - coins).toLocaleString()} more IQCoins`);
      return;
    }
    
    setSelectedReward(reward);
    setAccountName(user.username || '');
    setDeliveryEmail('');
    setActiveTab('FORM');
  };

  const handleFormSubmit = async () => {
    if (!selectedReward) return;

    const needDetails = selectedReward.type === 'rb' || selectedReward.type === 'nitro';
    if (needDetails) {
      if (!accountName.trim()) {
        triggerToast('!', 'Please enter your account username');
        return;
      }
      if (!deliveryEmail.trim() || !deliveryEmail.includes('@')) {
        triggerToast('!', 'Please enter a valid delivery email');
        return;
      }
    }

    setSubmitting(true);
    
    // Spend coins locally
    const success = spendCoins(selectedReward.cost);
    if (!success) {
      setSubmitting(false);
      triggerToast('✕', 'Transaction could not be completed.');
      return;
    }

    const invoiceNo = 'IQ-' + selectedReward.type.slice(0, 2).toUpperCase() + '-' + Date.now().toString(36).toUpperCase().slice(-7);
    const dateFormatted = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const invoiceObj: Invoice = {
      redeemType: 'coins',
      type: selectedReward.type,
      game: selectedReward.name,
      plan: selectedReward.key.includes('50') ? '$50' : selectedReward.key.includes('100') ? '$100' : null,
      account: accountName || user?.username || 'Gamer',
      email: deliveryEmail || user?.username + '@discord.com',
      coinsSpent: selectedReward.cost,
      inrPrice: selectedReward.inrPrice,
      date: dateFormatted,
      invoiceNo,
      ts: Date.now()
    };

    // Save claim order to local logs
    const savedOrders = JSON.parse(localStorage.getItem('eiq_ords') || '[]');
    savedOrders.unshift(invoiceObj);
    localStorage.setItem('eiq_ords', JSON.stringify(savedOrders));

    // Telemetry dispatch
    try {
      await fetch('http://localhost:5000/api/spend-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userName: user?.username,
          amount: selectedReward.cost,
          gameKey: selectedReward.key,
          invoiceNo
        })
      });
      await fetch('http://localhost:5000/api/save-redemption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userName: user?.username,
          discordTag: user?.username,
          game: selectedReward.name,
          plan: invoiceObj.plan,
          account: invoiceObj.account,
          email: invoiceObj.email,
          coinsSpent: invoiceObj.coinsSpent,
          inrPrice: invoiceObj.inrPrice,
          invoiceNo: invoiceObj.invoiceNo,
          redeemType: 'coins',
          date: invoiceObj.date,
          ts: invoiceObj.ts
        })
      });
    } catch {}

    setGeneratedInvoice(invoiceObj);
    setSubmitting(false);
    setActiveTab('SUCCESS');
    triggerToast('🪙', `Successfully redeemed ${selectedReward.name}!`);
  };

  const handleDownloadPDF = () => {
    if (!generatedInvoice) return;
    
    // Dynamically import jsPDF to work nicely with SSR Next.js
    import('jspdf').then((module) => {
      const doc = new module.jsPDF();
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(124, 92, 252);
      doc.text('IQ REWARDS PORTAL', 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('OFFICIAL INVOICE VOUCHER', 20, 32);
      
      doc.setDrawColor(220);
      doc.line(20, 38, 190, 38);
      
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text(`Invoice Number: #${generatedInvoice.invoiceNo}`, 20, 48);
      doc.text(`Redemption Date: ${generatedInvoice.date}`, 20, 55);
      doc.text(`Status: QUEUED`, 20, 62);
      
      doc.line(20, 70, 190, 70);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Item Description', 20, 80);
      doc.text('Account Details', 90, 80);
      doc.text('Voucher Price', 150, 80);
      
      doc.setFont('Helvetica', 'normal');
      doc.text(generatedInvoice.game, 20, 90);
      doc.text(`User: ${generatedInvoice.account}`, 90, 90);
      doc.text(`${generatedInvoice.coinsSpent.toLocaleString()} Coins`, 150, 90);
      doc.text(`Email: ${generatedInvoice.email}`, 90, 97);
      
      doc.line(20, 107, 190, 107);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Summary', 20, 118);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Approx. Cash Value: ${generatedInvoice.inrPrice}`, 20, 126);
      doc.text(`Estimated Delivery Time: Within 72 hours`, 20, 133);
      
      doc.line(20, 145, 190, 145);
      
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text('Thank you for redeeming with IQ Rewards. Your code is processed securely.', 20, 155);
      doc.text('If you have questions, join our Discord Support Node.', 20, 161);
      
      doc.save(`invoice-${generatedInvoice.invoiceNo}.pdf`);
    });
  };

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto space-y-8 relative">
        
        {/* Toast Drawer alert */}
        {toastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1a1535] text-white border border-[var(--border3)] px-6 py-3 rounded-full text-xs font-semibold shadow-[var(--s3)] animate-toastIn">
            <span>{toastMsg.type === '!' ? '⚠️' : toastMsg.type === '✕' ? '✕' : '🪙'}</span>
            <span>{toastMsg.text}</span>
          </div>
        )}

        {/* Banner Hero header */}
        {activeTab === 'TILES' && (
          <>
            <div className="text-center space-y-3">
              <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
                🪙 Coin Rewards
              </div>
              <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
                Spend <span className="text-[var(--p)] italic font-normal">IQCoins</span>
              </h1>
              <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
                Exchange your IQCoins for real gaming rewards — no code needed.
              </p>
            </div>

            {/* Current balance bar */}
            <div className="flex items-center gap-5 bg-gradient-to-r from-[rgba(245,158,11,0.07)] to-[rgba(245,158,11,0.03)] border border-[rgba(245,158,11,0.2)] rounded-[var(--r3)] px-6 py-5.5 shadow-[var(--s1)]">
              <span className="text-4xl animate-bounce">🪙</span>
              <div>
                <div className="font-serif text-3xl font-extrabold text-[#b45309] dark:text-[#f59e0b] tracking-tight">{coins.toLocaleString()}</div>
                <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mt-1">Available IQCoins Balance</div>
              </div>
              <button
                onClick={() => claimDailyCoins()}
                className="ml-auto px-5 py-2.5 bg-gradient-to-br from-[var(--p)] to-[#5b35e8] text-white text-xs font-bold rounded-full shadow-[var(--s1)] hover:scale-105 transition no-underline"
              >
                Claim Daily →
              </button>
            </div>

            {/* Grid display list of rewards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rewards.map((reward, idx) => (
                <div
                  key={idx}
                  onClick={() => handleTileSelect(reward)}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 relative overflow-hidden group hover:border-[var(--border3)] hover:-translate-y-1 hover:shadow-[var(--s3)] transition-all duration-300 cursor-pointer"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle,rgba(124,92,252,0.1),transparent_70%)] pointer-events-none" />
                  <span className="text-3xl block mb-4">{reward.icon}</span>
                  
                  <span
                    className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 border border-purple-500/10"
                    style={{ background: reward.badgeStyle, color: 'var(--p)' }}
                  >
                    {reward.badge}
                  </span>

                  <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1 group-hover:text-[var(--p)] transition">{reward.name}</h3>
                  <p className="text-[11px] text-[var(--t2)] leading-relaxed mb-4">{reward.desc}</p>
                  
                  <div className="border-t border-[var(--border)] pt-4 mt-2">
                    <div className="text-xs font-bold text-[#b45309] dark:text-[#f59e0b]">🪙 {reward.cost.toLocaleString()} IQCoins</div>
                    <div className="text-[10px] text-[var(--t3)] font-semibold mt-1">Approx. Cash Value: {reward.inrPrice}</div>
                  </div>

                  <span className="block text-right text-xs font-bold text-[var(--p)] group-hover:translate-x-1.5 transition-transform duration-200 mt-4">Redeem →</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* INPUT DETAIL FORM CONTAINER */}
        {activeTab === 'FORM' && selectedReward && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s2)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--p)] to-transparent" />
            <button
              onClick={() => setActiveTab('TILES')}
              className="text-xs text-[var(--t3)] font-bold hover:text-[var(--t)] flex items-center gap-1.5 mb-6"
            >
              ← Back to rewards
            </button>

            <h3 className="font-serif text-2xl font-bold text-[var(--p)] mb-2">{selectedReward.name}</h3>
            <p className="text-xs text-[var(--t2)] mb-6 leading-relaxed">
              You will spend <strong className="text-[#b45309] dark:text-[#f59e0b]">🪙 {selectedReward.cost.toLocaleString()} IQCoins</strong>. Your current balance: <strong>{coins.toLocaleString()}</strong>
            </p>

            {/* Simulated warnings info alerts */}
            {selectedReward.type === 'rb' || selectedReward.type === 'nitro' ? (
              <div className="bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 rounded-xl p-4 mb-6 text-xs leading-relaxed">
                <strong className="block mb-1">⚠️ Important account details</strong>
                Enter the exact account username — reward will be delivered directly to the account specified below.
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-xl p-4 mb-6 text-xs leading-relaxed">
                <strong className="block mb-1">✓ Account integration linked</strong>
                Voucher will be delivered securely to your Discord account: <strong>{user?.username}</strong>
              </div>
            )}

            {/* Input fields mapping */}
            <div className="space-y-4 text-left">
              {(selectedReward.type === 'rb' || selectedReward.type === 'nitro') && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--t2)] uppercase tracking-wider mb-1.5">
                      {selectedReward.type === 'nitro' ? 'Discord Account Username' : 'Roblox Profile Name'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. gamer_cyber"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--p)] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--t2)] uppercase tracking-wider mb-1.5">Delivery Email</label>
                    <input
                      type="email"
                      placeholder="e.g. your@email.com"
                      value={deliveryEmail}
                      onChange={(e) => setDeliveryEmail(e.target.value)}
                      className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--p)] transition"
                    />
                  </div>
                </>
              )}

              <button
                onClick={handleFormSubmit}
                disabled={submitting}
                className="w-full bg-gradient-to-br from-[var(--p)] to-[#5b35e8] text-white rounded-xl py-3 text-xs font-bold shadow-[var(--s2)] hover:scale-[1.01] transition duration-200 mt-4"
              >
                {submitting ? 'Confirming Transaction...' : `Confirm Redemption — ${selectedReward.cost.toLocaleString()} Coins`}
              </button>
            </div>
          </div>
        )}

        {/* REDEEM SUCCESS INVOICE FORM */}
        {activeTab === 'SUCCESS' && generatedInvoice && (
          <div className="space-y-6">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 text-center shadow-[var(--s3)] relative overflow-hidden animate-popIn">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-3xl mx-auto mb-5">
                ✅
              </div>
              <h2 className="font-serif text-2xl font-bold tracking-tight mb-2 select-none">{generatedInvoice.game} Queued!</h2>
              <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed mb-6">Your reward is queued and will be activated within <strong>72 hours</strong>.</p>
              
              {/* Detailed invoice representation in UI */}
              <div className="bg-[var(--surface)] border border-[var(--border2)] rounded-2xl p-6 text-left max-w-md mx-auto shadow-[var(--s1)] mb-6 text-xs">
                <div className="flex justify-between border-b border-[var(--border)] pb-3 mb-4 font-serif">
                  <span className="font-bold text-[var(--t)]">Rewards Portal</span>
                  <span className="font-bold text-emerald-500 uppercase tracking-wider text-[10px]">QUEUED</span>
                </div>
                
                <h4 className="font-bold text-[var(--t)] text-sm mb-1">Invoice #{generatedInvoice.invoiceNo}</h4>
                <div className="text-[10px] text-[var(--t3)] mb-4">Redeemed: {generatedInvoice.date}</div>
                
                <div className="space-y-2 border-t border-[var(--border)] pt-4 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[var(--t2)]">Reward Item:</span>
                    <strong className="text-[var(--t)]">{generatedInvoice.game}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--t2)]">Target Account:</span>
                    <strong className="text-[var(--t)]">{generatedInvoice.account}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--t2)]">Delivery Email:</span>
                    <strong className="text-[var(--t)]">{generatedInvoice.email}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--t2)]">Coins Spent:</span>
                    <strong className="text-[#b45309] dark:text-[#f59e0b]">🪙 {generatedInvoice.coinsSpent.toLocaleString()} IQCoins</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--t2)]">Value Estimate:</span>
                    <strong className="text-[var(--p)]">{generatedInvoice.inrPrice}</strong>
                  </div>
                </div>
              </div>

              <div className="text-xs text-[var(--p)] font-bold mb-8">
                ⏱ Delivery completes within <strong>72 hours</strong>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="px-6 py-3 bg-[var(--p)] text-white text-xs font-bold rounded-full hover:brightness-110 shadow-sm transition"
                >
                  📄 Download Invoice PDF
                </button>
                <button
                  onClick={() => {
                    setActiveTab('TILES');
                    setSelectedReward(null);
                    setGeneratedInvoice(null);
                  }}
                  className="px-6 py-3 bg-[var(--bg2)] text-[var(--t)] text-xs font-bold rounded-full hover:brightness-95 border border-[var(--border)] transition"
                >
                  Return to Store
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </ConsoleLayout>
  );
}
