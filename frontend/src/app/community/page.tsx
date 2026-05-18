'use client';

import React from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { useApp } from '@/components/AppContext';
import { MessageSquare, Disc, Activity, Users, Cpu, Heart } from 'lucide-react';

export default function Community() {
  const { stats } = useApp();

  const guildFeatures = [
    { name: 'Neural Verify Gateway', desc: 'Secure bot roles synchronization upon linking credentials.', icon: Disc },
    { name: 'Encrypted Ticket System', desc: 'Real-time support channel creations directly inside Discord.', icon: MessageSquare },
    { name: 'Invite Logs Registry', desc: 'Auto track member arrivals and verify advocate ranks.', icon: Activity }
  ];

  return (
    <ConsoleLayout>
      <div className="space-y-8">
        
        {/* Title */}
        <div className="border-b border-cyber-cyan/15 pb-6">
          <h1 className="font-rajdhani text-3xl md:text-4xl font-extrabold tracking-wider text-white uppercase flex items-center space-x-2">
            <span className="text-cyber-cyan font-mono text-neon-cyan">//</span>
            <span>COMMUNITY CENTRAL HUB</span>
          </h1>
          <p className="text-cyber-light-gray text-sm mt-1">
            Connect to the neural network nodes, view statistics, and sync with other active advocates.
          </p>
        </div>

        {/* Discord CTA banner */}
        <div className="relative overflow-hidden p-8 rounded-xl border border-purple-500/40 bg-purple-500/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-transparent pointer-events-none -z-10" />
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <div className="inline-block bg-purple-500/20 border border-purple-500/50 text-white text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase">
              DISCORD TELEMETRY HUB
            </div>
            <h2 className="font-rajdhani text-2xl font-extrabold tracking-wider text-white uppercase">
              JOIN THE NEURAL CHAT SERVER
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed font-mono text-xs">
              Link up with over 5,000+ active gamers. Secure custom roles, participate in daily giveaways, and raise support tickets instantly.
            </p>
          </div>
          
          <a
            href="https://discord.gg/riwaayat"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto relative group overflow-hidden px-8 py-3.5 rounded font-rajdhani text-base font-bold tracking-wider text-white bg-purple-600 hover:bg-purple-500 transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center space-x-2 shrink-0 border border-transparent"
          >
            <Disc className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            <span>JOIN NEURAL DISCORD SERVER</span>
          </a>
        </div>

        {/* Community stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/15 space-y-2">
            <div className="flex items-center space-x-2 text-[10px] font-mono text-cyber-cyan tracking-widest uppercase">
              <Users size={14} />
              <span>COMMUNITY POPULATION</span>
            </div>
            <div className="font-rajdhani text-4xl font-extrabold text-white mt-2 font-mono">
              {(stats.totalVisitors * 3.5).toFixed(0)} <span className="text-xs text-cyber-light-gray font-normal lowercase">nodes</span>
            </div>
            <p className="text-xs text-cyber-light-gray/60 leading-relaxed mt-2">
              Global unique gaming registries connected via Discord interface networks.
            </p>
          </div>

          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/15 space-y-2">
            <div className="flex items-center space-x-2 text-[10px] font-mono text-cyber-purple tracking-widest uppercase">
              <Cpu size={14} />
              <span>ACTIVE CORES DEPLOYED</span>
            </div>
            <div className="font-rajdhani text-4xl font-extrabold text-white mt-2 font-mono">
              4 <span className="text-xs text-cyber-light-gray font-normal lowercase">categories</span>
            </div>
            <p className="text-xs text-cyber-light-gray/60 leading-relaxed mt-2">
              Roblox, Minecraft, YouTube Premium, and Discord Nitro active categories.
            </p>
          </div>

          <div className="glassmorphism p-6 rounded-xl border border-cyber-cyan/15 space-y-2">
            <div className="flex items-center space-x-2 text-[10px] font-mono text-cyber-pink tracking-widest uppercase">
              <Heart size={14} />
              <span>SYSTEM STABILITY</span>
            </div>
            <div className="font-rajdhani text-4xl font-extrabold text-white mt-2 font-mono">
              99.9% <span className="text-xs text-cyber-light-gray font-normal lowercase">uptime</span>
            </div>
            <p className="text-xs text-cyber-light-gray/60 leading-relaxed mt-2">
              Continuous audit sync engines securing database and Discord sync.
            </p>
          </div>
        </div>

        {/* Guild Bot features */}
        <div className="space-y-6 pt-6">
          <div className="text-center space-y-2">
            <h2 className="font-rajdhani text-2xl font-extrabold tracking-wider text-white uppercase">
              INTEGRATED TELEMETRY BOT SYNC
            </h2>
            <p className="text-cyber-light-gray max-w-lg mx-auto text-xs font-mono">
              Bot networks run continuous audits syncing member status balances with platform databases.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {guildFeatures.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="glassmorphism p-6 rounded-xl border border-cyber-cyan/10 text-center space-y-4 group hover:border-cyber-cyan/30 transition duration-300">
                  <div className="w-12 h-12 mx-auto rounded-lg bg-cyber-dark-blue border border-cyber-cyan/20 flex items-center justify-center group-hover:border-cyber-cyan transition-all">
                    <Icon size={20} className="text-cyber-cyan animate-pulse" />
                  </div>
                  <h3 className="font-rajdhani text-base font-bold text-white uppercase tracking-wider">{feat.name}</h3>
                  <p className="text-xs text-cyber-light-gray leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
