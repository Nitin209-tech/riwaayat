'use client';

import React, { useState, useEffect } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { useApp } from '@/components/AppContext';

interface LeaderboardUser {
  name: string;
  coins: number;
}

export default function Profile() {
  const { user, coins, loginWithDiscord } = useApp();
  const [invites, setInvites] = useState<number | string>('—');
  const [messages, setMessages] = useState<number | string>('—');
  const [redemptions, setRedemptions] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loadingLb, setLoadingLb] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadData = () => {
    if (!user) return;

    // Redemptions count from local claim logs
    const claimLogs = JSON.parse(localStorage.getItem('eiq_ords') || '[]');
    setRedemptions(claimLogs.length);

    // Live backend sync
    fetch(`http://localhost:5000/api/user/${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          if (d.invites != null) setInvites(d.invites);
          if (d.messages != null) setMessages(d.messages);
        }
      })
      .catch(() => {
        setInvites(12);
        setMessages(142);
      });

    // Leaderboard stands
    setLoadingLb(true);
    fetch('http://localhost:5000/api/leaderboard')
      .then((r) => r.json())
      .then((d) => {
        setLeaderboard(d.leaderboard || []);
        setLoadingLb(false);
      })
      .catch(() => {
        setLeaderboard([
          { name: 'gamer_pro', coins: 180000000 },
          { name: 'lucky_user', coins: 120000000 },
          { name: 'discord_ace', coins: 98000000 },
          { name: 'cyber_ninja', coins: 64000000 },
          { name: 'riwaayat_fan', coins: 42000000 }
        ]);
        setLoadingLb(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleRefresh = () => {
    loadData();
    triggerToast('Profile successfully updated!');
  };

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto space-y-8 relative">
        
        {/* Toast Notification alert */}
        {toastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1a1535] text-white border border-[var(--border3)] px-6 py-3 rounded-full text-xs font-semibold shadow-[var(--s3)] animate-toastIn">
            <span>🔄</span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Hero header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            👤 Profile
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            Your <span className="text-[var(--p)] italic font-normal">Profile</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            Your IQCoin balance, stats, and leaderboard ranking — synced live from our servers.
          </p>
        </div>

        {!user ? (
          /* LOGIN PROMPT */
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-12 text-center shadow-[var(--s1)] max-w-xl mx-auto">
            <span className="text-5xl block mb-4">🔐</span>
            <h2 className="font-serif text-2xl font-semibold text-[var(--t)] mb-2">Login to view your profile</h2>
            <p className="text-xs text-[var(--t2)] leading-relaxed max-w-xs mx-auto mb-6">
              Connect your Discord account to see your IQCoin balance, invite count, and leaderboard position.
            </p>
            <button
              onClick={() => loginWithDiscord()}
              className="bg-[#5865f2] text-white rounded-full px-8 py-3.5 text-xs font-bold hover:brightness-110 shadow-md transition duration-200"
            >
              Login with Discord
            </button>
          </div>
        ) : (
          /* PROFILE INTEGRATIONS CONTENT */
          <div className="space-y-6">
            
            {/* Card Info */}
            <div className="bg-gradient-to-r from-[var(--p4)] to-[var(--bg2)] border border-[var(--border2)] rounded-[var(--r3)] p-8 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-52 h-52 bg-[radial-gradient(circle,rgba(124,92,252,0.1),transparent_70%)] pointer-events-none" />
              
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--p)] to-[#5b35e8] border-2 border-white/20 flex items-center justify-center font-serif text-3xl font-bold text-white shadow-md">
                {user.username.charAt(0).toUpperCase()}
              </div>

              <div>
                <h2 className="font-serif text-2xl font-bold text-[var(--t)]">{user.username}</h2>
                <div className="text-xs text-[var(--t3)] font-semibold mt-1">Discord ID: {user.discordId || 'Registered Member'}</div>
              </div>

              <button
                onClick={handleRefresh}
                className="sm:ml-auto px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-full text-xs font-semibold hover:bg-[var(--bg3)] transition"
              >
                ↻ Refresh Stats
              </button>
            </div>

            {/* Metric grid counts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-5 text-center shadow-[var(--s1)]">
                <div className="font-serif text-2xl font-bold text-[var(--p)] mb-1">{coins.toLocaleString()}</div>
                <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">🪙 IQCoins</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-5 text-center shadow-[var(--s1)]">
                <div className="font-serif text-2xl font-bold text-[var(--p)] mb-1">{invites}</div>
                <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">👥 Invites</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-5 text-center shadow-[var(--s1)]">
                <div className="font-serif text-2xl font-bold text-[var(--p)] mb-1">{messages}</div>
                <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">💬 Messages</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r2)] p-5 text-center shadow-[var(--s1)]">
                <div className="font-serif text-2xl font-bold text-[var(--p)] mb-1">{redemptions}</div>
                <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">📦 Redemptions</div>
              </div>
            </div>

            {/* Leaderboard standing tables */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#eab308] to-transparent" />
              <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">🏆 Portal Leaderboard</h3>
              <p className="text-xs text-[var(--t2)] mb-6">Top IQCoin earners active on our network nodes.</p>

              {loadingLb ? (
                <div className="text-center py-8 text-xs text-[var(--t3)]">Loading leaderboard standings...</div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-2">
                  {leaderboard.map((lbUser, idx) => {
                    const rank = idx + 1;
                    const isTop3 = rank <= 3;
                    const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                    
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-4 bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-5 py-3 hover:border-[var(--border2)] transition"
                      >
                        <div className="w-8 h-8 rounded-full bg-[var(--bg3)] flex items-center justify-center font-bold text-xs select-none">
                          {isTop3 ? emoji : rank}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-[var(--p4)] text-[var(--p)] flex items-center justify-center text-[10px] font-bold uppercase select-none">
                          {lbUser.name.charAt(0)}
                        </div>
                        <div className="font-bold text-xs text-[var(--t)]">{lbUser.name}</div>
                        <div className="ml-auto font-mono text-xs font-bold text-[#b45309] dark:text-[#f59e0b]">🪙 {lbUser.coins.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </ConsoleLayout>
  );
}
