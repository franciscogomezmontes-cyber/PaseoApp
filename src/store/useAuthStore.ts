import { Session, User } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { create } from "zustand";
import { supabase } from "../lib/supabase";

interface AuthStore {
  session: Session | null;
  user: User | null;
  persona: { id: string; nombre: string; email: string } | null;
  loading: boolean;
  error: string | null;
  pendingSignup: { nombre: string; email: string } | null;
  initialize: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    nombre: string,
  ) => Promise<"ok" | "confirm_email" | "error">;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  persona: null,
  loading: true,
  error: null,
  pendingSignup: null,

  initialize: async () => {
    set({ loading: true });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      set({ session, user: session.user });
      await loadPersona(session.user.id, set);
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null });

      if (event === "SIGNED_IN" && session?.user) {
        const { data: existing } = await supabase
          .from("personas")
          .select("id, nombre, email")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        if (existing) {
          set({ persona: existing, loading: false });
        } else {
          const pending = get().pendingSignup;
          const nombre =
            pending?.nombre ?? session.user.email?.split("@")[0] ?? "Usuario";
          const email = session.user.email ?? "";

          const { data: byEmail } = await supabase
            .from("personas")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (byEmail) {
            await supabase
              .from("personas")
              .update({ auth_user_id: session.user.id, nombre })
              .eq("id", byEmail.id);
          } else {
            await supabase
              .from("personas")
              .insert({ nombre, email, auth_user_id: session.user.id });
          }

          await loadPersona(session.user.id, set);
          set({ pendingSignup: null, loading: false });
        }
      }

      if (event === "SIGNED_OUT") {
        set({ persona: null, pendingSignup: null, loading: false });
      }
    });

    AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active") {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          set({ session, user: session.user });
          const current = get();
          if (!current.persona) await loadPersona(session.user.id, set);
        }
      }
    });

    set({ loading: false });
  },

  signUp: async (email, password, nombre) => {
    set({ error: null });

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      set({ error: error.message });
      return "error";
    }

    if (!data.user) {
      set({ error: "No se pudo crear el usuario." });
      return "error";
    }

    // No session = email confirmation required
    if (!data.session) {
      set({ pendingSignup: { nombre, email } });
      return "confirm_email";
    }

    // Email confirmation disabled (dev mode) — proceed immediately
    await new Promise((r) => setTimeout(r, 500));

    const { data: byEmail } = await supabase
      .from("personas")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (byEmail) {
      await supabase
        .from("personas")
        .update({ auth_user_id: data.user.id, nombre })
        .eq("id", byEmail.id);
    } else {
      await supabase
        .from("personas")
        .insert({ nombre, email, auth_user_id: data.user.id });
    }

    await loadPersona(data.user.id, set);
    return "ok";
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    return true;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, persona: null, pendingSignup: null });
  },

  clearError: () => set({ error: null }),
}));

async function loadPersona(authUserId: string, set: any) {
  const { data } = await supabase
    .from("personas")
    .select("id, nombre, email")
    .eq("auth_user_id", authUserId)
    .single();
  if (data) set({ persona: data });
}
