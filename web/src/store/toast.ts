import { create } from "zustand"

export interface ToastItem {
  id: number
  message: string
}

interface ToastStore {
  toasts: ToastItem[]
  dismiss: (id: number) => void
}

let nextToastID = 1

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

export function toast(message: string) {
  const id = nextToastID++
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { id, message }] }))
  window.setTimeout(() => useToastStore.getState().dismiss(id), 4000)
}
