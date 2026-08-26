# Security policy

`avitam-teach` is an educational companion repository, not a supported hosted
service, deployment guide, or production reference architecture. Historical
tags intentionally retain flaws and dependency versions discussed in the book.
A clean test run does not establish deployment readiness.

If you independently adapt any code for deployment:

1. run a current dependency and container-image audit;
2. upgrade affected packages and re-run the full verification suite;
3. replace all local development configuration and credentials;
4. review the trust boundaries for the intended environment; and
5. perform a deployment-specific security review.

Please report a newly discovered vulnerability privately through GitHub's
security-advisory reporting flow rather than opening a public issue with exploit
details.
