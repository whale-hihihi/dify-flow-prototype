import { create } from 'zustand';

interface GeneratorMessage {
  role: 'ai' | 'user';
  text: string;
}

interface GeneratorState {
  step: number;
  messages: GeneratorMessage[];
  yamlOutput: string;
  setStep: (step: number) => void;
  addMessage: (msg: GeneratorMessage) => void;
  setYamlOutput: (yaml: string) => void;
  reset: () => void;
}

export const useGeneratorStore = create<GeneratorState>((set) => ({
  step: -1,
  messages: [],
  yamlOutput: '',

  setStep: (step) => set({ step }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setYamlOutput: (yamlOutput) => set({ yamlOutput }),
  reset: () => set({ step: -1, messages: [], yamlOutput: '' }),
}));
