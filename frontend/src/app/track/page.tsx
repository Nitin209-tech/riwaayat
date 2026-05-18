'use client';

import React, { useState, useEffect } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import Link from 'next/link';

interface Order {
  redeemType: string;
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

interface LiveStatus {
  success: boolean;
  status?: string;
  websiteStatus?: string;
  websiteMessage?: string;
  websiteReason?: string;
}

export default function Track() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchVal, setSearchVal] = useState('');
  const [searchMsg, setSearchMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LiveStatus>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadLocalOrders = () => {
    const saved = JSON.parse(localStorage.getItem('eiq_ords') || '[]');
    setOrders(saved);
    return saved;
  };

  const fetchLiveStatus = async (invoiceNo: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order-status/${invoiceNo}`);
      const data = await res.json();
      if (data.success) {
        setLiveStatuses((prev) => ({ ...prev, [invoiceNo]: data }));
      }
    } catch {}
  };

  useEffect(() => {
    const local = loadLocalOrders();
    // Batch fetch live order statuses
    local.forEach((o: Order) => {
      fetchLiveStatus(o.invoiceNo);
    });
  }, []);

  const handleSearch = () => {
    const val = searchVal.trim().toUpperCase();
    if (!val) {
      setSearchMsg({ text: 'Enter invoice number', isError: true });
      return;
    }
    const found = orders.some((o) => o.invoiceNo && o.invoiceNo.toUpperCase() === val);
    if (!found) {
      setSearchMsg({ text: 'No order found with that invoice number', isError: true });
    } else {
      setSearchMsg({ text: '✓ Order found — see below', isError: false });
    }
  };

  const handleRefresh = async (invoiceNo: string) => {
    triggerToast('Updating order status...');
    await fetchLiveStatus(invoiceNo);
  };

  const handleClearAll = () => {
    if (!window.confirm('Clear all order history?')) return;
    localStorage.removeItem('eiq_ords');
    setOrders([]);
    triggerToast('All order logs cleared!');
  };

  const handleRemove = (invoiceNo: string) => {
    if (!window.confirm('Remove this order from history?')) return;
    const next = orders.filter((o) => o.invoiceNo !== invoiceNo);
    localStorage.setItem('eiq_ords', JSON.stringify(next));
    setOrders(next);
    triggerToast('Order removed from logs!');
  };

  const handleDownloadPDF = (o: Order) => {
    import('jspdf').then((module) => {
      const doc = new module.jsPDF();
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(124, 92, 252);
      doc.text('IQ REWARDS PORTAL', 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('OFFICIAL INVOICE VOUCHER', 20, 32);
      
      doc.line(20, 38, 190, 38);
      
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text(`Invoice Number: #${o.invoiceNo}`, 20, 48);
      doc.text(`Redemption Date: ${o.date}`, 20, 55);
      doc.text(`Status: ACTIVE`, 20, 62);
      
      doc.line(20, 70, 190, 70);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Item Description', 20, 80);
      doc.text('Account Details', 90, 80);
      doc.text('Voucher Price', 150, 80);
      
      doc.setFont('Helvetica', 'normal');
      doc.text(o.game, 20, 90);
      doc.text(`User: ${o.account}`, 90, 90);
      doc.text(`${o.coinsSpent.toLocaleString()} Coins`, 150, 90);
      doc.text(`Email: ${o.email}`, 90, 97);
      
      doc.line(20, 107, 190, 107);
      doc.save(`invoice-${o.invoiceNo}.pdf`);
    });
  };

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto space-y-8 relative">
        
        {/* Toast Drawer overlay */}
        {toastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1a1535] text-white border border-[var(--border3)] px-6 py-3 rounded-full text-xs font-semibold shadow-[var(--s3)] animate-toastIn">
            <span>🔄</span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Hero header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            📦 Track Order
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            Track Your <span className="text-[var(--p)] italic font-normal">Order</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            Check your redemption status in real time. All orders are stored securely on your device.
          </p>
        </div>

        {/* Search card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--p)] to-transparent" />
          <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">Search by Invoice Number</h3>
          <p className="text-xs text-[var(--t2)] mb-5">Enter your invoice number (e.g. IQ-MC-AB12XYZ) to look up your order status.</p>
          
          <div className="flex gap-2.5 max-w-md">
            <input
              type="text"
              placeholder="IQ-XX-XXXXXXX"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value.toUpperCase())}
              className="flex-1 bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--p)] transition font-mono tracking-widest uppercase"
            />
            <button
              onClick={handleSearch}
              className="px-5 py-2 bg-[var(--p)] text-white text-xs font-bold rounded shadow-sm hover:brightness-110"
            >
              Search
            </button>
          </div>

          {searchMsg && (
            <div className={`text-[10px] font-bold mt-3 uppercase tracking-wider ${searchMsg.isError ? 'text-rose-500' : 'text-emerald-500'}`}>
              {searchMsg.text}
            </div>
          )}
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h3 className="font-serif text-lg font-semibold text-[var(--t)]">Your Redemptions</h3>
            {orders.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-4 py-1.5 rounded-full bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold transition"
              >
                Clear All Logs
              </button>
            )}
          </div>

          {orders.length === 0 ? (
            /* Empty log prompt */
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-12 text-center shadow-[var(--s1)]">
              <span className="text-5xl block mb-4">📭</span>
              <h2 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">No orders yet</h2>
              <p className="text-xs text-[var(--t3)] leading-relaxed max-w-xs mx-auto mb-6">
                Redeem a code or spend IQCoins to see your orders tracked live here.
              </p>
              <div className="flex justify-center gap-3">
                <Link href="/redeem/verify?category=minecraft" className="px-5 py-2.5 bg-[var(--p)] text-white text-xs font-bold rounded-full shadow-sm hover:brightness-110 no-underline">Redeem Code</Link>
                <Link href="/coins" className="px-5 py-2.5 bg-[var(--bg2)] text-[var(--t)] text-xs font-bold rounded-full hover:brightness-95 border border-[var(--border)] no-underline">Spend Coins</Link>
              </div>
            </div>
          ) : (
            /* Detailed Order cards list */
            <div className="space-y-4">
              {orders.map((o, idx) => {
                const live = liveStatuses[o.invoiceNo];
                const s = live?.websiteStatus || live?.status || 'pending';
                
                const isActivated = s === 'activated';
                const isRejected = s === 'rejected' || s === 'custom_rejected';
                const isPending = !isActivated && !isRejected;

                const hrs = (Date.now() - (o.ts || Date.now())) / 3600000;
                const progress = Math.min(100, Math.round((hrs / 72) * 100));
                const rem = Math.max(0, 72 - hrs);

                return (
                  <div
                    key={idx}
                    className={`bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-6 space-y-4 hover:shadow-[var(--s2)] transition duration-200 ${
                      isRejected ? 'border-rose-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--pd)] border border-[var(--border2)] flex items-center justify-center text-xl shrink-0">
                        {o.type === 'mc' ? '⛏' : o.type === 'rb' ? '🎮' : o.type === 'xbox' ? '🎯' : '💎'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-serif text-sm font-bold text-[var(--t)] truncate">{o.game}</h4>
                        <div className="text-[10px] text-[var(--t3)] font-mono uppercase tracking-widest">{o.invoiceNo}</div>
                      </div>

                      <div
                        className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-3 py-1 ${
                          isActivated
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25'
                            : isRejected
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                        }`}
                      >
                        {isActivated ? '✓ Activated' : isRejected ? '✕ Rejected' : '⏳ Pending'}
                      </div>
                    </div>

                    {/* Live status detailed messages */}
                    {isRejected && (
                      <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3.5 text-xs text-[var(--t)] leading-relaxed">
                        <strong className="block text-rose-500 mb-1">❌ Rejection alert</strong>
                        {live?.websiteMessage || 'Your reward request was flagged and rejected by safety tools.'}
                        {live?.websiteReason && <span className="block mt-2 font-semibold">Reason: {live.websiteReason}</span>}
                      </div>
                    )}

                    {isActivated && (
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 text-xs text-[var(--t)] leading-relaxed">
                        <strong className="block text-emerald-500 mb-1">🎉 Order Fulfilled!</strong>
                        {live?.websiteMessage || 'Your key has been delivered. Please check your spam folder or logs.'}
                      </div>
                    )}

                    {isPending && live?.websiteMessage && (
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3.5 text-xs text-[var(--t)] leading-relaxed">
                        <strong className="block text-amber-500 mb-1">⏳ Processing message</strong>
                        {live.websiteMessage}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-4 text-xs font-semibold">
                      <div>
                        <div className="text-[9px] text-[var(--t3)] uppercase tracking-wider mb-0.5">Account</div>
                        <div className="text-[var(--t)] truncate">{o.account}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[var(--t3)] uppercase tracking-wider mb-0.5">Est. Price</div>
                        <div className="text-[var(--p)]">{o.inrPrice}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[var(--t3)] uppercase tracking-wider mb-0.5">Log Date</div>
                        <div className="text-[var(--t2)] text-[10px]">{new Date(o.ts || Date.now()).toLocaleDateString('en-IN')}</div>
                      </div>
                    </div>

                    {/* Progress representation bar */}
                    {isPending && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-[var(--t3)]">
                          <span>Processing Telemetry</span>
                          <span>{progress}% · {rem.toFixed(0)}h remaining</span>
                        </div>
                        <div className="w-full bg-[var(--bg2)] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[var(--p)] h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleDownloadPDF(o)}
                        className="px-4 py-2 bg-[var(--bg2)] border border-[var(--border)] hover:bg-[var(--bg3)] text-[var(--t2)] rounded text-[10px] font-bold uppercase transition"
                      >
                        📄 Download Invoice
                      </button>
                      <button
                        onClick={() => handleRefresh(o.invoiceNo)}
                        className="px-4 py-2 bg-[var(--bg2)] border border-[var(--border)] hover:bg-[var(--bg3)] text-[var(--t2)] rounded text-[10px] font-bold uppercase transition"
                      >
                        🔄 Refresh
                      </button>
                      <button
                        onClick={() => handleRemove(o.invoiceNo)}
                        className="px-4 py-2 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/15 text-rose-500 rounded text-[10px] font-bold uppercase transition ml-auto"
                      >
                        Remove Log
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </ConsoleLayout>
  );
}
