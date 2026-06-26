/* =====================================================
   QUESTION BANK
   Loaded at runtime from questions.json.
   d = domain (1-5), q = question, o = options[4], a = correct index, e = explanation
  to run on phone , on the same network : python -m http.server , and on the phone open the ipv4 address of the computer with port 8000
===================================================== */
let QUESTIONS = [];

const DOMAINS = {
  1:{name:"General_Security_Concepts", code:"1.0", color:"var(--d1)"},
  2:{name:"Threats_Vulnerabilities_&_Mitigations", code:"2.0", color:"var(--d2)"},
  3:{name:"Security_Architecture", code:"3.0", color:"var(--d3)"},
  4:{name:"Security_Operations", code:"4.0", color:"var(--d4)"},
  5:{name:"Security_Program_Management_&_Oversight", code:"5.0", color:"var(--d5)"}
};

/* =====================================================
   STATE
===================================================== */
let ALL = [];
let screen = "start";
let selectedDomains = new Set([1,2,3,4,5]);
let missedOnly = false;
let shuffle = true;
let active = [];
let idx = 0;
let picks = {}; // id -> chosen index
let storedProgress = {missed:[], lastScore:null, attempts:0, seenOrder:[]};
let storageOK = true;

const app = document.getElementById("app");

/* =====================================================
   STORAGE
===================================================== */
function loadProgress(){
  try{
    const raw = localStorage.getItem("sy0701-progress");
    if(raw){
      const parsed = JSON.parse(raw);
      storedProgress = Object.assign({missed:[], lastScore:null, attempts:0, seenOrder:[]}, parsed);
    }
  }catch(err){
    // localStorage unavailable (e.g. private browsing) — fine, just use defaults
    storageOK = false;
  }
  render();
}

function saveProgress(){
  try{
    localStorage.setItem("sy0701-progress", JSON.stringify(storedProgress));
  }catch(err){
    storageOK = false;
  }
}

