# Security Policy

## Supported Versions

NearMatch follows semantic versioning. Security updates are provided for the current major and previous patch releases.

| Version | Supported          | Notes                          |
| ------- | ------------------ | ------------------------------ |
| 1.x     | :white_check_mark: | Current release, actively maintained |
| 0.x     | :x:                | Pre-release, no longer supported |

## Reporting a Vulnerability

**We take security seriously.** If you discover a security vulnerability in NearMatch, please report it responsibly by emailing **security@nearmatch.in** instead of using the public issue tracker.

### What to Include

Please provide:
- Description of the vulnerability
- Steps to reproduce (if applicable)
- Affected components or versions
- Potential impact
- Suggested fix (if available)

### What to Expect

- **Acknowledgment:** You'll receive a response within 48 hours
- **Assessment:** We'll investigate and assess the severity
- **Timeline:** Critical vulnerabilities will be patched within 7 days; high-priority within 14 days
- **Disclosure:** We'll coordinate with you on disclosure timing (minimum 30 days for patches)
- **Credit:** We'll acknowledge your responsible disclosure in release notes (unless you prefer anonymity)

## Security Considerations

### Payment Processing

NearMatch handles financial transactions via Razorpay. Vulnerabilities related to payment processing, keys, or credentials are treated as **CRITICAL** and require immediate attention.

### Data Privacy

User data is stored in Supabase with Row-Level Security (RLS) enabled. Any vulnerabilities affecting authentication, authorization, or data isolation should be reported immediately.

### Third-Party Dependencies

We regularly audit our dependencies (Expo, React Native, Supabase, etc.) for known vulnerabilities. We recommend users keep their installation up to date.

## Development Security Best Practices

If you're contributing to NearMatch:

1. **Never commit secrets** — use environment variables for API keys, credentials, and sensitive values
2. **Use RLS policies** — Supabase RLS must protect all sensitive tables
3. **Validate input** — sanitize user input on both client and server
4. **Authenticate requests** — all API calls should require valid authentication
5. **Review dependencies** — check for known vulnerabilities before adding new packages
6. **Test security flows** — review payment, auth, and data access tests before PRs

## Security Audit

Last audit: September 2026
- ✅ Supabase RLS policies reviewed
- ⚠️ Razorpay key management — **see issue #10**
- ✅ Dependency audit completed

## Contact

- **Security Reports:** security@nearmatch.in
- **GitHub Issues:** Use for non-sensitive bug reports only
- **Website:** https://nearmatch.in
