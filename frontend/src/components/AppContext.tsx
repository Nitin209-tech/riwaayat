'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface User {
  id: string;
  discordId: string;
  username: string;
  role: string;
  coins: number;
}

interface Claim {
  id: string;
  rewardName: string;
  category: string;
  emailUsed: string;
  extraField1: string;
  deliveredPayload: string;
  claimedAt: string;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  claims: Claim[];
  coins: number;
  stats: { totalVisitors: number; claimedRewards: number };
  loginWithDiscord: () => void;
  logout: () => void;
  claimDailyCoins: () => Promise<{ success: boolean; message: string }>;
  spendCoins: (amount: number) => boolean;
  redeemRewardForm: (data: { rewardId: string; category: string; emailUsed: string; extraField1: string }) => Promise<{ success: boolean; message?: string; payload?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [coins, setCoins] = useState(0);
  const [stats, setStats] = useState({ totalVisitors: 0, claimedRewards: 0 });

  // Restore user session on mount
  useEffect(() => {
    const saved = localStorage.getItem('riwaayat_user');
    const token = localStorage.getItem('riwaayat_token');
    if (saved && token) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        setCoins(u.coins || 0);
      } catch {
        localStorage.removeItem('riwaayat_user');
        localStorage.removeItem('riwaayat_token');
      }
    }

    // Capture visitor analytics (non-blocking)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    fetch(`${API_BASE}/api/visitor`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.success) console.log('Visitor tracked:', d.visitorId);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // Handle Discord OAuth callback from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !user) {
      handleOAuthCallback(code);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOAuthCallback = async (code: string) => {
    try {
      const redirectUri = encodeURIComponent(window.location.origin + '/');
      const res = await fetch(`${API_BASE}/api/auth/callback?code=${code}&redirect_uri=${redirectUri}`);
      const data = await res.json();
      if (data.success && data.user && data.token) {
        setUser(data.user);
        setCoins(data.user.coins);
        localStorage.setItem('riwaayat_user', JSON.stringify(data.user));
        localStorage.setItem('riwaayat_token', data.token);
      } else {
        console.error('Auth failed:', data.error);
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
    }
  };

  const loginWithDiscord = () => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1505965176413880371';
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    const scope = encodeURIComponent('identify');
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    window.location.href = discordUrl;
  };

  const logout = () => {
    setUser(null);
    setCoins(0);
    setClaims([]);
    localStorage.removeItem('riwaayat_user');
    localStorage.removeItem('riwaayat_token');
  };

  const claimDailyCoins = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Please login first.' };
    
    const lastClaim = localStorage.getItem('riwaayat_daily_claim');
    const now = Date.now();
    if (lastClaim && now - parseInt(lastClaim) < 86400000) {
      return { success: false, message: 'Daily coins already claimed. Come back tomorrow!' };
    }

    setCoins(prev => {
      const next = prev + 100;
      const nextUser = { ...user, coins: next };
      setUser(nextUser);
      localStorage.setItem('riwaayat_user', JSON.stringify(nextUser));
      return next;
    });
    localStorage.setItem('riwaayat_daily_claim', String(now));
    return { success: true, message: '+100 coins added to your balance!' };
  };

  const spendCoins = (amount: number): boolean => {
    if (coins < amount) return false;
    setCoins(prev => {
      const next = prev - amount;
      if (user) {
        const nextUser = { ...user, coins: next };
        setUser(nextUser);
        localStorage.setItem('riwaayat_user', JSON.stringify(nextUser));
      }
      return next;
    });
    return true;
  };

  const redeemRewardForm = async (data: { rewardId: string; category: string; emailUsed: string; extraField1: string }) => {
    const token = localStorage.getItem('riwaayat_token') || '';
    if (!token) {
      return { success: false, message: 'Please login to redeem rewards.' };
    }

    try {
      const res = await fetch(`${API_BASE}/api/rewards/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (resData.success) {
        const newClaim: Claim = {
          id: resData.claim.id,
          rewardName: resData.claim.rewardName,
          category: data.category,
          emailUsed: data.emailUsed,
          extraField1: data.extraField1,
          deliveredPayload: resData.claim.deliveredPayload,
          claimedAt: new Date(resData.claim.claimedAt).toLocaleString()
        };
        setClaims(prev => [newClaim, ...prev]);
        setStats(prev => ({ ...prev, claimedRewards: prev.claimedRewards + 1 }));
        return { success: true, payload: resData.claim.deliveredPayload };
      } else {
        return { success: false, message: resData.error || 'Redemption failed.' };
      }
    } catch (err) {
      return { success: false, message: 'Server connection failed. Please try again later.' };
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        claims,
        coins,
        stats,
        loginWithDiscord,
        logout,
        claimDailyCoins,
        spendCoins,
        redeemRewardForm,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
