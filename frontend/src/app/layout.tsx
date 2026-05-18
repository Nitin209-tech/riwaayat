import React from 'react';
import './globals.css';
import { AppProvider } from '@/components/AppContext';

export const metadata = {
  title: 'Riwaayat | Premium Gaming Rewards Platform',
  description: 'Earn coins, invite friends, and redeem premium gaming rewards — Minecraft, Discord Nitro, Roblox, and more.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
