import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://tjrawflvejlysjxkdcvg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcmF3Zmx2ZWpseXNqeGtkY3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MDc5OTAsImV4cCI6MjA4Nzk4Mzk5MH0._amegHHsnvI1LdudyWb8LkZpRBMlPEN3_9TDOHZwvDw"
);

const STATUS_CONFIG = {
  todo:  { label:"준비됨",  color:"#6366f1", bg:"#eef2ff" },
  doing: { label:"진행중",  color:"#f59e0b", bg:"#fffbeb" },
  done:  { label:"완료됨",  color:"#10b981", bg:"#ecfdf5" },
};

const KR_HOLIDAYS = {
  "01-01":"신정","03-01":"삼일절","05-05":"어린이날","06-06":"현충일",
  "08-15":"광복절","10-03":"개천절","10-09":"한글날","12-25":"크리스마스",
  "2025-01-28":"설날","2025-01-29":"설날(연휴)","2025-01-30":"설날(연휴)",
  "2025-05-06":"대체공휴일","2025-09-06":"추석(연휴)","2025-09-07":"추석","2025-09-08":"추석(연휴)",
  "2026-01-28":"설날(연휴)","2026-01-29":"설날","2026-01-30":"설날(연휴)",
  "2026-03-02":"대체공휴일","2026-05-24":"부처님오신날","2026-05-25":"대체공휴일",
  "2026-09-24":"추석(연휴)","2026-09-25":"추석","2026-09-26":"추석(연휴)","2026-10-05":"대체공휴일",
};
const isHoliday=(year,month,day)=>{
  const mmdd=`${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  const full=`${year}-${mmdd}`;
  return KR_HOLIDAYS[full]||KR_HOLIDAYS[mmdd]||null;
};
const isRedDay=(year,month,day)=>new Date(year,month,day).getDay()===0||!!isHoliday(year,month,day);

function generateInviteCode() { return String(Math.floor(100000+Math.random()*900000)); }
function formatDate(s) { if(!s)return""; return new Date(s).toLocaleDateString("ko-KR",{month:"short",day:"numeric"}); }
function toDateKey(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function toMonthKey(value) {
  const dateKey = toDateKey(value);
  return dateKey ? dateKey.slice(0, 7) : "";
}
function isToday(s) { return new Date(s).toDateString()===new Date().toDateString(); }
function isThisWeek(s) {
  const today=new Date(), d=new Date(s);
  const start=new Date(today); start.setDate(today.getDate()-today.getDay());
  const end=new Date(start); end.setDate(start.getDate()+6);
  return d>=start&&d<=end;
}
function isOverdue(s) { const t=new Date(); t.setHours(0,0,0,0); return new Date(s)<t; }
function getDaysInMonth(y,m) { return new Date(y,m+1,0).getDate(); }
function getFirstDayOfMonth(y,m) { return new Date(y,m,1).getDay(); }

const AVATAR_COLORS=["#6366f1","#f59e0b","#10b981","#ec4899","#3b82f6","#8b5cf6"];
function getAvatarColor(n){let h=0;for(let c of(n||"?"))h=h*31+c.charCodeAt(0);return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length];}

const AI_API_ENDPOINT="/api/ai";

function addDays(dateStr,days){
  const base=dateStr?new Date(`${dateStr}T00:00:00`):new Date();
  base.setDate(base.getDate()+days);
  return `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,"0")}-${String(base.getDate()).padStart(2,"0")}`;
}

async function invokeAI(action,payload,fallbackFn){
  try{
    const res=await fetch(AI_API_ENDPOINT,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action,payload}),
    });
    if(!res.ok) throw new Error("AI API failed");
    const json=await res.json();
    if(json?.result) return json.result;
    throw new Error("AI result missing");
  }catch{
    return fallbackFn(payload);
  }
}

function fallbackBreakdown({title="",description=""}){
  const source=`${title}\n${description}`
    .split(/[.\n]/)
    .map(s=>s.trim())
    .filter(Boolean);
  const normalized=source
    .map(s=>s.replace(/^\d+[.)]\s*/,""))
    .map(s=>s.length>34?`${s.slice(0,34)}...`:s);
  const unique=[...new Set(normalized)];
  const checklist=(unique.length?unique:[title||"요구사항 정리"]).slice(0,5);
  const subtasks=checklist.slice(0,4).map((s,i)=>({
    title:s,
    status:"todo",
    dueOffsetDays:i+1
  }));
  return {checklist,subtasks};
}

function fallbackRecommend({title="",members=[],tasks=[]}){
  const now=Date.now();
  const open=tasks.filter(t=>t.status!=="done");
  const memberStats=members.map(member=>{
    const myOpen=open.filter(t=>t.assignee===member);
    const myDoneRecent=tasks.filter(t=>{
      if(t.assignee!==member||t.status!=="done") return false;
      const doneAt=new Date(t.updated_at||t.created_at||0).getTime();
      return Number.isFinite(doneAt)&&doneAt>now-(1000*60*60*24*30);
    }).length;
    const overdueOpen=myOpen.filter(t=>t.due&&isOverdue(t.due)).length;
    const balanceScore=(myDoneRecent*2)-myOpen.length-(overdueOpen*2);
    return {member,myOpen:myOpen.length,myDoneRecent,overdueOpen,balanceScore};
  });
  const best=memberStats.sort((a,b)=>b.balanceScore-a.balanceScore)[0];
  const assignee=best?.member||members[0]||"";
  const urgent=/긴급|버그|오류|장애|hotfix|fix/i.test(title);
  const complexity=/리팩토링|설계|분석|마이그레이션|배포|통합/i.test(title)?5:3;
  const dueInDays=urgent?1:Math.max(1,complexity+(best?.myOpen>=4?1:0)-(best?.myDoneRecent>=4?1:0));
  const due=addDays("",dueInDays);
  return {
    assignee,
    due,
    reason:urgent
      ?"긴급 키워드 감지로 빠른 마감/가용 담당자 우선 추천"
      :`${assignee||"담당자"}의 현재 업무량(${best?.myOpen??0})과 최근 처리량(${best?.myDoneRecent??0}) 기준 추천`
  };
}

function fallbackSummarize({items=[]}){
  const texts=items.map(i=>(i.text||"").trim()).filter(Boolean);
  const recent=texts.slice(-6);
  const summaryLines=[...new Set(recent)]
    .slice(-3)
    .map(t=>t.length>60?`${t.slice(0,60)}...`:t);
  const actionItems=texts.filter(t=>/TODO|할 일|해야|부탁|요청|필요/i.test(t)).slice(0,3);
  const decisions=texts.filter(t=>/결정|확정|합의|정함/i.test(t)).slice(0,3);
  return {summaryLines,actionItems,decisions};
}

function fallbackStandup({tasks=[]}){
  const todayKey=toDateKey(new Date());
  const doneToday=tasks
    .filter(t=>t.status==="done"&&toDateKey(t.updated_at||t.created_at)===todayKey)
    .map(t=>`- ${t.title}`);
  const todayPlan=tasks.filter(t=>toDateKey(t.due)===todayKey&&t.status!=="done").map(t=>`- ${t.title} (${t.assignee})`);
  const blockers=tasks
    .filter(t=>t.status!=="done")
    .map(t=>({task:t,risk:calculateRisk(t,tasks)}))
    .filter(x=>x.risk.level!=="low")
    .slice(0,4)
    .map(x=>`- ${x.task.title} (${x.task.assignee}) · ${x.risk.reasons.join(", ")}`);
  const lines=[
    "[어제 완료]",
    ...(doneToday.length?doneToday:["- 없음"]),
    "",
    "[오늘 할 일]",
    ...(todayPlan.length?todayPlan:["- 없음"]),
    "",
    "[막힌 점/리스크]",
    ...(blockers.length?blockers:["- 없음"]),
  ];
  return {text:lines.join("\n")};
}

function fallbackCommand({command="",members=[]}){
  const txt=(command||"").trim();
  const isCreate=/추가|만들|생성|등록|할당|배정/.test(txt);
  const dateMatch=txt.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const due=dateMatch?.[1]||(
    /내일/.test(txt)?addDays("",1):/모레/.test(txt)?addDays("",2):/오늘/.test(txt)?addDays("",0):""
  );
  const assignee=members.find(m=>txt.includes(m))||members[0]||"";
  const status=/완료/.test(txt)?"done":/진행/.test(txt)?"doing":/(준비|대기|백로그)/.test(txt)?"todo":"todo";
  const title=txt
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g," ")
    .replace(/(오늘|내일|모레|까지|에게|한테|담당|상태|로|으로|할당해줘|배정해줘|추가해줘|만들어줘|생성해줘|등록해줘)/g," ")
    .replace(/\s+/g," ")
    .trim();
  if(/상태.*(준비|진행|완료)|옮겨|이동/.test(txt)){
    return {action:"updateStatus",targetTitle:title,status};
  }
  if(isCreate){
    return {action:"create",task:{title:title||"새 업무",assignee,due,status}};
  }
  return {action:"unknown"};
}

function normalizeSummary(result){
  return {
    ...result,
    summaryLines:(result?.summaryLines||[]).filter(Boolean).slice(0,3),
    actionItems:(result?.actionItems||[]).filter(Boolean).slice(0,3),
    decisions:(result?.decisions||[]).filter(Boolean).slice(0,3),
  };
}

function normalizeTextValue(value){
  return (value||"").toLowerCase().replace(/\s+/g,"");
}

function findTaskByTitle(tasks,targetTitle){
  const target=normalizeTextValue(targetTitle);
  if(!target) return null;
  const exact=tasks.find(t=>normalizeTextValue(t.title)===target);
  if(exact) return exact;
  return tasks.find(t=>normalizeTextValue(t.title).includes(target)||target.includes(normalizeTextValue(t.title)))||null;
}

function calculateRisk(task,tasks){
  if(task.status==="done") return {level:"low",score:0,reasons:[]};
  let score=0;
  const reasons=[];
  if(task.due&&isOverdue(task.due)){score+=3;reasons.push("마감일 초과");}
  if(task.due&&!isOverdue(task.due)){
    const dueDate=new Date(`${toDateKey(task.due)}T00:00:00`);
    const diff=Math.ceil((dueDate-new Date())/(1000*60*60*24));
    if(diff<=1){score+=2;reasons.push("마감 임박");}
  }
  const assigneeOpen=tasks.filter(t=>t.status!=="done"&&t.assignee===task.assignee).length;
  if(assigneeOpen>=4){score+=2;reasons.push("담당자 업무량 높음");}
  if(/선행|의존|blocked|대기/i.test(task.description||"")){score+=1;reasons.push("선행 작업 확인 필요");}
  if(task.status==="todo"){score+=1;reasons.push("아직 시작 전");}
  const level=score>=4?"high":score>=2?"medium":"low";
  return {level,score,reasons};
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{--bg:#f8f7ff;--surface:#fff;--surface2:#f3f2ff;--border:#e8e6ff;--text:#1a1830;--text2:#6b6896;--accent:#6366f1;--accent2:#8b5cf6;--shadow:0 2px 12px rgba(99,102,241,0.08);--radius:14px;}
  body{font-family:'Pretendard',sans-serif;background:var(--bg);color:var(--text);}
  .auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;}
  .auth-card{background:#fff;border-radius:20px;padding:48px 40px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2);}
  .auth-logo{font-size:28px;font-weight:700;color:var(--accent);margin-bottom:8px;}
  .auth-subtitle{color:var(--text2);font-size:15px;margin-bottom:32px;}
  .auth-tabs{display:flex;gap:4px;background:var(--bg);border-radius:10px;padding:4px;margin-bottom:28px;}
  .auth-tab{flex:1;padding:10px;border:none;background:transparent;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;color:var(--text2);transition:all .2s;font-family:inherit;}
  .auth-tab.active{background:#fff;color:var(--accent);box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  .verify-box{background:#f0f0ff;border:1.5px solid #c7d2fe;border-radius:12px;padding:20px;margin-bottom:16px;}
  .verify-box-title{font-size:14px;font-weight:700;color:var(--accent);margin-bottom:6px;}
  .verify-box-desc{font-size:13px;color:var(--text2);line-height:1.8;}
  .field{margin-bottom:16px;}
  .field label{display:block;font-size:13px;font-weight:600;color:var(--text2);margin-bottom:6px;}
  .field input{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:10px;font-size:15px;outline:none;transition:border .2s;background:var(--bg);font-family:inherit;}
  .field input:focus{border-color:var(--accent);background:#fff;}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;border:none;transition:all .2s;font-family:inherit;}
  .btn-primary{background:var(--accent);color:#fff;width:100%;margin-top:8px;}
  .btn-primary:hover:not(:disabled){background:var(--accent2);transform:translateY(-1px);}
  .btn-primary:disabled{opacity:.5;cursor:not-allowed;}
  .btn-secondary{background:var(--surface2);color:var(--text);border:2px solid var(--border);}
  .btn-secondary:hover{border-color:var(--accent);color:var(--accent);}
  .btn-ghost{background:transparent;color:var(--text2);}
  .btn-ghost:hover{background:var(--surface2);}
  .btn-sm{padding:7px 14px;font-size:13px;}
  .onboarding-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:24px;}
  .onboarding-card{background:#fff;border-radius:20px;padding:48px 40px;width:100%;max-width:500px;box-shadow:0 8px 32px rgba(99,102,241,0.15);}
  .choice-btn{display:flex;align-items:center;gap:16px;width:100%;padding:20px 24px;border:2px solid var(--border);border-radius:14px;background:#fff;cursor:pointer;transition:all .2s;margin-bottom:12px;text-align:left;}
  .choice-btn:hover{border-color:var(--accent);background:var(--surface2);}
  .choice-icon{font-size:28px;width:48px;text-align:center;}
  .choice-label{font-size:16px;font-weight:600;color:var(--text);}
  .choice-desc{font-size:13px;color:var(--text2);margin-top:2px;}
  .main-layout{display:flex;height:100vh;overflow:hidden;}
  .sidebar{width:260px;background:#1a3a2a;color:#fff;display:flex;flex-direction:column;padding:28px 20px;flex-shrink:0;overflow-y:auto;}
  .sidebar-logo{font-size:20px;font-weight:700;margin-bottom:32px;}
  .sidebar-logo span{color:#4ade80;}
  .board-info{background:rgba(74,222,128,0.1);border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid rgba(74,222,128,0.15);}
  .board-name{font-size:16px;font-weight:600;margin-bottom:4px;}
  .board-code{font-size:12px;color:#a5b4fc;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
  .invite-code-badge{background:rgba(99,102,241,0.3);border-radius:6px;padding:2px 8px;font-family:monospace;font-size:13px;letter-spacing:2px;font-weight:700;}
  .sidebar-nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:#c4c0e8;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;margin-bottom:4px;border:none;background:transparent;width:100%;text-align:left;}
  .sidebar-nav-item:hover,.sidebar-nav-item.active{background:rgba(74,222,128,0.15);color:#4ade80;}
  .sidebar-section{font-size:11px;font-weight:600;color:#6b6896;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px 12px;}
  .member-item{display:flex;align-items:center;gap:10px;padding:8px 12px;}
  .avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}
  .member-name{font-size:13px;color:#c4c0e8;}
  .sidebar-footer{margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);}
  .main-content{flex:1;overflow-y:auto;padding:32px;}
  .content-layout{display:flex;gap:24px;}
  .content-main{flex:1;min-width:0;overflow:hidden;}
  .right-panel{width:340px;flex-shrink:0;}
  .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;}
  .page-title{font-size:24px;font-weight:700;}
  .page-sub{font-size:14px;color:var(--text2);margin-top:2px;}
  .kanban-board{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:20px;align-items:start;width:100%;}
  .kanban-col{background:var(--surface2);border-radius:var(--radius);padding:16px;height:600px;min-width:220px;}
  .col-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
  .col-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;}
  .col-dot{width:8px;height:8px;border-radius:50%;}
  .col-count{background:rgba(0,0,0,0.06);border-radius:20px;padding:2px 8px;font-size:12px;font-weight:600;}
  .col-droppable{height:520px;overflow-y:auto;}
  .col-droppable.drag-over{background:rgba(99,102,241,0.05);border-radius:10px;}
  .task-card{background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:grab;transition:all .15s;border:2px solid transparent;user-select:none;height:118px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;}
  .task-card:hover{box-shadow:0 4px 16px rgba(99,102,241,0.12);border-color:var(--border);transform:translateY(-1px);}
  .task-title{font-size:14px;font-weight:600;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;flex:1;}
  .task-meta{display:flex;align-items:center;justify-content:space-between;margin-top:6px;}
  .task-assignee{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);}
  .task-due{font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;}
  .task-due.today{background:#fef2f2;color:#dc2626;}
  .task-due.week{background:#fffbeb;color:#d97706;}
  .task-due.overdue{background:#fef2f2;color:#dc2626;}
  .task-due.normal{background:var(--surface2);color:var(--text2);}
  .risk-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px;white-space:nowrap;}
  .risk-badge.high{background:#fee2e2;color:#b91c1c;}
  .risk-badge.medium{background:#fef3c7;color:#92400e;}
  .risk-strip{display:flex;align-items:center;gap:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:600;margin-bottom:12px;}
  .add-task-btn{display:flex;align-items:center;gap:6px;width:100%;padding:10px 12px;border:2px dashed var(--border);border-radius:10px;background:transparent;color:var(--text2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;font-family:inherit;}
  .add-task-btn:hover{border-color:var(--accent);color:var(--accent);}
  .calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;width:100%;}
  .calendar-header-day{text-align:center;font-size:11px;font-weight:600;color:var(--text2);padding:8px 0;}
  .calendar-day{height:90px;min-height:90px;border-radius:8px;padding:6px;background:#fff;border:1.5px solid var(--border);cursor:pointer;transition:background .1s;overflow:hidden;}
  .calendar-day:hover{background:#f3f2ff;}
  .calendar-day.empty{background:transparent;border-color:transparent;cursor:default;}
  .calendar-day.empty:hover{background:transparent;}
  .calendar-day.today{border-color:var(--accent);background:rgba(99,102,241,0.04);}
  .calendar-day.is-holiday .calendar-day-num{color:#ef4444;}
  .calendar-day-num{font-size:13px;font-weight:600;margin-bottom:2px;}
  .calendar-day.today .calendar-day-num{color:var(--accent);}
  .calendar-task-dot{font-size:10px;padding:1px 5px;border-radius:4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px;backdrop-filter:blur(4px);}
  .modal{background:#fff;border-radius:20px;padding:32px;width:100%;max-width:520px;box-shadow:0 24px 64px rgba(0,0,0,0.2);animation:slideUp .2s ease;max-height:90vh;overflow-y:auto;}
  @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  .modal-title{font-size:20px;font-weight:700;margin-bottom:24px;}
  .select{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:10px;font-size:15px;outline:none;background:var(--bg);font-family:inherit;cursor:pointer;}
  .select:focus{border-color:var(--accent);}
  .modal-actions{display:flex;gap:10px;margin-top:24px;justify-content:flex-end;}
  .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;}
  .stat-card{background:#fff;border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);border:1.5px solid var(--border);}
  .stat-card.is-jumpable{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;}
  .stat-card.is-jumpable:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(99,102,241,0.14);}
  .stat-num{font-size:32px;font-weight:700;}
  .stat-label{font-size:13px;color:var(--text2);margin-top:4px;}
  .mobile-name-editor{display:none;align-items:center;gap:6px;}
  .mobile-name-btn{padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;background:#fff;color:var(--text);font-size:12px;font-weight:600;cursor:pointer;}
  .mobile-name-input{width:120px;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;outline:none;}
  .mobile-name-save{padding:6px 9px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;}
  .mobile-name-cancel{padding:6px 9px;border:1px solid var(--border);border-radius:8px;background:#fff;color:var(--text2);font-size:12px;cursor:pointer;}
  .toast{position:fixed;bottom:24px;right:24px;background:var(--text);color:#fff;padding:14px 20px;border-radius:12px;font-size:14px;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:toastIn .3s ease;}
  @keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .error-msg{color:#dc2626;font-size:13px;margin-top:8px;padding:10px 14px;background:#fef2f2;border-radius:8px;}
  .mini-calendar{background:#fff;border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);border:1.5px solid var(--border);position:sticky;top:0;}
  .mini-cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
  .mini-cal-title{font-size:13px;font-weight:700;}
  .mini-cal-nav{background:transparent;border:none;cursor:pointer;color:var(--text2);font-size:16px;padding:2px 8px;border-radius:6px;}
  .mini-cal-nav:hover{background:var(--surface2);}
  .mini-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
  .mini-cal-day-label{text-align:center;font-size:9px;font-weight:600;color:var(--text2);padding:3px 0;}
  .mini-cal-day-label.is-sunday{color:#ef4444;}
  .mini-cal-day{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;position:relative;transition:all .15s;}
  .mini-cal-day:hover{background:var(--surface2);}
  .mini-cal-day.empty{cursor:default;pointer-events:none;}
  .mini-cal-day.is-today{background:var(--accent);color:#fff;font-weight:700;}
  .mini-cal-day.is-today:hover{background:var(--accent2);}
  .mini-cal-day.is-selected{outline:2px solid var(--accent);color:var(--accent);font-weight:700;}
  .mini-cal-day.is-today.is-selected{outline:2px solid var(--accent2);}
  .mini-cal-day.is-holiday{color:#ef4444;}
  .mini-cal-dot{position:absolute;bottom:1px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:var(--accent);}
  .mini-cal-day.is-today .mini-cal-dot{background:#fff;}
  .day-tasks-panel{margin-top:16px;padding-top:16px;border-top:1.5px solid var(--border);}
  .day-tasks-label{font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
  .day-task-item{padding:10px 12px;border-radius:8px;background:var(--surface2);margin-bottom:6px;border-left:3px solid;}
  .day-task-name{font-size:12px;font-weight:600;color:var(--text);}
  .day-task-meta{font-size:11px;color:var(--text2);margin-top:3px;}
  .no-tasks-msg{font-size:12px;color:var(--text2);text-align:center;padding:12px 0;}
  .pin-input{display:flex;gap:8px;justify-content:center;margin:12px 0;}
  .pin-digit{width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;border:2px solid var(--border);border-radius:10px;outline:none;background:var(--bg);}
  .pin-digit:focus{border-color:var(--accent);}
  .notice-box{background:#fff;border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);border:1.5px solid var(--border);margin-top:16px;}
  .notice-box-title{font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text);}
  .notice-textarea{width:100%;padding:10px 12px;border:2px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:var(--bg);resize:none;line-height:1.6;min-height:72px;max-height:160px;overflow-y:auto;display:block;box-sizing:border-box;}
  .notice-textarea:focus{border-color:var(--accent);}
  .notice-item{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);}
  .notice-item:last-child{border-bottom:none;}
  .notice-text{flex:1;font-size:13px;line-height:1.6;color:var(--text);word-break:break-all;white-space:pre-wrap;}
  .notice-text.done{text-decoration:line-through;color:var(--text2);}
  .notice-meta{font-size:11px;color:var(--text2);margin-top:3px;}
  .notice-btn{background:transparent;border:none;cursor:pointer;font-size:14px;padding:3px 6px;border-radius:5px;color:var(--text2);}
  .notice-btn:hover{background:var(--surface2);}
  .ai-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
  .ai-btn{border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;}
  .ai-btn:disabled{opacity:.5;cursor:not-allowed;}
  .ai-summary{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:12px;line-height:1.6;}
  .ai-summary-title{font-weight:700;color:#334155;margin-bottom:4px;}
  .ai-inline{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
  .ai-reason{font-size:12px;color:var(--text2);margin-top:8px;line-height:1.5;}
  .breakdown-preview{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-top:8px;}
  .breakdown-preview ul{padding-left:18px;margin-top:6px;}
  .breakdown-preview li{font-size:12px;line-height:1.5;color:#334155;}
  .command-result{margin-bottom:12px;}
  .command-actions{display:flex;align-items:center;gap:8px;}
  .command-bar{display:flex;gap:8px;align-items:center;margin-bottom:14px;}
  .command-input{flex:1;padding:10px 12px;border:2px solid var(--border);border-radius:10px;font-size:13px;outline:none;background:#fff;}
  .command-input:focus{border-color:var(--accent);}
  .standup-modal{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;font-size:13px;line-height:1.6;max-height:45vh;overflow:auto;}
  @media(max-width:768px){
    .main-layout{flex-direction:column;height:auto;min-height:100vh;}
    .sidebar{width:100%;flex-direction:row;flex-wrap:wrap;padding:10px 14px;gap:6px;align-items:center;position:sticky;top:0;z-index:50;}
    .sidebar-logo{margin-bottom:0;font-size:15px;margin-right:8px;}
    .board-info{display:none;}
    .sidebar-section{display:none;}
    .member-item{display:none;}
    .sidebar-footer{margin-top:0;padding-top:0;border-top:none;margin-left:auto;}
    .sidebar-nav-item{padding:6px 10px;font-size:13px;margin-bottom:0;white-space:nowrap;}
    .main-content{padding:14px;}
    .mobile-name-editor{display:flex;}
    .content-layout{flex-direction:column;}
    .right-panel{width:100%!important;}
    .kanban-board{grid-template-columns:1fr;gap:10px;}
    .stat-grid{gap:8px;margin-bottom:16px;}
    .stat-card{padding:12px 10px;}
    .stat-label{font-size:12px;}
    .stat-num{font-size:24px;}
    .modal-overlay{padding:12px;align-items:flex-end;}
    .modal{padding:24px 18px;border-radius:16px 16px 0 0;max-width:100%;margin:0;}
    .command-bar{flex-direction:column;align-items:stretch;}
    .command-actions{width:100%;}
    .command-actions .btn{flex:1;}
  }
  @media(max-width:480px){.main-content{padding:10px;}.stat-num{font-size:20px;}}
  .comments-section{margin-top:20px;padding-top:20px;border-top:2px solid var(--border);}
  .comments-title{font-size:13px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;}
  .comment-item{display:flex;gap:10px;margin-bottom:14px;}
  .comment-body{flex:1;background:var(--surface2);border-radius:10px;padding:10px 14px;}
  .comment-header{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
  .comment-author{font-size:13px;font-weight:700;color:var(--text);}
  .comment-time{font-size:11px;color:var(--text2);}
  .comment-text{font-size:13px;line-height:1.6;color:var(--text);white-space:pre-wrap;word-break:break-all;}
  .comment-mention{color:var(--accent);font-weight:700;}
  .comment-input-wrap{display:flex;gap:8px;align-items:flex-end;margin-top:10px;}
  .comment-textarea{flex:1;padding:10px 12px;border:2px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:var(--bg);resize:none;line-height:1.6;min-height:60px;}
  .comment-textarea:focus{border-color:var(--accent);}
  .mention-dropdown{position:absolute;background:#fff;border:1.5px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:200;min-width:160px;overflow:hidden;}
  .mention-item{padding:9px 14px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px;}
  .mention-item:hover{background:var(--surface2);color:var(--accent);}
`;


