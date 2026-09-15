import { pickBackup, shareBackup } from '@/data/backup-file';
import { describeBackup } from '@/domain/backup';
import { useApp } from '@/store/app-store';

import { haptics } from './components';
import { showDialog } from './dialog-store';
import { showToast } from './toast';

function showError(title: string, message: string) {
  showDialog({ icon: 'info', tone: 'danger', title, message, confirmLabel: 'OK', cancelLabel: null });
}

/** Export and restore flows shared by the Rules tab and the welcome screen. */
export function useBackupActions({ onRestored }: { onRestored?: () => void } = {}) {
  const today = useApp((state) => state.today);
  const hasData = useApp((state) => state.settings !== null);
  const exportBackup = useApp((state) => state.exportBackup);
  const importBackup = useApp((state) => state.importBackup);

  const share = async () => {
    const backup = exportBackup();
    if (!backup) return;
    try {
      await shareBackup(backup, today);
    } catch {
      showError("Couldn't create the backup", 'Please try again.');
    }
  };

  const restore = async () => {
    let result;
    try {
      result = await pickBackup();
    } catch {
      showError("Couldn't open that file", 'Pick a Flousey backup file (.json).');
      return;
    }
    if (!result) return;
    if (!result.ok) {
      showError("Couldn't restore", result.error);
      return;
    }

    const { backup } = result;
    showDialog({
      icon: 'download',
      tone: hasData ? 'danger' : 'brand',
      title: hasData ? 'Replace your data?' : 'Restore this backup?',
      message: hasData
        ? `${describeBackup(backup)}\n\nEverything currently on this phone will be replaced.`
        : describeBackup(backup),
      confirmLabel: hasData ? 'Replace' : 'Restore',
      onConfirm: () => {
        importBackup(backup);
        haptics.success();
        showToast('Backup restored');
        onRestored?.();
      },
    });
  };

  return { share, restore };
}
