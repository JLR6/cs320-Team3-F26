'use client';

import { createContext, useContext, useState } from 'react';
import { LoginWall } from './LoginWall';

type LoginWallContextValue = {
  openLoginWall: () => void;
};

const LoginWallContext = createContext<LoginWallContextValue | null>(null);

// Puts one login wall popup on the page and lets any component open it.
export function LoginWallProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <LoginWallContext.Provider value={{ openLoginWall: () => setOpen(true) }}>
      {children}
      <LoginWall open={open} onOpenChange={setOpen} />
    </LoginWallContext.Provider>
  );
}

// Returns { openLoginWall }, or null outside a LoginWallProvider
// (e.g. in a component test), so callers can fall back to a disabled button.
export function useLoginWall() {
  return useContext(LoginWallContext);
}
