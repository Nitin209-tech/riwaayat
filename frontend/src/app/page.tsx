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
  const [activeCategory, setActiveCategory] = useState<'minecraft' | 'youtube' | 'roblox' | 'nitro'>('minecraft');
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
      ico: <Gamepad2 className="w-8 h-8 text-[#1d4ed8]" />,
      desc: 'Claim official premium Java/Bedrock accounts gift card codes directly activated on Microsoft portal.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: 'Premium Account'
    },
    {
      category: 'youtube',
      title: 'YouTube Subscribers',
      ico: <Tv className="w-8 h-8 text-[#1d4ed8]" />,
      desc: 'Redeem 10K or 30K active subscribers directly delivered to your YouTube channel profile safely.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: '10K Subscribers'
    },
    {
      category: 'roblox',
      title: 'Roblox Giftcards',
      ico: <Sparkles className="w-8 h-8 text-[#1d4ed8]" />,
      desc: 'Redeem official $50 or $100 Robux gift card codes directly activated on Roblox billing portal.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: '$50 Giftcard'
    },
    {
      category: 'nitro',
      title: 'Discord Nitro',
      ico: <Award className="w-8 h-8 text-[#1d4ed8]" />,
      desc: 'Redeem official Discord Nitro Basic or Nitro Boost activation links with zero service cooldowns.',
      price: 'Requires 25-Char Promo Code',
      defaultPlan: 'Nitro Boost'
    }
  ];

  const features = [
    { 
      ico: <Shield className="w-6 h-6 text-[#1d4ed8]" />, 
      title: 'Discord OAuth2 Authentication', 
      desc: '100% secure connection verified by official Discord API. We never see or store your private gaming passwords.' 
    },
    { 
      ico: <CheckCircle className="w-6 h-6 text-[#1d4ed8]" />, 
      title: '25-Character Validation', 
      desc: 'Apply secure alpha-numeric promotion keys to check inventory stock and initiate secure activation queues.' 
    },
    { 
      ico: <CheckCircle className="w-6 h-6 text-[#1d4ed8]" />, 
      title: 'Modern Telemetry Dashboard', 
      desc: 'Track claim histories, active validation channels, and invite counters in an elegant glassmorphic UI.' 
    }
  ];

  const handleOpenRedeem = (card: typeof redeemCards[0]) => {
    setActiveCategory(card.category as any);
    setSelectedPlan(card.defaultPlan);
    setEmail('');
    setUsername('');
    setShowModal(true);
  };

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !username) return;
    
    // Redirect to unified verify page with credential parameters
    window.location.href = `/redeem/verify?category=${activeCategory}&email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&plan=${encodeURIComponent(selectedPlan)}`;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/20 selection:text-white font-sans overflow-x-hidden relative">
      
      {/* Premium Cyberpunk Background Grids & Chromatic Orb Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.04),transparent_70%)] blur-[120px]" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.03),transparent_70%)] blur-[150px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.02),transparent_70%)] blur-[180px]" />
        
        {/* Subtle Tech Grid overlay */}
        <div className="absolute inset-0 bg-grid opacity-[0.08]" />
      </div>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#09090b]/75 backdrop-blur-[24px] shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="max-w-7xl mx-auto px-6 h-[80px] flex items-center justify-between">
          
          {/* Left Brand Brandmark */}
          <Link href="/" className="flex items-center gap-3.5 no-underline group shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-zinc-700 to-zinc-500 text-white flex items-center justify-center font-black text-base shadow-[0_0_20px_rgba(255,255,255,0.05)] group-hover:scale-105 transition-transform duration-300">
              R
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-[0.08em] text-white uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
                RIWAAYAT
              </div>
              <div className="text-[9px] text-zinc-400 tracking-widest font-extrabold uppercase">
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
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-500 text-white flex items-center justify-center text-[10px] font-black">
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[350px] bg-[radial-gradient(ellipse,rgba(99,102,241,0.05),transparent_70%)] pointer-events-none -z-10" />

          {/* Secure OAuth Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-6 py-2.5 text-[10px] sm:text-xs font-bold tracking-widest uppercase text-zinc-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
          >
            <Shield className="w-3.5 h-3.5 text-zinc-400" />
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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-300 to-zinc-600">
              Discord Reward
            </span><br />
            Platform.
          </motion.h1>

          {/* Description Paragraph */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs sm:text-sm md:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed"
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
                className="relative group overflow-hidden px-12 py-5 bg-gradient-to-r from-zinc-700 to-zinc-500 text-white hover:brightness-110 rounded-full text-xs font-black tracking-widest uppercase shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:scale-[1.05] transition-all duration-300 no-underline flex items-center gap-2"
              >
                Start Redeeming <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-200" />
              </a>
            ) : (
              <button
                onClick={() => loginWithDiscord()}
                className="relative group overflow-hidden px-12 py-5 bg-gradient-to-r from-zinc-700 to-zinc-500 text-white hover:brightness-110 rounded-full text-xs font-black tracking-widest uppercase shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:scale-[1.05] transition-all duration-300 flex items-center gap-2"
              >
                Login with Discord <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-200" />
              </button>
            )}
            <a
              href="#dashboard"
              className="px-12 py-5 bg-white/5 border border-white/10 rounded-full text-xs font-black tracking-widest uppercase text-white hover:bg-white/15 hover:border-white/20 transition-all duration-200 no-underline"
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
              className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 text-center backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.4)] hover:border-zinc-500/30 transition-all duration-300 relative group"
            >
              {/* Corner tech lines */}
              <div className="absolute top-0 left-0 w-4 h-[1px] bg-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 left-0 w-[1px] h-4 bg-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 right-0 w-4 h-[1px] bg-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 right-0 w-[1px] h-4 bg-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="text-4xl sm:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400 tracking-tight mb-2">
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

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 sm:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.8)] relative overflow-hidden backdrop-blur-2xl">
            
            {/* Top User Account Profile Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-white/5 pb-8 mb-8">
              <div className="flex items-center gap-4">
                {/* Large Premium Avatar Block with gradient border ring */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-500 p-[1.5px] shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                  <div className="w-full h-full rounded-full bg-[#09090b] flex items-center justify-center text-white font-bold font-mono text-xl">
                    {isAuthenticated && user ? user.username.substring(0, 2).toUpperCase() : 'RW'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold tracking-widest text-zinc-400 uppercase font-mono">Connected Account</div>
                  <h3 className="text-xl font-black text-white">
                    {isAuthenticated && user ? `@${user.username}` : 'Login to connect'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                    <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
                    Verified Discord Session Active
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-3 shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <Shield className="w-5 h-5 text-zinc-400" />
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
                  className="bg-white/[0.02] border border-white/5 rounded-3xl p-7 flex flex-col justify-between hover:border-zinc-500/40 hover:shadow-[0_15px_45px_rgba(255,255,255,0.02)] transition-all duration-300 group"
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-zinc-400 transition-all duration-300">
                        {React.cloneElement(card.ico, { className: 'w-7 h-7 text-zinc-400' })}
                      </div>
                      <span className="text-[10px] font-black text-white font-mono tracking-wider bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1">{card.price}</span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-black text-white uppercase tracking-tight">{card.title}</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-5 mt-6">
                    {isAuthenticated ? (
                      <button
                        onClick={() => handleOpenRedeem(card)}
                        className="w-full py-4 bg-gradient-to-r from-zinc-700 to-zinc-500 text-white hover:brightness-110 rounded-xl text-xs font-black tracking-widest uppercase transition-all duration-250 text-center block shadow-[0_4px_15px_rgba(255,255,255,0.05)]"
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
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] font-sans">
              <p className="text-xs text-zinc-400 text-center sm:text-left leading-relaxed">
                Do you hold an official 25-character premium redeem coupon code gifted by administrators?
              </p>
              <Link
                href="/redeem/verify?category=minecraft"
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black tracking-wider uppercase hover:bg-white/15 hover:border-white/20 text-white transition duration-300 no-underline flex items-center gap-1.5 shrink-0"
              >
                Apply Coupon Code <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </Link>
            </div>

          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="max-w-5xl mx-auto space-y-12 pt-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-zinc-400 font-mono">Security & Architecture</span>
            <h2 className="text-4xl font-black text-white tracking-tight uppercase">Enterprise Shield Infrastructure</h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              We leverage cloud-grade anti-bot protocols, secure session structures, and fully encrypted database ledgers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <div 
                key={i} 
                className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 relative overflow-hidden group hover:border-zinc-500/40 hover:shadow-[0_15px_45px_rgba(255,255,255,0.02)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:border-zinc-500 transition-all duration-300">
                  {React.cloneElement(feat.ico, { className: 'w-6 h-6 text-zinc-400' })}
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-tight mb-2.5">{feat.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="bg-gradient-to-tr from-[#09090b] to-[#121217] border border-white/5 rounded-3xl p-10 md:p-14 text-center relative overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.8)] max-w-5xl mx-auto">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(255,255,255,0.02),transparent_70%)] pointer-events-none" />
          
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4 uppercase">Join the Premium Circle</h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed mb-8">
            Authenticate with Discord, apply 25-character codes, and claim rewards safely.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            {isAuthenticated ? (
              <a
                href="#dashboard"
                className="px-9 py-4 bg-gradient-to-r from-zinc-700 to-zinc-500 text-white hover:brightness-110 rounded-full text-xs font-black tracking-widest uppercase hover:scale-105 transition duration-300 no-underline flex items-center gap-2"
              >
                Start Redeeming <ArrowRight className="w-3.5 h-3.5 text-white" />
              </a>
            ) : (
              <button
                onClick={() => loginWithDiscord()}
                className="px-9 py-4 bg-gradient-to-r from-zinc-700 to-zinc-500 text-white hover:brightness-110 rounded-full text-xs font-black tracking-widest uppercase hover:scale-105 transition duration-300 flex items-center gap-2"
              >
                Login with Discord <ArrowRight className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            <Link
              href="/howitworks"
              className="px-9 py-4 bg-white/5 border border-white/10 rounded-full text-xs font-black tracking-widest uppercase text-white hover:bg-white/15 hover:border-white/20 transition duration-300 no-underline"
            >
              How it works →
            </Link>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="w-full bg-[#09090b] border-t border-white/5 py-12 relative z-20 mt-16 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-6 space-y-4">
          <div className="flex justify-center gap-6 font-semibold text-zinc-400 text-[11px] mb-2">
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
              className="w-full max-w-lg bg-[#0f0f13] border border-white/10 rounded-[32px] p-10 space-y-8 text-left relative shadow-[0_30px_90px_rgba(0,0,0,0.85)]"
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
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Authenticate your gaming details before applying the 25-character activation code.
                </p>
              </div>

              <form onSubmit={handleProceed} className="space-y-6">
                
                {/* Email Field */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                    Microsoft Outlook / Email ID
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="steve@outlook.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-4.5 pl-13 text-sm text-white focus:outline-none focus:border-zinc-500/80 transition"
                      required
                    />
                    <Mail className="absolute left-4.5 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                  </div>
                </div>

                {/* Username Field */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                    Gamer Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. SteveTheGamer"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-4.5 pl-13 text-sm text-white focus:outline-none focus:border-zinc-500/80 transition"
                      required
                    />
                    <User className="absolute left-4.5 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                  </div>
                </div>

                {/* Selective Plan Tier based on activeCategory */}
                {activeCategory === 'nitro' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                      Select Nitro Plan Tier
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('Nitro Basic')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === 'Nitro Basic' 
                            ? 'bg-gradient-to-r from-zinc-700 to-zinc-500 text-white border-transparent shadow-[0_4px_12px_rgba(255,255,255,0.05)]' 
                            : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        ⚡ Nitro Basic
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('Nitro Boost')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === 'Nitro Boost' 
                            ? 'bg-gradient-to-r from-zinc-700 to-zinc-500 text-white border-transparent shadow-[0_4px_12px_rgba(255,255,255,0.05)]' 
                            : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        🚀 Nitro Boost
                      </button>
                    </div>
                  </div>
                )}

                {activeCategory === 'youtube' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                      Select Subscribers Plan
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('10K Subscribers')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '10K Subscribers' 
                            ? 'bg-gradient-to-r from-zinc-700 to-zinc-500 text-white border-transparent shadow-[0_4px_12px_rgba(255,255,255,0.05)]' 
                            : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        🔴 10K Subs
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('30K Subscribers')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '30K Subscribers' 
                            ? 'bg-gradient-to-r from-zinc-700 to-zinc-500 text-white border-transparent shadow-[0_4px_12px_rgba(255,255,255,0.05)]' 
                            : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        🔥 30K Subs
                      </button>
                    </div>
                  </div>
                )}

                {activeCategory === 'roblox' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                      Select Robux Card Tier
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('$50 Giftcard')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '$50 Giftcard' 
                            ? 'bg-gradient-to-r from-zinc-700 to-zinc-500 text-white border-transparent shadow-[0_4px_12px_rgba(255,255,255,0.05)]' 
                            : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        💎 $50 Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('$100 Giftcard')}
                        className={`py-3.5 px-4 rounded-2xl border text-xs font-bold transition duration-200 ${
                          selectedPlan === '$100 Giftcard' 
                            ? 'bg-gradient-to-r from-zinc-700 to-zinc-500 text-white border-transparent shadow-[0_4px_12px_rgba(255,255,255,0.05)]' 
                            : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        👑 $100 Card
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-4.5 bg-gradient-to-r from-zinc-700 to-zinc-500 text-white hover:brightness-110 rounded-2xl text-sm font-black tracking-widest uppercase transition duration-300 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,255,255,0.05)] font-sans"
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
