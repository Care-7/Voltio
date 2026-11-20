import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ConsumptionProfile, TariffConfig } from '../types/tariff';

const MAX_NAME_LENGTH = 60;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function clampNumber(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

export function normalizeInviteCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

export function generateRandomInviteCode(): string {
  const bytes = new Uint8Array(6);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const suffix = Array.from(bytes)
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join('');
  return `VOLTIO-${suffix}`;
}

export function sanitizeTariffForCloud(tariff: TariffConfig): TariffConfig {
  return {
    name: String(tariff.name ?? '').slice(0, MAX_NAME_LENGTH),
    mode: tariff.mode === 'fixed' ? 'fixed' : 'tou',
    fixedPrice: clampNumber(tariff.fixedPrice, 0, 10),
    puntaPrice: clampNumber(tariff.puntaPrice, 0, 10),
    llanoPrice: clampNumber(tariff.llanoPrice, 0, 10),
    vallePrice: clampNumber(tariff.vallePrice, 0, 10),
    powerP1Price: clampNumber(tariff.powerP1Price, 0, 10),
    powerP2Price: clampNumber(tariff.powerP2Price, 0, 10),
    samePowerPrice: Boolean(tariff.samePowerPrice),
  };
}

export function sanitizeConsumptionForCloud(
  consumption: ConsumptionProfile
): ConsumptionProfile {
  const rawPunta = clampNumber(Math.round(consumption.split.punta), 0, 100);
  const rawLlano = clampNumber(Math.round(consumption.split.llano), 0, 100);
  const rawValle = clampNumber(Math.round(consumption.split.valle), 0, 100);
  const sum = rawPunta + rawLlano + rawValle;

  let split = { punta: 25, llano: 30, valle: 45 };
  if (sum > 0) {
    const p = Math.round((rawPunta / sum) * 100);
    const l = Math.round((rawLlano / sum) * 100);
    const v = Math.max(0, 100 - p - l);
    split = { punta: p, llano: l, valle: v };
  }

  return {
    monthlyKwh: clampNumber(consumption.monthlyKwh, 0, 100000),
    powerP1Kw: clampNumber(consumption.powerP1Kw, 0, 100),
    powerP2Kw: clampNumber(consumption.powerP2Kw, 0, 100),
    samePowerKw: Boolean(consumption.samePowerKw),
    split,
    includeTaxes: Boolean(consumption.includeTaxes),
  };
}

export interface CloudProfileSnapshot {
  exists: boolean;
  hasInviteCode: boolean;
  currentTariff?: TariffConfig;
  consumption?: ConsumptionProfile;
}

export interface InviteCodeRecord {
  code: string;
  label: string;
  active: boolean;
  createdBy: string;
}

export function subscribeUserProfile(
  userId: string,
  onData: (snapshot: CloudProfileSnapshot) => void,
  onFatalError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}`;
  const docRef = doc(db, 'users', userId);

  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onData({ exists: false, hasInviteCode: false });
        return;
      }
      const data = snap.data();
      onData({
        exists: true,
        hasInviteCode: typeof data.inviteCode === 'string' && data.inviteCode.length >= 5,
        currentTariff: data.currentTariff
          ? sanitizeTariffForCloud(data.currentTariff as TariffConfig)
          : undefined,
        consumption: data.consumption
          ? sanitizeConsumptionForCloud(data.consumption as ConsumptionProfile)
          : undefined,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveUserProfileToCloud(
  userId: string,
  currentTariff: TariffConfig,
  consumption: ConsumptionProfile,
  options: {
    existsInCloud: boolean;
    inviteCode?: string;
    backfillAdminInviteCode?: boolean;
  }
): Promise<void> {
  const path = `users/${userId}`;
  const docRef = doc(db, 'users', userId);
  const safeTariff = sanitizeTariffForCloud(currentTariff);
  const safeConsumption = sanitizeConsumptionForCloud(consumption);

  if (!options.existsInCloud) {
    const safeCode = normalizeInviteCode(options.inviteCode || 'ADMIN');
    try {
      await setDoc(docRef, {
        ownerId: userId,
        inviteCode: safeCode,
        currentTariff: safeTariff,
        consumption: safeConsumption,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return;
  }

  try {
    if (options.backfillAdminInviteCode) {
      await updateDoc(docRef, {
        currentTariff: safeTariff,
        consumption: safeConsumption,
        inviteCode: 'ADMIN',
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        currentTariff: safeTariff,
        consumption: safeConsumption,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function redeemInviteCodeForUser(
  userId: string,
  rawCode: string,
  initialTariff: TariffConfig,
  initialConsumption: ConsumptionProfile
): Promise<{ ok: true } | { ok: false; reason: 'invalid_format' | 'invalid_code' | 'error' }> {
  const code = normalizeInviteCode(rawCode);
  if (code.length < 5 || code.length > 32) {
    return { ok: false, reason: 'invalid_format' };
  }

  const path = `users/${userId}`;
  const docRef = doc(db, 'users', userId);

  try {
    await setDoc(docRef, {
      ownerId: userId,
      inviteCode: code,
      currentTariff: sanitizeTariffForCloud(initialTariff),
      consumption: sanitizeConsumptionForCloud(initialConsumption),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error: unknown) {
    const firebaseCode = (error as { code?: string })?.code || '';
    const msg = error instanceof Error ? error.message : String(error);
    if (
      firebaseCode === 'permission-denied' ||
      msg.includes('Missing or insufficient permissions')
    ) {
      return { ok: false, reason: 'invalid_code' };
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- Admin Invite Code Management ---

export function subscribeInviteCodes(
  adminUid: string,
  onCodes: (codes: InviteCodeRecord[]) => void,
  onFatalError: (err: Error) => void
): Unsubscribe {
  const path = 'inviteCodes';
  const q = query(collection(db, path), where('createdBy', '==', adminUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InviteCodeRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          code: String(data.code || d.id),
          label: String(data.label || ''),
          active: Boolean(data.active),
          createdBy: String(data.createdBy || adminUid),
        };
      });
      items.sort((a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code));
      onCodes(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createInviteCode(
  adminUid: string,
  rawCode: string,
  label: string
): Promise<string> {
  const code = normalizeInviteCode(rawCode);
  if (code.length < 5 || code.length > 32) {
    throw new Error('El código debe tener entre 5 y 32 caracteres (letras, números o guiones).');
  }
  const safeLabel = label.trim().slice(0, MAX_NAME_LENGTH);
  const path = `inviteCodes/${code}`;

  try {
    await setDoc(doc(db, 'inviteCodes', code), {
      code,
      label: safeLabel,
      active: true,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleInviteCodeActive(
  code: string,
  nextActive: boolean
): Promise<void> {
  const path = `inviteCodes/${code}`;
  try {
    await updateDoc(doc(db, 'inviteCodes', code), {
      active: nextActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteInviteCode(code: string): Promise<void> {
  const path = `inviteCodes/${code}`;
  try {
    await deleteDoc(doc(db, 'inviteCodes', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
