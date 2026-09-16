import { pickBackup, shareBackup } from '@/data/backup-file';
import { describeBackup } from '@/domain/backup';
import { t } from '@/i18n';
import { useApp } from '@/store/app-store';

import { haptics } from './components';
import { showDialog } from './dialog-store';
import { showToast } from './toast';

function showError(title: string, message: string) {
  showDialog({ icon: 'info', tone: 'danger', title, message, confirmLabel: t('common.ok'), cancelLabel: null });
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
      showError(t('backup.createError.title'), t('backup.createError.body'));
    }
  };

  const restore = async () => {
    let result;
    try {
      result = await pickBackup();
    } catch {
      showError(t('backup.pickError.title'), t('backup.pickError.body'));
      return;
    }
    if (!result) return;
    if (!result.ok) {
      showError(t('backup.restoreError.title'), result.error);
      return;
    }

    const { backup } = result;
    showDialog({
      icon: 'download',
      tone: hasData ? 'danger' : 'brand',
      title: hasData ? t('backup.replaceTitle') : t('backup.restoreTitle'),
      message: hasData ? `${describeBackup(backup)}\n\n${t('backup.replaceMessage')}` : describeBackup(backup),
      confirmLabel: hasData ? t('backup.replace') : t('backup.restore'),
      onConfirm: () => {
        importBackup(backup);
        haptics.success();
        showToast(t('backup.restored'));
        onRestored?.();
      },
    });
  };

  return { share, restore };
}
