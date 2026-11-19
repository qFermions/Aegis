# Sources

> **Execution boundary:** reference text only.

Every vendor or standards page this module and the lane's runbooks rely on, with the date it was read and the vendor-fact ids in `docs/aegis/batch12/vendor-facts-security.md`. Pages were read with a web fetch tool (GET only, no credential). A page that redirected is listed at the address the content came from.

## Read on 2026-11-14

| Page | Facts |
|---|---|
| https://docs.aws.amazon.com/IAM/latest/UserGuide/access-keys-admin-managed.html | SV-01, SV-02, SV-03 |
| https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html | SV-69 |
| https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html | SV-47, SV-48, SV-76 |
| https://docs.aws.amazon.com/guardduty/latest/ug/compromised-creds.html | SV-04 |
| https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types-iam.html | SV-07 |
| https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html | SV-05, SV-06 |
| https://learn.microsoft.com/en-us/entra/identity/users/users-revoke-access | SV-16, SV-20, SV-57 |
| https://learn.microsoft.com/en-us/defender-office-365/responding-to-a-compromised-email-account | SV-08, SV-09, SV-58, SV-59 |
| https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-sign-in-log-activity-details | SV-10, SV-11, SV-12, SV-13 |
| https://learn.microsoft.com/en-us/azure/azure-monitor/platform/activity-log (served as fundamentals/activity-log) | SV-14, SV-15 |
| https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/disable-user-sign-in-portal | SV-21, SV-22 |
| https://learn.microsoft.com/en-us/defender-office-365/detect-and-remediate-illicit-consent-grants | SV-23, SV-24, SV-70 |
| https://learn.microsoft.com/en-us/defender-office-365/remediate-malicious-email-delivered-office-365 | SV-25, SV-71 |
| https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-user-mailboxes/configure-email-forwarding | SV-26 |
| https://learn.microsoft.com/en-us/defender-endpoint/respond-machine-alerts | SV-54, SV-55, SV-78, SV-79 |
| https://learn.microsoft.com/en-us/defender-office-365/tenant-allow-block-list-email-spoof-configure | SV-56, SV-72, SV-73 |
| https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials | SV-67 |
| https://support.microsoft.com/en-us/office/manage-email-messages-by-using-rules-in-outlook-c24f5dea-9465-4df4-ad17-a50704d66c59 | SV-68 |
| https://docs.cloud.google.com/logging/docs/audit (redirected from cloud.google.com) | SV-17, SV-18, SV-19 |
| https://docs.cloud.google.com/iam/docs/keys-disable-enable (redirected from cloud.google.com) | SV-45, SV-46 |
| https://knowledge.workspace.google.com/admin/security/manage-a-users-security-settings | SV-43, SV-44 |
| https://developer.okta.com/docs/okta-event-types.csv | SV-32 to SV-41, SV-65 |
| https://developer.okta.com/docs/api/openapi/okta-management/management/tags/usersessions.md | SV-42 |
| https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/reviewing-and-revoking-personal-access-tokens-in-your-organization | SV-49, SV-77 |
| https://docs.github.com/en/rest/credentials/revoke | SV-50 |
| https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository | SV-51 |
| https://docs.slack.dev/reference/methods/auth.revoke (redirected from api.slack.com) | SV-52 |
| https://www.cisa.gov/known-exploited-vulnerabilities-catalog | SV-27, SV-28 |
| https://www.cisa.gov/stopransomware/ransomware-guide | SV-29, SV-74, SV-75 |
| https://attack.mitre.org/techniques/T1114/003/ | SV-30 |
| https://attack.mitre.org/techniques/T1621/ | SV-31 |

## Tried and not usable on 2026-11-14

| Page | Why |
|---|---|
| https://nvd.nist.gov/vuln-metrics/cvss | The page rendered no body text for the fetch tool (SV-61 stays UNCONFIRMED). |
| https://knowledge.workspace.google.com/admin/security/control-which-third-party-internal-apps-access-google-workspace-data | 404; the Google app block path is the one `/gws-security-posture` already carries. |
| https://developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationlifecycle.md | 404 (SV-66 stays UNCONFIRMED). |
| https://www.cisa.gov/resources-tools/resources/federal-government-cybersecurity-incident-and-vulnerability-response-playbooks | Read, but it does not name the NIST lifecycle phases (SV-60 stays UNCONFIRMED). |

## Not on the lookup allowlist (left UNCONFIRMED)

- NIST SP 800-61 Revision 3 (csrc.nist.gov): SV-60.
- FIRST CVSS and EPSS (first.org): SV-61, SV-62.

## Existing facts this module reuses

- `docs/aegis/batch11/vendor-facts-microsoft.md` MB-20 to MB-23: the Purview audit roles, the 180-day window without E5, and the mailbox and file activities to search.
- `docs/aegis/batch11/vendor-facts-google-okta-jamf.md` GB-32 and GB-33: what Google's Drive log events record and miss.
- `docs/aegis/g3/vendor-facts.md`: GitHub secret scanning and Dependabot alert facts used by `/github-security-alerts`.
