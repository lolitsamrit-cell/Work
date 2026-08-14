# FitCore Enterprise Blueprint

This repository now contains a production-ready architecture and implementation blueprint for **FitCore Enterprise**, a multi-tenant Gym & Fitness Management SaaS platform.

## Contents

- `/docs/fitcore-enterprise-blueprint.md`  
  Complete architecture blueprint (modules, tenancy, infra, ERD, concurrency, security, delivery phases).
- `/docs/api-specification.md`  
  Detailed REST API contracts for auth, dynamic QR access, subscriptions, webhooks, and booking flows.
- `/database/fitcore_enterprise_schema.sql`  
  Production-grade PostgreSQL schema with UUID keys, constraints, indexes, idempotency support, and RLS scaffolding.

## Scope

The blueprint covers:
- Multi-tenant domain model for gym chains and branches
- RBAC and auditability
- Dynamic rotating QR access control (anti-pass sharing)
- Subscription lifecycle and webhook idempotency
- Concurrency-safe class/PT booking
- POS, inventory, staff/payroll, and analytics-ready schema foundation
