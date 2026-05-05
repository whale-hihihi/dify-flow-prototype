import { create } from 'zustand';

export interface GeneratorMessage {
  role: 'ai' | 'user';
  text: string;
  options?: string[];
}

interface GeneratorState {
  sessionId: string;
  messages: GeneratorMessage[];
  dsl: string;
  loading: boolean;
  options: string[];
  chatState: string;
  setSessionId: (id: string) => void;
  addMessage: (msg: GeneratorMessage) => void;
  setDsl: (dsl: string) => void;
  setLoading: (loading: boolean) => void;
  setOptions: (options: string[]) => void;
  setChatState: (state: string) => void;
  reset: () => void;
}

export const useGeneratorStore = create<GeneratorState>((set) => ({
  sessionId: '',
  messages: [],
  dsl: '',
  loading: false,
  options: [],
  chatState: 'idle',

  setSessionId: (sessionId) => set({ sessionId }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setDsl: (dsl) => set({ dsl }),
  setLoading: (loading) => set({ loading }),
  setOptions: (options) => set({ options }),
  setChatState: (chatState) => set({ chatState }),
  reset: () => set({ sessionId: '', messages: [], dsl: '', loading: false, options: [], chatState: 'idle' }),
}));