/* =====================================================
   HELPERS
===================================================== */
function shuffleArr(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function domainCounts(list){
  const c = {1:0,2:0,3:0,4:0,5:0};
  list.forEach(q=>c[q.d]++);
  return c;
}

function buildPool(){
  let pool = ALL.filter(q=>selectedDomains.has(q.d));
  if(missedOnly){
    const missedSet = new Set(storedProgress.missed);
    pool = pool.filter(q=>missedSet.has(q.id));
  }
  return pool;
}

/* ---- "seen" cycling: don't repeat a question until every question
   in the current pool (domain selection + missed-only filter) has
   been shown at least once. Tracked via storedProgress.seenOrder,
   an array of question ids in the order they were last seen
   (oldest first). When the pool runs dry, the cycle auto-resets by
   reusing the oldest-seen questions first. ---- */
function markSeen(id){
  const order = storedProgress.seenOrder;
  const existing = order.indexOf(id);
  if(existing !== -1) order.splice(existing,1);
  order.push(id);
  saveProgress();
}

function buildExamQueue(pool, count){
  if(pool.length===0) return [];
  const seenOrder = storedProgress.seenOrder;
  const seenIndex = new Map(seenOrder.map((id,i)=>[id,i]));

  const unseen = pool.filter(q=>!seenIndex.has(q.id));
  const seen = pool.filter(q=>seenIndex.has(q.id))
    .sort((a,b)=> seenIndex.get(a.id) - seenIndex.get(b.id)); // oldest-seen first

  let queue;
  if(unseen.length >= count){
    queue = (shuffle ? shuffleArr(unseen) : unseen).slice(0, count);
  } else {
    // use up all unseen, then top off with the oldest-seen questions (cycle reset)
    const needed = count - unseen.length;
    const refill = seen.slice(0, needed);
    queue = unseen.concat(refill);
    if(shuffle) queue = shuffleArr(queue);
  }
  return queue;
}

function shuffleOptions(q){
  const order = shuffleArr(q.o.map((_,i)=>i)); // permutation of original option indices
  return {
    ...q,
    o: order.map(i=>q.o[i]),
    a: order.indexOf(q.a)
  };
}

/* =====================================================
   EVENTS
===================================================== */
function toggleDomain(d){
  if(selectedDomains.has(d)){
    if(selectedDomains.size>1) selectedDomains.delete(d);
  } else {
    selectedDomains.add(d);
  }
  render();
}

function toggleMissedOnly(){
  missedOnly = !missedOnly;
  render();
}

function toggleShuffle(){
  shuffle = !shuffle;
  render();
}

const EXAM_SIZE = 90;
const EXAM_HALF_SIZE = 45;
const EXAM_THIRD_SIZE = 20;

function startExam(questionCount){
  let pool = buildPool();
  if(pool.length===0) return;
  const count = missedOnly ? pool.length : questionCount;
  const queue = buildExamQueue(pool, count);
  active = queue.map(shuffleOptions);
  idx = 0;
  picks = {};
  screen = "quiz";
  render();
}

function pickOption(qid, optIdx){
  if(picks[qid] !== undefined) return;
  picks[qid] = optIdx;
  render();
}

function goNext(){
  if(idx < active.length-1){ idx++; render(); }
  else finishExam();
}

function goPrev(){
  if(idx>0){ idx--; render(); }
}

function goHome(){
  screen = "start";
  render();
}

function finishExam(){
  const missedSet = new Set(storedProgress.missed);
  let correct = 0;
  active.forEach(q=>{
    const p = picks[q.id];
    if(p === q.a){ correct++; missedSet.delete(q.id); }
    else { missedSet.add(q.id); }
  });
  storedProgress.missed = Array.from(missedSet);
  storedProgress.lastScore = Math.round((correct/active.length)*100);
  storedProgress.attempts = (storedProgress.attempts||0)+1;
  saveProgress();
  screen = "results";
  render();
}

function retakeFull(){
  missedOnly = false;
  startExam(EXAM_SIZE);
}

function reviewMissed(){
  missedOnly = true;
  selectedDomains = new Set([1,2,3,4,5]);
  startExam();
}

/* =====================================================
   RENDER
===================================================== */
function render(){
  if(screen==="start") renderStart();
  else if(screen==="quiz") renderQuiz();
  else renderResults();
}

function renderStart(){
  const counts = {1:24,2:44,3:36,4:56,5:40};
  const total = 675;
  const hasHistory = storedProgress.lastScore !== null;
  const missedCount = storedProgress.missed.length;

  let blueprintHtml = "";
  for(let d=1; d<=5; d++){
    const pct = Math.round((counts[d]/total)*100);
    blueprintHtml += `
      <div class="bp-row">
        <span class="bp-code">${DOMAINS[d].code}</span>
        <span class="bp-name">${DOMAINS[d].name}</span>
        <span class="bp-bar-track"><span class="bp-bar-fill" style="width:${pct}%;background:${DOMAINS[d].color}"></span></span>
        <span class="bp-pct">${pct}%</span>
      </div>`;
  }

  let chipsHtml = "";
  for(let d=1; d<=5; d++){
    const active = selectedDomains.has(d);
    chipsHtml += `<button class="chip" data-active="${active}" style="--chip-color:${DOMAINS[d].color};--chip-bg:${DOMAINS[d].color}22" onclick="toggleDomain(${d})">${DOMAINS[d].code} · ${DOMAINS[d].name.split(" ")[0]}</button>`;
  }

  const poolCount = buildPool().length;

  app.innerHTML = `
    <div class="topbar">
      <button class="brand" onclick="goHome()">SY0-701 <b>PRACTICE EXAM</b></button>
      <span class="tag">90Q EXAM · 675+Q BANK</span>
    </div>
    <p class="eyebrow">CompTIA Security+ · Exam Prep</p>
    <h1 class="title">90-Question<br>Practice Exam</h1>
    <p class="subtitle">675+-question bank mapped to the official SY0-701 exam domains. Each session draws 90 questions at random in the same proportions as the real exam blueprint. Pick your scope below and begin.</p>

    ${hasHistory ? `
    <div class="resume-note">
      <span>Last attempt: <b style="color:var(--accent)">${storedProgress.lastScore}%</b> · ${missedCount} question${missedCount===1?"":"s"} flagged for review</span>
      ${missedCount>0 ? `<button class="btn btn-ghost" onclick="reviewMissed()">Review missed only →</button>` : ""}
    </div>` : ""}

    <div class="card">
      <h3>Exam Blueprint Coverage</h3>
      <div class="blueprint">${blueprintHtml}</div>
    </div>

    <div class="card">
      <h3>Domains to include</h3>
      <div class="chips">${chipsHtml}</div>
    </div>

    <div class="card">
      <h3>Options</h3>
      <div class="toggle-row">
        <span class="toggle-label">Shuffle question order</span>
        <div class="switch" data-on="${shuffle}" onclick="toggleShuffle()"><div class="knob"></div></div>
      </div>
      <div class="toggle-row">
        <span class="toggle-label">Missed questions only ${missedCount===0 ? "(none yet)" : `(${missedCount} available)`}</span>
        <div class="switch" data-on="${missedOnly}" onclick="${missedCount>0 ? 'toggleMissedOnly()' : ''}" style="${missedCount===0 ? 'opacity:.4;cursor:not-allowed;' : ''}"><div class="knob"></div></div>
      </div>
    </div>

    <button class="stamp-btn" onclick="startExam(90)" ${poolCount===0 ? "disabled" : ""}>Begin Exam · ${missedOnly ? poolCount : Math.min(poolCount, EXAM_SIZE)} Qs</button>
    <button class="stamp-btn" onclick="startExam(45)" ${poolCount===0 ? "disabled" : ""}>Begin Exam · ${missedOnly ? poolCount : Math.min(poolCount, EXAM_HALF_SIZE)} Qs</button>
    <button class="stamp-btn" onclick="startExam(20)" ${poolCount===0 ? "disabled" : ""}>Begin Exam · ${missedOnly ? poolCount : Math.min(poolCount, EXAM_THIRD_SIZE)} Qs</button>
  `;
}

function renderQuiz(){
  const q = active[idx];
  markSeen(q.id);
  const dom = DOMAINS[q.d];
  const answered = picks[q.id] !== undefined;
  const correctCount = active.slice(0, idx).reduce((acc,qq)=> acc + (picks[qq.id]===qq.a ? 1:0), 0) + (answered && picks[q.id]===q.a ? 1 : 0);

  let ticks = "";
  active.forEach((qq,i)=>{
    let state = "unanswered";
    if(i===idx) state="current";
    else if(picks[qq.id]!==undefined) state="answered";
    const color = picks[qq.id]!==undefined ? (picks[qq.id]===qq.a ? "var(--teal)" : "var(--rust)") : DOMAINS[qq.d].color;
    ticks += `<span class="tick" data-state="${state}" style="--tick-color:${color}"></span>`;
  });

  let optsHtml = "";
  q.o.forEach((optText, i)=>{
    let dataCorrect="false", dataWrong="false", dataPicked = (picks[q.id]===i) ? "true":"false";
    let mark = "";
    if(answered){
      if(i===q.a){ dataCorrect="true"; mark = "✓"; }
      else if(i===picks[q.id]){ dataWrong="true"; mark = "✕"; }
    }
    optsHtml += `
      <button class="option" data-picked="${dataPicked}" data-correct="${dataCorrect}" data-wrong="${dataWrong}" data-locked="${answered}" onclick="pickOption(${q.id},${i})">
        <span class="box">${mark}</span>
        <span>${optText}</span>
      </button>`;
  });

  app.innerHTML = `
    <div class="topbar">
      <button class="brand" onclick="goHome()">SY0-701 <b>PRACTICE EXAM</b></button>
      <button class="btn btn-ghost" onclick="goHome()">End Exam</button>
    </div>
    <div class="progress-strip">${ticks}</div>
    <div class="quiz-meta">
      <span>QUESTION ${String(idx+1).padStart(3,"0")} / ${String(active.length).padStart(3,"0")}</span>
      <span class="score-live">${correctCount} correct so far</span>
    </div>
    <div class="card">
      <div class="domain-chip" style="--chip-color:${dom.color}"><span class="dot"></span>${dom.code} ${dom.name}</div>
      <p class="q-text">${q.q}</p>
      <div class="options">${optsHtml}</div>
      ${answered ? `<div class="explain"><b>Why</b>${q.e}</div>` : ""}
    </div>
    <div class="nav-row">
      <button class="btn" onclick="goPrev()" ${idx===0 ? "disabled":""}>← Previous</button>
      <button class="btn btn-primary" onclick="goNext()">${idx===active.length-1 ? "Finish Exam" : "Next →"}</button>
    </div>
  `;
}

function renderResults(){
  let correct=0;
  const byDomain = {1:{c:0,t:0},2:{c:0,t:0},3:{c:0,t:0},4:{c:0,t:0},5:{c:0,t:0}};
  active.forEach(q=>{
    byDomain[q.d].t++;
    if(picks[q.id]===q.a){ correct++; byDomain[q.d].c++; }
  });
  const pct = Math.round((correct/active.length)*100);
  const passed = pct>=75;
  const r=50, circ=2*Math.PI*r;
  const offset = circ*(1-pct/100);

  let dbHtml="";
  for(let d=1; d<=5; d++){
    const row = byDomain[d];
    if(row.t===0) continue;
    const p = Math.round((row.c/row.t)*100);
    dbHtml += `
      <div class="db-row">
        <span class="db-name">${DOMAINS[d].code} ${DOMAINS[d].name}</span>
        <span class="db-track"><span class="db-fill" style="width:${p}%;background:${DOMAINS[d].color}"></span></span>
        <span class="db-frac">${row.c}/${row.t}</span>
      </div>`;
  }

  app.innerHTML = `
    <div class="topbar">
      <button class="brand" onclick="goHome()">SY0-701 <b>PRACTICE EXAM</b></button>
      <span class="tag">RESULTS</span>
    </div>
    <p class="eyebrow">Exam Complete</p>
    <h1 class="title">Case<br>Closed</h1>

    <div class="card results-head">
      <div class="gauge-wrap">
        <svg viewBox="0 0 120 120" width="128" height="128">
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="10"/>
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="${passed ? "var(--teal)" : "var(--rust)"}" stroke-width="10"
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
            transform="rotate(-90 60 60)"/>
        </svg>
        <div class="gauge-pct"><span class="num">${pct}%</span><span class="lbl">${correct}/${active.length}</span></div>
      </div>
      <div class="stamp show ${passed ? "pass":"review"}">${passed ? "Pass" : "Review"}</div>
    </div>

    <div class="card">
      <h3>Domain Breakdown</h3>
      <div class="domain-breakdown">${dbHtml}</div>
      <p class="caveat">This is a practice percentage, not a scaled CompTIA exam score (the real exam is scored 100–900 with a passing score of 750).</p>
    </div>

    <div class="row-btns">
      <button class="btn btn-primary" onclick="retakeFull()">Retake Full Exam</button>
      ${storedProgress.missed.length>0 ? `<button class="btn" onclick="reviewMissed()">Review ${storedProgress.missed.length} Missed</button>` : ""}
      <button class="btn btn-ghost" onclick="goHome()">Back to Start</button>
    </div>
  `;
}

async function init(){
  try{
    const res = await fetch("questions.json");
    if(!res.ok) throw new Error("HTTP " + res.status);
    QUESTIONS = await res.json();
  }catch(err){
    app.innerHTML = `
      <div class="card">
        <h3>Couldn't load questions.json</h3>
        <p style="color:var(--text-dim); font-size:13.5px;">
          ${err.message}.<br><br>
          If you opened this file directly (file://), most browsers block local
          file fetches for security reasons. Serve the folder instead, e.g. run
          <code>python3 -m http.server</code> in this folder and open
          <code>http://localhost:8000</code>, then try again.
        </p>
      </div>`;
    return;
  }
  ALL = QUESTIONS.map((q,i)=>({...q, id:i}));
  loadProgress();
}

init();