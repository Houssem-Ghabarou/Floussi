import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { backupFileName, parseBackup, type Backup, type ParsedBackup } from '@/domain/backup';
import type { LocalDate } from '@/domain/dates';

/** Writes the backup to a file and opens the share sheet (Drive, email, Files…). */
export async function shareBackup(backup: Backup, today: LocalDate): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const file = new File(Paths.cache, backupFileName(today));
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your Flousey backup',
    UTI: 'public.json',
  });
}

/** Lets the user pick a backup file and validates it. Resolves null when they cancel. */
export async function pickBackup(): Promise<ParsedBackup | null> {
  // Cloud drives often label .json files as generic binaries, so accept any file and validate the content.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  return parseBackup(await new File(result.assets[0].uri).text());
}
