# Sources

Every vendor or standards page this module and its runbooks rely on, with the date it was read. The quotes and what each one supports are in `docs/aegis/batch12/vendor-facts-networking.md` (ids NV-01 to NV-73). Read 2026-11-14 with a web fetch tool, GET requests only. A page listed as "not read" stands behind an UNCONFIRMED fact.

## Standards (www.rfc-editor.org)

| Page | Read | Supports |
|---|---|---|
| RFC 1034, Domain names: concepts and facilities (section 3.6.2) | 2026-11-14 | A CNAME has no other data beside it; no plain CNAME at the apex (NV-02) |
| RFC 1035, Domain names: implementation and specification (section 4.1.1) | 2026-11-14 | RCODE 2, 3 and 5; the AA flag (NV-03 to NV-06) |
| RFC 2308, Negative caching of DNS queries | 2026-11-14 | The negative-cache time (NV-01) |
| RFC 4035, DNSSEC protocol modifications (sections 3.2.2 and 5.5) | 2026-11-14 | The CD bit; RCODE 2 for bogus data (NV-07, NV-08) |
| RFC 8914, Extended DNS Errors | 2026-11-14 | EDE codes 6, 7 and 22 (NV-09 to NV-11) |
| RFC 1191, Path MTU discovery | 2026-11-14 | DF bit; "fragmentation needed" with the next-hop MTU (NV-16, NV-17) |
| RFC 2923, TCP problems with path MTU discovery (section 2.1) | 2026-11-14 | The black hole (NV-18) |
| RFC 7908, Problem definition and classification of BGP route leaks | 2026-11-14 | What a route leak is (NV-23) |
| RFC 2131, Dynamic Host Configuration Protocol | 2026-11-14 | `giaddr`; DHCPDECLINE (NV-24, NV-25) |
| RFC 5737, IPv4 address blocks reserved for documentation | 2026-11-14 | The example address ranges (NV-26) |
| RFC 6066, TLS extensions (section 3, server name indication) | 2026-11-14 | SNI and an unrecognised name (NV-27, NV-28) |
| RFC 8446, TLS 1.3 (section 4.4.2) | 2026-11-14 | Certificate chain order (NV-29, NV-30) |
| RFC 7296, IKEv2 (section 2) | 2026-11-14 | UDP 500 and 4500 (NV-33); section 2.23 not read (NV-66) |
| RFC 3948, UDP encapsulation of IPsec ESP (section 4) | 2026-11-14 | NAT keepalives (NV-34) |

## Vendors

| Page | Read | Supports |
|---|---|---|
| developers.cloudflare.com/dns/cname-flattening/ | 2026-11-14 | Apex CNAME flattening (NV-12) |
| developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/ and its error-522 and error-526 pages | 2026-11-14 | The 52x meanings (NV-51 to NV-53) |
| developers.cloudflare.com/fundamentals/reference/cloudflare-ray-id/ | 2026-11-14 | The Ray ID (NV-54); not that clients see it as a response header (NV-67) |
| developers.cloudflare.com/cloudflare-one/policies/gateway/block-page/ | 2026-11-14 | The Gateway block page (NV-55, NV-56) |
| developers.cloudflare.com/cloudflare-one/policies/gateway/http-policies/tls-decryption/ | 2026-11-14 | TLS decryption; pinned apps and Do Not Inspect (NV-57, NV-58) |
| developers.cloudflare.com/cloudflare-one/insights/logs/gateway-logs/ | 2026-11-14 | Gateway activity logs (NV-59) |
| developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/route-traffic/split-tunnels/ | 2026-11-14 | Split Tunnels (NV-60) |
| developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/troubleshooting/common-issues/ | 2026-11-14 | Read; it gives no tunnel MTU (NV-72) |
| www.cloudflarestatus.com | 2026-11-14 | Cloudflare's status page (NV-62) |
| docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html | 2026-11-14 | Alias at the apex; how an alias shows in dig (NV-13, NV-14) |
| docs.aws.amazon.com/vpn/latest/s2svpn/vpn-limits.html | 2026-11-14 | Site-to-Site VPN MTU and MSS; no path MTU discovery (NV-19, NV-20) |
| docs.aws.amazon.com/vpn/latest/s2svpn/Troubleshooting.html | 2026-11-14 | Read for the troubleshooting topics; no fact rests on it |
| docs.aws.amazon.com/vpc/latest/userguide/path_mtu_discovery.html | 2026-11-14 | The ICMP rule a network ACL needs (NV-21) |
| docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html | 2026-11-14 | Network ACL order; stateless against stateful (NV-49) |
| docs.aws.amazon.com/acm/latest/userguide/dns-renewal-validation.html | 2026-11-14 | ACM DNS-validated renewal (NV-31, NV-32) |
| learn.microsoft.com/en-us/azure/dns/dns-alias | 2026-11-14 | Azure DNS alias at the apex (NV-15) |
| learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview | 2026-11-14 | NSG priority and state (NV-50) |
| learn.microsoft.com/en-us/windows-server/administration/windows-commands/ping | 2026-11-14 | `ping /f` and `/l` (NV-22) |
| documentation.meraki.com/MX/Site-to-site_VPN/Site-to-Site_VPN_Settings | 2026-11-14 | Site-to-site VPN path; VPN mode; ports 500 and 4500 (NV-35 to NV-37) |
| documentation.meraki.com/MX/Site-to-site_VPN/Meraki_Auto_VPN_-_Configuration_and_Troubleshooting | 2026-11-14 | Registry and peer ports; captures on both peers (NV-38, NV-39) |
| documentation.meraki.com/General_Administration/Tools_and_Troubleshooting/Packet_Capture_Overview | 2026-11-14 | Packet capture path and storage (NV-40, NV-41) |
| documentation.meraki.com/General_Administration/Monitoring_and_Reporting/Meraki_Event_Log | 2026-11-14 | Event log path (NV-42) |
| documentation.meraki.com/MX/Firewall_and_Traffic_Shaping/MX_Firewall_Settings | 2026-11-14 | Firewall path; outbound allowed by default (NV-43, NV-44) |
| documentation.meraki.com/MR/Radio_Settings/Band_Steering_Overview | 2026-11-14 | Band steering (NV-45) |
| documentation.meraki.com/Architectures_and_Best_Practices/Cisco_Meraki_Best_Practice_Design/Best_Practice_Design_-_MR_Wireless/High_Density_Wi-Fi_Deployments | 2026-11-14 | Channel width, capacity, minimum bitrate (NV-46 to NV-48) |
| status.meraki.net | 2026-11-14 | Meraki's status page (NV-61) |
| trust.zscaler.com | 2026-11-14 | Zscaler's trust page, title only (NV-63) |

## Not read (UNCONFIRMED facts rest on them)

| Page | Why not | Fact |
|---|---|---|
| documentation.meraki.com, Layer 3 and 7 firewall processing order | 404 | NV-64 |
| documentation.meraki.com, Troubleshooting non-Meraki site-to-site VPN peers | Redirected to a sign-in page on another host; not followed | NV-65 |
| help.zscaler.com | Not on the lane's allowed hosts | NV-68 |
| wireguard.com | Not on the lane's allowed hosts | NV-69 |
| Linux and macOS `ping` manuals, openssl.org | Not on the lane's allowed hosts | NV-70, NV-71 |
