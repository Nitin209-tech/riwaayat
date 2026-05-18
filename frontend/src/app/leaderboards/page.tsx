'use client';

import React from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { Trophy, Award, Crown, User, Calendar } from 'lucide-react';

interface LeaderboardUser {
  rank: number;
  username: string;
  avatar: string | null;
  invites: number;
  joined: string;
}

export default function Leaderboards() {
  const ranks: LeaderboardUser[] = [
    { rank: 1, username: 'CyberGamer_Alpha', avatar: null, invites: 45, joined: '2026-01-12' },
    { rank: 2, username: 'Netrunner_2077', avatar: null, invites: 38, joined: '2026-02-18' },
    { rank: 3, username: 'SlayerX', avatar: null, invites: 29, joined: '2026-03-01' },
    { rank: 4, username: 'RiwaayatAlpha', avatar: null, invites: 18, joined: '2026-01-20' },
    { rank: 5, username: 'GhostInTheShell', avatar: null, invites: 14, joined: '2026-04-05' },
    { rank: 6, username: 'Neon_Ninja', avatar: null, invites: 11, joined: '2026-02-25' }
  ];

  return (
    <ConsoleLayout>
      <div className="space-y-8">
        
        {/* Title */}
        <div className="border-b border-cyber-cyan/15 pb-6">
          <h1 className="font-rajdhani text-3xl md:text-4xl font-extrabold tracking-wider text-white uppercase flex items-center space-x-2">
            <span className="text-cyber-cyan font-mono text-neon-cyan">//</span>
            <span>ADVOCATE LEADERBOARD LEDGER</span>
          </h1>
          <p className="text-cyber-light-gray text-sm mt-1">
            Top network advocates who secured invitations for active community gamers.
          </p>
        </div>

        {/* Podium Top 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
          
          {/* Rank 2 */}
          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/10 order-2 md:order-1 text-center space-y-4 relative h-60 flex flex-col justify-center">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              2ND PLACE
            </div>
            
            <div className="w-14 h-14 mx-auto rounded-full bg-cyber-dark-blue border-2 border-slate-400 flex items-center justify-center text-slate-400 relative">
              <Award size={20} />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-rajdhani text-lg font-bold text-white uppercase truncate">{ranks[1].username}</h3>
              <p className="text-xs text-cyber-light-gray font-mono">{ranks[1].invites} INVITES SECURED</p>
            </div>
          </div>

          {/* Rank 1 (Glowing Podium) */}
          <div className="glassmorphism p-8 rounded-xl border-2 border-cyber-cyan order-1 md:order-2 text-center space-y-4 relative h-68 flex flex-col justify-center shadow-[0_0_20px_rgba(0,240,255,0.15)]">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-cyber-pink/20 border border-cyber-pink/40 text-cyber-pink text-xs font-mono font-bold px-3 py-1 rounded-full uppercase tracking-widest flex items-center space-x-1 animate-pulse">
              <Crown size={12} />
              <span>OVERLORD</span>
            </div>
            
            <div className="w-16 h-16 mx-auto rounded-full bg-cyber-dark-blue border-2 border-cyber-cyan flex items-center justify-center text-cyber-cyan relative shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <Crown size={28} />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-rajdhani text-xl font-extrabold text-white uppercase tracking-wider truncate">{ranks[0].username}</h3>
              <p className="text-sm text-cyber-cyan font-mono font-bold">{ranks[0].invites} INVITES SECURED</p>
            </div>
          </div>

          {/* Rank 3 */}
          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/10 order-3 text-center space-y-4 relative h-56 flex flex-col justify-center">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              3RD PLACE
            </div>
            
            <div className="w-12 h-12 mx-auto rounded-full bg-cyber-dark-blue border-2 border-amber-600 flex items-center justify-center text-amber-600 relative">
              <Award size={18} />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-rajdhani text-lg font-bold text-white uppercase truncate">{ranks[2].username}</h3>
              <p className="text-xs text-cyber-light-gray font-mono">{ranks[2].invites} INVITES SECURED</p>
            </div>
          </div>

        </div>

        {/* Leaderboard Table List */}
        <div className="glassmorphism rounded-xl border border-cyber-cyan/15 overflow-hidden">
          <div className="p-6 border-b border-cyber-cyan/15 bg-cyber-dark-blue/40 flex items-center space-x-3">
            <Trophy className="text-cyber-cyan animate-pulse" size={20} />
            <h2 className="font-rajdhani text-xl font-bold tracking-wider text-white uppercase">
              ADVOCATE REGISTRY LEDGER
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-cyber-cyan/10 bg-cyber-black/40 text-cyber-light-gray/80 text-xs font-mono tracking-wider">
                  <th className="p-4 w-24">STAND RANK</th>
                  <th className="p-4">GAMER ADVOCATE</th>
                  <th className="p-4">JOIN SEQUENCE</th>
                  <th className="p-4 text-right">INVITES TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-cyan/10 font-mono text-xs text-cyber-light-gray">
                {ranks.map((adv) => (
                  <tr key={adv.rank} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
                        adv.rank === 1 
                          ? 'bg-cyber-cyan/20 border border-cyber-cyan text-cyber-cyan shadow-[0_0_6px_rgba(0,240,255,0.3)]' 
                          : adv.rank === 2
                          ? 'bg-slate-400/20 border border-slate-400 text-slate-300'
                          : adv.rank === 3
                          ? 'bg-amber-600/20 border border-amber-600 text-amber-500'
                          : 'bg-cyber-gray/30 border border-cyber-cyan/10 text-cyber-light-gray'
                      }`}>
                        #{adv.rank}
                      </span>
                    </td>

                    <td className="p-4 flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-cyber-dark-blue border border-cyber-cyan/25 flex items-center justify-center shrink-0">
                        <User size={12} className="text-cyber-cyan/60" />
                      </div>
                      <span className="text-white font-rajdhani font-bold tracking-wider text-sm">{adv.username}</span>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center space-x-1">
                        <Calendar size={12} />
                        <span>{new Date(adv.joined).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="p-4 text-right text-cyber-cyan font-bold font-mono">
                      {adv.invites} SECURED
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
