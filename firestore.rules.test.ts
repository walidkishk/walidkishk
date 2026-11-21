/**
 * Security Rules TDD Specification (Dirty Dozen Adversarial Payloads)
 * Verifies that all 12 attack vectors against /users/{userId} and
 * /users/{userId}/accounts/{accountId} are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read on user VPN account',
    operation: 'get',
    path: '/users/alice_uid/accounts/acc_1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-user profile creation attempt',
    operation: 'create',
    path: '/users/alice_uid',
    auth: { uid: 'bob_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      email: 'alice@example.com',
      displayName: 'Alice',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-user PII profile read',
    operation: 'get',
    path: '/users/alice_uid',
    auth: { uid: 'bob_uid', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-user account list scraping',
    operation: 'list',
    path: '/users/alice_uid/accounts',
    auth: { uid: 'bob_uid', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity spoofing via mismatched ownerId on create',
    operation: 'create',
    path: '/users/alice_uid/accounts/acc_1',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      id: 'acc_1',
      ownerId: 'bob_uid',
      upstreamProvisioned: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow/Ghost field injection (isAdmin: true) on UserProfile',
    operation: 'create',
    path: '/users/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      email: 'alice@example.com',
      displayName: 'Alice',
      isAdmin: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned account creation when parent /users/alice_uid does not exist',
    operation: 'create',
    path: '/users/alice_uid/accounts/acc_orphan',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      id: 'acc_orphan',
      ownerId: 'alice_uid',
      upstreamProvisioned: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID poisoning with disallowed characters and >128 char ID',
    operation: 'create',
    path: `/users/alice_uid/accounts/${'x'.repeat(160)}$bad`,
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      id: 'x'.repeat(160),
      ownerId: 'alice_uid',
      upstreamProvisioned: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Resource poisoning with oversized username (>64 chars)',
    operation: 'create',
    path: '/users/alice_uid/accounts/acc_poison',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      id: 'acc_poison',
      ownerId: 'alice_uid',
      username: 'u'.repeat(2048),
      upstreamProvisioned: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Fake VPN account injection (upstreamProvisioned: false)',
    operation: 'create',
    path: '/users/alice_uid/accounts/acc_fake',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      id: 'acc_fake',
      ownerId: 'alice_uid',
      upstreamProvisioned: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Client-forged createdAt timestamp instead of request.time',
    operation: 'create',
    path: '/users/alice_uid',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      uid: 'alice_uid',
      email: 'alice@example.com',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Immortal field mutation (modifying ownerId or username on update)',
    operation: 'update',
    path: '/users/alice_uid/accounts/acc_1',
    auth: { uid: 'alice_uid', email_verified: true },
    payload: {
      ownerId: 'alice_uid',
      username: 'hacked_username',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
];
