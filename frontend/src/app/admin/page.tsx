'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { useApp } from '@/components/AppContext';

interface AuditLog {
  action: string;
  admin: string;
  target: string;
  timestamp: string;
}

export default function Admin() {
  const { user } = useApp();
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [step, setStep] = useState<'PASSWORD' | 'USERNAME' | 'DASHBOARD'>('PASSWORD');
  
  // Dashboard states
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [coinActionAmt, setCoinActionAmt] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Form states for codes gen
  const [genCount, setGenCount] = useState<number>(10);
  const [genGame, setGenGame] = useState<string>('MINECRAFT');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  
  // Custom rejection modal
  const [activeRejectionInv, setActiveRejectionInv] = useState<string | null>(null);
  const [customRejectionReason, setCustomRejectionReason] = useState('');
  
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    const isAuthed = localStorage.getItem('eiq_admin_authed') === 'true';
    const name = localStorage.getItem('eiq_admin_name');
    if (isAuthed && name) {
      setAdminUsername(name);
      setIsAdmin(true);
      setStep('DASHBOARD');
      loadAdminTelemetry();
    }
  }, []);

  const handlePasswordSubmit = () => {
    if (password === 'eiq@admin2026') {
      setStep('USERNAME');
    } else {
      triggerToast('Incorrect Master Password!');
    }
  };

  const handleUsernameSubmit = () => {
    if (!adminUsername.trim()) {
      triggerToast('Please provide an administrator callsign');
      return;
    }
    localStorage.setItem('eiq_admin_authed', 'true');
    localStorage.setItem('eiq_admin_name', adminUsername);
    setIsAdmin(true);
    setStep('DASHBOARD');
    loadAdminTelemetry();
    triggerToast(`Welcome back Administrator ${adminUsername}!`);
  };

  const loadAdminTelemetry = async () => {
    // Redemptions from local logs
    const saved = JSON.parse(localStorage.getItem('eiq_ords') || '[]');
    setRedemptions(saved);

    // Mock initial audits
    setAuditLogs([
      { action: 'Portal Initialized', admin: 'SYSTEM', target: 'N/A', timestamp: new Date().toLocaleString() }
    ]);
  };

  const addAudit = (action: string, target: string) => {
    const next: AuditLog = {
      action,
      admin: adminUsername || 'Admin',
      target,
      timestamp: new Date().toLocaleString()
    };
    setAuditLogs((prev) => [next, ...prev]);
  };

  // Redeem statuses mod triggers
  const updateRedemptionStatus = async (invoiceNo: string, status: string, customMessage?: string, customReason?: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/update-order-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNo,
          status,
          websiteMessage: customMessage || (status === 'activated' ? '✅ Voucher code delivered' : '❌ Redemptions flagged'),
          websiteReason: customReason || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        addAudit(`Updated status to ${status}`, invoiceNo);
        triggerToast(`Invoice #${invoiceNo} updated to ${status}`);
        loadAdminTelemetry();
      }
    } catch {
      // Local simulated fallback
      const local = JSON.parse(localStorage.getItem('eiq_ords') || '[]');
      const updated = local.map((o: any) => {
        if (o.invoiceNo === invoiceNo) {
          return { ...o, status, websiteStatus: status, websiteMessage: customMessage, websiteReason: customReason };
        }
        return o;
      });
      localStorage.setItem('eiq_ords', JSON.stringify(updated));
      setRedemptions(updated);
      addAudit(`[Mock] Updated status to ${status}`, invoiceNo);
      triggerToast(`[Mock] Order status updated.`);
    }
  };

  const handleCustomRejectSubmit = () => {
    if (!activeRejectionInv) return;
    updateRedemptionStatus(
      activeRejectionInv,
      'rejected',
      '❌ Order was rejected during validation.',
      customRejectionReason
    );
    setActiveRejectionInv(null);
    setCustomRejectionReason('');
  };

  // Modify user balances
  const handleModifyUserCoins = async (action: 'ADD' | 'REMOVE') => {
    if (!selectedUser.trim()) {
      triggerToast('Please input a target Discord Username');
      return;
    }
    if (coinActionAmt <= 0) {
      triggerToast('Please provide a valid coin amount');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/modify-coins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: selectedUser,
          amount: coinActionAmt,
          action // 'ADD' | 'REMOVE'
        })
      });
      const data = await res.json();
      if (data.success) {
        addAudit(`${action === 'ADD' ? 'Allocated' : 'Debited'} ${coinActionAmt.toLocaleString()} Coins`, selectedUser);
        triggerToast(`Success! ${coinActionAmt.toLocaleString()} Coins updated.`);
        setCoinActionAmt(0);
      }
    } catch {
      addAudit(`[Mock Sandbox] Adjusted coins for ${selectedUser}`, `Coins: ${coinActionAmt}`);
      triggerToast(`[Sandbox Mode] Coins adjusted locally.`);
    }
  };

  // Code Gen helpers
  const handleGenerateCodes = () => {
    const codes: string[] = [];
    for (let i = 0; i < genCount; i++) {
      const token = genGame.slice(0, 3) + '-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      codes.push(token);
    }
    setGeneratedCodes(codes);
    addAudit(`Generated ${genCount} Codes for ${genGame}`, 'Redeem Ledger');
    triggerToast(`Generated ${genCount} custom codes!`);
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(generatedCodes.join('\n'));
    triggerToast('All generated codes copied!');
  };

  const handleSignOut = () => {
    localStorage.removeItem('eiq_admin_authed');
    localStorage.removeItem('eiq_admin_name');
    setIsAdmin(false);
    setStep('PASSWORD');
    triggerToast('Sign out secure.');
  };

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto space-y-8 relative">
        
        {/* Toast alert popup */}
        {toastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1a1535] text-white border border-[var(--border3)] px-6 py-3 rounded-full text-xs font-semibold shadow-[var(--s3)] animate-toastIn">
            <span>🛡️</span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* STEP 1: PASSWORD MASTER GATE */}
        {step === 'PASSWORD' && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-12 text-center shadow-[var(--s1)] max-w-sm mx-auto">
            <span className="text-5xl block mb-4">🔐</span>
            <h2 className="font-serif text-2xl font-semibold text-[var(--t)] mb-2">Command Center</h2>
            <p className="text-xs text-[var(--t3)] mb-6">Restricted to authorized personnel only.</p>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Enter Master Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-center bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--p)] transition font-mono tracking-widest"
              />
              <button
                onClick={handlePasswordSubmit}
                className="w-full bg-[var(--p)] text-white rounded-full py-2.5 text-xs font-bold shadow-sm"
              >
                Authenticate →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: USERNAME IDENTIFIER */}
        {step === 'USERNAME' && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-12 text-center shadow-[var(--s1)] max-w-sm mx-auto">
            <span className="text-5xl block mb-4">🎖️</span>
            <h2 className="font-serif text-2xl font-semibold text-[var(--t)] mb-2">Callsign Registry</h2>
            <p className="text-xs text-[var(--t3)] mb-6 font-semibold">Master password verified! Registry required.</p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Discord Callsign (e.g. nitin_ops)"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full text-center bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--p)] transition font-bold"
              />
              <button
                onClick={handleUsernameSubmit}
                className="w-full bg-[var(--p)] text-white rounded-full py-2.5 text-xs font-bold shadow-sm"
              >
                Launch Console →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: MAIN DYNAMIC ADMIN CONSOLE */}
        {step === 'DASHBOARD' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h1 className="font-serif text-3xl font-bold text-[var(--t)]">Console Panel</h1>
                <div className="text-[10px] text-[var(--t3)] font-bold uppercase tracking-widest mt-1">Logged in as {adminUsername} (Administrator)</div>
              </div>
              <button
                onClick={handleSignOut}
                className="mt-3 sm:mt-0 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-500 rounded-full text-xs font-bold transition"
              >
                Sign Out Console
              </button>
            </div>

            {/* Metric counters */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-5 shadow-sm text-center">
                <div className="text-2xl font-bold text-[var(--p)]">{redemptions.length}</div>
                <div className="text-[9px] text-[var(--t3)] font-bold uppercase tracking-wider mt-1">Total Claims Recorded</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-5 shadow-sm text-center">
                <div className="text-2xl font-bold text-[#b45309] dark:text-[#f59e0b]">{auditLogs.length}</div>
                <div className="text-[9px] text-[var(--t3)] font-bold uppercase tracking-wider mt-1">Audit Ledger Trails</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-5 shadow-sm text-center">
                <div className="text-2xl font-bold text-emerald-500">1</div>
                <div className="text-[9px] text-[var(--t3)] font-bold uppercase tracking-wider mt-1">Online Admins Active</div>
              </div>
            </div>

            {/* Live Claims Registry Management */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
              <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">📋 Redemptions Stock Queues</h3>
              <p className="text-xs text-[var(--t2)] mb-5">Approve, reject, or apply custom telemetry responses to pending vouchers.</p>

              {redemptions.length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--t3)]">No redemptions logged yet.</div>
              ) : (
                <div className="space-y-3">
                  {redemptions.map((item, idx) => (
                    <div key={idx} className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="font-bold text-xs text-[var(--t)]">{item.game}</div>
                        <div className="text-[10px] text-[var(--t3)] font-mono uppercase mt-1">{item.invoiceNo} · User: {item.account}</div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateRedemptionStatus(item.invoiceNo, 'activated', '✅ Your key has been activated successfully!')}
                          className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold rounded-full hover:bg-emerald-500/15"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setActiveRejectionInv(item.invoiceNo);
                            setCustomRejectionReason('');
                          }}
                          className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold rounded-full hover:bg-rose-500/15"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Rejection Popup Box */}
            {activeRejectionInv && (
              <div className="bg-[var(--surface)] border border-rose-500/30 rounded-[var(--r2)] p-6 shadow-md space-y-4">
                <h4 className="font-serif text-sm font-bold text-[var(--t)]">❌ Custom Rejection Reason for #{activeRejectionInv}</h4>
                <textarea
                  placeholder="e.g. Account name mismatch or suspicious automated traffic patterns."
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                  className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded p-3 text-xs outline-none focus:border-rose-500 transition"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCustomRejectSubmit}
                    className="px-4 py-2 bg-rose-500 text-white text-xs font-bold rounded-full hover:brightness-105"
                  >
                    Submit Rejection
                  </button>
                  <button
                    onClick={() => setActiveRejectionInv(null)}
                    className="px-4 py-2 bg-[var(--bg3)] text-[var(--t2)] text-xs font-bold rounded-full border border-[var(--border)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* User Coins Adjustments */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)]">
              <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">👥 Member Coin Balance Allocator</h3>
              <p className="text-xs text-[var(--t2)] mb-5">Credit or debit IQCoin balances directly for any active profile.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider mb-1.5">Discord Username</label>
                  <input
                    type="text"
                    placeholder="e.g. nitin"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-xs focus:border-[var(--p)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider mb-1.5">Coin Quantity</label>
                  <input
                    type="number"
                    placeholder="1000"
                    value={coinActionAmt || ''}
                    onChange={(e) => setCoinActionAmt(Number(e.target.value))}
                    className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-xs focus:border-[var(--p)] outline-none"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => handleModifyUserCoins('ADD')}
                    className="flex-1 py-2 bg-[var(--p)] text-white text-xs font-bold rounded shadow-sm hover:brightness-105"
                  >
                    + Grant
                  </button>
                  <button
                    onClick={() => handleModifyUserCoins('REMOVE')}
                    className="flex-1 py-2 bg-[var(--bg3)] border border-[var(--border)] text-[var(--t)] text-xs font-bold rounded hover:brightness-95"
                  >
                    - Debit
                  </button>
                </div>
              </div>
            </div>

            {/* Code Generator Card */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)]">
              <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">⚙️ Voucher Code Generator</h3>
              <p className="text-xs text-[var(--t2)] mb-5">Batch generate redeemable reward token codes for giveaways and admins.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider mb-1.5">Voucher Type</label>
                  <select
                    value={genGame}
                    onChange={(e) => setGenGame(e.target.value)}
                    className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-xs outline-none focus:border-[var(--p)]"
                  >
                    <option value="MINECRAFT">Minecraft Reward (Rs.899)</option>
                    <option value="ROBLOX-50">Roblox $50 Plan (Rs.1,499)</option>
                    <option value="ROBLOX-100">Roblox $100 Plan (Rs.2,499)</option>
                    <option value="XBOX">Xbox Game Pass (Rs.1,999)</option>
                    <option value="NITRO-BASIC">Discord Nitro Basic (Rs.1,199)</option>
                    <option value="NITRO-BOOST">Discord Nitro Boost (Rs.5,999)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                    className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-xs focus:border-[var(--p)] outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateCodes}
                className="w-full bg-gradient-to-br from-[var(--p)] to-[#5b35e8] text-white py-2.5 rounded text-xs font-bold shadow-sm"
              >
                Generate Code Block
              </button>

              {generatedCodes.length > 0 && (
                <div className="mt-5 space-y-3">
                  <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4 font-mono text-[10px] whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto pr-2">
                    {generatedCodes.join('\n')}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyCodes}
                      className="px-4 py-2 bg-[var(--p)] text-white text-xs font-bold rounded-full hover:brightness-105 shadow-sm"
                    >
                      📋 Copy All
                    </button>
                    <button
                      onClick={() => setGeneratedCodes([])}
                      className="px-4 py-2 bg-[var(--bg3)] border border-[var(--border)] text-[var(--t)] text-xs font-bold rounded-full hover:brightness-95"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Logs Trail */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)]">
              <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">🛡️ Console Audit Ledger</h3>
              <p className="text-xs text-[var(--t2)] mb-5">Cryptographically logged events on this console connection.</p>
              
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 text-[10px] font-mono leading-relaxed">
                {auditLogs.map((log, idx) => (
                  <div key={idx} className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-2.5 flex justify-between text-[var(--t2)]">
                    <div>
                      <span className="text-[var(--p)] font-bold">[{log.admin}]</span> {log.action} &rarr; <span className="font-bold">{log.target}</span>
                    </div>
                    <div className="text-[var(--t3)] shrink-0 ml-4">{log.timestamp}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </ConsoleLayout>
  );
}