function Avatar({name}) {
  return <div className="avatar" style={{background:getAvatarColor(name),color:"#fff"}}>{(name||"?")[0].toUpperCase()}</div>;
}

function Toast({msg,onClose}) {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[]);
  return <div className="toast">✓ {msg}</div>;
}

function AuthPage({onLogin}) {
  const [tab,setTab]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [step,setStep]=useState("form");

  const handleSignup=async()=>{
    setError("");
    if(!name.trim()){setError("이름을 입력해주세요.");return;}
    if(!email.trim()){setError("이메일을 입력해주세요.");return;}
    if(password.length<6){setError("비밀번호는 6자 이상이어야 합니다.");return;}
    setLoading(true);
    const{error:err}=await supabase.auth.signUp({email,password,options:{data:{name}}});
    setLoading(false);
    if(err){setError(err.message);return;}
    setStep("verify");
  };

  const handleLogin=async()=>{
    setError("");
    if(!email||!password){setError("이메일과 비밀번호를 입력해주세요.");return;}
    setLoading(true);
    const{data,error:err}=await supabase.auth.signInWithPassword({email,password});
    setLoading(false);
    if(err){setError(err.message);return;}
    const u=data.user;
    const{data:bm}=await supabase.from("board_members").select("name").eq("user_id",u.id).order("joined_at",{ascending:false}).limit(1).maybeSingle();
    const uname=bm?.name||u.user_metadata?.name||u.email.split("@")[0];
    onLogin({id:u.id,email:u.email,name:uname});
  };

  if(step==="verify") return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">✦ Werki</div>
        <div className="verify-box" style={{marginTop:8}}>
          <div className="verify-box-title">📬 인증 이메일을 확인해주세요!</div>
          <div className="verify-box-desc">
            <b>{email}</b>로 인증 링크를 보냈습니다.<br/>
            링크를 클릭하면 가입이 완료됩니다.<br/>
            <span style={{fontSize:12,color:"#a5b4fc"}}>스팸함도 확인해보세요.</span>
          </div>
        </div>
        <button className="btn btn-primary" style={{marginTop:8}}
          onClick={()=>{setStep("form");setTab("login");setPassword("");}}>
          로그인하러 가기 →
        </button>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">✦ Werki</div>
        <div className="auth-subtitle">팀과 함께 일정을 관리하세요</div>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab==="login"?"active":""}`} onClick={()=>{setTab("login");setError("");}}>로그인</button>
          <button className={`auth-tab ${tab==="signup"?"active":""}`} onClick={()=>{setTab("signup");setError("");}}>회원가입</button>
        </div>
        {tab==="signup"&&<div className="field"><label>이름</label><input placeholder="홍길동" value={name} onChange={e=>setName(e.target.value)}/></div>}
        <div className="field"><label>이메일</label><input type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
        <div className="field"><label>비밀번호</label>
          <input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&(tab==="login"?handleLogin():handleSignup())}/>
        </div>
        {error&&<div className="error-msg">{error}</div>}
        <button className="btn btn-primary" disabled={loading} onClick={tab==="login"?handleLogin:handleSignup}>
          {loading?"처리 중...":tab==="login"?"로그인":"계정 만들기"}
        </button>
      </div>
    </div>
  );
}

function OnboardingPage({user,onEnterBoard}) {
  const [mode,setMode]=useState(null);
  const [inviteCode,setInviteCode]=useState("");
  const [boardName,setBoardName]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [myBoards,setMyBoards]=useState([]);
  const [boardsLoading,setBoardsLoading]=useState(true);
  const [deletingBoard,setDeletingBoard]=useState(null);
  const [deletePin,setDeletePin]=useState("");
  const [deleteError,setDeleteError]=useState("");
  const [deleteLoading,setDeleteLoading]=useState(false);

  const handleDeleteBoard=async()=>{
    if(deletePin!=="1234"){setDeleteError("비밀번호가 틀렸습니다.");setDeletePin("");return;}
    setDeleteLoading(true);
    await supabase.from("tasks").delete().eq("board_id",deletingBoard.id);
    await supabase.from("notices").delete().eq("board_id",deletingBoard.id);
    await supabase.from("board_members").delete().eq("board_id",deletingBoard.id);
    await supabase.from("boards").delete().eq("id",deletingBoard.id);
    setMyBoards(p=>p.filter(b=>b.id!==deletingBoard.id));
    setDeletingBoard(null);setDeletePin("");setDeleteError("");
    setDeleteLoading(false);
  };

  useEffect(()=>{
    (async()=>{
      setBoardsLoading(true);
      const{data}=await supabase.from("board_members")
        .select("board_id,boards(id,name,invite_code)")
        .eq("user_id",user.id);
      if(data&&data.length>0){
        setMyBoards(data.map(d=>d.boards).filter(Boolean));
      }
      setBoardsLoading(false);
    })();
  },[]);

  const handleCreate=async()=>{
    if(!boardName.trim()){setError("보드 이름을 입력해주세요.");return;}
    setLoading(true);
    const code=generateInviteCode();
    const{data:board,error:e1}=await supabase.from("boards")
      .insert({name:boardName,invite_code:code,created_by:user.id}).select().single();
    if(e1){setError(e1.message);setLoading(false);return;}
    const{data:existingMember}=await supabase.from("board_members").select("id").eq("board_id",board.id).eq("user_id",user.id).maybeSingle();
    if(!existingMember){await supabase.from("board_members").insert({board_id:board.id,user_id:user.id,name:user.name});}
    setLoading(false);
    onEnterBoard({id:board.id,name:board.name,inviteCode:board.invite_code});
  };

  const handleJoin=async()=>{
    if(inviteCode.length!==6){setError("6자리 코드를 입력해주세요.");return;}
    setLoading(true);
    const { data:board, error:e1 } = await supabase
      .rpc("join_board_by_invite", {
        p_invite_code: inviteCode,
        p_member_name: user.name
      })
      .single();
    if(e1||!board){
      setError("존재하지 않는 초대 코드입니다.");
      setLoading(false);
      return;
    }
    setLoading(false);
    onEnterBoard({id:board.id,name:board.name,inviteCode:board.invite_code});
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="auth-logo" style={{marginBottom:4}}>✦ Werki</div>
        <div style={{fontSize:14,color:"var(--text2)",marginBottom:28}}>안녕하세요, {user.name}님 👋</div>
        {!mode?(
          <>
            {boardsLoading?(
              <div style={{textAlign:"center",color:"var(--text2)",padding:"20px 0"}}>⏳ 보드 목록 불러오는 중...</div>
            ):myBoards.length>0&&(
              <>
                <div style={{fontSize:16,fontWeight:700,marginBottom:12}}>내 보드</div>
                {myBoards.map(b=>(
                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <button className="choice-btn" style={{flex:1,marginBottom:0}} onClick={()=>onEnterBoard({id:b.id,name:b.name,inviteCode:b.invite_code})}>
                      <span className="choice-icon">📋</span>
                      <div>
                        <div className="choice-label">{b.name}</div>
                        <div className="choice-desc">초대코드: {b.invite_code}</div>
                      </div>
                    </button>
                    <button onClick={e=>{e.stopPropagation();setDeletingBoard(b);setDeletePin("");setDeleteError("");}}
                      style={{flexShrink:0,background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:10,padding:"10px 14px",cursor:"pointer",fontSize:16,color:"#dc2626"}}>
                      🗑
                    </button>
                  </div>
                ))}
                <div style={{borderTop:"1.5px solid var(--border)",margin:"20px 0"}}/>
                {deletingBoard&&(
                  <div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:12,padding:"16px 20px",marginBottom:16}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#dc2626",marginBottom:4}}>🗑 보드 삭제</div>
                    <div style={{fontSize:13,color:"var(--text2)",marginBottom:12}}>
                      <b style={{color:"var(--text)"}}>{deletingBoard.name}</b> 보드와 모든 일정이 영구 삭제됩니다.
                    </div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>삭제 비밀번호</div>
                    <input type="password" placeholder="비밀번호 입력" value={deletePin}
                      onChange={e=>{setDeletePin(e.target.value);setDeleteError("");}}
                      onKeyDown={e=>e.key==="Enter"&&handleDeleteBoard()}
                      style={{width:"100%",padding:"10px 14px",border:"2px solid #fecaca",borderRadius:8,fontSize:15,fontFamily:"inherit",outline:"none",background:"#fff",boxSizing:"border-box",marginBottom:8}}
                      autoFocus/>
                    {deleteError&&<div style={{fontSize:13,color:"#dc2626",marginBottom:8}}>{deleteError}</div>}
                    <div style={{display:"flex",gap:8}}>
                      <button className="btn btn-secondary btn-sm" style={{flex:1}}
                        onClick={()=>{setDeletingBoard(null);setDeletePin("");setDeleteError("");}}>취소</button>
                      <button className="btn btn-sm" style={{flex:1,background:"#dc2626",color:"#fff"}}
                        disabled={deleteLoading} onClick={handleDeleteBoard}>
                        {deleteLoading?"삭제 중...":"삭제 확인"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            <div style={{fontSize:myBoards.length>0?16:22,fontWeight:700,marginBottom:8}}>{myBoards.length>0?"다른 보드":"시작하기"}</div>
            {myBoards.length===0&&<div style={{color:"var(--text2)",marginBottom:24}}>새 팀 보드를 만들거나 기존 보드에 참여하세요.</div>}
            <button className="choice-btn" onClick={()=>setMode("create")}>
              <span className="choice-icon">🚀</span>
              <div><div className="choice-label">새 팀 보드 만들기</div><div className="choice-desc">보드를 생성하고 팀원을 초대하세요</div></div>
            </button>
            <button className="choice-btn" onClick={()=>setMode("join")}>
              <span className="choice-icon">🔗</span>
              <div><div className="choice-label">기존 보드에 참여하기</div><div className="choice-desc">초대 코드 6자리를 입력해 합류하세요</div></div>
            </button>
          </>
        ):mode==="create"?(
          <>
            <div style={{fontSize:22,fontWeight:700,marginBottom:20}}>새 팀 보드</div>
            <div className="field"><label>보드 이름</label>
              <input placeholder="예: 마케팅팀 Q2 프로젝트" value={boardName} onChange={e=>setBoardName(e.target.value)}/>
            </div>
            {error&&<div className="error-msg">{error}</div>}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>{setMode(null);setError("");}}>← 뒤로</button>
              <button className="btn btn-primary" style={{flex:1}} disabled={loading} onClick={handleCreate}>
                {loading?"생성 중...":"보드 만들기"}
              </button>
            </div>
          </>
        ):(
          <>
            <div style={{fontSize:22,fontWeight:700,marginBottom:20}}>보드 참여하기</div>
            <div className="field"><label>초대 코드 (6자리)</label>
              <input placeholder="123456" maxLength={6} value={inviteCode} onChange={e=>setInviteCode(e.target.value)}
                style={{letterSpacing:4,fontSize:20,textAlign:"center"}}/>
            </div>
            {error&&<div className="error-msg">{error}</div>}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>{setMode(null);setError("");}}>← 뒤로</button>
              <button className="btn btn-primary" style={{flex:1}} disabled={loading} onClick={handleJoin}>
                {loading?"참여 중...":"참여하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PinModal({onSuccess,onClose,title="비밀번호 입력"}) {
  const [pin,setPin]=useState(["","","",""]);
  const [error,setError]=useState(false);
  const r0=useRef(null);const r1=useRef(null);const r2=useRef(null);const r3=useRef(null);
  const refs=[r0,r1,r2,r3];

  useEffect(()=>{setTimeout(()=>r0.current&&r0.current.focus(),100);},[]);

  const handleChange=(i,v)=>{
    if(!/^\d*$/.test(v))return;
    const np=[...pin];np[i]=v.slice(-1);setPin(np);setError(false);
    if(v&&i<3)refs[i+1].current.focus();
    if(np.every(d=>d)){
      const code=np.join("");
      const ok=onSuccess(code);
      if(!ok){setError(true);setPin(["","","",""]);setTimeout(()=>r0.current&&r0.current.focus(),50);}
    }
  };
  const handleKey=(i,e)=>{if(e.key==="Backspace"&&!pin[i]&&i>0)refs[i-1].current.focus();};

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:320,textAlign:"center"}}>
        <div className="modal-title">{title}</div>
        <div style={{fontSize:13,color:"var(--text2)",marginBottom:8}}>4자리 숫자를 입력하세요</div>
        <div className="pin-input">
          {pin.map((d,i)=>(
            <input key={i} ref={refs[i]} className="pin-digit" type="password" inputMode="numeric"
              maxLength={1} value={d} onChange={e=>handleChange(i,e.target.value)}
              onKeyDown={e=>handleKey(i,e)}/>
          ))}
        </div>
        {error&&<div style={{color:"#dc2626",fontSize:13,marginBottom:8}}>비밀번호가 틀렸어요 🔒</div>}
        <button className="btn btn-secondary btn-sm" onClick={onClose} style={{width:"100%"}}>취소</button>
      </div>
    </div>
  );
}

function formatCommentTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if(diff < 60) return '방금 전';
  if(diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if(diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  return d.toLocaleDateString('ko-KR',{month:'short',day:'numeric'});
}

function renderCommentText(text) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((p,i) =>
    p.startsWith('@')
      ? <span key={i} className="comment-mention">{p}</span>
      : p
  );
}

function CommentSection({taskId, currentUser, members}) {
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [summary,setSummary]=useState(null);
  const [summaryLoading,setSummaryLoading]=useState(false);
  const textareaRef = useRef(null);

  useEffect(()=>{
    (async()=>{
      const{data}=await supabase.from('task_comments').select().eq('task_id',taskId).order('created_at');
      if(data) setComments(data);
    })();
    const sub = supabase.channel('comments:'+taskId)
      .on('postgres_changes',{event:'*',schema:'public',table:'task_comments',filter:`task_id=eq.${taskId}`},
        payload=>{
          if(payload.eventType==='INSERT') setComments(p=>p.some(c=>c.id===payload.new.id)?p:[...p,payload.new]);
          if(payload.eventType==='DELETE') setComments(p=>p.filter(c=>c.id!==payload.old.id));
        }).subscribe();
    return()=>supabase.removeChannel(sub);
  },[taskId]);

  const handleInput = (e) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if(match) {
      setMentionQuery(match[1]);
      setShowMention(true);
    } else {
      setShowMention(false);
    }
  };

  const insertMention = (name) => {
    const cursor = textareaRef.current?.selectionStart || input.length;
    const before = input.slice(0, cursor).replace(/@\w*$/, '');
    const after = input.slice(cursor);
    const newVal = before + '@' + name + ' ' + after;
    setInput(newVal);
    setShowMention(false);
    setTimeout(()=>textareaRef.current?.focus(), 0);
  };

  const filteredMembers = members.filter(m =>
    m !== currentUser.name && m.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleSubmit = async() => {
    const text = input.trim();
    if(!text || loading) return;
    setLoading(true);
    const{data} = await supabase.from('task_comments').insert({
      task_id: taskId,
      author: currentUser.name,
      text
    }).select().single();
    if(data) setComments(p=>p.some(c=>c.id===data.id)?p:[...p,data]);
    setInput('');
    setLoading(false);
  };

  const handleDelete = async(id) => {
    const{error} = await supabase.from('task_comments').delete().eq('id', id);
    if(!error) setComments(p=>p.filter(c=>c.id!==id));
  };

  const handleSummarize=async()=>{
    if(comments.length===0||summaryLoading) return;
    setSummaryLoading(true);
    const result=await invokeAI(
      "summarize_comments",
      {items:comments.map(c=>({author:c.author,text:c.text,created_at:c.created_at}))},
      fallbackSummarize
    );
    setSummary(normalizeSummary(result));
    setSummaryLoading(false);
  };

  return (
    <div className="comments-section">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8}}>
        <div className="comments-title" style={{marginBottom:0}}>💬 댓글 {comments.length > 0 && `(${comments.length})`}</div>
        <button className="ai-btn" disabled={summaryLoading||comments.length===0} onClick={handleSummarize}>
          {summaryLoading?"요약 중...":"✨ AI 요약"}
        </button>
      </div>
      {summary&&(
        <div className="ai-summary">
          <div className="ai-summary-title">핵심 요약</div>
          {(summary.summaryLines||[]).length>0?(summary.summaryLines||[]).map((line,i)=><div key={i}>• {line}</div>):<div>• 최근 코멘트 중심으로 요약했어요.</div>}
          {(summary.decisions||[]).length>0&&(
            <>
              <div className="ai-summary-title" style={{marginTop:6}}>결정사항</div>
              {(summary.decisions||[]).map((line,i)=><div key={`d-${i}`}>• {line}</div>)}
            </>
          )}
          {(summary.actionItems||[]).length>0&&(
            <>
              <div className="ai-summary-title" style={{marginTop:6}}>할 일</div>
              {(summary.actionItems||[]).map((line,i)=><div key={`a-${i}`}>• {line}</div>)}
            </>
          )}
        </div>
      )}
      {comments.length === 0
        ? <div style={{fontSize:13,color:'var(--text2)',textAlign:'center',padding:'10px 0'}}>아직 댓글이 없어요</div>
        : comments.map(c=>(
          <div key={c.id} className="comment-item">
            <Avatar name={c.author}/>
            <div className="comment-body">
              <div className="comment-header">
                <span className="comment-author">{c.author}</span>
                <span className="comment-time">{formatCommentTime(c.created_at)}</span>
                {c.author===currentUser.name&&(
                  <button onClick={()=>handleDelete(c.id)}
                    style={{marginLeft:'auto',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,cursor:'pointer',fontSize:11,color:'#dc2626',padding:'2px 8px',flexShrink:0}}>삭제</button>
                )}
              </div>
              <div className="comment-text">{renderCommentText(c.text)}</div>
            </div>
          </div>
        ))
      }
      <div className="comment-input-wrap" style={{position:'relative'}}>
        <Avatar name={currentUser.name}/>
        <div style={{flex:1,position:'relative'}}>
          <textarea ref={textareaRef} className="comment-textarea"
            placeholder={"댓글을 입력하세요... (@이름 으로 멘션)"}
            value={input} onChange={handleInput}
            onKeyDown={e=>{
              if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();handleSubmit();}
              if(e.key==='Escape') setShowMention(false);
            }}/>
          {showMention && filteredMembers.length > 0 && (
            <div className="mention-dropdown" style={{position:'absolute',bottom:'calc(100% + 4px)',left:0}}>
              {filteredMembers.map(m=>(
                <div key={m} className="mention-item" onMouseDown={e=>{e.preventDefault();insertMention(m);}}>
                  <Avatar name={m}/> {m}
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-primary btn-sm" style={{marginTop:0,height:40,alignSelf:'flex-end'}}
          disabled={loading||!input.trim()} onClick={handleSubmit}>등록</button>
      </div>
    </div>
  );
}

function TaskModal({task,members,currentUser,tasks=[],onSave,onDelete,onClose}) {
  const [title,setTitle]=useState(task?.title||"");
  const [description,setDescription]=useState(task?.description||"");
  const [assignee,setAssignee]=useState(task?.assignee||members[0]||"");
  const [due,setDue]=useState(task?.due||"");
  const [status,setStatus]=useState(task?.status||"todo");
  const [recommendLoading,setRecommendLoading]=useState(false);
  const [recommendReason,setRecommendReason]=useState("");
  const [breakdownLoading,setBreakdownLoading]=useState(false);
  const [breakdown,setBreakdown]=useState(null);
  const [createSubtasks,setCreateSubtasks]=useState(true);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [pinUnlocked,setPinUnlocked]=useState(!task?.pin);
  const [pinSet,setPinSet]=useState(false);
  const [newPin,setNewPin]=useState(["","","",""]);
  const pr0=useRef(null);const pr1=useRef(null);const pr2=useRef(null);const pr3=useRef(null);
  const pinRefs=[pr0,pr1,pr2,pr3];

  const isNew=!task?.id;
  const isCreator=isNew||(task?.created_by===currentUser?.name);
  const isAssignee=task?.assignee===currentUser?.name;
  const canEdit=isNew||isCreator||isAssignee;

  if(!pinUnlocked){
    return <PinModal title="일정 비밀번호" onSuccess={(code)=>{
      if(code===task.pin){setPinUnlocked(true);return true;}
      return false;
    }} onClose={onClose}/>;
  }

  const handleNewPinChange=(i,v)=>{
    if(!/^\d*$/.test(v))return;
    const np=[...newPin];np[i]=v.slice(-1);setNewPin(np);
    if(v&&i<3)pinRefs[i+1].current.focus();
  };
  const handleNewPinKey=(i,e)=>{if(e.key==="Backspace"&&!newPin[i]&&i>0)pinRefs[i-1].current.focus();};
  const canRunAi=Boolean((title||description).trim());

  const handleRecommend=async()=>{
    if(recommendLoading||!canRunAi) return;
    setRecommendLoading(true);
    const result=await invokeAI(
      "recommend_assignee_due",
      {title,description,members,tasks},
      fallbackRecommend
    );
    if(result?.assignee&&members.includes(result.assignee)) setAssignee(result.assignee);
    if(result?.due) setDue(toDateKey(result.due));
    setRecommendReason(result?.reason||"업무량/처리속도 기준 추천값을 적용했습니다.");
    setRecommendLoading(false);
  };

  const handleBreakdown=async()=>{
    if(breakdownLoading||!canRunAi) return;
    setBreakdownLoading(true);
    const result=await invokeAI(
      "breakdown_task",
      {title,description},
      fallbackBreakdown
    );
    setBreakdown({
      checklist:(result?.checklist||[]).slice(0,5),
      subtasks:(result?.subtasks||[]).slice(0,5),
    });
    setBreakdownLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{isNew?"새 일정":"일정 수정"}</div>
        <div className="field">
          <label>제목</label>
          <input placeholder="일정 제목을 입력하세요" value={title}
            onChange={e=>setTitle(e.target.value)} autoFocus
            disabled={!!(task?.id&&!canEdit)}/>
        </div>
        <div className="field">
          <label>업무 내용 <span style={{fontWeight:400,color:"var(--text2)"}}>(선택)</span></label>
          <textarea rows={3} placeholder="업무 내용을 간략히 입력하세요" value={description}
            onChange={e=>setDescription(e.target.value)} disabled={!!(task?.id&&!canEdit)}
            style={{width:"100%",padding:"12px 16px",border:"2px solid var(--border)",borderRadius:10,fontSize:14,fontFamily:"inherit",outline:"none",background:"var(--bg)",resize:"none",lineHeight:1.6,boxSizing:"border-box"}}/>
          {canEdit&&(
            <div className="ai-inline">
              <button className="ai-btn" disabled={!canRunAi||breakdownLoading} onClick={handleBreakdown}>
                {breakdownLoading?"분해 중...":"✨ 자동 쪼개기"}
              </button>
              <button className="ai-btn" disabled={!canRunAi||recommendLoading} onClick={handleRecommend}>
                {recommendLoading?"추천 중...":"✨ 담당/마감 추천"}
              </button>
            </div>
          )}
          {recommendReason&&<div className="ai-reason">추천 사유: {recommendReason}</div>}
          {breakdown&&(
            <div className="breakdown-preview">
              <div className="ai-summary-title">자동 체크리스트</div>
              <ul>
                {breakdown.checklist.length>0
                  ? breakdown.checklist.map((line,i)=><li key={`ck-${i}`}>{line}</li>)
                  : <li>요구사항을 더 구체적으로 입력하면 정확도가 올라가요.</li>}
              </ul>
              {isNew&&breakdown.subtasks.length>0&&(
                <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,marginTop:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={createSubtasks} onChange={e=>setCreateSubtasks(e.target.checked)}/>
                  저장 시 하위 태스크 {breakdown.subtasks.length}개 자동 생성
                </label>
              )}
            </div>
          )}
        </div>
        <div className="field">
          <label>담당자</label>
          <select className="select" value={assignee} onChange={e=>setAssignee(e.target.value)}>
            {members.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label>마감일</label>
          <input type="date" value={due} onChange={e=>setDue(e.target.value)}
            disabled={!!(task?.id&&!canEdit)}
            style={{width:"100%",padding:"12px 16px",border:"2px solid var(--border)",borderRadius:10,fontSize:15,fontFamily:"inherit",outline:"none",background:"var(--bg)"}}/>
        </div>
        <div className="field">
          <label>상태</label>
          <select className="select" value={status} onChange={e=>setStatus(e.target.value)}
            disabled={!!(task?.id&&!isAssignee&&!isCreator)}>
            {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {isNew&&(
          <div className="field">
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
                <input type="checkbox" checked={pinSet} onChange={e=>setPinSet(e.target.checked)}/>
                🔒 비밀번호 설정 <span style={{fontWeight:400,fontSize:12,color:"var(--text2)"}}>(선택)</span>
              </label>
              {pinSet&&(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,color:"var(--text2)",whiteSpace:"nowrap"}}>4자리:</span>
                  <div style={{display:"flex",gap:6}}>
                    {newPin.map((d,i)=>(
                      <input key={i} ref={pinRefs[i]} className="pin-digit" type="password" inputMode="numeric"
                        maxLength={1} value={d} onChange={e=>handleNewPinChange(i,e.target.value)}
                        onKeyDown={e=>handleNewPinKey(i,e)}
                        style={{width:36,height:40,fontSize:18}}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {confirmDelete?(
          <div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:10,padding:"14px 16px",marginTop:16}}>
            <div style={{fontSize:14,fontWeight:600,color:"#dc2626",marginBottom:10}}>정말 삭제할까요?</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={()=>setConfirmDelete(false)}>취소</button>
              <button className="btn btn-sm" style={{flex:1,background:"#dc2626",color:"#fff"}} onClick={()=>{onDelete(task.id);onClose();}}>삭제</button>
            </div>
          </div>
        ):(
          <div className="modal-actions">
            {!isNew&&(isCreator||(isAssignee&&task?.status==="done"))&&(
              <button className="btn btn-sm" style={{background:"#fef2f2",color:"#dc2626",marginRight:"auto"}}
                onClick={()=>setConfirmDelete(true)}>🗑 삭제</button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={onClose}>닫기</button>
            {canEdit&&(
              <button className="btn btn-primary btn-sm" style={{marginTop:0}} onClick={()=>{
                if(!title.trim())return;
                const pin=(isNew&&pinSet&&newPin.every(d=>d))?newPin.join(""):task?.pin||null;
                onSave({
                  ...task,
                  title,
                  description,
                  assignee,
                  due,
                  status,
                  pin,
                  created_by:task?.created_by||currentUser?.name,
                  generatedSubtasks:isNew&&createSubtasks?(breakdown?.subtasks||[]):[],
                });
                onClose();
              }}>저장</button>
            )}
          </div>
        )}
        {!isNew&&(
          <CommentSection taskId={task.id} currentUser={currentUser} members={members}/>
        )}
      </div>
    </div>
  );
}

function TaskCard({task,risk,onEdit,onDelete,onDragStart}) {
  const [confirmDelete,setConfirmDelete]=useState(false);
  const getDueClass=()=>{
    if(!task.due)return"normal";
    if(isOverdue(task.due)&&task.status!=="done")return"overdue";
    if(isToday(task.due))return"today";
    if(isThisWeek(task.due))return"week";
    return"normal";
  };
  return (
    <div className="task-card" draggable
      onDragStart={e=>onDragStart(e,task.id)}
      onClick={()=>!confirmDelete&&onEdit(task)}>
      <div className="task-title" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:4}}>
        <span style={{flex:1,minWidth:0}}>
          {task.pin&&<span style={{fontSize:11,marginRight:4}}>🔒</span>}
          {task.title}
          {risk&&risk.level!=="low"&&task.status!=="done"&&(
            <span
              className={`risk-badge ${risk.level}`}
              title={risk.reasons.join(", ")}
              style={{marginLeft:6,verticalAlign:"middle"}}
            >
              위험 {risk.level==="high"?"높음":"중간"}
            </span>
          )}
        </span>
        {confirmDelete
          ?<div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}} onClick={e=>e.stopPropagation()}>
             <span style={{fontSize:11,color:"#dc2626",whiteSpace:"nowrap"}}>삭제?</span>
             <button onClick={()=>onDelete(task.id)} style={{fontSize:11,padding:"2px 6px",background:"#dc2626",color:"#fff",border:"none",borderRadius:4,cursor:"pointer"}}>확인</button>
             <button onClick={()=>setConfirmDelete(false)} style={{fontSize:11,padding:"2px 6px",background:"#eee",border:"none",borderRadius:4,cursor:"pointer"}}>취소</button>
           </div>
          :<button
             onClick={e=>{e.stopPropagation();setConfirmDelete(true);}}
             style={{flexShrink:0,background:"transparent",border:"none",cursor:"pointer",fontSize:13,color:"#ccc",padding:"0 2px",lineHeight:1}}
             title="삭제">🗑</button>
        }
      </div>
      <div className="task-meta">
        <div className="task-assignee"><Avatar name={task.assignee}/><span>{task.assignee}</span></div>
        {task.due&&<span className={`task-due ${getDueClass()}`}>{isToday(task.due)?"⚡ 오늘":formatDate(task.due)}</span>}
      </div>
    </div>
  );
}

function MiniCalendar({tasks,onAddTask,onMonthChange}) {
  const today=new Date();
  const todayStr=today.toISOString().slice(0,10);
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth());
  const [selected,setSelected]=useState(todayStr);

  const daysInMonth=getDaysInMonth(year,month);
  const firstDay=getFirstDayOfMonth(year,month);
  const monthStr=`${year}-${String(month+1).padStart(2,"0")}`;
  const cells=[...Array(firstDay).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while(cells.length%7!==0)cells.push(null);

  const getTasksForDate=dateStr=>tasks.filter(t=>t.due===dateStr);
  const selectedTasks=getTasksForDate(selected);
  const selectedLabel=new Date(selected+"T00:00:00").toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"});
  const holidayName=isHoliday(year,month,new Date(selected+"T00:00:00").getDate());

  const goMonth=(dir)=>{
    const ny=dir===1?(month===11?year+1:year):(month===0?year-1:year);
    const nm=dir===1?(month===11?0:month+1):(month===0?11:month-1);
    setYear(ny);setMonth(nm);
    onMonthChange&&onMonthChange(ny,nm);
  };

  return (
    <div className="mini-calendar">
      <div className="mini-cal-header">
        <button className="mini-cal-nav" onClick={()=>goMonth(-1)}>‹</button>
        <div className="mini-cal-title">{year}년 {month+1}월</div>
        <button className="mini-cal-nav" onClick={()=>goMonth(1)}>›</button>
      </div>
      <div className="mini-cal-grid">
        {["일","월","화","수","목","금","토"].map((d,di)=>(
          <div key={d} className={`mini-cal-day-label${di===0?" is-sunday":""}`}>{d}</div>
        ))}
        {cells.map((day,i)=>{
          if(!day)return<div key={i} className="mini-cal-day empty"/>;
          const dateStr=`${monthStr}-${String(day).padStart(2,"0")}`;
          const isTod=today.getDate()===day&&today.getMonth()===month&&today.getFullYear()===year;
          const isSel=selected===dateStr;
          const hasTasks=getTasksForDate(dateStr).length>0;
          const red=isRedDay(year,month,day);
          const hName=isHoliday(year,month,day);
          return (
            <div key={i} title={hName||undefined}
              className={`mini-cal-day${isTod?" is-today":""}${isSel?" is-selected":""}${red?" is-holiday":""}`}
              onClick={()=>setSelected(dateStr)}>
              {day}
              {hasTasks&&<div className="mini-cal-dot"/>}
            </div>
          );
        })}
      </div>
      <div className="day-tasks-panel">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div className="day-tasks-label" style={{marginBottom:0}}>
            📌 {selectedLabel}
            {holidayName&&<span style={{marginLeft:6,fontSize:11,color:"#ef4444",fontWeight:600}}>{holidayName}</span>}
          </div>
          {onAddTask&&(
            <button className="btn btn-primary btn-sm" style={{marginTop:0,padding:"4px 10px",fontSize:12}}
              onClick={()=>onAddTask(selected)}>+ 추가</button>
          )}
        </div>
        {selectedTasks.length===0
          ?<div className="no-tasks-msg">업무가 없어요</div>
          :selectedTasks.map(t=>{
            const s=STATUS_CONFIG[t.status];
            return (
              <div key={t.id} className="day-task-item" style={{borderLeftColor:s.color}}>
                <div className="day-task-name">{t.pin&&"🔒 "}{t.title}</div>
                <div className="day-task-meta">{t.assignee} · <span style={{color:s.color,fontWeight:600}}>{s.label}</span></div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

function KanbanView({tasks,setTasks,members,boardId,showToast,currentUser,calYear,calMonth}) {
  const [modalOpen,setModalOpen]=useState(false);
  const [editingTask,setEditingTask]=useState(null);
  const [dragId,setDragId]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const columnRefs=useRef({});
  const now=new Date();
  const defaultDue=(()=>{
    if(calYear==null||calMonth==null)return"";
    const day=Math.min(now.getDate(),getDaysInMonth(calYear,calMonth));
    return `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  })();

  const saveTask=async(task)=>{
    if(task.id){
      const{data,error}=await supabase.from("tasks")
        .update({title:task.title,description:task.description||null,assignee:task.assignee,due:task.due||null,status:task.status})
        .eq("id",task.id).select().single();
      if(error){showToast("수정오류: "+error.message);return;}
      setTasks(p=>p.map(t=>t.id===task.id?data:t));
      showToast(task.title+" 저장됨");
    } else {
      if(!boardId){showToast("오류: boardId 없음");return;}
      if(!currentUser){showToast("오류: 로그인 정보 없음");return;}
      const payload={board_id:boardId,title:task.title,description:task.description||null,assignee:task.assignee,due:task.due||defaultDue||null,status:task.status,pin:task.pin||null,created_by:currentUser?.name||""};
      const{data,error}=await supabase.from("tasks").insert(payload).select().single();
      if(error){showToast("추가오류: "+error.message);return;}
      const inserted=[data].filter(Boolean);
      const subtasks=(task.generatedSubtasks||[]).filter(Boolean).slice(0,6);
      if(data&&subtasks.length>0){
        const baseDue=task.due||defaultDue||addDays("",2);
        const subPayload=subtasks.map((sub,i)=>({
          board_id:boardId,
          title:`${task.title} · ${sub.title||`하위업무 ${i+1}`}`,
          description:`[자동 분해] ${task.title}의 하위 업무`,
          assignee:members.includes(sub.assignee)?sub.assignee:(task.assignee||members[0]||""),
          due:sub.due||addDays(baseDue,Number.isFinite(sub.dueOffsetDays)?sub.dueOffsetDays:(i+1)),
          status:sub.status||"todo",
          pin:null,
          created_by:currentUser?.name||"",
        }));
        const {data:subInserted,error:subError}=await supabase.from("tasks").insert(subPayload).select();
        if(!subError&&subInserted?.length) inserted.push(...subInserted);
      }
      if(inserted.length>0){
        setTasks(p=>{
          const seen=new Set(p.map(t=>t.id));
          return [...p,...inserted.filter(t=>!seen.has(t.id))];
        });
      }
      showToast(task.title+(subtasks.length?` + 하위 ${subtasks.length}개`:"")+" 추가됨");
    }
  };

  const deleteTask=async(id)=>{
    await supabase.from("tasks").delete().eq("id",id);
    setTasks(p=>p.filter(t=>t.id!==id));
    showToast("삭제됐습니다");
  };

  const handleDrop=async(e,status)=>{
    e.preventDefault();
    if(!dragId)return;
    await supabase.from("tasks").update({status}).eq("id",dragId);
    setTasks(p=>p.map(t=>t.id===dragId?{...t,status}:t));
    showToast(`"${STATUS_CONFIG[status].label}"로 이동됨`);
    setDragId(null);setDragOver(null);
  };

  const isCurrentMonth=!calYear||(calYear===now.getFullYear()&&calMonth===now.getMonth());
  const mStr=calYear!=null?`${calYear}-${String(calMonth+1).padStart(2,"0")}`:null;
  const displayTasks=mStr?tasks.filter(t=>toMonthKey(t.due)===mStr):tasks;
  const riskById=displayTasks.reduce((acc,t)=>{
    acc[t.id]=calculateRisk(t,tasks);
    return acc;
  },{});
  const highRiskCount=displayTasks.filter(t=>riskById[t.id]?.level==="high"&&t.status!=="done").length;
  const scrollToStatus=(status)=>{
    const el=columnRefs.current[status];
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
  };

  return (
    <div>
      {!isCurrentMonth&&(
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{background:"#ede9fe",color:"#7c3aed",borderRadius:20,padding:"5px 14px",fontSize:13,fontWeight:600}}>
            📅 {calYear}년 {calMonth+1}월 일정
          </div>
          <div style={{fontSize:12,color:"var(--text2)"}}>해당 월에 마감되는 업무만 표시돼요</div>
        </div>
      )}
      {highRiskCount>0&&(
        <div className="risk-strip">
          ⚠ 지연 위험 높은 업무 {highRiskCount}개 · 카드의 위험 뱃지를 눌러 사유를 확인하세요.
        </div>
      )}
      <div className="stat-grid">
        {Object.entries(STATUS_CONFIG).map(([k,v])=>(
          <div
            className="stat-card is-jumpable"
            key={k}
            style={{borderTop:`3px solid ${v.color}`}}
            role="button"
            tabIndex={0}
            onClick={()=>scrollToStatus(k)}
            onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")scrollToStatus(k);}}
          >
            <div className="stat-num" style={{color:v.color}}>{displayTasks.filter(t=>t.status===k).length}</div>
            <div className="stat-label">{v.label}</div>
          </div>
        ))}
      </div>
      <div className="kanban-board">
        {Object.entries(STATUS_CONFIG).map(([status,config])=>{
          const col=displayTasks.filter(t=>t.status===status);
          return (
            <div key={status} className="kanban-col" ref={el=>{columnRefs.current[status]=el;}}>
              <div className="col-header">
                <div className="col-title"><div className="col-dot" style={{background:config.color}}/>{config.label}</div>
                <span className="col-count">{col.length}</span>
              </div>
              <div className={`col-droppable ${dragOver===status?"drag-over":""}`}
                onDragOver={e=>{e.preventDefault();setDragOver(status);}}
                onDragLeave={()=>setDragOver(null)}
                onDrop={e=>handleDrop(e,status)}>
                {col.map(task=>(
                  <TaskCard key={task.id} task={task} risk={riskById[task.id]}
                    onEdit={t=>{setEditingTask(t);setModalOpen(true);}}
                    onDelete={deleteTask}
                    onDragStart={(_,id)=>setDragId(id)}/>
                ))}
                <button className="add-task-btn" onClick={()=>{setEditingTask({status,due:defaultDue});setModalOpen(true);}}>+ 추가</button>
              </div>
            </div>
          );
        })}
      </div>
      {modalOpen&&(
        <TaskModal task={editingTask} members={members} currentUser={currentUser} tasks={tasks}
          onSave={saveTask} onDelete={deleteTask}
          onClose={()=>{setModalOpen(false);setEditingTask(null);}}/>
      )}
    </div>
  );
}

