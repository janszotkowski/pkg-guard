# Security policy

This policy is about vulnerabilities **in weighme itself**: the code in this repository and the service built from it.

A vulnerability in a package measured by the service is not a weighme issue. Report it to that package's maintainers.

## Supported versions

Only the latest commit on `main` is supported; there are no maintained release branches.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub instead: on the repository page, open **Security → Report a vulnerability** ([direct link](https://github.com/janszotkowski/weighme/security/advisories/new)). Please include:

- what is affected (an endpoint, a page, the worker, the Docker image)
- steps or a proof of concept that reproduces it
- the impact you expect, and anything you know about a fix

## What to expect

- An acknowledgement within 7 days.
- An assessment, and a plan or a question, within 14 days.
- A fix as soon as it is ready, then a published advisory that credits you, unless you prefer not to be named.

This is a volunteer project without a bug bounty. Good-faith research that respects users' privacy, does not degrade the service for others (no load testing or denial of service against a public deployment) and gives reasonable time to fix the problem before disclosure is welcome.

## Scope notes

- The worker installs and bundles untrusted packages. A way for a package to run code, reach the worker's token or escape its container is exactly what this policy is for.
- The public API is read-only and unauthenticated by design, apart from queueing packages to be measured. Data being readable is not a finding.
