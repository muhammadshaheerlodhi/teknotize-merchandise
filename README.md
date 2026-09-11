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

Install once, then run the local Liquid server. It renders the real theme files —
`templates/*.json`, section groups, `{% schema %}` defaults and `{{ content_for_layout }}` —
the same way Shopify does, so template and section errors show up before you push.

```bash
npm install
npm run dev
```

Then open **http://127.0.0.1:9292**.

Routes: `/`, `/pages/<handle>`, `/collections`, `/collections/all`, `/products/<handle>`,
`/cart`, `/search`, `/blogs`, `/account/*`, plus any unknown URL to exercise the 404 template.

### Validate every template

```bash
npm run check
```

This renders all templates and fails on invalid JSON, missing section files, undefined block
types, broken translation keys and any page whose `<main>` comes out empty. Run it before
every push.

Note: cart/checkout and forms are visual-only locally, and product/collection data is stubbed.
Full functionality works after the theme is on Shopify.

A separate static mock also lives in `preview/` (`npm run preview`, port 3000). It is a design
reference only and is excluded from the theme upload.

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
