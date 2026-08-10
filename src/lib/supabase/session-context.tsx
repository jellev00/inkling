"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type SessionContextValue = {
  userId: string | null;
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  userId: null,
  loading: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function ensureSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        if (active) setUserId(session.user.id);
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();

      if (!active) return;
      if (error) {
        console.error("Anonieme login mislukt:", error.message);
      } else {
        setUserId(data.user?.id ?? null);
      }
      setLoading(false);
    }

    ensureSession();

    return () => {
      active = false;
    };
  }, []);

  return (
    <SessionContext.Provider value={{ userId, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
