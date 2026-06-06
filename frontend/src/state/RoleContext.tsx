import { createContext, useContext, useState, type ReactNode } from 'react';

export type Role = 'retailer' | 'brand' | 'provider';

export const ROLE_LABELS: Record<Role, string> = {
  retailer: 'Data Provider',
  brand: 'Brand',
  provider: 'Model Provider',
};

interface RoleCtx {
  role: Role;
  setRole: (r: Role) => void;
}

const Ctx = createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(
    (localStorage.getItem('walcoop_role') as Role) || 'retailer',
  );
  const setRole = (r: Role) => {
    setRoleState(r);
    localStorage.setItem('walcoop_role', r);
  };
  return <Ctx.Provider value={{ role, setRole }}>{children}</Ctx.Provider>;
}

export function useRole(): RoleCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRole must be used within RoleProvider');
  return c;
}
