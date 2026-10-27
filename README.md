# JiTap website

**JiTap — ASK • MATCH • BUZZ**  
AI-powered, real-time local service network, beginning with the Mombasa pilot.

This repository contains a functioning responsive **Next.js / TypeScript / React** public website built from the JiTap Website Master Development Specification v2.0. It is a GitHub implementation of the specification, **not a byte-for-byte import of the earlier 5.5 MB ZIP**. The original concept screenshots from the ZIP are not included; app previews are currently interactive React mockups. The official vector logo and optimized JiTap mascot/coastal images are included.

## Start locally

Requirements: Node.js 20.9+ (prefer 22 LTS).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

To verify:

```bash
npm run typecheck
npm run build
```

Automated GitHub Actions performs TypeScript checks and a production build on pushes to `main`.

## Site features

- Responsive homepage explaining **ASK • MATCH • BUZZ**, service search and neighbourhood selection.
- Category listing and dynamic category landing pages for eight service types.
- Customer service enquiry intake with general area, category, timing and description.
- Provider recruitment and multi-step provider application.
- Shared customer/provider lifecycle explanations and interactive concept views.
- Why JiTap, About, Guides, News, FAQ, Contact, Our App and draft policy pages.
- SEO metadata, XML sitemap, robots.txt, keyboard-friendly interactions and reduced-motion CSS.
- Official JiTap vector logo, JiTap mascot, coastal illustration and navy/green visual palette.

Routes are implemented via `src/app/page.tsx` and `src/app/[...slug]/page.tsx`. Backend request intake is in `src/app/api/intake/[kind]/route.ts`.

## Backend intake configuration

The four optional HTTPS integration URLs in `.env.example` are:

- `JITAP_REQUEST_WEBHOOK_URL`
- `JITAP_PROVIDER_WEBHOOK_URL`
- `JITAP_CONTACT_WEBHOOK_URL`
- `JITAP_EARLY_ACCESS_WEBHOOK_URL`

An optional `JITAP_WEBHOOK_BEARER_TOKEN` authenticates outgoing requests.

**Crucially, no endpoint configured means form submission returns an explicit error rather than falsely claiming success.** The app does not automatically match providers, BUZZ real people, collect payments or guarantee availability. `JITAP_DEMO_MODE` is intended solely for testing, and returns an explicit *demo only* response.

## Important before production launch

- Configure secured and monitored HTTPS intake endpoints, verify data persistence and delivery.
- Add deployment-grade rate limiting, bot protection, retention controls and logging.
- Finish legal review of Privacy, Terms, Payments/Refunds and consent mechanisms.
- Review service coverage, safety statements and founder-approved public copy.
- Test actual usability, accessibility and web vitals on mobile devices.
- Configure DNS, production HTTPS, hosting and domain on `www.jitap.app`.
- Replace/augment the optimized image assets with original-resolution assets if higher fidelity is required.
- Connect app store links only when verified listings exist.

See `IMPLEMENTATION_STATUS.md` for the remaining release blockers.

**This repository is a website frontend, not JiTap's application backend.**
