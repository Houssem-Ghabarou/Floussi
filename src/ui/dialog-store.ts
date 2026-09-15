import { useState } from 'react';
import { create } from 'zustand';

import type { IconName } from './icon';

export interface DialogOptions {
  title: string;
  message?: string;
  icon?: IconName;
  /** 'danger' paints the icon and the confirm button red. */
  tone?: 'brand' | 'danger';
  confirmLabel?: string;
  /** Null shows a single button. */
  cancelLabel?: string | null;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DialogState {
  dialog: (DialogOptions & { id: number }) | null;
  close: () => void;
}

export const useDialogStore = create<DialogState>()((set) => ({
  dialog: null,
  close: () => set({ dialog: null }),
}));

/** Shows an in-app dialog (confirmation, warning or information). */
export function showDialog(options: DialogOptions) {
  useDialogStore.setState({ dialog: { ...options, id: Date.now() } });
}

/** Asks before deleting or erasing something. */
export function confirmDestructive(options: Omit<DialogOptions, 'tone'> & { onConfirm: () => void }) {
  showDialog({ tone: 'danger', icon: 'delete', cancelLabel: 'Keep', confirmLabel: 'Delete', ...options });
}

/** True once any of the values differs from what the screen started with. */
export function useUnsavedChanges(values: unknown): boolean {
  const current = JSON.stringify(values);
  const [initial] = useState(current);
  return current !== initial;
}
