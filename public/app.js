const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const API = "/api";
let publicId = location.pathname.startsWith("/calendar/") ? location.pathname.split("/")[2] : null;
let calendar = null;
let canEdit = false;
let me = null;
let state = { people: [], events: [], messages: [] };

const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const week = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];

function openModal(id){ $("#"+id)?.classList.add("open"); }
function closeModal(id){ $("#"+id)?.classList.remove("open"); }
$$("[data-close]").forEach(b => b.onclick = () => closeModal(b.dataset.close));
$$(".modal").forEach(m => m.onclick = e => { if(e.target === m) closeModal(m.id); });

function esc(v=""){ return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }

async function api(path, options={}) {
  const r = await fetch(API + path, {credentials:"include", headers:{"Content-Type":"application/json",...(options.headers||{})}, ...options});
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || "Erro na operação.");
  return data;
}

function relationshipLabel(p){ return p.relationship || "Familiar"; }
function initials(name){ return name.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase(); }

function findEventsForMonth(monthIndex){
  return state.events.filter(e => Number(e.event_date.slice(5,7)) === monthIndex+1);
}

function eventClass(e){
  if(e.type === "holiday") return "holiday";
  if(e.type === "point") return "point";
  if(e.type === "birthday") return "birthday";
  if(e.type === "memory") return "memory";
  return "special";
}

