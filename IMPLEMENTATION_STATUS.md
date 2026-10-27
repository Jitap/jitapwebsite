# JiTap website — implementation status

## Completed in GitHub

- Public Next.js/TypeScript responsive site and navigation
- Home, Why JiTap, About, Services and dynamic category pages
- ASK • MATCH • BUZZ How It Works flow and interactive Customer/Provider concept preview
- Customer enquiry form, two-stage provider application, contact and early-access flows
- Server-side Zod validation and explicit production webhook boundaries
- Guides/article templates, empty Newsroom, FAQs, draft legal informational pages
- SEO metadata, sitemap and robots
- Official JiTap vector logo and optimized supplied coastal / mascot assets
- GitHub Actions workflow to run TypeScript checking and Next.js build

## Important qualifications

- The source was built from the master website specification and is **not byte-for-byte identical** to JiTap_Website_Master_Source_v2.zip.
- The original customer and provider screenshot files from that archive are not present in this repository; interactive UI concept mockups are used instead.
- Website **repository integration** is done, **production deployment and operational backend integration** are not.
- Service intake returns 503 until a verified HTTPS webhook is configured. Do not assume a form submission has been received if a backend is unavailable.
- Live matches, BUZZ acceptance, ETA, provider profiles, payments and reviews are **not** backed by operational systems here.
- Draft legal text needs founder/legal approval, and a production security and accessibility review remains required.

## Acceptance checks

GitHub Actions at `/.github/workflows/build.yml` runs `npm install`, `npm run typecheck`, and `npm run build` after changes. Check the latest run in the Actions tab before deployment.
