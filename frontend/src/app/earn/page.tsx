'use client';

import React, { useState, useEffect } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { useApp } from '@/components/AppContext';

export default function Earn() {
  const { user, coins, claimDailyCoins } = useApp();
  const [balance, setBalance] = useState(coins);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [dailyBtnText, setDailyBtnText] = useState('Claim Daily Reward');
  const [toastMsg, setToastMsg] = useState<{ type: '!' | '✕' | '🪙'; text: string } | null>(null);

  const triggerToast = (type: '!' | '✕' | '🪙', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    setBalance(coins);
    
    // Check 24 hour threshold
    const lastClaim = parseInt(localStorage.getItem('eiq_dl') || '0');
    const now = Date.now();
    if (now - lastClaim < 86400000) {
      setDailyClaimed(true);
      const hoursLeft = Math.ceil((86400000 - (now - lastClaim)) / 3600000);
      setDailyBtnText(`⏱ Come back in ${hoursLeft}h`);
    }
  }, [coins]);

  const handleDailyClaim = async () => {
    if (!user) {
      triggerToast('!', 'Please login with Discord first');
      return;
    }
    const lastClaim = parseInt(localStorage.getItem('eiq_dl') || '0');
    const now = Date.now();
    if (now - lastClaim < 86400000) {
      const hoursLeft = Math.ceil((86400000 - (now - lastClaim)) / 3600000);
      triggerToast('!', `Daily claim locked. Come back in ${hoursLeft}h!`);
      return;
    }

    localStorage.setItem('eiq_dl', String(now));
    const res = await claimDailyCoins();
    if (res.success) {
      setDailyClaimed(true);
      setDailyBtnText('✓ Claimed! Come back tomorrow');
      triggerToast('🪙', '+1,000 IQCoins claimed successfully!');
    }
  };

  const reqReference = [
    { name: 'Minecraft Reward', price: '5,00,00,000 IQCoins ≈ ₹899', icon: '⛏' },
    { name: 'Roblox $50 Plan', price: '8,00,00,000 IQCoins ≈ ₹1,499', icon: '🎮' },
    { name: 'Xbox Game Pass', price: '7,00,00,000 IQCoins ≈ ₹1,999', icon: '🎯' },
    { name: 'Discord Nitro Basic', price: '6,00,00,000 IQCoins ≈ ₹1,199', icon: '💎' }
  ];

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto space-y-8 relative">
        
        {/* Toast Drawer overlay */}
        {toastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1a1535] text-white border border-[var(--border3)] px-6 py-3 rounded-full text-xs font-semibold shadow-[var(--s3)] animate-toastIn">
            <span>{toastMsg.type === '!' ? '⚠️' : toastMsg.type === '✕' ? '✕' : '🪙'}</span>
            <span>{toastMsg.text}</span>
          </div>
        )}

        {/* Hero title */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            💰 Earn IQCoins
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            Earn <span className="text-[var(--p)] italic font-normal">IQCoins</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            Stack up coins through free activities and redeem for premium gaming rewards.
          </p>
        </div>

        {/* Balance Hero header */}
        <div className="flex items-center gap-6 bg-gradient-to-r from-[var(--p4)] to-[var(--bg2)] border border-[var(--border2)] rounded-[var(--r3)] px-8 py-7 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-[radial-gradient(circle,rgba(124,92,252,0.15),transparent_70%)] pointer-events-none" />
          <span className="text-4xl animate-bounce">🪙</span>
          <div>
            <div className="font-serif text-4xl font-bold text-[var(--p)] tracking-tight">{balance.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-widest mt-1.5">Available IQCoins Balance</div>
          </div>
        </div>

        {/* Earn activity cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Daily Claim card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 flex flex-col justify-between hover:border-[var(--border2)] hover:-translate-y-0.5 hover:shadow-[var(--s2)] transition duration-200">
            <div>
              <span className="text-3xl block mb-3">📅</span>
              <h3 className="font-serif text-base font-semibold text-[var(--t)] mb-1">Daily Claim</h3>
              <p className="text-[11px] text-[var(--t2)] leading-relaxed mb-4">Come back every 24 hours to claim your free IQCoins. Never miss a day!</p>
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--p)] mb-3">🪙 +1,000 IQCoins</div>
              <button
                onClick={handleDailyClaim}
                disabled={dailyClaimed}
                className={`w-full py-2.5 rounded-full text-xs font-bold transition duration-250 ${
                  dailyClaimed
                    ? 'bg-[var(--bg2)] border border-[var(--border)] text-[var(--t3)] cursor-not-allowed'
                    : 'bg-gradient-to-br from-[var(--p)] to-[#5b35e8] text-white shadow-sm hover:scale-[1.01]'
                }`}
              >
                {dailyBtnText}
              </button>
            </div>
          </div>

          {/* Discord Messages card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 flex flex-col justify-between hover:border-[var(--border2)] hover:-translate-y-0.5 hover:shadow-[var(--s2)] transition duration-200">
            <div>
              <span className="text-3xl block mb-3">💬</span>
              <h3 className="font-serif text-base font-semibold text-[var(--t)] mb-1">Discord Messages</h3>
              <p className="text-[11px] text-[var(--t2)] leading-relaxed mb-4">Every 50 messages you send in our Discord server earns you IQCoins automatically via our bot.</p>
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--p)] mb-3">🪙 +5,000 per 50 msgs</div>
              <a
                href="https://discord.com/channels/1411327756968661125"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center block bg-[#5865f2] text-white rounded-full py-2.5 text-xs font-bold hover:brightness-110 shadow-sm transition duration-200 no-underline"
              >
                Open Discord →
              </a>
            </div>
          </div>

          {/* Invites friends card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 flex flex-col justify-between hover:border-[var(--border2)] hover:-translate-y-0.5 hover:shadow-[var(--s2)] transition duration-200">
            <div>
              <span className="text-3xl block mb-3">👥</span>
              <h3 className="font-serif text-base font-semibold text-[var(--t)] mb-1">Invite Friends</h3>
              <p className="text-[11px] text-[var(--t2)] leading-relaxed mb-4">Every 5 members you invite to our Discord server earns you IQCoins via the invite tracker bot.</p>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--t3)] bg-[var(--bg2)] border border-[var(--border)] rounded-full px-3 py-1 text-center mb-3">
                🤖 Tracked by Discord Bot
              </div>
              <a
                href="https://discord.com/channels/1411327756968661125"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center block bg-[#5865f2] text-white rounded-full py-2.5 text-xs font-bold hover:brightness-110 shadow-sm transition duration-200 no-underline"
              >
                Get Invite Link →
              </a>
            </div>
          </div>
        </div>

        {/* Requirements references */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--p)] to-transparent" />
          <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">💡 How Many Coins Do I Need?</h3>
          <p className="text-xs text-[var(--t2)] mb-6">Here's a quick reference for coin requirements per reward:</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {reqReference.map((ref, idx) => (
              <div key={idx} className="bg-[var(--bg2)] border border-[var(--border)] rounded-[var(--r2)] p-4 flex flex-col items-start">
                <span className="text-2xl mb-2">{ref.icon}</span>
                <span className="font-serif text-xs font-semibold text-[var(--t)] mb-1">{ref.name}</span>
                <span className="text-[10px] text-[var(--t2)] leading-tight">{ref.price}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
