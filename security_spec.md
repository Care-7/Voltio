# Voltio — Security Specification (Invite-Code Access & Multi-User Isolation)

## 1. Data Invariants

1. **Admin-Only Code Management**: Only the verified admin (`c.matohuertas@gmail.com` with `email_verified == true`) can `get`, `list` (scoped by `resource.data.createdBy == request.auth.uid`), `create`, `update`, or `delete` documents in `/inviteCodes/{codeId}`.
2. **Zero Code Leakage**: Regular users and unauthenticated clients can NEVER read or list `/inviteCodes`. Code redemption is enforced exclusively inside the `/users/{userId}` `create` security rule using `exists()` + `get().data.active == true`.
3. **Private Per-User Isolation**: Any verified user who redeems a valid active invite code can create and access ONLY their own `/users/{request.auth.uid}` document. `list` on `/users` is unconditionally denied (`allow list: if false`).
4. **Immutable Ownership, Code & Creation Time**: `ownerId`, `inviteCode`, and `createdAt` cannot be modified after profile creation.
5. **Server Timestamp Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time`.
6. **Strict Schema Validation**: Both `/inviteCodes/{codeId}` and `/users/{userId}` enforce exact `hasAll` / `hasOnly` key checks, bounded string sizes, regex ID guards, and numeric range checks.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return `PERMISSION_DENIED`)

1. **Unauthenticated Read on `/users/{uid}`**: `GET` with `auth = null`.
2. **Non-Admin Listing `/inviteCodes`**: Verified regular user attempting `LIST /inviteCodes`.
3. **Non-Admin Reading `/inviteCodes/{code}`**: Verified regular user attempting `GET /inviteCodes/VOLTIO-1234`.
4. **Registration Without Valid Invite Code**: New verified user attempting `CREATE /users/{uid}` with nonexistent `inviteCode: "FAKE-0000"`.
5. **Registration With Deactivated Invite Code**: New verified user attempting `CREATE /users/{uid}` using a code whose `active == false`.
6. **Unverified Email Spoof**: User with `email = "c.matohuertas@gmail.com"`, `email_verified = false` attempting admin action or profile creation.
7. **Cross-User Read/Write**: Invited user A attempting `GET` or `UPDATE` on `/users/{userB}`.
8. **Users Collection Scraping**: Any user (including admin) attempting `LIST /users`.
9. **Shadow Field Injection**: `CREATE` or `UPDATE` injecting `isAdmin: true` into `/users/{uid}` or `/inviteCodes/{codeId}`.
10. **Immutable Field Tampering**: Invited user attempting `UPDATE` changing `ownerId`, `inviteCode`, or `createdAt`.
11. **Client-Forged Timestamp**: `CREATE` or `UPDATE` sending a forged `updatedAt` != `request.time`.
12. **Path & Value Poisoning**: `CREATE /inviteCodes/bad$code!` or `currentTariff.fixedPrice: -5` or `label` > 60 chars.
