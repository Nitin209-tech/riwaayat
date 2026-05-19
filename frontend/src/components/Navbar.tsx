'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from './AppContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Navbar() {
  const { user, loginWithDiscord, logout } = useApp();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const navItems = useMemo(() => [
    { label: 'Home', path: '/' },
    { label: 'Redeem Rewards', path: '/#dashboard' },
    { label: 'FAQ & Guide', path: '/howitworks' }
  ], []);

  return (
    <>
      <nav className="sticky top-0 z-50 h-16 flex items-center px-5 md:px-8 bg-white/75 border-b border-black/5 shadow-[0_1px_24px_rgba(0,0,0,0.02)] backdrop-blur-2xl">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
          
          {/* Brand Mark */}
          <Link href="/" className="flex items-center gap-2.5 no-underline group">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm shadow-[0_4px_12px_rgba(0,0,0,0.12)] group-hover:scale-105 transition-transform duration-300">
              R
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-wider text-black">
                RIWAAYAT
              </div>
              <div className="text-[8px] text-zinc-500 tracking-widest font-extrabold uppercase">
                Premium Rewards Platform
              </div>
            </div>
          </Link>

          {/* Desktop Nav Tabs */}
          <div className="hidden md:flex items-center gap-1 bg-black/[0.02] border border-black/5 rounded-full p-0.5 ml-5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition duration-250 ${
                  isActive(item.path)
                    ? 'text-white bg-black font-semibold'
                    : 'text-black/60 hover:text-black hover:bg-black/[0.04]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex-1 md:flex-none" />

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            
            {/* Auth panel info */}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 border-l border-black/10 pl-3">
                  <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center font-mono font-bold text-xs uppercase">
                    {user.username.substring(0, 2)}
                  </div>
                  <span className="text-xs font-bold text-black/80 max-w-[100px] truncate">{user.username}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs font-bold text-black/60 bg-black/5 border border-black/10 rounded-full px-3.5 py-1.5 hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/5 transition duration-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithDiscord}
                className="px-5 py-2 bg-black text-white hover:bg-zinc-800 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:scale-105 flex items-center gap-2"
              >
                Login with Discord
              </button>
            )}

            {/* Mobile hamburger menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 rounded-full bg-black/5 border border-black/5 flex flex-col gap-1 items-center justify-center p-2 cursor-pointer transition"
              aria-label="Toggle Navigation Menu"
            >
              <span className={`block w-4 h-0.5 bg-black/80 transition duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block w-4 h-0.5 bg-black/80 transition duration-300 ${mobileMenuOpen ? 'opacity-0 scale-0' : ''}`} />
              <span className={`block w-4 h-0.5 bg-black/80 transition duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </button>

          </div>
        </div>
      </nav>

      {/* Mobile Drawer menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-white border-b border-black/5 p-3 flex flex-col gap-1 shadow-md animate-slideDown">
          <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1">MAIN NAVIGATION</div>
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive(item.path)
                  ? 'text-white bg-black'
                  : 'text-black/70 hover:bg-black/[0.04]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default React.memo(Navbar);