function CalendarView({tasks,onAddTask,onMonthChange,year,month,setYear,setMonth}) {
  const today=new Date();
  const daysInMonth=getDaysInMonth(year,month);
  const firstDay=getFirstDayOfMonth(year,month);
  const monthStr=`${year}-${String(month+1).padStart(2,"0")}`;
  const monthTasks=tasks.filter(t=>toMonthKey(t.due)===monthStr);
  const getDay=d=>{
    const dateStr=`${monthStr}-${String(d).padStart(2,"0")}`;
    return monthTasks.filter(t=>toDateKey(t.due)===dateStr);
  };
  const cells=[...Array(firstDay).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while(cells.length%7!==0)cells.push(null);
  const todayTasks=monthTasks.filter(t=>t.due&&isToday(t.due)&&t.status!=="done");
  const weekTasks=monthTasks.filter(t=>t.due&&isThisWeek(t.due)&&!isToday(t.due)&&t.status!=="done");

  return (
    <div>
      {(todayTasks.length>0||weekTasks.length>0)&&(
        <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
          {todayTasks.length>0&&(
            <div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:12,padding:"14px 20px",flex:"1 1 200px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#dc2626",marginBottom:6}}>⚡ 오늘 마감</div>
              {todayTasks.map(t=><div key={t.id} style={{fontSize:14,fontWeight:600}}>{t.title} <span style={{color:"var(--text2)",fontWeight:400}}>— {t.assignee}</span></div>)}
            </div>
          )}
          {weekTasks.length>0&&(
            <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,padding:"14px 20px",flex:"1 1 200px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#d97706",marginBottom:6}}>📅 이번 주 마감</div>
              {weekTasks.map(t=><div key={t.id} style={{fontSize:14,fontWeight:600}}>{t.title} <span style={{color:"var(--text2)",fontWeight:400}}>— {formatDate(t.due)}</span></div>)}
            </div>
          )}
        </div>
      )}
      <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"var(--shadow)",border:"1.5px solid var(--border)",minWidth:0,width:"100%",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>{const ny=month===0?year-1:year;const nm=month===0?11:month-1;setYear(ny);setMonth(nm);onMonthChange&&onMonthChange(ny,nm);}}>←</button>
          <div style={{fontSize:18,fontWeight:700}}>{year}년 {month+1}월</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>{const ny=month===11?year+1:year;const nm=month===11?0:month+1;setYear(ny);setMonth(nm);onMonthChange&&onMonthChange(ny,nm);}}>→</button>
        </div>
        <div className="calendar-grid" style={{marginBottom:8}}>
          {["일","월","화","수","목","금","토"].map((d,di)=>(
            <div key={d} className="calendar-header-day" style={{color:di===0?"#ef4444":"inherit"}}>{d}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((day,i)=>{
            if(!day)return<div key={i} className="calendar-day empty"/>;
            const dt=getDay(day);
            const isT=today.getDate()===day&&today.getMonth()===month&&today.getFullYear()===year;
            const red=isRedDay(year,month,day);
            const hName=isHoliday(year,month,day);
            const dateStr=`${monthStr}-${String(day).padStart(2,"0")}`;
            return (
              <div key={i} className={`calendar-day${isT?" today":""}${red?" is-holiday":""}`}
                title={hName||undefined}
                onClick={()=>onAddTask&&onAddTask(dateStr)}>
                <div className="calendar-day-num">{day}</div>
                {hName&&<div style={{fontSize:9,color:"#ef4444",marginTop:1,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hName}</div>}
                {dt.slice(0,2).map(t=>{const s=STATUS_CONFIG[t.status];return<div key={t.id} className="calendar-task-dot" style={{background:s.bg,color:s.color}}>{t.title}</div>;})}
                {dt.length>2&&<div style={{fontSize:10,color:"var(--text2)"}}>+{dt.length-2}개</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NoticeBoard({boardId,currentUser}) {
  const [notices,setNotices]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [confirmClear,setConfirmClear]=useState(false);
  const [summary,setSummary]=useState(null);
  const [summaryLoading,setSummaryLoading]=useState(false);

  useEffect(()=>{
    (async()=>{
      const{data}=await supabase.from("notices").select().eq("board_id",boardId).order("created_at");
      if(data)setNotices(data);
    })();
    const sub=supabase.channel("notices:"+boardId)
      .on("postgres_changes",{event:"*",schema:"public",table:"notices",filter:`board_id=eq.${boardId}`},
        payload=>{
          if(payload.eventType==="INSERT")setNotices(p=>[...p,payload.new]);
          if(payload.eventType==="UPDATE")setNotices(p=>p.map(n=>n.id===payload.new.id?payload.new:n));
          if(payload.eventType==="DELETE")setNotices(p=>p.filter(n=>n.id!==payload.old.id));
        }).subscribe();
    return()=>{supabase.removeChannel(sub);};
  },[boardId]);

  const handleAdd=async()=>{
    const text=input.trim();if(!text||loading)return;
    setLoading(true);
    const{error}=await supabase.from("notices").insert({board_id:boardId,text,author:currentUser.name,done:false});
    if(!error)setInput("");
    setLoading(false);
  };

  const handleClearAll=async()=>{
    await supabase.from("notices").delete().eq("board_id",boardId);
    setNotices([]);
    setConfirmClear(false);
  };

  const handleSummarize=async()=>{
    if(notices.length===0||summaryLoading) return;
    setSummaryLoading(true);
    const result=await invokeAI(
      "summarize_notices",
      {items:notices.map(n=>({author:n.author,text:n.text,done:n.done,created_at:n.created_at}))},
      fallbackSummarize
    );
    setSummary(normalizeSummary(result));
    setSummaryLoading(false);
  };

  return (
    <div className="notice-box">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div className="notice-box-title" style={{marginBottom:0}}>📌 공통 중점 사항</div>
        {notices.length>0&&(
          confirmClear
            ?<div style={{display:"flex",gap:6,alignItems:"center"}}>
               <span style={{fontSize:12,color:"#dc2626"}}>전체 삭제?</span>
               <button onClick={handleClearAll} style={{fontSize:11,padding:"2px 8px",background:"#dc2626",color:"#fff",border:"none",borderRadius:5,cursor:"pointer"}}>확인</button>
               <button onClick={()=>setConfirmClear(false)} style={{fontSize:11,padding:"2px 8px",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:5,cursor:"pointer"}}>취소</button>
             </div>
            :<button onClick={()=>setConfirmClear(true)} style={{fontSize:11,padding:"3px 9px",background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:5,cursor:"pointer"}}>전체삭제</button>
        )}
      </div>
      <div className="ai-toolbar">
        <button className="ai-btn" disabled={summaryLoading||notices.length===0} onClick={handleSummarize}>
          {summaryLoading?"요약 중...":"✨ 공지 요약"}
        </button>
      </div>
      {summary&&(
        <div className="ai-summary">
          <div className="ai-summary-title">공지 요약</div>
          {(summary.summaryLines||[]).length>0?(summary.summaryLines||[]).map((line,i)=><div key={i}>• {line}</div>):<div>• 핵심 공지를 정리했어요.</div>}
          {(summary.decisions||[]).length>0&&(
            <>
              <div className="ai-summary-title" style={{marginTop:6}}>결정사항</div>
              {(summary.decisions||[]).map((line,i)=><div key={`nd-${i}`}>• {line}</div>)}
            </>
          )}
          {(summary.actionItems||[]).length>0&&(
            <>
              <div className="ai-summary-title" style={{marginTop:6}}>실행 항목</div>
              {(summary.actionItems||[]).map((line,i)=><div key={`na-${i}`}>• {line}</div>)}
            </>
          )}
        </div>
      )}
      <textarea className="notice-textarea"
        placeholder={"내용 입력\nShift+Enter 줄바꿈 / Enter 등록"}
        value={input} onChange={e=>setInput(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();handleAdd();}}}/>
      <button className="btn btn-primary btn-sm" style={{marginTop:8,width:"100%"}}
        disabled={loading||!input.trim()} onClick={handleAdd}>등록</button>
      <div style={{marginTop:12}}>
        {notices.length===0
          ?<div style={{fontSize:12,color:"var(--text2)",textAlign:"center",padding:"8px 0"}}>공지가 없어요</div>
          :notices.map(n=>(
            <div key={n.id} className="notice-item">
              <div style={{flex:1}}>
                <div className={"notice-text"+(n.done?" done":"")}>{n.text}</div>
                <div className="notice-meta">{n.author} · {new Date(n.created_at).toLocaleDateString("ko-KR",{month:"short",day:"numeric"})}</div>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0,marginTop:2}}>
                <button className="notice-btn" onClick={async()=>await supabase.from("notices").update({done:!n.done}).eq("id",n.id)}>
                  {n.done?"↩":"✓"}
                </button>
                <button className="notice-btn" style={{color:"#dc2626"}} onClick={async()=>await supabase.from("notices").delete().eq("id",n.id)}>🗑</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Dashboard({user:initialUser,board,onLogout}) {
  const [user,setUser]=useState(initialUser);
  const [tasks,setTasks]=useState([]);
  const [members,setMembers]=useState([]);
  const [view,setView]=useState("kanban");
  const [toast,setToast]=useState(null);
  const [copied,setCopied]=useState(false);
  const [calYear,setCalYear]=useState(new Date().getFullYear());
  const [calMonth,setCalMonth]=useState(new Date().getMonth());
  const [calModalDate,setCalModalDate]=useState(null);
  const [calViewYear,setCalViewYear]=useState(new Date().getFullYear());
  const [calViewMonth,setCalViewMonth]=useState(new Date().getMonth());
  const [editingName,setEditingName]=useState(false);
  const [nameInput,setNameInput]=useState(initialUser.name);
  const [commandInput,setCommandInput]=useState("");
  const [commandLoading,setCommandLoading]=useState(false);
  const [commandResult,setCommandResult]=useState("");
  const [standupOpen,setStandupOpen]=useState(false);
  const [standupLoading,setStandupLoading]=useState(false);
  const [standupText,setStandupText]=useState("");

  const handleNameSave=async()=>{
    const newName=nameInput.trim();
    const oldName=user.name;
    if(!newName||newName===oldName){setEditingName(false);return;}
    await supabase.from("board_members").update({name:newName}).eq("board_id",board.id).eq("user_id",user.id);
    await supabase.from("tasks").update({assignee:newName}).eq("board_id",board.id).eq("assignee",oldName);
    await supabase.from("tasks").update({created_by:newName}).eq("board_id",board.id).eq("created_by",oldName);
    setUser(prev=>({...prev,name:newName}));
    setMembers(p=>p.map(m=>m===oldName?newName:m));
    setTasks(p=>p.map(t=>({
      ...t,
      assignee:t.assignee===oldName?newName:t.assignee,
      created_by:t.created_by===oldName?newName:t.created_by,
    })));
    setNameInput(newName);
    setEditingName(false);
  };

  const handleBoardCommand=async()=>{
    const command=commandInput.trim();
    if(!command||commandLoading) return;
    setCommandLoading(true);
    const parsed=await invokeAI(
      "command_board",
      {command,members,tasks},
      fallbackCommand
    );
    let resultText="";
    if(parsed?.action==="create"){
      const t=parsed.task||{};
      const payload={
        board_id:board.id,
        title:(t.title||"새 업무").trim()||"새 업무",
        description:t.description||null,
        assignee:members.includes(t.assignee)?t.assignee:(members[0]||user.name),
        due:t.due||addDays("",3),
        status:Object.keys(STATUS_CONFIG).includes(t.status)?t.status:"todo",
        pin:null,
        created_by:user.name,
      };
      const {data,error}=await supabase.from("tasks").insert(payload).select().single();
      if(error){
        resultText=`명령 실패: ${error.message}`;
      }else if(data){
        setTasks(p=>p.some(x=>x.id===data.id)?p:[...p,data]);
        resultText=`업무 추가 완료: ${data.title}`;
      }
    }else if(parsed?.action==="updateStatus"){
      const target=findTaskByTitle(tasks,parsed.targetTitle);
      if(!target){
        resultText="변경할 업무를 찾지 못했어요. 업무명을 더 구체적으로 입력해 주세요.";
      }else{
        const nextStatus=Object.keys(STATUS_CONFIG).includes(parsed.status)?parsed.status:"todo";
        const {data,error}=await supabase.from("tasks").update({status:nextStatus}).eq("id",target.id).select().single();
        if(error){
          resultText=`상태 변경 실패: ${error.message}`;
        }else{
          setTasks(p=>p.map(x=>x.id===target.id?(data||{...x,status:nextStatus}):x));
          resultText=`${target.title} → ${STATUS_CONFIG[nextStatus].label}`;
        }
      }
    }else{
      resultText="명령을 이해하지 못했어요. 예: `내일 민수에게 QA 체크 추가해줘`";
    }
    setCommandResult(resultText);
    setToast(resultText);
    setCommandInput("");
    setCommandLoading(false);
  };

  const handleGenerateStandup=async()=>{
    if(standupLoading) return;
    setStandupOpen(true);
    setStandupLoading(true);
    const result=await invokeAI(
      "generate_standup",
      {tasks,members,date:toDateKey(new Date())},
      fallbackStandup
    );
    setStandupText(result?.text||"생성된 내용이 없습니다.");
    setStandupLoading(false);
  };

  useEffect(()=>{
    (async()=>{
      const{data:t}=await supabase.from("tasks").select().eq("board_id",board.id).order("created_at");
      if(t)setTasks(t);
      const{data:m}=await supabase.from("board_members").select("user_id,name").eq("board_id",board.id);
      if(m){
        const seen=new Set();
        setMembers(m.filter(x=>{if(seen.has(x.user_id))return false;seen.add(x.user_id);return true;}).map(x=>x.name));
      }
    })();

    const taskSub=supabase.channel("tasks:"+board.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"tasks",filter:`board_id=eq.${board.id}`},
        payload=>{
          if(payload.eventType==="UPDATE")setTasks(p=>p.map(t=>t.id===payload.new.id?payload.new:t));
          if(payload.eventType==="DELETE")setTasks(p=>p.filter(t=>t.id!==payload.old.id));
        }).subscribe();

    const memberSub=supabase.channel("members:"+board.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"board_members",filter:`board_id=eq.${board.id}`},
        payload=>setMembers(p=>[...new Set([...p,payload.new.name])])).subscribe();

    return()=>{supabase.removeChannel(taskSub);supabase.removeChannel(memberSub);};
  },[board.id]);

  return (
    <div className="main-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">✦ Wer<span>ki</span></div>
        <div className="board-info">
          <div className="board-name">{board.name}</div>
          <div className="board-code">
            초대코드 <span className="invite-code-badge">{board.inviteCode}</span>
            <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#a5b4fc",fontSize:13}}
              onClick={()=>{navigator.clipboard?.writeText(board.inviteCode);setCopied(true);setTimeout(()=>setCopied(false),2000);}}>
              {copied?"✓":"복사"}
            </button>
          </div>
        </div>
        <div className="sidebar-section">메뉴</div>
        <button className={`sidebar-nav-item ${view==="kanban"?"active":""}`} onClick={()=>setView("kanban")}>📋 Dash Board</button>
        <button className={`sidebar-nav-item ${view==="calendar"?"active":""}`} onClick={()=>setView("calendar")}>📅 달력 보기</button>
        <div className="sidebar-section">팀원 ({members.length})</div>
        {members.filter(m=>m!==user.name).map(m=>(
          <div key={m} className="member-item">
            <Avatar name={m}/>
            <span className="member-name">{m}</span>
          </div>
        ))}
        <div className="member-item">
          <Avatar name={user.name}/>
          {editingName?(
            <div style={{display:"flex",gap:4,alignItems:"center",flex:1}}>
              <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")handleNameSave();if(e.key==="Escape")setEditingName(false);}}
                autoFocus
                style={{flex:1,background:"rgba(255,255,255,0.15)",border:"1px solid rgba(74,222,128,0.5)",borderRadius:6,padding:"3px 7px",color:"#fff",fontSize:13,outline:"none",width:"80px"}}/>
              <button onClick={handleNameSave} style={{background:"#4ade80",border:"none",borderRadius:5,padding:"2px 7px",fontSize:12,fontWeight:700,cursor:"pointer",color:"#1a3a2a"}}>저장</button>
            </div>
          ):(
            <span className="member-name" style={{cursor:"pointer",display:"flex",alignItems:"center",gap:4}}
              onClick={()=>{setNameInput(user.name);setEditingName(true);}}>
              {user.name} (나) <span style={{fontSize:10,color:"#4ade80"}}>✏️</span>
            </span>
          )}
        </div>
        <div className="sidebar-footer">
          <button className="sidebar-nav-item" onClick={onLogout}>👋 로그아웃</button>
        </div>
      </aside>
      <main className="main-content">
        <div className="page-header">
          <div>
            {view==="kanban"
              ?<div className="page-title">📋 Dash Board</div>
              :<div className="page-title">📅 {calViewYear}년 {calViewMonth+1}월 달력</div>}
            {(()=>{
              const viewY=view==="calendar"?calViewYear:calYear;
              const viewM=view==="calendar"?calViewMonth:calMonth;
              const ms=`${viewY}-${String(viewM+1).padStart(2,"0")}`;
              const cnt=tasks.filter(t=>toMonthKey(t.due)===ms).length;
              return <div className="page-sub">{viewM+1}월 업무중점 · {cnt}개의 할 일</div>;
            })()}
          </div>
          <div className="mobile-name-editor">
            {editingName?(
              <>
                <input
                  className="mobile-name-input"
                  value={nameInput}
                  onChange={e=>setNameInput(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==="Enter")handleNameSave();
                    if(e.key==="Escape"){setNameInput(user.name);setEditingName(false);}
                  }}
                  autoFocus
                />
                <button className="mobile-name-save" onClick={handleNameSave}>저장</button>
                <button className="mobile-name-cancel" onClick={()=>{setNameInput(user.name);setEditingName(false);}}>취소</button>
              </>
            ):(
              <button className="mobile-name-btn" onClick={()=>{setNameInput(user.name);setEditingName(true);}}>
                👤 {user.name} ✏️
              </button>
            )}
          </div>
        </div>
        <div className="command-bar">
          <input
            className="command-input"
            placeholder="자연어 명령: 예) 내일 지민에게 API 문서 정리 추가해줘"
            value={commandInput}
            onChange={e=>setCommandInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();handleBoardCommand();}}}
          />
          <div className="command-actions">
            <button className="btn btn-primary btn-sm" style={{marginTop:0}} onClick={handleBoardCommand} disabled={commandLoading||!commandInput.trim()}>
              {commandLoading?"처리중...":"명령 실행"}
            </button>
            <button className="btn btn-secondary btn-sm" style={{marginTop:0}} onClick={handleGenerateStandup} disabled={standupLoading}>
              {standupLoading?"생성 중...":"오늘 스탠드업"}
            </button>
          </div>
        </div>
        {commandResult&&(
          <div className="ai-summary command-result">
            <div className="ai-summary-title">명령 결과</div>
            <div>{commandResult}</div>
          </div>
        )}
        <div className="content-layout">
          {view==="kanban"?(
            <>
              <div className="content-main">
                <KanbanView
                  tasks={tasks} setTasks={setTasks}
                  members={members} boardId={board.id}
                  showToast={setToast} currentUser={user}
                  calYear={calYear} calMonth={calMonth}/>
              </div>
              <div className="right-panel">
                <MiniCalendar tasks={tasks}
                  onAddTask={d=>setCalModalDate(d)}
                  onMonthChange={(y,m)=>{setCalYear(y);setCalMonth(m);}}/>
                <NoticeBoard boardId={board.id} currentUser={user}/>
              </div>
            </>
          ):(
            <>
              <div className="content-main">
                <CalendarView tasks={tasks} onAddTask={d=>setCalModalDate(d)}
                  year={calViewYear} month={calViewMonth}
                  setYear={setCalViewYear} setMonth={setCalViewMonth}
                  onMonthChange={(y,m)=>{setCalViewYear(y);setCalViewMonth(m);}}/>
              </div>
              <div className="right-panel">
                <NoticeBoard boardId={board.id} currentUser={user}/>
              </div>
            </>
          )}
        </div>
      </main>
      {standupOpen&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setStandupOpen(false)}>
          <div className="modal" style={{maxWidth:620}}>
            <div className="modal-title">📝 데일리 스탠드업</div>
            <div className="standup-modal">{standupLoading?"스탠드업 생성 중...":standupText}</div>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={()=>setStandupOpen(false)}>닫기</button>
              <button className="btn btn-primary btn-sm" style={{marginTop:0}} onClick={()=>{
                navigator.clipboard?.writeText(standupText);
                setToast("스탠드업 내용을 복사했어요");
              }} disabled={!standupText}>
                복사
              </button>
            </div>
          </div>
        </div>
      )}
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
      {calModalDate&&members.length>0&&(
        <TaskModal
          task={{due:calModalDate,status:"todo",assignee:members[0]}}
          members={members} currentUser={user} tasks={tasks}
          onSave={async(task)=>{
            const {data,error}=await supabase.from("tasks").insert({
              board_id:board.id,title:task.title,
              description:task.description||null,
              assignee:task.assignee,due:task.due||null,
              status:task.status,pin:task.pin||null,
              created_by:user.name
            }).select().single();
            if(error||!data) return;
            const inserted=[data];
            const subtasks=(task.generatedSubtasks||[]).filter(Boolean).slice(0,6);
            if(subtasks.length>0){
              const subPayload=subtasks.map((sub,i)=>({
                board_id:board.id,
                title:`${task.title} · ${sub.title||`하위업무 ${i+1}`}`,
                description:`[자동 분해] ${task.title}의 하위 업무`,
                assignee:members.includes(sub.assignee)?sub.assignee:(task.assignee||members[0]||user.name),
                due:sub.due||addDays(task.due||calModalDate,Number.isFinite(sub.dueOffsetDays)?sub.dueOffsetDays:(i+1)),
                status:sub.status||"todo",
                pin:null,
                created_by:user.name
              }));
              const {data:subInserted}=await supabase.from("tasks").insert(subPayload).select();
              if(subInserted?.length) inserted.push(...subInserted);
            }
            setTasks(p=>{
              const seen=new Set(p.map(t=>t.id));
              return [...p,...inserted.filter(t=>!seen.has(t.id))];
            });
          }}
          onDelete={()=>{}}
          onClose={()=>setCalModalDate(null)}/>
      )}
    </div>
  );
}

export default function App() {
  const [page,setPage]=useState("loading");
  const [user,setUser]=useState(null);
  const [board,setBoard]=useState(null);

  useEffect(()=>{
    const style=document.createElement("style");
    style.textContent=css;
    document.head.appendChild(style);

    supabase.auth.getSession().then(async({data})=>{
      if(data.session?.user){
        const u=data.session.user;
        const{data:bm}=await supabase.from("board_members").select("name").eq("user_id",u.id).order("joined_at",{ascending:false}).limit(1).maybeSingle();
        const name=bm?.name||u.user_metadata?.name||u.email.split("@")[0];
        setUser({id:u.id,email:u.email,name});
        setPage("onboarding");
      } else {
        setPage("auth");
      }
    });

    const{data:listener}=supabase.auth.onAuthStateChange(async(_e,session)=>{
      if(!session){setUser(null);setBoard(null);setPage("auth");}
    });

    return()=>{document.head.removeChild(style);listener.subscription.unsubscribe();};
  },[]);

  const handleLogout=async()=>{await supabase.auth.signOut();};

  if(page==="loading")return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#667eea,#764ba2)"}}>
      <div style={{color:"#fff",fontSize:18,fontWeight:600}}>⏳ 로딩 중...</div>
    </div>
  );

  return page==="auth"
    ?<AuthPage onLogin={u=>{setUser(u);setPage("onboarding");}}/>
    :page==="onboarding"
    ?<OnboardingPage user={user} onEnterBoard={b=>{setBoard(b);setPage("dashboard");}}/>
    :<Dashboard user={user} board={board} onLogout={handleLogout}/>;
}
