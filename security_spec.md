# Security Specification: STT Meeting Notes Firestore Database

This document outlines the security architecture and validation tests for the Google Cloud Firestore database used by our Speech-to-Text transcript application.

## 1. Data Invariants

- **Ownership Integrity**: A meeting document can only be read, created, updated, or deleted by its designated `ownerId` who matches the validated, authenticated Firebase Auth `request.auth.uid`. No user can access or query another user's meetings.
- **Verification Mandate**: To execute database writes, the caller's identity must be authenticated, and their email must be verified.
- **Timestamp Authenticity**: All `createdAt` and `updatedAt` timestamps must strictly leverage the authoritative server clock (`request.time`). Client-side overrides are blocked.
- **Immutable Provenance**: The fields `id`, `ownerId`, and `createdAt` are strictly read-only after creation and cannot be mutated.
- **Size Bounds**: Names, titles, transcripts, and attendee counts must have strict length or size limits to block Denials of Wallet and database resource pollution.

---

## 2. The "Dirty Dozen" Threat Payloads (Test Suite Design)

The following 12 attack vectors represent attempts to break the Laws of Identity, Integrity, and State:

1. **Owner Impersonation on Creation**: Attempting to create a meeting with `ownerId` set to a victim's user ID.
2. **Anonymous/Unauthenticated Document Creation**: Attempting to create a meeting without a valid Firebase Authentication token.
3. **Anomalous Owner Mutation**: Mutating `ownerId` on an existing meeting document to claim victim's data.
4. **Origin Timestamp Impersonation**: Attempting to create a document with a pre-dated `createdAt` timestamp from the client.
5. **Modification of Origins (Immortal Fields)**: Attempting to modify `createdAt` on update of an existing, saved meeting.
6. **Bypassing Server Timestamps on Update**: Setting `updatedAt` to a client timestamp rather than the authoritative server time.
7. **Cross-User Leak (Query Scraping)**: Attempting to list all meetings or fetch a meeting document belonging to a victim.
8. **Malicious ID Injection**: Creating a meeting document with a corrupted, path-traversing or exceptionally bloated ID (e.g. `../attacker/docs` or a 1KB string).
9. **Payload Size Exhaustion (Flood)**: Inserting a meeting with an attendees list exceeding 100 members or a title exceeding 500 characters.
10. **Type Poisoning Attack**: Passing boolean or number values to string fields like `title` or `date`.
11. **Malicious Field Injection**: Adding unmodeled properties like `isAdmin: true` or `verifiedStatus: true` on updates to check for permissive diff gates.
12. **Unauthenticated Query / Leak**: Attempting to list a query on meetings collection when logged out.

---

## 3. Test Runner Schema (firestore.rules.test.ts Outline)

```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

// Test suite confirms that all Dirty Dozen test payloads are securely blocked by returning permission denied:
describe("STT Firestore Security Rules Validation Suite", () => {
  it("rejects unauthorized access and malformed updates across all 12 vectors", async () => {
    // Assert write denials for unauthenticated/cross-tenant attacks...
    // Assert validation failures for path string overflows and dirty payloads...
  });
});
```
