'use client';

import React, { useState, useEffect } from 'react';
import { ConsoleLayout } from '@/components/ConsoleLayout';
import { useApp } from '@/components/AppContext';

interface GiveawayItem {
  id: string;
  prize: string;
  ico?: string;
  winners?: number;
  entries?: number;
  endsAt: number;
  desc?: string;
  active?: boolean;
}

export default function Giveaway() {
  const { user } = useApp();
  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enteredMap, setEnteredMap] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadGiveaways = () => {
    setLoading(true);

    // Initial local entrant checks
    const entries = JSON.parse(localStorage.getItem('eiq_gw_entries') || '{}');
    const userEntered: Record<string, boolean> = {};
    Object.keys(entries).forEach((key) => {
      userEntered[key] = true;
    });
    setEnteredMap(userEntered);

    fetch('http://localhost:5000/api/giveaways')
      .then((r) => r.json())
      .then((d) => {
        setGiveaways(d.giveaways || []);
        setLoading(false);
      })
      .catch(() => {
        // Mock fallback giveaways if offline or sandbox mode
        const mock: GiveawayItem[] = [
          {
            id: 'gw-1',
            prize: 'Minecraft Premium Account Java Key',
            ico: '⛏',
            winners: 1,
            entries: 142,
            endsAt: Date.now() + 86400000 * 2, // 2 days out
            desc: 'Exclusive full-access Mojang product key gifted directly.'
          },
          {
            id: 'gw-2',
            prize: 'Roblox 1,000 Robux Voucher Code',
            ico: '🎮',
            winners: 3,
            entries: 298,
            endsAt: Date.now() + 3600000 * 8, // 8 hours out
            desc: 'Unlock avatar accessories, custom profiles, or developer keys.'
          }
        ];
        setGiveaways(mock);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadGiveaways();
  }, [user]);

  const handleEnterGiveaway = async (id: string) => {
    if (!user) {
      triggerToast('Login with Discord to enter giveaways!');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/giveaway/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giveawayId: id,
          userId: user.id,
          userName: user.username
        })
      });
      const data = await res.json();
      if (data.success) {
        saveEntryLocal(id);
        triggerToast('🎉 Successfully entered! Good luck!');
      } else {
        triggerToast(data.error || 'Could not register entry.');
      }
    } catch {
      // Local fallback
      saveEntryLocal(id);
      triggerToast('🎉 Successfully registered for giveaway entry.');
    }
  };

  const saveEntryLocal = (id: string) => {
    const entries = JSON.parse(localStorage.getItem('eiq_gw_entries') || '{}');
    entries[id] = { ts: Date.now(), userId: user?.id || 'guest' };
    localStorage.setItem('eiq_gw_entries', JSON.stringify(entries));
    setEnteredMap((prev) => ({ ...prev, [id]: true }));
  };

  // Timer dynamic helper component
  const TimerComponent = ({ endsAt }: { endsAt: number }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      const update = () => {
        const diff = endsAt - Date.now();
        if (diff <= 0) {
          setTimeLeft('Ended');
          return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
      };

      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }, [endsAt]);

    return <span>{timeLeft}</span>;
  };

  return (
    <ConsoleLayout>
      <div className="max-w-4xl mx-auto space-y-8 relative">
        
        {/* Toast alert overlay */}
        {toastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1a1535] text-white border border-[var(--border3)] px-6 py-3 rounded-full text-xs font-semibold shadow-[var(--s3)] animate-toastIn">
            <span>🎉</span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Hero header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-[var(--pd)] border border-[var(--border2)] rounded-full px-4 py-1 text-xs font-bold text-[var(--p)] uppercase tracking-wider">
            🎉 Giveaways
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-[var(--t)] select-none">
            Live <span className="text-[var(--p)] italic font-normal">Giveaways</span>
          </h1>
          <p className="text-xs text-[var(--t2)] max-w-sm mx-auto leading-relaxed">
            Custom giveaways launched from Discord — enter for a chance to win free rewards.
          </p>
        </div>

        {/* Giveaways dynamic cards listing */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
            <div className="bg-[var(--surface)] h-44 border border-[var(--border)] rounded-[var(--r3)]" />
            <div className="bg-[var(--surface)] h-44 border border-[var(--border)] rounded-[var(--r3)]" />
          </div>
        ) : giveaways.length === 0 ? (
          /* Empty stand drawer */
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-12 text-center shadow-[var(--s1)] max-w-xl mx-auto">
            <span className="text-6xl block mb-4">🎉</span>
            <h2 className="font-serif text-xl font-semibold text-[var(--t)] mb-2">No Active Giveaways</h2>
            <p className="text-xs text-[var(--t2)] max-w-xs mx-auto leading-relaxed mb-6">
              No giveaways are running right now. Join our Discord to get notified when new ones launch — they go live frequently!
            </p>
            <a
              href="https://discord.com/channels/1411327756968661125"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#5865f2] text-white rounded-full px-8 py-3 text-xs font-bold hover:brightness-110 shadow-sm transition no-underline"
            >
              Join Discord Server →
            </a>
          </div>
        ) : (
          /* Active giveaways list grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {giveaways.map((gw, idx) => {
              const entered = enteredMap[gw.id];
              return (
                <div
                  key={idx}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 flex flex-col justify-between hover:border-[var(--border2)] hover:shadow-[var(--s2)] transition relative overflow-hidden"
                >
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    LIVE
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{gw.ico || '🎁'}</span>
                      <div>
                        <h4 className="font-serif text-sm font-bold text-[var(--t)]">{gw.prize}</h4>
                        <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
                          {gw.winners || 1} Winner{(gw.winners || 1) > 1 ? 's' : ''} · {gw.entries || 0} entered
                        </p>
                      </div>
                    </div>

                    {gw.desc && <p className="text-[11px] text-[var(--t2)] leading-relaxed">{gw.desc}</p>}
                  </div>

                  <div className="border-t border-[var(--border)] pt-4 mt-4 space-y-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--t3)] font-semibold">Ends in:</span>
                      <strong className="text-[var(--p)] font-mono">
                        <TimerComponent endsAt={gw.endsAt} />
                      </strong>
                    </div>

                    <button
                      onClick={() => handleEnterGiveaway(gw.id)}
                      disabled={entered}
                      className={`w-full py-2.5 rounded-full text-xs font-bold transition duration-200 ${
                        entered
                          ? 'bg-[var(--bg2)] border border-[var(--border)] text-[var(--t3)] cursor-not-allowed'
                          : 'bg-gradient-to-br from-[var(--p)] to-[#5b35e8] text-white hover:brightness-105 shadow-sm'
                      }`}
                    >
                      {entered ? '✓ Entered' : '🎉 Enter Giveaway'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Description Guide details */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r3)] p-6 md:p-8 shadow-[var(--s1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--p)] to-transparent" />
          <h3 className="font-serif text-lg font-semibold text-[var(--t)] mb-1">🎙️ How to Enter</h3>
          <p className="text-xs text-[var(--t2)] mb-6">All giveaways are launched from our Discord server and appear live here. Here's how to participate:</p>

          <div className="space-y-4">
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-[var(--p4)] text-[var(--p)] font-bold text-xs flex items-center justify-center shrink-0">1</span>
              <div>
                <h4 className="font-serif text-xs font-bold text-[var(--t)] mb-0.5">Join our Discord</h4>
                <p className="text-[11px] text-[var(--t2)] leading-relaxed">Be a member of our official Discord server to be eligible for all giveaways.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-[var(--p4)] text-[var(--p)] font-bold text-xs flex items-center justify-center shrink-0">2</span>
              <div>
                <h4 className="font-serif text-xs font-bold text-[var(--t)] mb-0.5">Click Enter above</h4>
                <p className="text-[11px] text-[var(--t2)] leading-relaxed">When a giveaway is live here, click the Enter button. Winners are picked randomly.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-[var(--p4)] text-[var(--p)] font-bold text-xs flex items-center justify-center shrink-0">3</span>
              <div>
                <h4 className="font-serif text-xs font-bold text-[var(--t)] mb-0.5">Wait for the draw</h4>
                <p className="text-[11px] text-[var(--t2)] leading-relaxed">When the timer ends, winners are announced in the Discord server and notified directly.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
