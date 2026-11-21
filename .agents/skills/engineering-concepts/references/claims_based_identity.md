# Claims-based identity and access control

**TL;DR** — A claim is a statement about a subject, made by an issuer the application trusts. Claims move authentication out of each application and make trust explicit. They are worth their cost only when identity crosses a boundary the application does not control.

## The concept card

| Concept | What it does | Use when | Do not use when | Smallest proof |
| :--- | :--- | :--- | :--- | :--- |
| Claims-based identity | The app receives signed claims instead of authenticating the user itself | Identity crosses a trust boundary, several apps share it, or credentials must not be handled | One local user, or one identity store the app already trusts | A token from the issuer is accepted; a token from anyone else is rejected |
| Federation / SSO | One issuer authenticates, many applications accept the result | Cross-realm or cross-company identity, or one sign-in for many apps | One app, one realm | A user signs in once and reaches two apps |
| Claims-based authorization | Policy checks read claims (role, group, attribute) | Authorization needs attributes beyond a local role table | A single app owns both identity and permissions | A policy denies a claim-less principal and allows the claimed one |
| Claims transformation | The issuer or app maps incoming claims to what the app needs | The app needs high-level roles from a heterogeneous issuer | The app can consume the issued claims directly | The same principal maps to the same app role through every issuer path |

## The model

- **Claim** — a statement about a subject: name, e-mail, role, group, tenant, manager. A claim is an attribute with a source.
- **Issuer** — the authority that makes the claim and signs it. The application trusts the issuer, not the claim in isolation.
- **Security token** — the signed bundle of claims. A valid token from a trusted issuer is what authenticates the user.
- **Trust is explicit.** Unlike Windows Integrated authentication, where trust is implicit in the domain, a claims-based application names the issuer it trusts and validates the token.

The airport analogy is the source's own: the airline issues a boarding pass (signed claims) after checking whatever credential it accepts (passport, licence); the gate agent validates the pass, not the passport. The application validates the token, not the password.

## What it buys

- **Authentication logic leaves the application.** The issuer handles Kerberos, forms, certificates, smart cards or federation; the application receives the same claim shape.
- **Identity store independence.** The app does not care whether claims come from Active Directory, a SQL table or another realm. Moving data between stores does not break the app.
- **Single sign-on and federation.** One sign-in crosses realms; home realm discovery routes the user to the right issuer.
- **Richer than roles.** E-mail, manager, tenant and group travel with the identity instead of requiring directory queries.
- **Anonymity when wanted.** Ask only for a role or a private identifier, not a name, and the app never learns who the user is.

## Good claims

Before turning an attribute into a claim, ask:

1. Is this a core part of how I model user identity?
2. Is the issuer an authority on this information?
3. Will more than one application use it?
4. Should the issuer manage it, or should my application?

If the answer is "only this app", keep it local. A theme preference is personalization, not identity. Fine-grained permissions are usually a bad claim: the count explodes and the issuer is rarely the authority. Keep claims at a high level (role, tenant, entitlement class) and map them to fine permissions inside the application.

**Cached claims are read-only and dated.** If the app caches a claim for offline use, store the value with the time it was fetched and refresh it when the user next presents a token. Never treat a cache as authoritative.

## When to use it

- The application is web-facing and its users are not in your domain.
- Two domains or companies must federate and no forest trust exists.
- Several applications must accept one identity and one sign-in.
- You want to stop handling passwords, resets and lockouts.
- You need anonymity: authorization without identifying the user.
- A partner or tenant must be authoritative for its own users.

## When not to

- A single-user local tool. The operating system is the identity boundary; a claims layer adds a token format and a validation failure mode for no gain.
- A monolith with one identity store and one application. Windows Integrated authentication or a local user table already gives the benefit without the token machinery.
- When the "issuer" would be the same process as the application. That is a role table with extra steps.
- When you cannot validate the token properly. An unvalidated token is worse than no token.

## Validation checklist

- **Signature** against the issuer's published keys; reject `alg: none` and unexpected algorithms.
- **Issuer** matches the trusted issuer exactly.
- **Audience** is this application.
- **Lifetime**: not expired, not before its start; allow a small clock skew, no more.
- **Replay**: short lifetimes, one-time nonces or token binding where the threat warrants it.
- **Type**: an ID token is not an access token; do not accept one where the other is required.
- **Least privilege**: request only the claims the app uses.
- **Never log tokens or claim values that are personal data.** Log the decision, not the bearer secret.
- **Do not trust client-supplied claims.** A claim is only as good as the signature and the issuer behind it.

## In .NET today

The concepts map directly: `ClaimsPrincipal` and `ClaimsIdentity` hold the claim set; JWT bearer authentication validates the token; OpenID Connect supplies the sign-in protocol; policy-based authorization evaluates claims against a requirement. The source book predates this stack and describes ADFS 2.0, WIF, WS-Federation, WS-Trust and SAML. Use the concepts and the validation checklist; use the current protocol and library rather than the book's 2010 API names.

## Applying it here

The owner's repositories are local, single-user tools. The correct answer today is OS or local identity, no claims layer. Claims become relevant at a concrete boundary: an MCP server exposed to another principal, a phone bridge that accepts commands from a device you do not control, or a hosted service with more than one user. At that point, the gate is "does identity cross a boundary I do not control" — and the answer should be a standard issuer and OIDC, not a hand-rolled token.

## Sources

- *A Guide to Claims-Based Identity and Access Control*, Microsoft patterns & practices, 2010 (Dominick Baier, Vittorio Bertocci, Keith Brown, Eugenio Pace, Matias Woloski). Chapters 1–2 for the model, claims transformation and design criteria; chapters 3–6 for the worked scenarios.
- The book's protocol and API detail is dated; the identity model, trust reasoning and claim-design questions are not.
