# FitCore Enterprise API Specification (Core v1)

Base path: `/v1`  
Auth: Authorization header required for protected endpoints.
Tenant scoping: resolved from JWT and validated against requested branch/member resources.

---

## 1) Auth

### POST `/auth/login`
Request:
```json
{
  "email": "member@example.com",
  "password": "StrongPass123!",
  "tenantSlug": "fitcore-downtown"
}
```
Response:
```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-or-jwt",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "roles": ["member"],
    "permissions": ["booking:create", "access:checkin"]
  }
}
```

### POST `/auth/refresh`
Request:
```json
{ "refreshToken": "token" }
```
Response: rotated access + refresh tokens (same shape as login).

### POST `/auth/logout`
Request:
```json
{ "refreshToken": "token" }
```
Response:
```json
{ "success": true }
```

---

## 2) Dynamic QR Access

### GET `/access/qr-token`
Response:
```json
{
  "token": "hmac-token",
  "expiresAt": "2026-08-14T14:15:15.000Z",
  "serverTime": "2026-08-14T14:15:00.000Z"
}
```

### POST `/access/checkin`
Request:
```json
{
  "token": "hmac-token",
  "branchId": "uuid",
  "zoneId": "uuid",
  "deviceId": "gate-01"
}
```
Response:
```json
{
  "status": "granted",
  "occupancy": {
    "branchCurrent": 118,
    "zoneCurrent": 36
  }
}
```

Denied example:
```json
{
  "status": "denied",
  "reason": "TOKEN_EXPIRED"
}
```

---

## 3) Subscription Lifecycle

### POST `/subscriptions`
Request:
```json
{
  "memberId": "uuid",
  "planId": "uuid",
  "startAt": "2026-09-01T00:00:00.000Z",
  "couponCode": "WELCOME10"
}
```
Response:
```json
{
  "subscriptionId": "uuid",
  "status": "active",
  "nextBillingAt": "2026-10-01T00:00:00.000Z"
}
```

### POST `/subscriptions/{id}/pause`
Request:
```json
{
  "fromDate": "2026-10-15",
  "toDate": "2026-11-15",
  "reason": "medical"
}
```
Response:
```json
{
  "subscriptionId": "uuid",
  "status": "paused",
  "freezeUntil": "2026-11-15T00:00:00.000Z"
}
```

### POST `/subscriptions/{id}/resume`
Response:
```json
{
  "subscriptionId": "uuid",
  "status": "active"
}
```

### POST `/webhooks/stripe`
### POST `/webhooks/razorpay`
- Verify signature
- Store event in `payment_webhook_events` with unique `(provider,event_id)`
- Enqueue processing job
- Return `200` quickly

Response:
```json
{
  "accepted": true,
  "eventId": "evt_123"
}
```

---

## 4) Concurrency-safe Class & PT Booking

### POST `/classes/{sessionId}/book`
Headers:
- `Idempotency-Key: <uuid>`

Request:
```json
{ "memberId": "uuid" }
```
Response (booked):
```json
{
  "bookingId": "uuid",
  "status": "booked"
}
```
Response (waitlisted):
```json
{
  "bookingId": "uuid",
  "status": "waitlisted",
  "queuePosition": 3
}
```

### POST `/classes/{sessionId}/cancel`
Request:
```json
{ "memberId": "uuid" }
```
Response:
```json
{
  "cancelled": true,
  "waitlistPromotedMemberId": "uuid"
}
```

### POST `/pt-sessions/book`
Headers:
- `Idempotency-Key: <uuid>`

Request:
```json
{
  "trainerId": "uuid",
  "memberId": "uuid",
  "startsAt": "2026-08-21T10:00:00.000Z",
  "endsAt": "2026-08-21T11:00:00.000Z"
}
```
Response:
```json
{
  "ptSessionId": "uuid",
  "status": "booked"
}
```
