document.documentElement.classList.add('js-ready');
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));

function initNav(){
  const nav=q('.site-nav'), toggle=q('.menu-toggle'); if(!nav) return;
  const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  qa('.site-nav a[data-page]').forEach(a=>{const on=(a.dataset.page||'').toLowerCase()===current;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','page');});
  toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});
  qa('.site-nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
}
function initReveal(){const items=qa('.reveal');if(!('IntersectionObserver'in window)){items.forEach(e=>e.classList.add('visible'));return}const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}}),{threshold:.1});items.forEach(e=>io.observe(e));}
function showToast(msg){let t=q('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),3500)}

const WHATSAPP_NUMBER=''; // Replace with the school's WhatsApp number: 919876543210 (digits only, country code included)
function saveWhatsAppEnquiry(form){
  const data=Object.fromEntries(new FormData(form).entries());
  const isAdmission=form.dataset.type==='admission';
  const message=isAdmission
    ? `Hello Little Bloom Admissions,\n\nI would like to enquire about admission.\n\nParent Name: ${data.name||''}\nPhone: ${data.phone||''}\nChild Age: ${data.age||''}\nPreferred Program: ${data.program||''}\nQuestion: ${data.message||'I would like to know more about admission.'}\n\nSent from the Little Bloom website.`
    : `Hello Little Bloom,\n\nI would like to make an enquiry.\n\nName: ${data.name||''}\nPhone: ${data.phone||''}\nEmail: ${data.email||''}\nTopic: ${data.topic||'General enquiry'}\nMessage: ${data.message||''}\n\nSent from the Little Bloom website.`;
  sessionStorage.setItem('lb_whatsapp_enquiry',JSON.stringify({message,number:WHATSAPP_NUMBER,createdAt:Date.now()}));
  location.href='whatsapp-redirect.html';
}
function initForms(){qa('form[data-whatsapp-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;saveWhatsAppEnquiry(form)}));}

function initAI(){
  const panel=q('.ai-panel'), form=q('#chat-form'), input=q('#chat-input'), body=q('#chat-messages');
  if(!panel||!form||!input||!body)return;

  const history=[];
  let busy=false;

  const open=()=>{
    panel.classList.add('open');
    panel.setAttribute('aria-hidden','false');
    setTimeout(()=>input.focus(),80);
  };

  const close=()=>{
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
  };

  qa('.open-ai').forEach(el=>el.addEventListener('click',e=>{
    e.preventDefault();
    open();
  }));

  q('.ai-close')?.addEventListener('click',close);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')close();
  });

  qa('.suggestions button').forEach(b=>b.addEventListener('click',()=>{
    if(busy)return;
    input.value=b.textContent.trim();
    form.requestSubmit();
  }));

  const add=(role,text,typing=false)=>{
    const row=document.createElement('div');
    row.className=`chat-row ${role}${typing?' typing':''}`;

    if(role==='bot'){
      const a=document.createElement('div');
      a.className='avatar';
      a.textContent='LB';
      row.appendChild(a);
    }

    const bubble=document.createElement('div');
    bubble.className='bubble';
    bubble.textContent=text;
    row.appendChild(bubble);
    body.appendChild(row);
    body.scrollTop=body.scrollHeight;

    return {row,bubble};
  };

  function setTypingState(target,isTyping){
    target.row.classList.toggle('typing',isTyping);
    target.bubble.classList.toggle('streaming',isTyping);
  }

  async function ask(text){
    const message=String(text||'').trim().slice(0,500);
    if(!message||busy)return;

    busy=true;
    input.disabled=true;

    add('user',message);
    history.push({role:'user',content:message});
    input.value='';

    const target=add('bot','Typing…',true);
    let answer='';
    let gotFirstChunk=false;

    try{
      const r=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:history.slice(-8)})
      });

      if(!r.ok){
        const data=await r.json().catch(()=>({}));
        throw new Error(data.error||'AI request failed');
      }

      if(!r.body){
        throw new Error('The AI stream is unavailable right now.');
      }

      const reader=r.body.getReader();
      const decoder=new TextDecoder();
      let buffer='';

      const processEvent=raw=>{
        const dataLines=raw
          .split(/\r?\n/)
          .filter(line=>line.startsWith('data:'));

        if(!dataLines.length)return;

        const payloadText=dataLines
          .map(line=>line.slice(5).trimStart())
          .join('\n')
          .trim();

        if(!payloadText)return;

        let payload;
        try{
          payload=JSON.parse(payloadText);
        }catch{
          return;
        }

        if(payload.error){
          throw new Error(payload.error);
        }

        if(typeof payload.text==='string'&&payload.text){
          if(!gotFirstChunk){
            gotFirstChunk=true;
            target.bubble.textContent='';
            setTypingState(target,false);
          }

          answer+=payload.text;
          target.bubble.textContent=answer;
          body.scrollTop=body.scrollHeight;
        }
      };

      while(true){
        const {value,done}=await reader.read();
        if(done)break;

        buffer+=decoder.decode(value,{stream:true});

        const events=buffer.split(/\r?\n\r?\n/);
        buffer=events.pop()||'';

        for(const event of events){
          processEvent(event);
        }
      }

      buffer+=decoder.decode();
      if(buffer.trim())processEvent(buffer);

      if(!answer.trim()){
        throw new Error('The assistant returned an empty response.');
      }

      setTypingState(target,false);
      history.push({role:'assistant',content:answer.trim()});
    }catch(err){
      target.bubble.textContent=err.message||'The admissions assistant is temporarily unavailable.';
      setTypingState(target,false);
    }finally{
      busy=false;
      input.disabled=false;
      input.focus();
      body.scrollTop=body.scrollHeight;
    }
  }

  form.addEventListener('submit',e=>{
    e.preventDefault();
    ask(input.value);
  });
}
function initYear(){qa('[data-year]').forEach(e=>e.textContent=new Date().getFullYear())}
initNav();initReveal();initForms();initAI();initYear();

function initWhatsAppRedirect(){
  const status=document.getElementById('wa-status');
  const fallback=document.getElementById('wa-fallback');
  const spinner=q('.redirect-spinner');
  if(!status)return;
  let payload=null;
  try{payload=JSON.parse(sessionStorage.getItem('lb_whatsapp_enquiry')||'null')}catch{}
  if(!payload?.message){status.textContent='No enquiry details were found. Please return to the admissions page and submit the form again.';spinner?.remove();return}
  const number=String(payload.number||'').replace(/\D/g,'');
  if(!number){status.innerHTML='WhatsApp is ready, but the school WhatsApp number is not configured yet.<br><strong>Add the number in js/main.js before deployment.</strong>';spinner?.remove();return}
  const url=`https://wa.me/${number}?text=${encodeURIComponent(payload.message)}`;
  if(fallback){fallback.href=url;fallback.hidden=false;fallback.target='_blank';fallback.rel='noopener'}
  status.textContent='Opening WhatsApp with your enquiry details…';
  setTimeout(()=>{window.location.assign(url);},650);
  sessionStorage.removeItem('lb_whatsapp_enquiry');
}
initWhatsAppRedirect();
