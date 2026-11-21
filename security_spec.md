# Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Owner & Authentication Invariant**: No unauthenticated user (`request.auth == null`) may read, list, create, update, or delete any `/users/{userId}` or `/users/{userId}/accounts/{accountId}` document. Every signed-in user (via Google or Email/Password) can access strictly their own UID path (`request.auth.uid == userId`).
2. **PII Isolation Invariant**: `/users/{userId}` contains `email` and is readable/writable strictly by `request.auth.uid == userId`. No blanket `list` is permitted on `/users`.
3. **Master Gate Relational Invariant**: Every subcollection document under `/users/{userId}/accounts/{accountId}` cannot exist or be accessed unless the parent `/users/{userId}` document exists (`exists(/databases/$(database)/documents/users/$(userId))`) and `ownerId == request.auth.uid == userId`.
4. **Verified Real Account Invariant**: Stored VPN accounts must have `upstreamProvisioned == true` (verified or created directly against the configured VPN site) and conform strictly to `isValidSavedVpnAccount(incoming())` on both `create` and `update`.
5. **Immutability & Temporal Integrity Invariant**: `ownerId`, `id`, and `createdAt` are immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on create/update.
6. **Action-Based Update Invariant**: Every `update` on `/users/{userId}/accounts/{accountId}` must declare an explicit action (`toggleAutoRenew`, `updateExpiresAt`, `renameAccount`, `refreshProbe`, `renewAccount`, or `updateConnectionConfig`) with strict `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Read/Write**: `auth = null` attempting `get(/users/alice/accounts/acc1)` -> `PERMISSION_DENIED`.
2. **Cross-User Profile Overwrite**: `auth = { uid: 'bob', token: { email_verified: true } }` attempting `create(/users/alice)` -> `PERMISSION_DENIED`.
3. **Cross-User PII Read**: `auth = { uid: 'bob', token: { email_verified: true } }` attempting `get(/users/alice)` -> `PERMISSION_DENIED`.
4. **Cross-User Subcollection List**: `auth = { uid: 'bob', token: { email_verified: true } }` attempting `list(/users/alice/accounts)` -> `PERMISSION_DENIED`.
5. **Identity Spoofing on Create**: `alice` creating `/users/alice/accounts/acc1` with `ownerId: 'bob'` -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection**: `alice` creating `/users/alice` with `{ uid: 'alice', email: 'a@example.com', isAdmin: true, createdAt: serverTimestamp, updatedAt: serverTimestamp }` -> `PERMISSION_DENIED`.
7. **Orphaned Subcollection Write**: `alice` creating `/users/alice/accounts/acc1` before `/users/alice` exists -> `PERMISSION_DENIED`.
8. **ID Poisoning (1.5KB / Invalid Chars)**: `alice` creating `/users/alice/accounts/bad$id` or 200-char accountId -> `PERMISSION_DENIED`.
9. **Resource Poisoning (Oversized String)**: `alice` creating `/users/alice/accounts/acc1` with 2KB `username` or 10KB `upstreamMessage` -> `PERMISSION_DENIED`.
10. **Fake / Unverified VPN Account Injection**: `alice` creating `/users/alice/accounts/acc1` with `upstreamProvisioned: false` -> `PERMISSION_DENIED`.
11. **Client Timestamp Forgery**: `alice` creating `/users/alice/accounts/acc1` with `createdAt: Timestamp(2020-01-01)` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Immortal Field Mutation / Unauthorized Update Key**: `alice` updating `/users/alice/accounts/acc1` to mutate `ownerId`, `createdAt`, or `username` -> `PERMISSION_DENIED`.
