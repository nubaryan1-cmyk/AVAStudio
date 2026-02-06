# AVA — SECURITY BASELINE (CANON)

**Version:** 1.0  
**Status:** CANON (OWNER APPROVED)  
**Authority:** _CANON/SEMANTICS/SECURITY_BASELINE.v1.md  
**Scope:** AUTHENTICATION, AUTHORIZATION & DATA PROTECTION

---

## 1. AUTHENTICATION METHODS

### Primary: Supabase JWT

```
Authorization: Bearer <supabase_jwt>
```

- Verify signature with Supabase public key
- Check `exp` claim (expiration)
- Extract `sub` claim as user_id

### Fallback: API Key (STAGING ONLY)

```
X-API-Key: <api_key>
```

- Only allowed when AVA_ENV=STAGING
- Hardcoded keys for testing
- NEVER enabled in PROD

---

## 2. AUTHORIZATION MODEL

### User Ownership

- Users can only access their own jobs
- user_id extracted from JWT
- All queries filtered by user_id

### Admin Role

- Admin users can access all jobs
- Admin status from JWT custom claim: `role: admin`

---

## 3. ENVIRONMENT RULES

### PROD Environment

| Rule | Enforcement |
|------|-------------|
| SEC-001 | JWT auth REQUIRED |
| SEC-002 | API key auth DISABLED |
| SEC-003 | HTTPS only |
| SEC-004 | Strict CORS |
| SEC-005 | Rate limiting ENABLED |

### STAGING Environment

| Rule | Enforcement |
|------|-------------|
| SEC-101 | JWT auth optional |
| SEC-102 | API key auth allowed |
| SEC-103 | HTTP allowed |
| SEC-104 | Relaxed CORS |
| SEC-105 | Rate limiting optional |

---

## 4. SECRETS MANAGEMENT

### Required Secrets (PROD)

| Secret | Description | Source |
|--------|-------------|--------|
| DATABASE_URL | Postgres connection | env |
| SUPABASE_JWT_SECRET | JWT verification | env |
| STRIPE_SECRET_KEY | Billing | env |
| STRIPE_WEBHOOK_SECRET | Webhook verification | env |
| AWS_ACCESS_KEY_ID | S3 access | env |
| AWS_SECRET_ACCESS_KEY | S3 secret | env |

### Forbidden in PROD

- Hardcoded credentials
- Default passwords
- Debug/test keys
- Localhost URLs

---

## 5. INPUT VALIDATION

### API Input

1. JSON Schema validation for all payloads
2. String length limits enforced
3. File size limits enforced
4. URL validation for external resources

### Sanitization

1. Strip HTML/JS from text inputs
2. Validate file types by magic bytes
3. Sanitize filenames

---

## 6. DATA PROTECTION

### At Rest

- Database: Encrypted (Postgres RDS)
- S3: Server-side encryption
- Logs: Encrypted

### In Transit

- TLS 1.2+ required (PROD)
- API endpoints HTTPS only

### PII Handling

- Minimize collection
- No logging of passwords/tokens
- User deletion removes all data

---

**END OF SECURITY BASELINE CANON**
