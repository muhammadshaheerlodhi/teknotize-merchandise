# Teknotize Merchandise — Shopify theme

Dark athletic storefront for **Teknotize Merchandise**, modeled on the Signature Drop Shop layout (announcement marquee, sticky header, Anton headlines, athlete roster, how-it-works engine, footer columns) with Teknotize branding, logo, copy, and your existing Shopify collections.

Logo is in `assets/logo.png` and is used in the header, footer, password page, and gift card.

## Pages to create in Shopify Admin

After you publish the theme, create these pages and assign the matching template:

| Page title | Handle | Theme template |
|---|---|---|
| About | `about` | `page.about` |
| Contact | `contact` | `page.contact` |
| Partnerships | `partnerships` | `page.partnerships` |
| Athlete Sign Up | `signup` | `page.signup` |
| NIL Agency | `agency` | `page.agency` |
| How It Works | `how-it-works` | `page.how-it-works` |

You already have collections for each athlete. They appear automatically on **Athlete Stores** (`/collections`) and in the homepage roster.

## Local preview (before Shopify)

A static demo lives in `preview/` so you can review the design locally:

```bash
npm run preview
```

Then open **http://localhost:3000** in your browser.

Preview pages:

- http://localhost:3000 — Homepage
- http://localhost:3000/collections.html — Athlete Stores
- http://localhost:3000/signup.html — Athlete sign-up
- http://localhost:3000/contact.html — Contact
- http://localhost:3000/how-it-works.html — How It Works
- http://localhost:3000/about.html — About
- http://localhost:3000/partnerships.html — Partnerships
- http://localhost:3000/agency.html — NIL Agency

Note: Cart/checkout and forms are visual-only in preview. Full functionality works after importing the theme to Shopify.

## Import from GitHub

Theme folders stay at the repo root: `assets`, `config`, `layout`, `locales`, `sections`, `snippets`, `templates`.

The homepage file is **`templates/index.json`**. Do not add `templates/index.liquid`.

1. Connect **Online Store → Themes → Add theme → Connect from GitHub** to branch `main`.
2. In Shopify: **Settings → Online store → Preferences → Homepage = Home page**.
3. Open **Customize**. The Home page sidebar should list 11 sections.
4. Publish the connected theme.

Or run `npm run build:theme` and upload `teknotize-theme-upload.zip` via **Add theme → Upload zip file**.

## Theme editor

Customize logo, announcement bar, colors, contact details, and homepage sections under **Online Store → Customize**.

Contact defaults:

- Email: info@teknotizemerchandise.com
- Phone: +1 631-308-9457
- Address: 43 McKinley Ave, Farmingdale NY 11735, United States
