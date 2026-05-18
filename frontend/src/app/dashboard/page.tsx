'use client';

import React, { useState } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { useApp } from '@/components/AppContext';
import { Gift, Copy, Check, Terminal, Shield, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { user, claims, coins, claimDailyCoins, isAuthenticated } = useApp();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);

  if (!isAuthenticated || !user) {
    return (
      <ConsoleLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
          <AlertTriangle className="text-cyber-pink w-16 h-16 animate-pulse" />
          <h2 className="font-rajdhani text-3xl font-bold text-white uppercase tracking-wider">
            ACCESS DENIED
          </h2>
          <p className="text-cyber-light-gray max-w-md font-mono text-xs">
            Link up your Discord credentials via the header button to initialize entry into this console.
          </p>
        </div>
      </ConsoleLayout>
    );
  }

  const handleClaimDaily = async () => {
    const res = await claimDailyCoins();
    if (res.success) {
      setDailyMessage(res.message);
      setTimeout(() => setDailyMessage(null), 4000);
    }
  };

  const copyPayload = (payload: string, claimId: string) => {
    navigator.clipboard.writeText(payload);
    setCopiedId(claimId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <ConsoleLayout>
      <div className="space-y-8">
        
        {/* Title */}
        <div className="border-b border-cyber-cyan/15 pb-6">
          <h1 className="font-rajdhani text-3xl md:text-4xl font-extrabold tracking-wider text-white uppercase flex items-center space-x-2">
            <span className="text-cyber-cyan font-mono text-neon-cyan">//</span>
            <span>NEURAL OPERATIONS DESK</span>
          </h1>
          <p className="text-cyber-light-gray text-sm mt-1">
            Analyze personal coins standing, secure claim logs, and deploy daily allocations.
          </p>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/15 flex items-center space-x-4 relative overflow-hidden group">
            <div className="w-14 h-14 rounded-full border-2 border-cyber-cyan/40 bg-cyber-dark-blue flex items-center justify-center text-cyber-cyan font-mono font-bold text-lg uppercase shrink-0">
              {user.username.substring(0, 2)}
            </div>
            <div>
              <h3 className="font-rajdhani text-lg font-bold text-white tracking-wide uppercase">
                {user.username}
              </h3>
              <p className="text-xs text-cyber-light-gray/60 uppercase">System Status: Linked</p>
              <div className="mt-1.5 inline-block bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                {user.role} ACCESS
              </div>
            </div>
          </div>

          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/15 relative overflow-hidden">
            <span className="text-[10px] font-mono text-cyber-light-gray/50 tracking-widest uppercase">
              COINS LEDGER BALANCE
            </span>
            <div className="font-rajdhani text-4xl font-extrabold text-white mt-2 font-mono">
              🪙 {coins.toLocaleString()} <span className="text-xs text-cyber-light-gray font-normal">IQCoins</span>
            </div>
            <p className="text-xs text-cyber-light-gray/60 leading-relaxed mt-1">
              Earn more coins by participating in giveaways or advocates leaderboards.
            </p>
          </div>

          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/15 relative overflow-hidden">
            <span className="text-[10px] font-mono text-cyber-light-gray/50 tracking-widest uppercase block mb-3">
              DAILY BONUS DEPLOYER
            </span>
            <button
              onClick={handleClaimDaily}
              className="w-full py-2.5 rounded font-rajdhani text-sm font-bold tracking-wider text-black bg-cyber-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.4)] transition-all duration-300"
            >
              EXECUTE DAILY CLAIM
            </button>
            {dailyMessage && (
              <p className="text-emerald-400 text-xs font-mono mt-2 text-center animate-pulse">{dailyMessage}</p>
            )}
          </div>

        </div>

        {/* Claim history logs */}
        <div className="glassmorphism rounded-xl border border-cyber-cyan/15 overflow-hidden">
          <div className="p-6 border-b border-cyber-cyan/15 bg-cyber-dark-blue/40 flex items-center justify-between">
            <h2 className="font-rajdhani text-xl font-bold tracking-wider text-white uppercase flex items-center space-x-2">
              <Terminal size={18} className="text-cyber-cyan animate-pulse" />
              <span>SECURED CLAIMS HISTORICAL REGISTRY</span>
            </h2>
            <Link
              href="/redeem/verify?category=minecraft"
              className="text-xs text-cyber-cyan font-mono hover:underline hover:text-white transition-colors"
            >
              + NEW DECRYPTION
            </Link>
          </div>

          <div className="overflow-x-auto">
            {claims.length === 0 ? (
              <div className="text-center py-12 text-cyber-light-gray space-y-2">
                <Gift size={32} className="mx-auto text-cyber-light-gray/20" />
                <p className="text-sm">No claims reported under this digital identity ledger.</p>
                <Link href="/redeem/verify?category=minecraft" className="text-xs text-cyber-cyan hover:underline font-mono">Redeem a code package to begin</Link>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-cyber-cyan/10 bg-cyber-black/40 text-cyber-light-gray/80 text-xs font-mono tracking-wider">
                    <th className="p-4">DATE CLAIMED</th>
                    <th className="p-4">REWARD ITEM</th>
                    <th className="p-4">CATEGORY</th>
                    <th className="p-4">EMAIL GATEWAY</th>
                    <th className="p-4">USERNAME / HANDLE</th>
                    <th className="p-4">DELIVERED VALUE</th>
                    <th className="p-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-cyan/10 font-mono text-xs text-cyber-light-gray">
                  {claims.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">{c.claimedAt}</td>
                      <td className="p-4 text-white font-bold font-rajdhani tracking-wider text-sm">{c.rewardName}</td>
                      <td className="p-4">
                        <span className="bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan px-2 py-0.5 rounded font-bold">
                          {c.category}
                        </span>
                      </td>
                      <td className="p-4">{c.emailUsed}</td>
                      <td className="p-4 text-white font-bold">{c.extraField1}</td>
                      <td className="p-4 max-w-xs truncate">
                        <code className="text-xs text-emerald-400 bg-cyber-black/80 px-2 py-1 rounded border border-emerald-500/10">
                          {c.deliveredPayload}
                        </code>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => copyPayload(c.deliveredPayload, c.id)}
                          className="p-1.5 bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan hover:text-black rounded transition"
                          title="Copy secure key to clipboard"
                        >
                          {copiedId === c.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
