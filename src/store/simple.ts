import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 简化的状态接口
interface SimpleAppState {
  // 基础UI状态
  theme: 'light' | 'dark' | 'auto';
  sidebarOpen: boolean;
  loading: boolean;

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
}

// 创建简化的store
export const useSimpleAppStore = create<SimpleAppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      theme: 'light',
      sidebarOpen: true,
      loading: false,

      // Actions
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'email-assist-simple-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// 导出hooks
export const useTheme = () => useSimpleAppStore((state) => state.theme);
export const useSidebar = () => useSimpleAppStore((state) => ({
  sidebarOpen: state.sidebarOpen,
  toggleSidebar: state.toggleSidebar,
}));