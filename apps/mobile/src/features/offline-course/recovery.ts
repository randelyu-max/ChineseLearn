import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { DemoCourseState } from '@/features/demo-course';
import { parseRecoveredCourse } from './model';

const key = 'hanziquest.offline-course.v1';

export async function loadRecoveredCourse(): Promise<DemoCourseState> {
  const raw =
    Platform.OS === 'web'
      ? typeof localStorage === 'undefined'
        ? null
        : localStorage.getItem(key)
      : await SecureStore.getItemAsync(key);
  return parseRecoveredCourse(raw);
}

export async function saveRecoveredCourse(state: DemoCourseState): Promise<void> {
  const value = JSON.stringify(state);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}
