# Security Guide

This project contains a `client` (Vue + Vite) and `server` (Node.js + Express) application.

## Supported Scope

- Security practices in this file apply to `client/` and `server/`.
- `student-info-system/` is an independent subproject and is out of scope for the main web system deployment checklist.

## Deployment Checklist

Before deploying to production, verify all items below:

- [ ] Set `NODE_ENV=production`.
- [ ] Configure strong secrets in `server/.env`:
  - `JWT_SECRET` (random, at least 16 chars)
  - `ADMIN_USERNAME` and `ADMIN_PASSWORD` (not default values)
  - `MYSQL_PASSWORD` (strong password)
- [ ] Set strict `CORS_ALLOWED_ORIGINS` to your frontend domains only.
- [ ] Keep rate limiting enabled (`API_RATE_LIMIT_*`, `LOGIN_RATE_LIMIT_*`, `REGISTER_RATE_LIMIT_*`, `FORGOT_PASSWORD_RATE_LIMIT_*`).
- [ ] Ensure HTTPS is enabled at reverse proxy or gateway.
- [ ] Do not commit `.env`, database dumps, or uploaded files.
- [ ] Run quality gates successfully:
  - `cd server && npm run lint && npm test`
  - `cd client && npm run lint && npm run build`

## Vulnerability Reporting

If you find a security issue, report it privately to the maintainer:

- Preferred: open a private security advisory in your repository hosting platform.
- Alternative: email the maintainer directly with:
  - reproduction steps
  - impact assessment
  - affected versions and files
  - optional mitigation suggestions

Please avoid posting exploitable details in public issues before a fix is ready.

## Secure Defaults Reminder

- Development mode may allow additional local origins for convenience.
- Production mode should be locked down by explicit environment configuration.
