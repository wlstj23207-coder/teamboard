import { useState, useEffect } from "react";
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

function generateInviteCode() { return String(Math.floor(100000+Math.random()*900000)); }
function formatDate(s) { if(!s)return""; return new Date(s).toLocaleDateString("ko-KR",{month:"short",day:"numeric"}); }
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
  .sidebar{width:260px;background:var(--text);color:#fff;display:flex;flex-direction:column;padding:28px 20px;flex-shrink:0;overflow-y:auto;}
  .sidebar-logo{font-size:20px;font-weight:700;margin-bottom:32px;}
  .sidebar-logo span{color:#a5b4fc;}
  .board-info{background:rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:24px;}
  .board-name{font-size:16px;font-weight:600;margin-bottom:4px;}
  .board-code{font-size:12px;color:#a5b4fc;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
  .invite-code-badge{background:rgba(99,102,241,0.3);border-radius:6px;padding:2px 8px;font-family:monospace;font-size:13px;letter-spacing:2px;font-weight:700;}
  .sidebar-nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:#c4c0e8;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;margin-bottom:4px;border:none;background:transparent;width:100%;text-align:left;}
  .sidebar-nav-item:hover,.sidebar-nav-item.active{background:rgba(255,255,255,0.1);color:#fff;}
  .sidebar-section{font-size:11px;font-weight:600;color:#6b6896;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px 12px;}
  .member-item{display:flex;align-items:center;gap:10px;padding:8px 12px;}
  .avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}
  .member-name{font-size:13px;color:#c4c0e8;}
  .sidebar-footer{margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);}
  .main-content{flex:1;overflow-y:auto;padding:32px;}
  .content-layout{display:flex;gap:24px;}
  .content-main{flex:1;min-width:0;}
  .right-panel{width:260px;flex-shrink:0;}
  .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;}
  .page-title{font-size:24px;font-weight:700;}
  .page-sub{font-size:14px;color:var(--text2);margin-top:2px;}
  .kanban-board{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:start;}
  .kanban-col{background:var(--surface2);border-radius:var(--radius);padding:16px;min-height:500px;}
  .col-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
  .col-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;}
  .col-dot{width:8px;height:8px;border-radius:50%;}
  .col-count{background:rgba(0,0,0,0.06);border-radius:20px;padding:2px 8px;font-size:12px;font-weight:600;}
  .col-droppable{min-height:400px;}
  .col-droppable.drag-over{background:rgba(99,102,241,0.05);border-radius:10px;}
  .task-card{background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:grab;transition:all .15s;border:2px solid transparent;user-select:none;}
  .task-card:hover{box-shadow:0 4px 16px rgba(99,102,241,0.12);border-color:var(--border);transform:translateY(-1px);}
  .task-title{font-size:14px;font-weight:600;margin-bottom:10px;line-height:1.4;}
  .task-meta{display:flex;align-items:center;justify-content:space-between;}
  .task-assignee{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);}
  .task-due{font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;}
  .task-due.today{background:#fef2f2;color:#dc2626;}
  .task-due.week{background:#fffbeb;color:#d97706;}
  .task-due.overdue{background:#fef2f2;color:#dc2626;}
  .task-due.normal{background:var(--surface2);color:var(--text2);}
  .add-task-btn{display:flex;align-items:center;gap:6px;width:100%;padding:10px 12px;border:2px dashed var(--border);border-radius:10px;background:transparent;color:var(--text2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;font-family:inherit;}
  .add-task-btn:hover{border-color:var(--accent);color:var(--accent);}
  .calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  .calendar-header-day{text-align:center;font-size:11px;font-weight:600;color:var(--text2);padding:8px 0;}
  .calendar-day{min-height:80px;border-radius:8px;padding:6px;background:#fff;border:1.5px solid var(--border);}
  .calendar-day.empty{background:transparent;border-color:transparent;}
  .calendar-day.today{border-color:var(--accent);background:rgba(99,102,241,0.04);}
  .calendar-day-num{font-size:13px;font-weight:600;margin-bottom:4px;}
  .calendar-day.today .calendar-day-num{color:var(--accent);}
  .calendar-task-dot{font-size:10px;padding:1px 5px;border-radius:4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px;backdrop-filter:blur(4px);}
  .modal{background:#fff;border-radius:20px;padding:32px;width:100%;max-width:480px;box-shadow:0 24px 64px rgba(0,0,0,0.2);animation:slideUp .2s ease;}
  @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  .modal-title{font-size:20px;font-weight:700;margin-bottom:24px;}
  .select{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:10px;font-size:15px;outline:none;background:var(--bg);font-family:inherit;cursor:pointer;}
  .select:focus{border-color:var(--accent);}
  .modal-actions{display:flex;gap:10px;margin-top:24px;justify-content:flex-end;}
  .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;}
  .stat-card{background:#fff;border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);border:1.5px solid var(--border);}
  .stat-num{font-size:32px;font-weight:700;}
  .stat-label{font-size:13px;color:var(--text2);margin-top:4px;}
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
  .mini-cal-day{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;position:relative;transition:all .15s;}
  .mini-cal-day:hover{background:var(--surface2);}
  .mini-cal-day.empty{cursor:default;pointer-events:none;}
  .mini-cal-day.is-today{background:var(--accent);color:#fff;font-weight:700;}
  .mini-cal-day.is-today:hover{background:var(--accent2);}
  .mini-cal-day.is-selected{outline:2px solid var(--accent);color:var(--accent);font-weight:700;}
  .mini-cal-day.is-today.is-selected{outline:2px solid var(--accent2);}
  .mini-cal-dot{position:absolute;bottom:1px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:var(--accent);}
  .mini-cal-day.is-today .mini-cal-dot{background:#fff;}
  .day-tasks-panel{margin-top:16px;padding-top:16px;border-top:1.5px solid var(--border);}
  .day-tasks-label{font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
  .day-task-item{padding:10px 12px;border-radius:8px;background:var(--surface2);margin-bottom:6px;border-left:3px solid;}
  .day-task-name{font-size:12px;font-weight:600;color:var(--text);}
  .day-task-meta{font-size:11px;color:var(--text2);margin-top:3px;}
  .no-tasks-msg{font-size:12px;color:var(--text2);text-align:center;padding:12px 0;}
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
    onLogin({id:u.id,email:u.email,name:u.user_metadata?.name||email.split("@")[0]});
  };

  if(step==="verify") return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">✦ TeamBoard</div>
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
        <div className="auth-logo">✦ TeamBoard</div>
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

  useEffect(()=>{
    (async()=>{
      const{data}=await supabase.from("board_members")
        .select("board_id,boards(id,name,invite_code)")
        .eq("user_id",user.id).single();
      if(data?.boards){
        const b=data.boards;
        onEnterBoard({id:b.id,name:b.name,inviteCode:b.invite_code});
      }
    })();
  },[]);

  const handleCreate=async()=>{
    if(!boardName.trim()){setError("보드 이름을 입력해주세요.");return;}
    setLoading(true);
    const code=generateInviteCode();
    const{data:board,error:e1}=await supabase.from("boards")
      .insert({name:boardName,invite_code:code,created_by:user.id}).select().single();
    if(e1){setError(e1.message);setLoading(false);return;}
    await supabase.from("board_members").insert({board_id:board.id,user_id:user.id,name:user.name});
    setLoading(false);
    onEnterBoard({id:board.id,name:board.name,inviteCode:board.invite_code});
  };

  const handleJoin=async()=>{
    if(inviteCode.length!==6){setError("6자리 코드를 입력해주세요.");return;}
    setLoading(true);
    const{data:board,error:e1}=await supabase.from("boards").select().eq("invite_code",inviteCode).single();
    if(e1||!board){setError("존재하지 않는 초대 코드입니다.");setLoading(false);return;}
    await supabase.from("board_members")
      .upsert({board_id:board.id,user_id:user.id,name:user.name},{onConflict:"board_id,user_id"});
    setLoading(false);
    onEnterBoard({id:board.id,name:board.name,inviteCode:board.invite_code});
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="auth-logo" style={{marginBottom:4}}>✦ TeamBoard</div>
        <div style={{fontSize:14,color:"var(--text2)",marginBottom:28}}>안녕하세요, {user.name}님 👋</div>
        {!mode?(
          <>
            <div style={{fontSize:22,fontWeight:700,marginBottom:8}}>시작하기</div>
            <div style={{color:"var(--text2)",marginBottom:24}}>새 팀 보드를 만들거나 기존 보드에 참여하세요.</div>
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

function TaskModal({task,members,onSave,onDelete,onClose}) {
  const [title,setTitle]=useState(task?.title||"");
  const [assignee,setAssignee]=useState(task?.assignee||members[0]||"");
  const [due,setDue]=useState(task?.due||"");
  const [status,setStatus]=useState(task?.status||"todo");
  const [confirmDelete,setConfirmDelete]=useState(false);

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{task?.id?"할 일 수정":"새 할 일"}</div>
        <div className="field"><label>제목</label><input placeholder="할 일을 입력하세요" value={title} onChange={e=>setTitle(e.target.value)} autoFocus/></div>
        <div className="field"><label>담당자</label>
          <select className="select" value={assignee} onChange={e=>setAssignee(e.target.value)}>
            {members.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field"><label>마감일</label>
          <input type="date" value={due} onChange={e=>setDue(e.target.value)}
            style={{width:"100%",padding:"12px 16px",border:"2px solid var(--border)",borderRadius:10,fontSize:15,fontFamily:"inherit",outline:"none",background:"var(--bg)"}}/>
        </div>
        <div className="field"><label>상태</label>
          <select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
            {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
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
            {task?.id&&<button className="btn btn-sm" style={{background:"#fef2f2",color:"#dc2626",marginRight:"auto"}} onClick={()=>setConfirmDelete(true)}>🗑 삭제</button>}
            <button className="btn btn-secondary btn-sm" onClick={onClose}>취소</button>
            <button className="btn btn-primary btn-sm" style={{marginTop:0}} onClick={()=>{
              if(!title.trim())return;
              onSave({...task,id:task?.id,title,assignee,due,status});
              onClose();
            }}>저장</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({task,onEdit,onDragStart}) {
  const getDueClass=()=>{
    if(!task.due)return"normal";
    if(isOverdue(task.due)&&task.status!=="done")return"overdue";
    if(isToday(task.due))return"today";
    if(isThisWeek(task.due))return"week";
    return"normal";
  };
  return (
    <div className="task-card" draggable onDragStart={e=>onDragStart(e,task.id)} onClick={()=>onEdit(task)}>
      <div className="task-title">{task.title}</div>
      <div className="task-meta">
        <div className="task-assignee"><Avatar name={task.assignee}/><span>{task.assignee}</span></div>
        {task.due&&<span className={`task-due ${getDueClass()}`}>{isToday(task.due)?"⚡ 오늘":formatDate(task.due)}</span>}
      </div>
    </div>
  );
}

function MiniCalendar({tasks}) {
  const today=new Date();
  const todayStr=today.toISOString().slice(0,10);
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth());
  const [selected,setSelected]=useState(todayStr);

  const daysInMonth=getDaysInMonth(year,month);
  const firstDay=getFirstDayOfMonth(year,month);
  const monthStr=`${year}-${String(month+1).padStart(2,"0")}`;
  const cells=[...Array(firstDay).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while(cells.length%7!==0) cells.push(null);

  const getTasksForDate=dateStr=>tasks.filter(t=>t.due===dateStr);
  const selectedTasks=getTasksForDate(selected);
  const selectedLabel=new Date(selected+"T00:00:00").toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"});

  return (
    <div className="mini-calendar">
      <div className="mini-cal-header">
        <button className="mini-cal-nav" onClick={()=>month===0?(setMonth(11),setYear(y=>y-1)):setMonth(m=>m-1)}>‹</button>
        <div className="mini-cal-title">{year}년 {month+1}월</div>
        <button className="mini-cal-nav" onClick={()=>month===11?(setMonth(0),setYear(y=>y+1)):setMonth(m=>m+1)}>›</button>
      </div>
      <div className="mini-cal-grid">
        {["일","월","화","수","목","금","토"].map(d=>(
          <div key={d} className="mini-cal-day-label">{d}</div>
        ))}
        {cells.map((day,i)=>{
          if(!day) return <div key={i} className="mini-cal-day empty"/>;
          const dateStr=`${monthStr}-${String(day).padStart(2,"0")}`;
          const isTod=today.getDate()===day&&today.getMonth()===month&&today.getFullYear()===year;
          const isSel=selected===dateStr;
          const hasTasks=getTasksForDate(dateStr).length>0;
          return (
            <div key={i}
              className={`mini-cal-day${isTod?" is-today":""}${isSel?" is-selected":""}`}
              onClick={()=>setSelected(dateStr)}>
              {day}
              {hasTasks&&<div className="mini-cal-dot"/>}
            </div>
          );
        })}
      </div>
      <div className="day-tasks-panel">
        <div className="day-tasks-label">📌 {selectedLabel}</div>
        {selectedTasks.length===0
          ?<div className="no-tasks-msg">업무가 없어요</div>
          :selectedTasks.map(t=>{
            const s=STATUS_CONFIG[t.status];
            return (
              <div key={t.id} className="day-task-item" style={{borderLeftColor:s.color}}>
                <div className="day-task-name">{t.title}</div>
                <div className="day-task-meta">{t.assignee} · <span style={{color:s.color,fontWeight:600}}>{s.label}</span></div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

function KanbanView({tasks,setTasks,members,boardId,showToast}) {
  const [modalOpen,setModalOpen]=useState(false);
  const [editingTask,setEditingTask]=useState(null);
  const [dragId,setDragId]=useState(null);
  const [dragOver,setDragOver]=useState(null);

  const saveTask=async(task)=>{
    if(task.id){
      const{data}=await supabase.from("tasks").update({title:task.title,assignee:task.assignee,due:task.due||null,status:task.status}).eq("id",task.id).select().single();
      setTasks(p=>p.map(t=>t.id===task.id?data:t));
      showToast(task.title+" 저장됨");
    } else {
      const{data}=await supabase.from("tasks").insert({board_id:boardId,title:task.title,assignee:task.assignee,due:task.due||null,status:task.status}).select().single();
      setTasks(p=>[...p,data]);
      showToast(task.title+" 추가됨");
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

  return (
    <div>
      <div className="stat-grid">
        {Object.entries(STATUS_CONFIG).map(([k,v])=>(
          <div className="stat-card" key={k} style={{borderTop:`3px solid ${v.color}`}}>
            <div className="stat-num" style={{color:v.color}}>{tasks.filter(t=>t.status===k).length}</div>
            <div className="stat-label">{v.label}</div>
          </div>
        ))}
      </div>
      <div className="kanban-board">
        {Object.entries(STATUS_CONFIG).map(([status,config])=>{
          const col=tasks.filter(t=>t.status===status);
          return (
            <div key={status} className="kanban-col">
              <div className="col-header">
                <div className="col-title"><div className="col-dot" style={{background:config.color}}/>{config.label}</div>
                <span className="col-count">{col.length}</span>
              </div>
              <div className={`col-droppable ${dragOver===status?"drag-over":""}`}
                onDragOver={e=>{e.preventDefault();setDragOver(status);}}
                onDragLeave={()=>setDragOver(null)}
                onDrop={e=>handleDrop(e,status)}>
                {col.map(task=>(
                  <TaskCard key={task.id} task={task}
                    onEdit={t=>{setEditingTask(t);setModalOpen(true);}}
                    onDragStart={(_,id)=>setDragId(id)}/>
                ))}
                <button className="add-task-btn" onClick={()=>{setEditingTask({status});setModalOpen(true);}}>+ 추가</button>
              </div>
            </div>
          );
        })}
      </div>
      {modalOpen&&(
        <TaskModal task={editingTask} members={members}
          onSave={saveTask} onDelete={deleteTask}
          onClose={()=>{setModalOpen(false);setEditingTask(null);}}/>
      )}
    </div>
  );
}

function CalendarView({tasks}) {
  const today=new Date();
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth());
  const daysInMonth=getDaysInMonth(year,month);
  const firstDay=getFirstDayOfMonth(year,month);
  const monthStr=`${year}-${String(month+1).padStart(2,"0")}`;
  const getDay=d=>tasks.filter(t=>t.due===`${monthStr}-${String(d).padStart(2,"0")}`);
  const cells=[...Array(firstDay).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while(cells.length%7!==0)cells.push(null);
  const todayTasks=tasks.filter(t=>t.due&&isToday(t.due)&&t.status!=="done");
  const weekTasks=tasks.filter(t=>t.due&&isThisWeek(t.due)&&!isToday(t.due)&&t.status!=="done");

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
      <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"var(--shadow)",border:"1.5px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>month===0?(setMonth(11),setYear(y=>y-1)):setMonth(m=>m-1)}>←</button>
          <div style={{fontSize:18,fontWeight:700}}>{year}년 {month+1}월</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>month===11?(setMonth(0),setYear(y=>y+1)):setMonth(m=>m+1)}>→</button>
        </div>
        <div className="calendar-grid" style={{marginBottom:8}}>
          {["일","월","화","수","목","금","토"].map(d=><div key={d} className="calendar-header-day">{d}</div>)}
        </div>
        <div className="calendar-grid">
          {cells.map((day,i)=>{
            if(!day)return<div key={i} className="calendar-day empty"/>;
            const dt=getDay(day);
            const isT=today.getDate()===day&&today.getMonth()===month&&today.getFullYear()===year;
            return (
              <div key={i} className={`calendar-day ${isT?"today":""}`}>
                <div className="calendar-day-num">{day}</div>
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

function Dashboard({user,board,onLogout}) {
  const [tasks,setTasks]=useState([]);
  const [members,setMembers]=useState([]);
  const [view,setView]=useState("kanban");
  const [toast,setToast]=useState(null);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    (async()=>{
      const{data:t}=await supabase.from("tasks").select().eq("board_id",board.id).order("created_at");
      if(t)setTasks(t);
      const{data:m}=await supabase.from("board_members").select("name").eq("board_id",board.id);
      if(m)setMembers(m.map(x=>x.name));
    })();

    const taskSub=supabase.channel("tasks:"+board.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"tasks",filter:`board_id=eq.${board.id}`},
        payload=>{
          if(payload.eventType==="INSERT")setTasks(p=>[...p,payload.new]);
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
        <div className="sidebar-logo">✦ Team<span>Board</span></div>
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
        <button className={`sidebar-nav-item ${view==="kanban"?"active":""}`} onClick={()=>setView("kanban")}>📋 칸반 보드</button>
        <button className={`sidebar-nav-item ${view==="calendar"?"active":""}`} onClick={()=>setView("calendar")}>📅 달력 보기</button>
        <div className="sidebar-section">팀원 ({members.length})</div>
        {members.map(m=>(
          <div key={m} className="member-item"><Avatar name={m}/><span className="member-name">{m===user.name?`${m} (나)`:m}</span></div>
        ))}
        <div className="sidebar-footer">
          <button className="sidebar-nav-item" onClick={onLogout}>👋 로그아웃</button>
        </div>
      </aside>
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">{view==="kanban"?"📋 칸반 보드":"📅 달력"}</div>
            <div className="page-sub">{board.name} · {tasks.length}개의 할 일</div>
          </div>
        </div>
        <div className="content-layout">
          <div className="content-main">
            {view==="kanban"
              ?<KanbanView tasks={tasks} setTasks={setTasks} members={members} boardId={board.id} showToast={setToast}/>
              :<CalendarView tasks={tasks}/>}
          </div>
          <div className="right-panel">
            <MiniCalendar tasks={tasks}/>
          </div>
        </div>
      </main>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
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

    supabase.auth.getSession().then(({data})=>{
      if(data.session?.user){
        const u=data.session.user;
        setUser({id:u.id,email:u.email,name:u.user_metadata?.name||u.email.split("@")[0]});
        setPage("onboarding");
      } else {
        setPage("auth");
      }
    });

    const{data:listener}=supabase.auth.onAuthStateChange((_e,session)=>{
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