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
    <div className="min-h-screen bg-[#ffffff] text-black selection:bg-black/10 selection:text-black font-sans overflow-x-hidden relative">
      
      {/* Minimal Background Grids & Dark Blue Orb Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.04),transparent_70%)] blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.03),transparent_70%)] blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.01),transparent_70%)] blur-[180px]" />
        
        {/* Subtle Grid overlay */}
        <div className="absolute inset-0 bg-grid opacity-50" />
      </div>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 w-full border-b border-black/5 bg-white/75 backdrop-blur-[24px] shadow-[0_1px_24px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          
          {/* Left Brand Brandmark */}
          <Link href="/" className="flex items-center gap-3 no-underline group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-black text-sm shadow-[0_4px_12px_rgba(0,0,0,0.12)] group-hover:scale-105 transition-transform duration-300">
              R
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-[0.05em] text-black">
                RIWAAYAT
              </div>
              <div className="text-[9px] text-[#1d4ed8] tracking-wider font-extrabold uppercase">
                Premium Rewards Platform
              </div>
            </div>
          </Link>

          {/* Center Links Tabs */}
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-black/70">
            <a href="#rewards" className="hover:text-black transition-colors no-underline">Rewards</a>
            <a href="#features" className="hover:text-black transition-colors no-underline">Features</a>
            <a href="#dashboard" className="hover:text-black transition-colors no-underline">Dashboard</a>
            <Link href="/howitworks" className="hover:text-black transition-colors no-underline">FAQ & Guide</Link>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-black/5 border border-black/10 rounded-full px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black">
                    {user.username.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-black/90">{user.username}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs font-bold text-black/60 bg-black/5 border border-black/10 rounded-full px-4 py-2 hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/5 transition duration-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => loginWithDiscord()}
                className="px-6 py-2.5 bg-black text-white hover:bg-zinc-800 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.1)] hover:scale-105 flex items-center gap-2"
              >
                Login with Discord
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* BODY CONTENT WRAPPER */}
      <main className="max-w-7xl mx-auto px-6 py-20 relative z-10 space-y-24">
        
        {/* HERO SECTION */}
        <section className="text-center space-y-8 max-w-4xl mx-auto relative pt-8">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[350px] bg-[radial-gradient(ellipse,rgba(0,0,0,0.01),transparent_70%)] pointer-events-none -z-10" />

          {/* Secure OAuth Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-black/[0.03] border border-black/10 rounded-full px-5 py-2 text-[10px] sm:text-xs font-bold tracking-widest uppercase text-black/80"
          >
            <Shield className="w-3.5 h-3.5 text-[#1d4ed8]" />
            Secure OAuth2 Reward Authentication
          </motion.div>

          {/* Huge Main Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-7xl lg:text-[80px] font-extrabold tracking-tight leading-[0.98] text-black"
          >
            The Ultimate<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-black via-zinc-800 to-zinc-600">
              Discord Reward
            </span><br />
            Platform.
          </motion.h1>

          {/* Description Paragraph */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs sm:text-sm md:text-base text-zinc-600 max-w-xl mx-auto leading-relaxed"
          >
            Authenticate seamlessly using Discord OAuth2, input your Minecraft outlook and desired username, and paste your 25-character promo key to activate.
          </motion.p>

          {/* Call to Action buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-4"
          >
            {isAuthenticated ? (
              <a
                href="#dashboard"
                className="relative group overflow-hidden px-10 py-5 bg-black text-white hover:bg-zinc-800 rounded-full text-xs font-black tracking-widest uppercase shadow-[0_4px_30px_rgba(0,0,0,0.12)] hover:scale-[1.05] transition-all duration-300 no-underline flex items-center gap-2"
              >
                Start Redeeming <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-200" />
              </a>
            ) : (
              <button
                onClick={() => loginWithDiscord()}
                className="relative group overflow-hidden px-10 py-5 bg-black text-white hover:bg-zinc-800 rounded-full text-xs font-black tracking-widest uppercase shadow-[0_4px_30px_rgba(0,0,0,0.12)] hover:scale-[1.05] transition-all duration-300 flex items-center gap-2"
              >
                Login with Discord <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-200" />
              </button>
            )}
            <a
              href="#dashboard"
              className="px-10 py-5 bg-black/5 border border-black/10 rounded-full text-xs font-black tracking-widest uppercase text-black hover:bg-black/10 hover:border-black/20 transition-all duration-200 no-underline"
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
              className="bg-black/[0.01] border border-black/5 rounded-2xl p-8 text-center backdrop-blur-md shadow-[0_4px_25px_rgba(0,0,0,0.02)] hover:border-black/10 transition-all duration-300"
            >
              <div className="text-4xl sm:text-5xl font-black text-black tracking-tight mb-2">
                {st.num}
              </div>
              <div className="text-xs font-bold text-[#1d4ed8] uppercase tracking-widest mb-1">
                {st.label}
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {st.desc}
              </p>
            </motion.div>
          ))}
        </section>

        {/* REDEEM DASHBOARD SECTION */}
        <section id="dashboard" className="max-w-5xl mx-auto space-y-8 pt-12">
          
          <div className="text-center space-y-2">
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#1d4ed8]">Redeem Center</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-black font-serif">Command Dashboard</h2>
            <p className="text-xs text-zinc-500">Active reward categories connected to your Discord gaming instance.</p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 sm:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.06)] relative overflow-hidden">
            
            {/* Top User Account Profile Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-zinc-100 pb-8 mb-8">
              <div className="flex items-center gap-4">
                {/* Large Premium Avatar Block with black border ring */}
                <div className="w-16 h-16 rounded-full bg-black p-[1px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-black font-bold font-mono text-xl">
                    {isAuthenticated && user ? user.username.substring(0, 2).toUpperCase() : 'RW'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold tracking-widest text-[#1d4ed8] uppercase">Connected Account</div>
                  <h3 className="text-lg font-extrabold text-black">
                    {isAuthenticated && user ? `@${user.username}` : 'Login to connect'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8] animate-ping" />
                    Verified Discord Session Active
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="bg-black/[0.01] border border-black/10 rounded-xl px-6 py-3.5 flex items-center gap-3 shrink-0">
                <Shield className="w-5 h-5 text-[#1d4ed8]" />
                <div>
                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Verification Status</div>
                  <div className="text-xs font-black text-black tracking-wide uppercase mt-0.5">
                    Level 1 Authenticated
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Large Redeem Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {redeemCards.map((card, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white border border-zinc-200/80 rounded-2xl p-6 flex flex-col justify-between hover:border-black/35 hover:shadow-[0_10px_35px_rgba(0,0,0,0.05)] transition-all duration-300 group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-14 h-14 rounded-lg bg-black/[0.01] border border-black/10 flex items-center justify-center group-hover:border-[#1d4ed8] transition-all duration-300">
                        {card.ico}
                      </div>
                      <span className="text-[10px] font-bold text-[#1d4ed8] font-mono">{card.price}</span>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-base font-extrabold text-black font-serif tracking-tight">{card.title}</h4>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 pt-4 mt-5">
                    {isAuthenticated ? (
                      <button
                        onClick={() => handleOpenRedeem(card)}
                        className="w-full py-3 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-250 text-center block"
                      >
                        Redeem Reward
                      </button>
                    ) : (
                      <button
                        onClick={() => loginWithDiscord()}
                        className="w-full py-3 bg-black/5 border border-black/10 text-black hover:bg-black/10 rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-250 text-center block"
                      >
                        Login with Discord
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-black/[0.01] border border-black/5 rounded-xl p-5 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] text-zinc-400 text-center sm:text-left leading-relaxed">
                Do you hold an official 25-character premium redeem coupon code gifted by administrators?
              </p>
              <Link
                href="/redeem/verify?category=minecraft"
                className="px-6 py-2.5 bg-black/5 border border-black/10 rounded-xl text-xs font-extrabold tracking-wider uppercase hover:bg-black/10 hover:border-black/20 text-black transition duration-300 no-underline flex items-center gap-1.5"
              >
                Apply Coupon Code <ExternalLink className="w-3 h-3 text-[#1d4ed8]" />
              </Link>
            </div>

          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="max-w-5xl mx-auto space-y-12 pt-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#1d4ed8]">Security & Architecture</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-black font-serif">Enterprise Shield Infrastructure</h2>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              We leverage cloud-grade anti-bot protocols, secure session structures, and fully encrypted database ledgers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <div 
                key={i} 
                className="bg-white border border-zinc-200/80 rounded-2xl p-8 relative overflow-hidden group hover:border-black/35 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-black/[0.01] border border-black/10 flex items-center justify-center mb-6 group-hover:border-[#1d4ed8] transition-all duration-300">
                  {feat.ico}
                </div>
                <h3 className="text-sm font-extrabold text-black tracking-tight mb-2.5">{feat.title}</h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="bg-white border border-zinc-200 rounded-2xl p-10 md:p-14 text-center relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.03)] max-w-5xl mx-auto">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(0,0,0,0.01),transparent_70%)] pointer-events-none" />
          
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-black mb-4 font-serif">Join the Premium Circle</h2>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed mb-8">
            Authenticate with Discord, apply 25-character codes, and claim rewards safely.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            {isAuthenticated ? (
              <a
                href="#dashboard"
                className="px-8 py-3.5 bg-black text-white hover:bg-zinc-800 rounded-full text-xs font-black tracking-widest uppercase hover:scale-105 transition no-underline flex items-center gap-2"
              >
                Start Redeeming <ArrowRight className="w-3.5 h-3.5 text-white group-hover:translate-x-1 transition-transform" />
              </a>
            ) : (
              <button
                onClick={() => loginWithDiscord()}
                className="px-8 py-3.5 bg-black text-white hover:bg-zinc-800 rounded-full text-xs font-black tracking-widest uppercase hover:scale-105 transition flex items-center gap-2"
              >
                Login with Discord <ArrowRight className="w-3.5 h-3.5 text-white group-hover:translate-x-1 transition-transform" />
              </button>
            )}
            <Link
              href="/howitworks"
              className="px-8 py-3.5 bg-black/5 border border-black/10 rounded-full text-xs font-black tracking-widest uppercase hover:bg-black/10 transition no-underline"
            >
              How it works →
            </Link>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="w-full bg-white border-t border-black/5 py-10 relative z-20 mt-16 text-center text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto px-6 space-y-4">
          <div className="flex justify-center gap-6 font-semibold text-zinc-500 text-[11px] mb-2">
            <Link href="/howitworks" className="hover:text-black transition no-underline">How It Works</Link>
            <Link href="/shop" className="hover:text-black transition no-underline">Shop</Link>
            <Link href="/about" className="hover:text-black transition no-underline">About</Link>
            <Link href="/contact" className="hover:text-black transition no-underline">Contact</Link>
            <Link href="/privacy" className="hover:text-black transition no-underline">Privacy</Link>
            <Link href="/terms" className="hover:text-black transition no-underline">Terms</Link>
          </div>
          <p className="leading-relaxed">
            © 2026 Riwaayat • Premium Rewards Platform
          </p>
        </div>
      </footer>

      {/* DYNAMIC POPUP MODAL (GET EMAIL & USERNAME FIRST) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-6 space-y-5 text-left relative shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-black transition"
              >
                <X size={16} />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-black uppercase tracking-tight">
                  Session Credentials
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Authenticate your gaming details before applying the 25-character activation code.
                </p>
              </div>

              <form onSubmit={handleProceed} className="space-y-4">
                
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                    Microsoft Outlook / Email ID
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="steve@outlook.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/[0.01] border border-zinc-200 rounded-lg p-3 pl-10 text-xs text-black focus:outline-none focus:border-black transition"
                      required
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                  </div>
                </div>

                {/* Username Field */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                    Gamer Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. SteveTheGamer"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-black/[0.01] border border-zinc-200 rounded-lg p-3 pl-10 text-xs text-black focus:outline-none focus:border-black transition"
                      required
                    />
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                  </div>
                </div>

                {/* Selective Plan Tier based on activeCategory */}
                {activeCategory === 'nitro' && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                      Select Nitro Plan Tier
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('Nitro Basic')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                          selectedPlan === 'Nitro Basic' 
                            ? 'bg-black text-white border-transparent' 
                            : 'bg-black/[0.01] border-zinc-200 text-zinc-600 hover:bg-black/[0.03]'
                        }`}
                      >
                        ⚡ Nitro Basic
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('Nitro Boost')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                          selectedPlan === 'Nitro Boost' 
                            ? 'bg-black text-white border-transparent' 
                            : 'bg-black/[0.01] border-zinc-200 text-zinc-600 hover:bg-black/[0.03]'
                        }`}
                      >
                        🚀 Nitro Boost
                      </button>
                    </div>
                  </div>
                )}

                {activeCategory === 'youtube' && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                      Select Subscribers Plan
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('10K Subscribers')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                          selectedPlan === '10K Subscribers' 
                            ? 'bg-black text-white border-transparent' 
                            : 'bg-black/[0.01] border-zinc-200 text-zinc-600 hover:bg-black/[0.03]'
                        }`}
                      >
                        🔴 10K Subs
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('30K Subscribers')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                          selectedPlan === '30K Subscribers' 
                            ? 'bg-black text-white border-transparent' 
                            : 'bg-black/[0.01] border-zinc-200 text-zinc-600 hover:bg-black/[0.03]'
                        }`}
                      >
                        🔥 30K Subs
                      </button>
                    </div>
                  </div>
                )}

                {activeCategory === 'roblox' && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                      Select Robux Card Tier
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('$50 Giftcard')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                          selectedPlan === '$50 Giftcard' 
                            ? 'bg-black text-white border-transparent' 
                            : 'bg-black/[0.01] border-zinc-200 text-zinc-600 hover:bg-black/[0.03]'
                        }`}
                      >
                        💎 $50 Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('$100 Giftcard')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                          selectedPlan === '$100 Giftcard' 
                            ? 'bg-black text-white border-transparent' 
                            : 'bg-black/[0.01] border-zinc-200 text-zinc-600 hover:bg-black/[0.03]'
                        }`}
                      >
                        👑 $100 Card
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-black tracking-widest uppercase transition duration-200 flex items-center justify-center gap-1.5"
                >
                  Proceed to Secure Line <ArrowRight size={14} />
                </button>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
