// Little Bloom Preschool — Netlify Streaming AI Admissions Assistant
// Gemini API key must stay in Netlify Environment Variables.

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const KEY = process.env.GEMINI_API_KEY;

const context = `
You are the Virtual Admissions Assistant for Little Bloom Early Learning Centre, a sample preschool website serving families in Surat, Gujarat.

Speak naturally and warmly, like a helpful admissions desk assistant, while remaining accurate and concise.

Use only the school facts below. Do not invent teachers, awards, student counts, facilities, transport routes, discounts, policies, certificates, medical services or exact admission dates.

If a requested detail is not listed, say the admissions team can confirm it.

The assistant can answer in simple English, Hindi or Gujarati when the visitor uses those languages.

School: Little Bloom Early Learning Centre.
Location: Surat, Gujarat, India.
Hours: Monday–Saturday, 8:00 AM–1:30 PM.

Programs and indicative annual tuition:
- Playgroup, age 2–3: ₹33,600/year (₹2,800/month)
- Nursery, age 3–4: ₹38,400/year (₹3,200/month)
- Junior KG, age 4–5: ₹43,200/year (₹3,600/month)
- Senior KG, age 5–6: ₹46,800/year (₹3,900/month)

Additional indicative charges shown on the website:
- ₹5,000 one-time admission
- ₹4,500/year activity and learning materials
- Approximately ₹5,000/year books and uniform
- Transport approximately ₹1,800–₹2,500/month depending on route

Learning approach:
play-based learning, stories, art, music, movement, early literacy, early numeracy, discovery activities, group projects and school-readiness.

Activities:
art and craft, storytelling, music and movement, outdoor play, discovery/science-style activities and group projects.

Admission flow:
choose a program, send an enquiry, speak with admissions, then complete the school's enrolment process after availability and final fees are confirmed.

Do not say that the site stores enquiries. Website enquiries are handed to WhatsApp by the frontend.
`;

const hits = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function clientId(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for') ||
    'unknown'
  ).split(',')[0].trim();
}

function allowed(req) {
  const key = clientId(req);
  const now = Date.now();
  const item = hits.get(key);

  if (!item || now - item.time > 60000) {
    hits.set(key, { time: now, count: 1 });
    return true;
  }

  if (item.count >= 12) return false;

  item.count++;
  return true;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      x =>
        x &&
        (x.role === 'user' || x.role === 'assistant') &&
        typeof x.content === 'string'
    )
    .slice(-8)
    .map(x => ({
      role: x.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: x.content.slice(0, 1000) }]
    }));
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .filter(part => part && part.thought !== true && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
}

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff'
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  if (!KEY) {
    return json(
      {
        error:
          'The admissions assistant is not configured yet. Add GEMINI_API_KEY in Netlify and redeploy.'
      },
      503
    );
  }

  if (!allowed(req)) {
    return json(
      { error: 'Please wait a minute before trying again.' },
      429
    );
  }

  let body;

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const contents = cleanMessages(body?.messages);

  if (!contents.length) {
    return json({ error: 'Please enter a question.' }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': KEY
      },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: context }]
        },
        contents,
        generationConfig: {
          thinkingConfig: {
            thinkingLevel: 'minimal'
          },
          maxOutputTokens: 320
        }
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error(
        'Gemini stream error',
        response.status,
        data?.error?.message
      );

      if (response.status === 429) {
        return json(
          {
            error:
              'The AI service is temporarily busy or has reached its free limit. Please try again shortly.'
          },
          429
        );
      }

      return json(
        {
          error:
            data?.error?.message ||
            'The admissions assistant is temporarily unavailable.'
        },
        502
      );
    }

    if (!response.body) {
      return json(
        { error: 'The AI stream is unavailable right now.' },
        502
      );
    }

    const upstream = response.body;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        let buffer = '';

        const send = payload => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        };

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() || '';

            for (const event of events) {
              const lines = event
                .split(/\r?\n/)
                .filter(line => line.startsWith('data:'));

              if (!lines.length) continue;

              const raw = lines
                .map(line => line.slice(5).trimStart())
                .join('\n')
                .trim();

              if (!raw || raw === '[DONE]') continue;

              try {
                const payload = JSON.parse(raw);
                const text = extractText(payload);

                if (text) {
                  send({ text });
                }
              } catch (parseError) {
                console.warn('Ignored malformed Gemini SSE chunk.', parseError);
              }
            }
          }

          const tail = decoder.decode();
          buffer += tail;

          if (buffer.trim()) {
            const lines = buffer
              .split(/\r?\n/)
              .filter(line => line.startsWith('data:'));

            const raw = lines
              .map(line => line.slice(5).trimStart())
              .join('\n')
              .trim();

            if (raw && raw !== '[DONE]') {
              try {
                const payload = JSON.parse(raw);
                const text = extractText(payload);
                if (text) send({ text });
              } catch {}
            }
          }

          send({ done: true });
          controller.close();
        } catch (error) {
          console.error('Gemini streaming error', error);

          try {
            send({
              error:
                error?.name === 'AbortError'
                  ? 'The assistant took too long to respond. Please try again.'
                  : 'The admissions assistant connection was interrupted.'
            });
          } finally {
            controller.close();
          }
        } finally {
          clearTimeout(timeout);
          try {
            reader.releaseLock();
          } catch {}
        }
      },

      cancel() {
        clearTimeout(timeout);
      }
    });

    return new Response(stream, {
      status: 200,
      headers: sseHeaders()
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error(err);

    return json(
      {
        error:
          err?.name === 'AbortError'
            ? 'The assistant took too long to respond. Please try again.'
            : 'Unable to connect to the admissions assistant.'
      },
      502
    );
  }
}

export const config = {
  path: '/api/chat'
};
