# 📋 Callopss — Work Log: Lead Management v2

> All changes in branch `feature/lead-management-v2`.  
> Each row links to a detailed log with: what was built, the problem it solved, files changed, and test proof.

| # | Feature | Problem Solved | Status | Detail |
|:-:|:--------|:--------------|:------:|:-------|
| **11** | Password Auth (bcrypt) | Passwords were stored/compared in plaintext | ✅ | [View →](./logs/11-password-authentication.md) |
| **12** | Block Caller Exports | Callers could download any lead CSV | ✅ | [View →](./logs/12-restrict-downloads-admins-only.md) |
| **13** | Security Architecture Audit | No documented ownership/access rules | ✅ | [View →](./logs/13-security-architecture-and-audit.md) |
| **14** | Security Hardening | Meeting endpoints had no ownership check | ✅ | [View →](./logs/14-security-hardening-applied.md) |
| **15** | Phone Standardizer | Same number stored 5 different ways → false duplicates | ✅ | [View →](./logs/15-phone-number-standardizer.md) |
| **16** | Manual Lead Entry | No way to add a single lead without uploading a file | ✅ | [View →](./logs/16-manual-lead-entry.md) |
| **17** | Lead Activity Timeline | No way to see a lead's full call/note/meeting history | ✅ | [View →](./logs/17-lead-history-timeline.md) |
| **18** | Universal File Importer + Custom Fields | Only fixed CSV columns supported; PDF/Excel ignored | ✅ | [View →](./logs/18-universal-file-importer-and-custom-fields.md) |
| **19** | Upload UX Improvements | Plain file picker; no steps, no mobile import button | ✅ | [View →](./logs/19-upload-ux-improvements.md) |
| **20** | PDF Smart Table Parser (Bug Fix) | Real-world PDFs gave 0 valid leads due to header detection bug | ✅ | [View →](./logs/20-pdf-smart-table-parser.md) |
