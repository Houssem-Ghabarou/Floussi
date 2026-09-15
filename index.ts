import 'expo-router/entry';

import { Platform } from 'react-native';

// Android home-screen widgets render in a background task that needs to be registered at startup.
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/android/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
