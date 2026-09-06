# Security Specification — Sistema de Gestão EBD

## 1. Data Invariants
1. `User` document ID must match the authenticated `request.auth.uid`.
2. Initial role for `vitorleonardocl@gmail.com` is automatically `MASTER`. Any other newly registered user starts as `PENDING`.
3. Only `MASTER` can update user roles (`role`).
4. Users cannot elevate their own role.
5. All financial transactions must specify valid accounts (`caixa_5` or `caixa_licoes`) and types (`income` or `expense`).
6. Financial transactions created by `TESOURARIA` require approval (`status == 'pending'`). Only `MASTER` or `DIRIGENTE` can approve (`status == 'approved'`) transactions.
7. Only authenticated users with verified email and non-pending roles (`MASTER`, `DIRIGENTE`, `SECRETARIA`, `TESOURARIA`) can access operational data.
8. Unapproved (`PENDING`) users can only read their own user document.
9. Lesson orders can be created, updated, and managed by `SECRETARIA`, `DIRIGENTE`, and `MASTER`.

## 2. Dirty Dozen Payloads (Rejection Vectors)
1. **Unauthenticated Read**: Attempting to read `/transactions` without auth credentials. -> PERMISSION_DENIED
2. **Pending User Reading Transactions**: A newly signed up user with role `PENDING` attempting to list financial records. -> PERMISSION_DENIED
3. **Self Role Escalation**: User editing `/users/{uid}` to set `role: "MASTER"`. -> PERMISSION_DENIED
4. **Spoofed Master Email**: Non-verified token attempting to act as `vitorleonardocl@gmail.com`. -> PERMISSION_DENIED
5. **Direct Approval by Tesouraria**: User with role `TESOURARIA` submitting a transaction with `status: "approved"`. -> PERMISSION_DENIED
6. **Tesouraria Approving Pending**: User with role `TESOURARIA` sending update payload with `status: "approved"`. -> PERMISSION_DENIED
7. **Negative or Invalid Amount**: Transaction with `amount: -500` or non-number. -> PERMISSION_DENIED
8. **Invalid Account Target**: Transaction targeting `account: "caixa_secreto"`. -> PERMISSION_DENIED
9. **Identity Forgery on Transaction**: User 'userA' creating a transaction with `createdByUid: "userB"`. -> PERMISSION_DENIED
10. **ID Injection Attack**: Path with 2KB junk character string. -> PERMISSION_DENIED
11. **Shadow Fields Injection**: Creating a transaction with unallowed arbitrary fields like `isAdmin: true`. -> PERMISSION_DENIED
12. **Foreign Lesson Order Deletion/Modification**: Secretarial orders tampered with by unauthorized or pending users. -> PERMISSION_DENIED
