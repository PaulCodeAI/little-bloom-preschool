# Little Bloom Early Learning Centre — Colorful Preschool Website

A colorful, responsive preschool website created for PaulCodeAI client outreach. The visual direction uses light green, light yellow, light orange, light purple, and light blue with deep navy text for readability.

## Pages

- `index.html`
- `about.html`
- `programs.html` — includes indicative fees
- `activities.html`
- `gallery.html`
- `admission.html`
- `contact.html`
- `whatsapp-redirect.html` — WhatsApp handoff page
- `404.html`

## Files

```text
css/style.css
js/main.js
images/
netlify/functions/chat.mjs
netlify.toml
```

## WhatsApp enquiries

Admission and contact forms save the submitted data temporarily in browser `sessionStorage`, then redirect to `whatsapp-redirect.html`. That page creates a `wa.me` link containing the structured enquiry text and sends the visitor to WhatsApp.

Set the school's WhatsApp number in `js/main.js`:

```js
const WHATSAPP_NUMBER='917990837238';
```

Use digits only, including country code. Do not put spaces, `+`, brackets or dashes.

On a phone, the `wa.me` link normally hands off to the WhatsApp app. On desktop, WhatsApp Web or another supported WhatsApp handler may open. The visitor still has to press **Send** in WhatsApp.

## AI admissions assistant

The floating assistant is named:

**Little Bloom Admissions**

*Virtual Admissions Assistant · Online*

The frontend calls `/api/chat`. The Netlify Function calls Gemini server-side so the API key is not exposed to the browser.

Configure in Netlify:

```text
GEMINI_API_KEY = your_key
GEMINI_MODEL = gemini-2.5-flash-lite
```

Do not commit the real API key.

## Deployment

Deploy the project root to Netlify. The included `netlify.toml` configures the publish directory and Functions directory.

## Content

Fees, contact details, location copy and other school information are illustrative and should be replaced with verified client information before commercial delivery.
