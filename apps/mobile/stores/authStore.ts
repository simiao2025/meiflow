import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: any | null;
  isLoading: boolean;
  isProfileLoaded: boolean;
  isPasswordRecovery: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setProfile: (profile: any | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isProfileLoaded: false,
  isPasswordRecovery: false,

  setSession: (session) => set({ 
    session, 
    user: session?.user ?? null,
    isLoading: false 
  }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, isPasswordRecovery: false });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) {
      set({ isProfileLoaded: true });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      set({ profile: data, isProfileLoaded: true });
    } else {
      set({ isProfileLoaded: true });
    }
  },
}));

// Inicialização e Listener
const initAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  useAuthStore.getState().setSession(session);
  if (session) {
    await useAuthStore.getState().refreshProfile();
  } else {
    useAuthStore.setState({ isProfileLoaded: true });
  }
};

initAuth();

supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.getState().setSession(session);
  
  if (event === 'PASSWORD_RECOVERY') {
    useAuthStore.setState({ isPasswordRecovery: true, isProfileLoaded: true });
  }
  
  if (session && event !== 'PASSWORD_RECOVERY') {
    useAuthStore.getState().refreshProfile();
  }
  
  if (!session) {
    useAuthStore.setState({ isProfileLoaded: true, isPasswordRecovery: false });
  }
});
