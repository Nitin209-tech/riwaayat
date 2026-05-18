'use client';

import React from 'react';

function Disclaimer() {
  return (
    <footer className="w-full py-6 px-6 border-t border-black/5 bg-white text-center font-mono text-[10px] text-zinc-400">
      <div className="max-w-4xl mx-auto leading-relaxed">
        Riwaayat is an independent community platform and is not affiliated with third-party brands or services referenced on the platform.
        <span className="block mt-1">© 2026 Riwaayat Rewards. All rights reserved.</span>
      </div>
    </footer>
  );
}

export default React.memo(Disclaimer);
