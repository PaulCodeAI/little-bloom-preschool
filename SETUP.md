# Deployment setup

## WhatsApp number

Edit `js/main.js` and set:

```js
const WHATSAPP_NUMBER='91XXXXXXXXXX';
```

Example format only:

```js
const WHATSAPP_NUMBER='919876543210';
```

Use the real school's number before deployment.

## Gemini key

Add the following Netlify environment variable:

```text
GEMINI_API_KEY=YOUR_REAL_KEY
```

Optional:

```text
GEMINI_MODEL=gemini-2.5-flash-lite
```

Redeploy after changing the environment variables.

## Local website

You can open the HTML pages with a local web server. The WhatsApp handoff is a browser-side redirect and will work only after `WHATSAPP_NUMBER` is configured.

The AI function requires a Netlify Functions runtime (for example `netlify dev`) and a valid Gemini API key.
