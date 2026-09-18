import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { AppText, Card, SheetScreen } from '@/ui/components';
import { Space } from '@/ui/theme';

/**
 * The address shown at the end of the policy. Left empty the contact section is not rendered, so a
 * placeholder can never ship by accident: fill it in before submitting to the stores.
 */
const SUPPORT_EMAIL: string = '';

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="small" tone="secondary">
        {body}
      </AppText>
    </View>
  );
}

export default function PrivacyScreen() {
  return (
    <SheetScreen title={t('privacy.title')} closeLabel={t('common.close')}>
      <AppText variant="caption" tone="muted">
        {t('privacy.updated')}
      </AppText>

      <Card>
        <AppText>{t('privacy.summary')}</AppText>
      </Card>

      <Section title={t('privacy.storedTitle')} body={t('privacy.storedBody')} />
      <Section title={t('privacy.neverTitle')} body={t('privacy.neverBody')} />
      <Section title={t('privacy.remindersTitle')} body={t('privacy.remindersBody')} />
      <Section title={t('privacy.backupsTitle')} body={t('privacy.backupsBody')} />
      <Section title={t('privacy.deleteTitle')} body={t('privacy.deleteBody')} />
      <Section title={t('privacy.storesTitle')} body={t('privacy.storesBody')} />
      <Section title={t('privacy.changesTitle')} body={t('privacy.changesBody')} />
      {SUPPORT_EMAIL ? (
        <Section title={t('privacy.contactTitle')} body={t('privacy.contactBody', { email: SUPPORT_EMAIL })} />
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Space.xs },
});
