# FitCore Enterprise — Production Architecture Blueprint

## 1) Architecture Overview

### Execution Model
- **Start:** Modular monolith (NestJS + TypeScript) with strict module boundaries.
- **Scale path:** Extract high-throughput domains into microservices (Billing, Access, Booking) when required.

### Core Modules (Bounded Contexts)
1. Identity & Access (Auth, RBAC, sessions, MFA)
2. Tenant Management (tenants, branches, zones)
3. Membership & Billing (plans, subscriptions, invoices, payments, webhooks)
4. Access Control (dynamic QR, check-ins, RFID/biometric adapters)
5. Booking & Scheduling (classes, PT sessions, waitlist, penalties)
6. Staff & Payroll (shifts, attendance, commission)
7. POS & Inventory (catalog, stock, orders)
8. Analytics & Reporting (aggregations, KPI dashboards)
9. Notifications (email/SMS/push)
10. File Service (invoice PDFs, media on S3)

### Tenant Isolation
- Shared PostgreSQL with mandatory `tenant_id` on tenant-scoped tables.
- PostgreSQL **RLS** + app-layer tenant guards.
- JWT includes: `tenant_id`, `branch_ids`, `role`, `permissions`.
- Immutable audit trail for privileged operations.

### Infrastructure
- API gateway + NestJS app + worker processes.
- PostgreSQL + Redis + BullMQ.
- Stripe/Razorpay webhooks -> idempotency table -> async processor.
- OpenTelemetry traces + Prometheus metrics + Grafana dashboards.
- Docker deployment (ECS/Kubernetes compatible).

---

## 2) ERD Model (Normalized)

```text
[tenants] 1---N [branches] 1---N [zones]
                 |             |
                 |             +---N [checkins]
                 |
                 +---N [members] 1---N [member_subscriptions] 1---N [invoices] 1---N [payments]
                 |                    |
                 |                    +---N [access_tokens]
                 |
                 +---N [staff]
                 |
                 +---N [class_templates] 1---N [class_sessions] 1---N [class_bookings]
                                                     |
                                                     +---N [waitlist_entries]
                 |
                 +---N [products] 1---N [inventory_items] 1---N [stock_movements]
                 |
                 +---N [pos_orders] 1---N [pos_order_items]
```

### Security/Platform Entities
- `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
- `refresh_tokens`, `audit_logs`, `idempotency_keys`, `outbox_events`
- `payment_webhook_events`

---

## 3) Concurrency & Race Condition Blueprint

### A. Last-slot booking
1. Begin DB transaction.
2. `SELECT ... FOR UPDATE` on `class_sessions.id = :sessionId`.
3. If `booked_count < capacity`, insert booking and increment count atomically.
4. Else insert `waitlist_entries`.
5. Commit.

### B. Distributed multi-instance lock
- Acquire Redis lock: `SET lock:class:{sessionId} value NX PX 3000`.
- Perform DB transaction with row lock as source of truth.
- Release lock with token-safe unlock script.

### C. Idempotency
- Require `Idempotency-Key` header for booking/check-in/payment mutation routes.
- Persist request hash + response payload.
- Return stored response for retries with same key.

### D. Webhook resiliency
- Unique `(provider, event_id)`.
- Retry policy with exponential backoff.
- Dead-letter state after max retries.

### E. Dynamic QR anti-sharing
- Token basis: `HMAC_SHA256(user_secret, floor(server_time/15s), nonce)`.
- Validate ±1 time window for drift.
- Mark nonce as consumed in Redis to prevent replay.

---

## 4) Security & Compliance Checklist

- PCI-DSS scope minimization (provider tokenization only; no raw PAN storage).
- Signed webhook verification (Stripe/Razorpay secret) and optional IP allowlist.
- Access token short TTL + refresh token rotation + device binding.
- Redis rate limiting on login/check-in/booking/webhook endpoints.
- Tenant-scoped RLS policy and guarded repository/service access patterns.
- Audit logs for auth, role changes, billing changes, and access denials.
- Encryption at rest for PII fields and mandatory TLS in transit.
- Secrets in managed vaults (AWS Secrets Manager / equivalent).
- OWASP ASVS baseline controls (validation, encoding, CSRF/XSS controls).
- Backups + PITR and operational runbooks for DR.
- Security observability on anomalous check-ins, payment failures, and brute force signals.

---

## 5) Delivery Phasing

1. **Phase 1:** Auth/RBAC, tenant/branch/member core, billing fundamentals, basic class booking.
2. **Phase 2:** Dynamic QR access, occupancy tracking, webhook idempotency, automated waitlists.
3. **Phase 3:** POS/inventory, payroll/commission, advanced reporting.
4. **Phase 4:** Selective microservice extraction by throughput and team boundaries.
