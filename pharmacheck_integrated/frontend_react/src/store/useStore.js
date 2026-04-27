import { create } from 'zustand'

const useStore = create((set) => ({
  // Input
  reportText: '',
  setReportText: (text) => set({ reportText: text }),

  // API state
  isLoading: false,
  error: null,
  result: null,

  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
  setResult: (r) => set({ result: r }),

  // Map interaction
  hoveredCountry: null,
  setHoveredCountry: (c) => set({ hoveredCountry: c }),
  selectedCountry: null,
  setSelectedCountry: (c) => set({ selectedCountry: c }),

  // Active violation (for detail drawer)
  activeViolation: null,
  setActiveViolation: (v) => set({ activeViolation: v }),

  // Reset for new check
  reset: () => set({ result: null, error: null, activeViolation: null, selectedCountry: null }),
}))

export default useStore
