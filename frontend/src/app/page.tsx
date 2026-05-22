'use client';

import React, { useState } from 'react';
import { useApp } from '@/components/AppContext';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Award, 
  Gamepad2, 
  Tv, 
  CheckCircle, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  Mail,
  User,
  X
} from 'lucide-react';

export default function Home() {
  const { isAuthenticated, loginWithDiscord, logout, user } = useApp();

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'minecraft' | 'youtube' | 'roblox' | 'nitro' | 'valorant' | 'fortnite'>('minecraft');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');

  const stats = [
    { num: '50K+', label: 'Users Joined', desc: 'Active gamer profiles linked via Discord OAuth2' },
    { num: '120K+', label: 'Rewards Delivered', desc: 'Secure activation voucher codes logged' },
    { num: '99.9%', label: 'System Uptime', desc: 'Constant live Express telemetry connection' }
  ];

  const redeemCards = [
    {
      category: 'minecraft',
      title: 'Minecraft Premium',
      ico: (
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-emerald-400">
          <path d="M4 6l8-4 8 4v8l-8 4-8-4V6zm8-2.3L5.4 6.7 12 10l6.6-3.3L12 3.7zM5.5 8.2v5.1L11 16v-5.1L5.5 8.2zm13 0L13 10.9V16l5.5-2.7V8.2z"/>
        </svg>
      ),
      desc: 'Claim official premium Java/Bedrock accounts gift card codes directly activated on Microsoft portal.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: 'Premium Account'
    },
    {
      category: 'youtube',
      title: 'YouTube Subscribers',
      ico: (
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-red-500">
          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.507 9.388.507 9.388.507s7.518 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      desc: 'Redeem 10K or 30K active subscribers directly delivered to your YouTube channel profile safely.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: '10K Subscribers'
    },
    {
      category: 'roblox',
      title: 'Roblox Giftcards',
      ico: (
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-amber-500">
          <path d="M5.375 0L0 18.625L18.625 24L24 5.375L5.375 0ZM15.5 13.75L10.25 15.25L8.75 10L14 8.5L15.5 13.75Z"/>
        </svg>
      ),
      desc: 'Redeem official $50 or $100 Robux gift card codes directly activated on Roblox billing portal.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: '$50 Giftcard'
    },
    {
      category: 'nitro',
      title: 'Discord Nitro',
      ico: (
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-indigo-400">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
        </svg>
      ),
      desc: 'Redeem official Discord Nitro Basic or Nitro Boost activation links with zero service cooldowns.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: 'Nitro Boost'
    },
    {
      category: 'valorant',
      title: 'Valorant Gift Card',
      ico: (
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-rose-500">
          <path d="M19.16 2.84H14.4l-7.7 9.87v-9.87H2v18.29h4.7v-7.8l7.63 7.8h4.83l-8.73-9.1z"/>
        </svg>
      ),
      desc: 'Claim official premium 2500 VP or 5000 VP gift card codes directly activated on Valorant billing portal.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: '2500 Points'
    },
    {
      category: 'fortnite',
      title: 'Fortnite V-Bucks',
      ico: (
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-indigo-400">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 1.83-.62 3.52-1.65 4.88z"/>
        </svg>
      ),
      desc: 'Claim premium 1000 V-Bucks or 2800 V-Bucks gift card codes directly activated on Fortnite billing portal.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: '1000 V-Bucks'
    }
  ];

  const features = [
    { 
      ico: <Shield className="w-6 h-6 text-purple-400" />, 
      title: 'Discord OAuth2 Authentication', 
      desc: '100% secure connection verified by official Discord API. We never see or store your private gaming passwords.' 
    },
    { 
      ico: <CheckCircle className="w-6 h-6 text-emerald-400" />, 
      title: '25-Character Validation', 
      desc: 'Apply secure alpha-numeric promotion keys to check inventory stock and initiate secure activation queues.' 
    },
    { 
      ico: <CheckCircle className="w-6 h-6 text-cyan-400" />, 
      title: 'Modern Telemetry Dashboard', 
      desc: 'Track claim histories, active validation channels, and invite counters in an elegant glassmorphic UI.' 
    }
  ];

  const getUsernameLabel = () => {
    switch (activeCategory) {
      case 'nitro':
        return 'Discord Username';
      case 'valorant':
        return 'Velo Username';
      case 'fortnite':
        return 'Epic Username';
      case 'youtube':
        return 'Channel Link';
      case 'minecraft':
        return 'Gamer Username';
      case 'roblox':
        return 'Roblox Username';
      default:
        return 'Gamer Username';
    }
  };

  const getUsernamePlaceholder = () => {
    switch (activeCategory) {
      case 'nitro':
        return 'e.g. steve';
      case 'valorant':
        return 'e.g. Steve#NA1';
      case 'fortnite':
        return 'e.g. SteveEpic';
      case 'youtube':
        return 'e.g. https://youtube.com/@channel';
      case 'minecraft':
        return 'e.g. Steve';
      case 'roblox':
        return 'e.g. SteveRoblox';
      default:
        return 'e.g. steve';
    }
  };

  const handleOpenRedeem = (card: typeof redeemCards[0]) => {
    setActiveCategory(card.category as any);
    setSelectedPlan(card.defaultPlan);
    setEmail('');
    if (card.category === 'nitro') {
      setUsername(user?.username || '');
    } else {
      setUsername('');
    }
    setShowModal(true);
  };

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !username) return;
    
    // Redirect to unified verify page with credential parameters
    window.location.href = `/redeem/verify?category=${activeCategory}&email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&plan=${encodeURIComponent(selectedPlan)}`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--t)] selection:bg-[var(--p)]/30 selection:text-white font-sans overflow-x-hidden relative">
      
      {/* Premium Cyberpunk Background Grids & Chromatic Orb Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.15),transparent_70%)] blur-[120px]" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.12),transparent_70%)] blur-[150px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.1),transparent_70%)] blur-[180px]" />
        
        {/* Subtle Tech Grid overlay */}
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
      </div>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 w-full border-b border-white/5 bg-[var(--bg)]/80 backdrop-blur-[24px] shadow-[0_4px_30px_rgba(183,148,244,0.08)]">
        <div className="max-w-7xl mx-auto px-6 h-[80px] flex items-center justify-between">
          
          {/* Left Brand Brandmark */}
          <Link href="/" className="flex items-center gap-3.5 no-underline group shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-cyan-400 text-white flex items-center justify-center font-black text-base shadow-[0_0_20px_rgba(168,85,247,0.4)] group-hover:scale-105 transition-transform duration-300">
              R
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-[0.08em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400">
                RIWAAYAT
              </div>
              <div className="text-[9px] text-purple-300 tracking-widest font-extrabold uppercase">
                Premium Rewards Portal
              </div>
            </div>
          </Link>

          {/* Center Links Tabs */}
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-zinc-400">
            <a href="#rewards" className="hover:text-white transition-colors duration-200 no-underline">Rewards</a>
            <a href="#features" className="hover:text-white transition-colors duration-200 no-underline">Shield Tech</a>
            <a href="#dashboard" className="hover:text-white transition-colors duration-200 no-underline">Dashboard</a>
            <Link href="/howitworks" className="hover:text-white transition-colors duration-200 no-underline">FAQ & Guide</Link>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-cyan-400 text-white flex items-center justify-center text-[10px] font-black">
                    {user.username.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-white/90">{user.username}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs font-bold text-zinc-400 bg-white/5 border border-white/10 rounded-full px-5 py-2.5 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition duration-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => loginWithDiscord()}
                className="px-7 py-3 bg-gradient-to-r from-[#5865F2] to-[#404eed] text-white hover:brightness-110 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-300 shadow-[0_0_20px_rgba(88,101,242,0.3)] hover:scale-105 flex items-center gap-2"
              >
                Login with Discord
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* BODY CONTENT WRAPPER */}
      <main className="max-w-7xl mx-auto px-6 py-24 relative z-10 space-y-28">
        
        {/* HERO SECTION */}
        <section className="text-center space-y-8 max-w-4xl mx-auto relative pt-4">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[350px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.15),transparent_70%)] pointer-events-none -z-10" />

          {/* Secure OAuth Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[#0c082c]/65 border border-purple-500/30 rounded-full px-6 py-2.5 text-[10px] sm:text-xs font-bold tracking-widest uppercase text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
          >
            <Shield className="w-3.5 h-3.5 text-fuchsia-400" />
            Secure OAuth2 Reward Authentication
          </motion.div>

          {/* Huge Main Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-7xl lg:text-[85px] font-black tracking-tight leading-[0.95] text-white"
          >
            The Ultimate<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400">
              Discord Reward
            </span><br />
            Platform.
          </motion.h1>

          {/* Description Paragraph */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs sm:text-sm md:text-base text-zinc-300 max-w-xl mx-auto leading-relaxed"
          >
            Authenticate seamlessly using Discord OAuth2, input your Microsoft outlook and desired username, and paste your 25-character promo key to activate.
          </motion.p>

          {/* Call to Action buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-5 pt-4"
          >
            {isAuthenticated ? (
              <a
                href="#dashboard"
                className="relative group overflow-hidden px-12 py-5 btn-neon-purple text-white rounded-full text-xs font-black tracking-widest uppercase hover:scale-[1.05] transition-all duration-300 no-underline flex items-center gap-2"
              >
                Start Redeeming <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-200" />
              </a>
            ) : (
              <button
                onClick={() => loginWithDiscord()}
                className="relative group overflow-hidden px-12 py-5 btn-neon-purple text-white rounded-full text-xs font-black tracking-widest uppercase hover:scale-[1.05] transition-all duration-300 flex items-center gap-2"
              >
                Login with Discord <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-200" />
              </button>
            )}
            <a
              href="#dashboard"
              className="px-12 py-5 bg-white/5 border border-white/10 rounded-full text-xs font-black tracking-widest uppercase text-white hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all duration-200 no-underline"
            >
              Explore Rewards
            </a>
          </motion.div>
        </section>

        {/* STATS SECTION */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto pt-8">
          {stats.map((st, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="card-cyber rounded-3xl p-8 text-center relative group"
            >
              {/* Corner tech lines */}
              <div className="absolute top-0 left-0 w-4 h-[1px] bg-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 left-0 w-[1px] h-4 bg-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 right-0 w-4 h-[1px] bg-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 right-0 w-[1px] h-4 bg-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="text-4xl sm:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 tracking-tight mb-2">
                {st.num}
              </div>
              <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                {st.label}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {st.desc}
              </p>
            </motion.div>
          ))}
        </section>

        {/* REDEEM DASHBOARD SECTION */}
        <section id="dashboard" className="max-w-5xl mx-auto space-y-8 pt-12">
          
          <div className="text-center space-y-2">
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-zinc-400 font-mono">Redeem Center</span>
            <h2 className="text-4xl font-black text-white tracking-tight uppercase">Command Dashboard</h2>
            <p className="text-xs text-zinc-400">Active reward categories connected to your Discord gaming instance.</p>
          </div>

          <div className="bg-[#0c082c]/40 border border-purple-500/10 rounded-3xl p-6 sm:p-10 shadow-[0_30px_90px_rgba(168,85,247,0.06)] relative overflow-hidden backdrop-blur-2xl">
            
            {/* Top User Account Profile Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-white/5 pb-8 mb-8">
              <div className="flex items-center gap-4">
                {/* Large Premium Avatar Block with gradient border ring */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 via-fuchsia-500 to-cyan-400 p-[1.5px] shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  <div className="w-full h-full rounded-full bg-[var(--bg)] flex items-center justify-center text-white font-bold font-mono text-xl">
                    {isAuthenticated && user ? user.username.substring(0, 2).toUpperCase() : 'RW'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold tracking-widest text-purple-300 uppercase font-mono">Connected Account</div>
                  <h3 className="text-xl font-black text-white">
                    {isAuthenticated && user ? `@${user.username}` : 'Login to connect'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-300 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Verified Discord Session Active
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="bg-[var(--bg)]/65 border border-purple-500/20 rounded-2xl px-6 py-4 flex items-center gap-3 shrink-0 shadow-[0_0_15px_rgba(183,148,244,0.1)]">
                <Shield className="w-5 h-5 text-fuchsia-400" />
                <div>
                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Verification Status</div>
                  <div className="text-xs font-black text-white tracking-wide uppercase mt-0.5 font-mono">
                    Level 1 Authenticated
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Large Redeem Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {redeemCards.map((card, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="card-cyber rounded-3xl p-7 flex flex-col justify-between group"
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="w-14 h-14 rounded-xl bg-purple-500/5 border border-purple-500/20 flex items-center justify-center group-hover:border-cyan-400 group-hover:bg-cyan-500/5 transition-all duration-300">
                        {React.cloneElement(card.ico, { className: 'w-7 h-7' })}
                      </div>
                      <span className="text-[10px] font-black text-white font-mono tracking-wider bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1">{card.price}</span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-black text-white uppercase tracking-tight">{card.title}</h4>
                      <p className="text-xs text-zinc-300 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-5 mt-6">
                    {isAuthenticated ? (
                      <button
                        onClick={() => handleOpenRedeem(card)}
                        className="w-full py-4 btn-neon-cyan text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all duration-250 text-center block"
                      >
                        Redeem Reward
                      </button>
                    ) : (
                      <button
                        onClick={() => loginWithDiscord()}
                        className="w-full py-4 bg-gradient-to-r from-[#5865F2] to-[#404eed] text-white hover:brightness-110 rounded-xl text-xs font-black tracking-widest uppercase transition-all duration-250 text-center block shadow-[0_4px_15px_rgba(88,101,242,0.25)]"
                      >
                        Login with Discord
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-[var(--bg)]/65 border border-cyan-500/20 rounded-2xl p-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(163,191,250,0.15)] font-sans">
              <p className="text-xs text-zinc-400 text-center sm:text-left leading-relaxed">
                Do you hold an official 25-character premium redeem coupon code gifted by administrators?
              </p>
              <Link
                href="/redeem/verify?category=minecraft"
                className="px-6 py-3 bg-[var(--bg)]/65 border border-cyan-500/25 rounded-xl text-xs font-black tracking-wider uppercase hover:bg-cyan-500/10 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(163,191,250,0.25)] text-white transition duration-300 no-underline flex items-center gap-1.5 shrink-0"
              >
                Apply Coupon Code <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              </Link>
            </div>

          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="max-w-5xl mx-auto space-y-12 pt-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-purple-300 font-mono">Security & Architecture</span>
            <h2 className="text-4xl font-black text-white tracking-tight uppercase">Enterprise Shield Infrastructure</h2>
            <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
              We leverage cloud-grade anti-bot protocols, secure session structures, and fully encrypted database ledgers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <div 
                key={i} 
                className="card-cyber rounded-3xl p-8 relative overflow-hidden group"
              >
                <div className="w-12 h-12 rounded-lg bg-purple-500/5 border border-purple-500/20 flex items-center justify-center mb-6 group-hover:border-cyan-400 group-hover:bg-cyan-500/5 transition-all duration-300">
                  {React.cloneElement(feat.ico, { className: 'w-6 h-6' })}
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-tight mb-2.5">{feat.title}</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="bg-gradient-to-tr from-[var(--bg2)] via-[var(--bg3)] to-[var(--bg)] border border-purple-500/20 rounded-3xl p-10 md:p-14 text-center relative overflow-hidden shadow-[0_30px_90px_rgba(183,148,244,0.1)] max-w-5xl mx-auto">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.1),transparent_70%)] pointer-events-none" />
          
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4 uppercase">Join the Premium Circle</h2>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-sm mx-auto leading-relaxed mb-8">
            Authenticate with Discord, apply 25-character codes, and claim rewards safely.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            {isAuthenticated ? (
              <a
                href="#dashboard"
                className="px-9 py-4 btn-neon-purple text-white rounded-full text-xs font-black tracking-widest uppercase hover:scale-105 transition duration-300 no-underline flex items-center gap-2"
              >
                Start Redeeming <ArrowRight className="w-3.5 h-3.5 text-white" />
              </a>
            ) : (
              <button
                onClick={() => loginWithDiscord()}
                className="px-9 py-4 btn-neon-purple text-white rounded-full text-xs font-black tracking-widest uppercase hover:scale-105 transition duration-300 flex items-center gap-2"
              >
                Login with Discord <ArrowRight className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            <Link
              href="/howitworks"
              className="px-9 py-4 bg-white/5 border border-white/10 rounded-full text-xs font-black tracking-widest uppercase text-white hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition duration-300 no-underline"
            >
              How it works →
            </Link>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="w-full bg-[var(--bg)] border-t border-white/5 py-12 relative z-20 mt-16 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-6 space-y-4">
          <div className="flex justify-center gap-6 font-semibold text-purple-300 text-[11px] mb-2">
            <Link href="/howitworks" className="hover:text-white transition duration-200 no-underline">How It Works</Link>
            <Link href="/shop" className="hover:text-white transition duration-200 no-underline">Shop</Link>
            <Link href="/about" className="hover:text-white transition duration-200 no-underline">About</Link>
            <Link href="/contact" className="hover:text-white transition duration-200 no-underline">Contact</Link>
            <Link href="/privacy" className="hover:text-white transition duration-200 no-underline">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition duration-200 no-underline">Terms</Link>
          </div>
          <p className="leading-relaxed">
            © 2026 Riwaayat • Premium Rewards Platform
          </p>
        </div>
      </footer>

      {/* DYNAMIC POPUP MODAL (GET EMAIL & USERNAME FIRST) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg bg-[var(--surface)]/95 border border-[var(--border2)] rounded-[32px] p-10 space-y-8 text-left relative shadow-[0_30px_95px_rgba(183,148,244,0.15)] backdrop-blur-3xl"
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 text-zinc-400 hover:text-white transition"
              >
                <X size={20} />
              </button>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                  Session Credentials
                </h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Authenticate your Discord details before applying the 25-character activation code.
                </p>
              </div>

              <form onSubmit={handleProceed} className="space-y-6">
                
                {/* Email Field */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-purple-300 uppercase tracking-widest block font-mono">
                    Microsoft Outlook / Email ID
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="steve@outlook.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[var(--bg)]/65 border border-purple-500/20 rounded-2xl py-3.5 px-4 pl-12 text-sm text-white focus:outline-none focus:border-cyan-400/80 transition"
                      required
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 w-5 h-5" />
                  </div>
                </div>

                {/* Username Field */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-purple-300 uppercase tracking-widest block font-mono">
                    {getUsernameLabel()}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={getUsernamePlaceholder()}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[var(--bg)]/65 border border-purple-500/20 rounded-2xl py-3.5 px-4 pl-12 text-sm text-white focus:outline-none focus:border-cyan-400/80 transition"
                      required
                    />
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 w-5 h-5" />
                  </div>
                </div>

                {/* Selective Plan Tier based on activeCategory */}
                {activeCategory === 'nitro' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-purple-300 uppercase tracking-widest block font-mono">
                      Select Nitro Plan Tier
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('Nitro Basic')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === 'Nitro Basic' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        ⚡ Nitro Basic
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('Nitro Boost')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === 'Nitro Boost' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        🚀 Nitro Boost
                      </button>
                    </div>
                  </div>
                )}

                {activeCategory === 'youtube' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-purple-300 uppercase tracking-widest block font-mono">
                      Select Subscribers Plan
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('10K Subscribers')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '10K Subscribers' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        🔴 10K Subs
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('30K Subscribers')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '30K Subscribers' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        🔥 30K Subs
                      </button>
                    </div>
                  </div>
                )}

                {activeCategory === 'roblox' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-purple-300 uppercase tracking-widest block font-mono">
                      Select Robux Card Tier
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('$50 Giftcard')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '$50 Giftcard' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        💎 $50 Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('$100 Giftcard')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '$100 Giftcard' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        👑 $100 Card
                      </button>
                    </div>
                  </div>
                )}

                {activeCategory === 'valorant' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-purple-300 uppercase tracking-widest block font-mono">
                      Select Valorant Points Tier
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('2500 Points')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '2500 Points' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        🔴 2500 VP
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('5000 Points')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '5000 Points' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        🔥 5000 VP
                      </button>
                    </div>
                  </div>
                )}

                {activeCategory === 'fortnite' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-purple-300 uppercase tracking-widest block font-mono">
                      Select V-Bucks Tier
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('2500 V-Bucks')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '2500 V-Bucks' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        ⚡ 2500 V-Bucks
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('5000 V-Bucks')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '5000 V-Bucks' 
                            ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white border-transparent shadow-[0_4px_15px_rgba(183,148,244,0.3)]' 
                            : 'bg-[var(--bg)]/65 border-white/10 text-zinc-300 hover:bg-[var(--surface)]/85 hover:border-[var(--p)]/30'
                        }`}
                      >
                        ⭐ 5000 V-Bucks
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 btn-neon-purple text-white rounded-2xl text-sm font-black tracking-widest uppercase transition duration-300 flex items-center justify-center gap-2 font-sans"
                >
                  Proceed to Secure Line <ArrowRight size={16} />
                </button>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