function renderMonths(){
  const grid = $("#monthsGrid");
  grid.innerHTML = "";
  for(let m=0;m<12;m++){
    const first = new Date(calendar.year,m,1);
    const total = new Date(calendar.year,m+1,0).getDate();
    const start = (first.getDay()+6)%7;
    const events = findEventsForMonth(m);
    let days = "";
    for(let i=0;i<start;i++) days += `<div class="day"></div>`;
    for(let d=1;d<=total;d++){
      const date = `${calendar.year}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const ev = events.find(e=>e.event_date===date);
      days += `<div class="day ${ev?eventClass(ev):""} ${ev?"special":""}" title="${ev?esc(ev.title):""}">${d}</div>`;
    }
    grid.insertAdjacentHTML("beforeend", `
      <div class="month">
        <div class="month-head"><span>${months[m]}</span><b>${calendar.year}</b></div>
        <div class="week">${week.map(x=>`<span>${x}</span>`).join("")}</div>
        <div class="days">${days}</div>
      </div>`);
  }
}

function renderSide(){
  const birthdays = state.people.map(p=>({
    title:p.name, date:p.birth_date, relationship:p.relationship
  }));
  const memories = state.events.filter(e=>["memory","family","commemorative"].includes(e.type)).map(e=>({title:e.title,date:e.event_date}));
  $("#sheetBirthdays").innerHTML = birthdays.length ? birthdays.map(x=>`<div class="side-event">● ${formatDate(x.date)} — ${esc(x.title)} (${esc(x.relationship)})</div>`).join("") : `<div class="side-event">Nenhum aniversariante.</div>`;
  $("#sheetMemories").innerHTML = memories.length ? memories.slice(0,5).map(x=>`<div class="side-event">● ${formatDate(x.date)} — ${esc(x.title)}</div>`).join("") : `<div class="side-event">Nenhuma data.</div>`;
}

function renderFooter(){
  const defaults = state.events.filter(e=>e.is_default);
  const cols = [[],[],[]];
  defaults.forEach((e,i)=>cols[i%3].push(e));
  $("#holidaysFooter").innerHTML = cols.map(col=>col.map(e=>`<div class="holiday-item"><b>${formatDate(e.event_date)}</b> — ${esc(e.title)} <span>${e.type==="holiday"?"FN":"PC"}</span></div>`).join("")).join("");
}

function renderPeople(){
  $("#peopleGrid").innerHTML = state.people.length ? state.people.map(p=>`
    <article class="card">
      <div class="avatar">${initials(p.name)}</div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(relationshipLabel(p))}</p>
      <p>${formatDate(p.birth_date)}</p>
      ${p.bio?`<p>${esc(p.bio)}</p>`:""}
      ${canEdit?`<button class="btn btn-primary full" style="margin-top:10px" onclick="openMessage(${p.id},'${esc(p.name)}')">Enviar felicitação</button>`:""}
    </article>`).join("") : `<div class="panel">Ainda não há perfis familiares.</div>`;
}

function renderEvents(){
  $("#eventsGrid").innerHTML = state.events.filter(e=>!e.is_default).length ? state.events.filter(e=>!e.is_default).map(e=>`
    <article class="card">
      <span class="tag-pill">${e.type}</span>
      <h3>${esc(e.title)}</h3>
      <p>${formatDate(e.event_date)}</p>
      ${e.description?`<p>${esc(e.description)}</p>`:""}
    </article>`).join("") : `<div class="panel">Ainda não há encontros ou datas personalizadas.</div>`;
}

function renderMessages(){
  $("#messagesGrid").innerHTML = state.messages.length ? state.messages.map(m=>`
    <article class="message">
      <q>${esc(m.message)}</q>
      <small>${esc(m.sender_name)} → ${esc(m.recipient_name)} • ${new Date(m.created_at).toLocaleDateString("pt-PT")}</small>
    </article>`).join("") : `<div class="panel">As felicitações enviadas aos integrantes aparecerão aqui e ficam guardadas no calendário.</div>`;
}

function formatDate(v){
  if(!v) return "";
  const [y,m,d]=v.split("-");
  return `${d}/${m}`;
}

function updatePermissions(){
  $$(".member-only").forEach(el=>el.style.display=canEdit?"":"none");
  $("#requestAccess").style.display = canEdit ? "none" : "";
  $("#calendarStatus").textContent = canEdit
    ? `Sessão autorizada. ${me?.role==="admin"?"Você é administrador.":"Você é integrante autorizado."}`
    : "Acesso público: visualização. Membros autorizados podem interagir.";
}

async function loadCalendar(){
  if(!publicId){
    $("#calendarSection").classList.add("hidden");
    $("#people").classList.add("hidden");
    $("#memories").classList.add("hidden");
    $("#messages").classList.add("hidden");
    return;
  }
  const data = await api(`/calendars/${publicId}`);
  calendar = data.calendar; state = data;
  $("#landing").classList.add("hidden");
  $("#calendarTitle").innerHTML = `${esc(calendar.name)} <span>${calendar.year}</span>`;
  $("#sheetFamily").textContent = calendar.name.toUpperCase();
  $("#sheetYear").textContent = calendar.year;
  $("#footerFamily").textContent = calendar.name.toUpperCase();
  $("#qrImage").src = `/api/calendars/${publicId}/qr.png`;
  renderMonths(); renderSide(); renderFooter(); renderPeople(); renderEvents(); renderMessages();
  try{
    const d = await api("/me");
    me=d.user;
    const admin = await api(`/calendars/${publicId}/admin`);
    canEdit = true;
    $("#admin").classList.remove("hidden");
    $("#shareUrl").textContent = `${location.origin}/calendar/${publicId}`;
    renderMembers(admin.members);
  }catch{
    canEdit=false;
  }
  updatePermissions();
}

function renderMembers(rows){
  $("#membersList").innerHTML = rows.map(m=>`
    <div class="member-row">
      <span><b>${esc(m.name)}</b><br>${esc(m.email)}<br>Status: ${m.status}</span>
      ${m.status==="pending"?`<span><button class="btn btn-primary" onclick="memberAction(${m.id},'approve')">Aprovar</button> <button class="btn btn-outline" onclick="memberAction(${m.id},'reject')">Recusar</button></span>`:""}
    </div>`).join("");
}

window.memberAction = async (id, action) => {
  await api(`/calendars/${publicId}/members/${id}/${action}`, {method:"POST",body:"{}"});
  loadCalendar();
};

window.openMessage = (id,name) => {
  $("#messagePersonId").value=id; $("#messagePersonName").textContent=`Felicitação para ${name}`; openModal("messageModal");
};

$("#createForm").onsubmit = async e => {
  e.preventDefault();
  try{
    const d=await api("/calendars",{method:"POST",body:JSON.stringify({
      name:$("#familyName").value, year:Number($("#familyYear").value), template:$("#template").value,
      adminName:$("#adminName").value,email:$("#adminEmail").value,password:$("#adminPassword").value
    })});
    publicId=d.publicId;
    history.pushState({}, "", `/calendar/${publicId}`);
    closeModal("createModal");
    await loadCalendar();
    alert("Calendário criado. Guarde o link e o QR Code exclusivo.");
  }catch(e){alert(e.message)}
};

$("#accessForm").onsubmit = async e => {
  e.preventDefault();
  try{
    const step=$("#accessStep").value;
    if(step==="request"){
      await api("/access/request",{method:"POST",body:JSON.stringify({
        publicId,name:$("#accessName").value,email:$("#accessEmail").value,phone:$("#accessPhone").value
      })});
      $("#accessStep").value="verify"; $("#otpArea").classList.remove("hidden"); $("#accessButton").textContent="Confirmar OTP";
      alert("Código enviado. Se SMTP não estiver configurado, veja o terminal do servidor.");
    }else{
      const d=await api("/access/verify",{method:"POST",body:JSON.stringify({
        publicId,name:$("#accessName").value,email:$("#accessEmail").value,phone:$("#accessPhone").value,code:$("#otp").value
      }));
      alert(d.message); closeModal("accessModal");
    }
  }catch(e){alert(e.message)}
};

$("#personForm").onsubmit = async e => {
  e.preventDefault();
  try{
    await api(`/calendars/${publicId}/people`,{method:"POST",body:JSON.stringify({
      name:$("#personName").value,birthDate:$("#personBirth").value,relationship:$("#personRelationship").value,bio:$("#personBio").value
    })});
    closeModal("personModal"); e.target.reset(); await loadCalendar();
  }catch(e){alert(e.message)}
};

$("#eventForm").onsubmit = async e => {
  e.preventDefault();
  try{
    await api(`/calendars/${publicId}/events`,{method:"POST",body:JSON.stringify({
      title:$("#eventTitle").value,date:$("#eventDate").value,type:$("#eventType").value,description:$("#eventDescription").value
    })});
    closeModal("eventModal"); e.target.reset(); await loadCalendar();
  }catch(e){alert(e.message)}
};

$("#messageForm").onsubmit = async e => {
  e.preventDefault();
  try{
    await api(`/calendars/${publicId}/messages`,{method:"POST",body:JSON.stringify({
      personId:Number($("#messagePersonId").value),message:$("#messageText").value
    })});
    closeModal("messageModal"); e.target.reset(); await loadCalendar();
  }catch(e){alert(e.message)}
};

$("#startCreate").onclick=()=>openModal("createModal");
$("#adminOpen").onclick=()=>openModal("createModal");
$("#showAccess").onclick=()=>openModal("accessModal");
$("#requestAccess").onclick=()=>openModal("accessModal");
$("#addPerson").onclick=()=>openModal("personModal");
$("#addEvent").onclick=()=>openModal("eventModal");
$("#menuBtn").onclick=()=>$(".topbar nav").classList.toggle("mobile-open");

$("#copyLink").onclick=async()=>{await navigator.clipboard.writeText(`${location.origin}/calendar/${publicId}`);alert("Link copiado.");};

$("#downloadPdf").onclick=async()=>{
  const sheet=$("#a3Sheet");
  const oldWidth=sheet.style.width;
  sheet.style.width="1587px";
  const canvas=await html2canvas(sheet,{scale:2,backgroundColor:"#fff",useCORS:true});
  sheet.style.width=oldWidth;
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a3"});
  const img=canvas.toDataURL("image/jpeg",0.96);
  pdf.addImage(img,"JPEG",0,0,420,297);
  pdf.save(`${calendar.name.replace(/\s+/g,"-")}-${calendar.year}-A3.pdf`);
};

async function setupPush(){
  if(!("serviceWorker" in navigator) || !("Notification" in window) || !canEdit) return;
  try{
    const key=await api("/push/public-key");
    if(!key.publicKey) return;
    const reg=await navigator.serviceWorker.register("/sw.js");
    const permission=await Notification.requestPermission();
    if(permission!=="granted") return;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key.publicKey)});
    await api("/push/subscribe",{method:"POST",body:JSON.stringify(sub)});
  }catch{}
}
function urlBase64ToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
}

loadCalendar().then(setupPush).catch(err=>console.error(err));
