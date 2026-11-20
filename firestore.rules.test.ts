/**
 * Security Rules Verification Spec for Voltio (/inviteCodes/{codeId} & /users/{userId})
 * Verifies all 12 Dirty Dozen adversarial payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedBy: string;
}

const VALID_TARIFF = {
  name: 'Mi tarifa',
  mode: 'tou',
  fixedPrice: 0.14,
  puntaPrice: 0.195,
  llanoPrice: 0.145,
  vallePrice: 0.105,
  powerP1Price: 0.098,
  powerP2Price: 0.035,
  samePowerPrice: false,
};

const VALID_CONSUMPTION = {
  monthlyKwh: 260,
  powerP1Kw: 4.6,
  powerP2Kw: 4.6,
  samePowerKw: true,
  split: { punta: 25, llano: 30, valle: 45 },
  includeTaxes: true,
};

const FRIEND_AUTH = {
  uid: 'friend_uid_1',
  email: 'amigo@example.com',
  email_verified: true,
};

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read on user profile',
    operation: 'get',
    path: '/users/friend_uid_1',
    auth: null,
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedOwner(userId)',
  },
  {
    id: 2,
    name: 'Non-admin listing invite codes',
    operation: 'list',
    path: '/inviteCodes',
    auth: FRIEND_AUTH,
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if isAdmin() && existing().createdBy == request.auth.uid',
  },
  {
    id: 3,
    name: 'Non-admin direct read of invite code',
    operation: 'get',
    path: '/inviteCodes/VOLTIO-1234',
    auth: FRIEND_AUTH,
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'allow get: if isAdmin() && isValidInviteCode(codeId)',
  },
  {
    id: 4,
    name: 'Profile creation with nonexistent invite code',
    operation: 'create',
    path: '/users/friend_uid_1',
    auth: FRIEND_AUTH,
    payload: {
      ownerId: 'friend_uid_1',
      inviteCode: 'FAKE-0000',
      currentTariff: VALID_TARIFF,
      consumption: VALID_CONSUMPTION,
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'exists(/databases/$(database)/documents/inviteCodes/$(incoming().inviteCode))',
  },
  {
    id: 5,
    name: 'Profile creation with deactivated invite code',
    operation: 'create',
    path: '/users/friend_uid_1',
    auth: FRIEND_AUTH,
    payload: {
      ownerId: 'friend_uid_1',
      inviteCode: 'DISABLED-9999',
      currentTariff: VALID_TARIFF,
      consumption: VALID_CONSUMPTION,
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'get(.../inviteCodes/...).data.active == true',
  },
  {
    id: 6,
    name: 'Admin email spoofing with unverified email',
    operation: 'create',
    path: '/inviteCodes/HACKED-1234',
    auth: { uid: 'spoof_uid', email: 'c.matohuertas@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isAdmin() -> email_verified == true',
  },
  {
    id: 7,
    name: 'Cross-user profile read',
    operation: 'get',
    path: '/users/other_friend_uid',
    auth: FRIEND_AUTH,
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'request.auth.uid == userId',
  },
  {
    id: 8,
    name: 'Users collection enumeration',
    operation: 'list',
    path: '/users',
    auth: FRIEND_AUTH,
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if false',
  },
  {
    id: 9,
    name: 'Shadow field injection on user profile',
    operation: 'create',
    path: '/users/friend_uid_1',
    auth: FRIEND_AUTH,
    payload: {
      ownerId: 'friend_uid_1',
      inviteCode: 'VOLTIO-1234',
      currentTariff: VALID_TARIFF,
      consumption: VALID_CONSUMPTION,
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidUserEnergyProfile -> data.keys().hasOnly(...)',
  },
  {
    id: 10,
    name: 'Immutable inviteCode tampering on update',
    operation: 'update',
    path: '/users/friend_uid_1',
    auth: FRIEND_AUTH,
    payload: { inviteCode: 'ADMIN' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().inviteCode == existing().inviteCode && affectedKeys().hasOnly(...)',
  },
  {
    id: 11,
    name: 'Client-forged updatedAt timestamp',
    operation: 'update',
    path: '/users/friend_uid_1',
    auth: FRIEND_AUTH,
    payload: { currentTariff: VALID_TARIFF, updatedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().updatedAt == request.time',
  },
  {
    id: 12,
    name: 'Path ID & value poisoning on invite code',
    operation: 'create',
    path: '/inviteCodes/bad$code!',
    auth: { uid: 'admin_uid', email: 'c.matohuertas@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidInviteCode(codeId)',
  },
];
