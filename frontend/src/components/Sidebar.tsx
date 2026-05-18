'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from './AppContext';
import { Home, LayoutDashboard, Key, ShoppingBag, Trophy, Users, HelpCircle, Shield, FileText, Lock } from 'lucide-react';
import Link from 'next/link';

function Sidebar() {
  const pathname = usePathname();
  const { user } = useApp();

  const links = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Redeem', path: '/redeem/verify', icon: Key },
    { name: 'Rewards', path: '/rewards', icon: ShoppingBag },
    { name: 'Leaderboards', path: '/leaderboards', icon: Trophy },
    { name: 'Community', path: '/community', icon: Users },
    { name: 'Support', path: '/support', icon: HelpCircle }
  ];

  const adminLinks = [
    { name: 'Admin Panel', path: '/admin', icon: Shield }
  ];

  const legalLinks = [
    { name: 'Terms of Service', path: '/terms', icon: FileText },
    { name: 'Privacy Policy', path: '/privacy', icon: Lock }
  ];

  return (
    <aside className="w-full md:w-64 border-r border-black/5 bg-white/80 backdrop-blur-sm flex flex-col justify-between shrink-0 min-h-[calc(100vh-73px)]">
      {/* Links */}
      <div className="p-4 space-y-6">
        
        {/* Navigation Section */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase px-3 block mb-2">
            NAVIGATION
          </span>
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.path;
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition ${
                  active 
                    ? 'bg-black text-white' 
                    : 'text-zinc-600 hover:text-black hover:bg-black/[0.04] border border-transparent'
                }`}
              >
                <Icon size={16} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {user && (user.role === 'ADMIN' || user.role === 'MODERATOR') && (
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-red-400 tracking-widest uppercase px-3 block mb-2">
              ADMIN
            </span>
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.path;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition ${
                    active 
                      ? 'bg-red-500 text-white' 
                      : 'text-zinc-600 hover:text-black hover:bg-black/[0.04] border border-transparent'
                  }`}
                >
                  <Icon size={16} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>
        )}

      </div>

      {/* Legal links bottom */}
      <div className="p-4 border-t border-black/5 space-y-1 text-xs">
        {legalLinks.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.path;
          return (
            <Link
              key={link.path}
              href={link.path}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition ${
                active ? 'text-[#1d4ed8]' : 'text-zinc-400 hover:text-black'
              }`}
            >
              <Icon size={12} />
              <span className="text-[10px]">{link.name}</span>
            </Link>
          );
        })}
      </div>

    </aside>
  );
}

export default React.memo(Sidebar);
