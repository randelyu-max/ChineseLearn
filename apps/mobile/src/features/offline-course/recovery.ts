import type { AttemptDraft } from '@hanziquest/contracts';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { DemoCourseState } from '@/features/demo-course';
import {
  ACTIVE_DEMO_SESSION_ID,
  createSessionSnapshot,
  getOfflineStore,
  type JsonValue,
} from '@/features/offline-storage';

import { parseRecoveredCourse } from './model';

const legacyKey = 'hanziquest.offline-course.v1';

async function readLegacyCourse(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(legacyKey);
  }
  return SecureStore.getItemAsync(legacyKey);
}

async function removeLegacyCourse(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(legacyKey);
    return;
  }
  await SecureStore.deleteItemAsync(legacyKey);
}

function snapshot(state: DemoCourseState) {
  return createSessionSnapshot(
    ACTIVE_DEMO_SESSION_ID,
    state as unknown as JsonValue,
    new Date().toISOString(),
  );
}

export async function loadRecoveredCourse(): Promise<DemoCourseState> {
  const store = await getOfflineStore();
  const recovered = await store.getSessionSnapshot(ACTIVE_DEMO_SESSION_ID);
  if (recovered) return parseRecoveredCourse(JSON.stringify(recovered.payload));

  const legacy = await readLegacyCourse();
  const state = parseRecoveredCourse(legacy);
  await store.saveSessionSnapshot(snapshot(state));
  if (legacy) await removeLegacyCourse();
  return state;
}

export async function saveRecoveredCourse(state: DemoCourseState): Promise<void> {
  const store = await getOfflineStore();
  await store.saveSessionSnapshot(snapshot(state));
}

export async function saveAttemptAndRecoveredCourse(
  attempt: AttemptDraft,
  state: DemoCourseState,
): Promise<'duplicate' | 'inserted'> {
  const store = await getOfflineStore();
  return store.saveAttemptAndSession(attempt, snapshot(state));
}

export async function cacheDemoCourseContent(payload: JsonValue): Promise<void> {
  const store = await getOfflineStore();
  await store.cacheContent({
    schemaVersion: 'content-cache-v1',
    contentVersion: 'home-demo-1.0.0',
    contentSchemaVersion: 'curriculum-package-v1',
    payload,
    cachedAt: new Date().toISOString(),
  });
}
