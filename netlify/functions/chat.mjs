const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const KEY = process.env.GEMINI_API_KEY;
const context = `You are the Virtual Admissions Assistant for Little Bloom Early Learning Centre, a sample preschool website serving families in Surat, Gujarat.
Speak naturally and warmly, like a helpful admissions desk assistant, while remaining accurate.
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
Additional indicative charges shown on the website: ₹5,000 one-time admission; ₹4,500/year activity and learning materials; approximately ₹5,000/year books and uniform; transport approximately ₹1,800–₹2,500/month depending on route.
Learning approach: play-based learning, stories, art, music, movement, early literacy, early numeracy, discovery activities, group projects and school-readiness.
Activities: art and craft, storytelling, music and movement, outdoor play, discovery/science-style activities and group projects.
Admission flow: choose a program, send an enquiry, speak with admissions, then complete the school's enrolment process after availability and final fees are confirmed.
Do not say that the site stores enquiries. Website enquiries are handed to WhatsApp by the frontend.`;

const hits=new Map();
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
function allowed(req){const key=(req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();const now=Date.now();const item=hits.get(key);if(!item||now-item.time>60000){hits.set(key,{time:now,count:1});return true}if(item.count>=12)return false;item.count++;return true}
function cleanMessages(messages){if(!Array.isArray(messages))return [];return messages.filter(x=>x&&(x.role==='user'||x.role==='assistant')&&typeof x.content==='string').slice(-8).map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content.slice(0,1200)}]}))}
export default async function handler(req){
  if(req.method!=='POST')return json({error:'Method not allowed.'},405);
  if(!KEY)return json({error:'The admissions assistant is not configured yet. Add GEMINI_API_KEY in Netlify and redeploy.'},503);
  if(!allowed(req))return json({error:'Please wait a minute before trying again.'},429);
  let body;try{body=await req.json()}catch{return json({error:'Invalid request.'},400)}
  const contents=cleanMessages(body?.messages);if(!contents.length)return json({error:'Please enter a question.'},400);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(KEY)}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({system_instruction:{parts:[{text:context}]},contents,generationConfig:{temperature:.55,maxOutputTokens:500}})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){console.error('Gemini error',r.status,data?.error?.message);if(r.status===429)return json({error:'The free AI limit has been reached for now. Please try again later.'},429);return json({error:'The admissions assistant is temporarily unavailable.'},502)}
    const reply=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(!reply)return json({error:'The assistant returned an empty response.'},502);return json({reply});
  }catch(err){console.error(err);return json({error:err?.name==='AbortError'?'The assistant took too long to respond. Please try again.':'Unable to connect to the admissions assistant.'},502)}finally{clearTimeout(timeout)}
}
export const config={path:'/api/chat'};
