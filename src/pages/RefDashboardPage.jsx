// ============================================================
// FILE: frontend/bul-qc-app/src/pages/RefDashboardPage.jsx
//
// Refinery live dashboard with three tabs:
//   In-process   → CPO Line, CPL Line, BPO, RBD, RPL, PFAD
//   Fractionation → OLEIN, STEARIN, PMF
//   Crystallizer  → Crystallizer 1-9 (only those with results)
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import PageFooter           from '../components/PageFooter';
import NotificationBell     from '../components/NotificationBell';
import LoadingSpinner       from '../components/LoadingSpinner';
import { useAuth }          from '../context/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { supabase }         from '../services/supabase';
import { format }           from 'date-fns';

let santosLogo = null;
let bulqcLogo  = null;
try { santosLogo = require('../assets/santos_logo.png'); } catch(e) {}
try { bulqcLogo  = require('../assets/bulqc_logo.png');  } catch(e) {}

// ── Tab definitions ───────────────────────────────────────
const TABS = [
  {
    key    : 'inprocess',
    label  : 'In-Process',
    icon   : '⚙️',
    types  : ['CPO Line','CPL Line','BPO','RBD','RPL','PFAD'],
    catCode: 'REF_INP',
  },
  {
    key    : 'frac',
    label  : 'Fractionation',
    icon   : '🔬',
    types  : ['OLEIN','STEARIN','PMF'],
    catCode: 'REF_FRAC',
  },
  {
    key    : 'crys',
    label  : 'Crystallizer',
    icon   : '❄️',
    types  : ['Crystallizer 1','Crystallizer 2','Crystallizer 3',
               'Crystallizer 4','Crystallizer 5','Crystallizer 6',
               'Crystallizer 7','Crystallizer 8','Crystallizer 9'],
    catCode: 'REF_CRYS',
  },
];

const playBeep = (freq=660, dur=0.6, type='sine') => {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator(); const gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value=freq; osc.type=type;
    gain.gain.setValueAtTime(0.5,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    osc.start(); osc.stop(ctx.currentTime+dur);
  } catch(e){}
};

const getCS = (status) => {
  switch(status){
    case 'pass': case 'ok':
      return {color:'#15803D',bg:'#F0FDF4',border:'#86EFAC',dot:'#22C55E'};
    case 'fail_low': case 'fail_high':
      return {color:'#DC2626',bg:'#FEF2F2',border:'#FECACA',dot:'#EF4444'};
    case 'text_ok':
      return {color:'#1D4ED8',bg:'#EFF6FF',border:'#BFDBFE',dot:'#60A5FA'};
    default:
      return {color:'#374151',bg:'#F9FAFB',border:'#E5E7EB',dot:'#9CA3AF'};
  }
};

let toastId=0;
const P='#6B21A8', PM='#7C3AED', PL='#EDE9FE', G='#FFB81C';
const HEAD_BG=`linear-gradient(180deg,#5B1894 0%,${P} 100%)`;
const INFO_W=220, TEST_W=155;

export default function RefDashboardPage(){
  const {user,logout}     = useAuth();
  const [results, setR]   = useState([]);
  const [stats,   setS]   = useState({});
  const [loading, setL]   = useState(true);
  const [clock,   setC]   = useState(new Date());
  const [lastUpd, setU]   = useState(new Date());
  const [toasts,  setT]   = useState([]);
  const [search,  setSr]  = useState('');
  const [from,    setFr]  = useState(format(new Date(),'yyyy-MM-dd'));
  const [to,      setTo]  = useState(format(new Date(),'yyyy-MM-dd'));
  const [range,   setRg]  = useState(false);
  const [activeTab,setTab]= useState('inprocess');
  const [avatar,  setAv]  = useState(()=>localStorage.getItem('bul_qc_avatar_'+(user?.id||'g')));
  const [showAv,  setSA]  = useState(false);
  const fileRef = useRef(null);
  const today   = format(new Date(),'yyyy-MM-dd');

  useEffect(()=>{
    const t=setInterval(()=>setC(new Date()),1000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    const s=localStorage.getItem('bul_qc_avatar_'+(user?.id||'g'));
    if(s) setAv(s);
  },[user]);

  const uploadAv=(e)=>{
    const f=e.target.files?.[0];
    if(!f||!f.type.startsWith('image/')) return;
    const r=new FileReader();
    r.onload=ev=>{
      setAv(ev.target.result);
      localStorage.setItem('bul_qc_avatar_'+(user?.id||'g'),ev.target.result);
      setSA(false);
    };
    r.readAsDataURL(f);
  };

  const addToast=useCallback((msg,type='info')=>{
    const id=++toastId;
    setT(p=>[{id,msg,type},...p.slice(0,4)]);
    setTimeout(()=>setT(p=>p.filter(t=>t.id!==id)),6000);
  },[]);

  const load=useCallback(async(quiet=false)=>{
    try{
      const [r,s]=await Promise.all([
        dashboardService.getLiveResults(),
        dashboardService.getStats(user?.department_id),
      ]);
      setR(r||[]); setS(s||{}); setU(new Date());
    }catch(e){console.error(e);}
    finally{if(!quiet)setL(false);}
  },[user]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const sub=supabase.channel('ref_live')
      .on('postgres_changes',
        {event:'UPDATE',schema:'public',table:'sample_test_assignments'},
        (p)=>{
          load(true);
          const oos=p.new.result_status==='fail_low'||p.new.result_status==='fail_high';
          if(oos){playBeep(440,1.2,'square');addToast('⚠️ Out of Spec result!','error');}
          else if(p.new.result_value){playBeep(660,0.5,'sine');addToast('✅ New result submitted','success');}
        }
      ).subscribe();
    return()=>sub.unsubscribe();
  },[load,addToast]);

  // ── Active tab config ─────────────────────────────────────
  const tabConfig = TABS.find(t=>t.key===activeTab);

  // ── Filter by date ────────────────────────────────────────
  const dateFilt=results.filter(r=>{
    const d=r.registered_samples?.registered_at?.substring(0,10);
    if(!d) return false;
    return range?(d>=from&&d<=to):d===from;
  });

  // ── Filter by active tab (match category code) ────────────
  const tabFilt=dateFilt.filter(r=>{
    const catCode=r.registered_samples?.sample_types?.sample_categories?.code;
    return catCode===tabConfig.catCode;
  });

  // ── Group by sample ───────────────────────────────────────
  const sMap={};
  for(const r of tabFilt){
    const id=r.registered_samples?.id; if(!id) continue;
    if(!sMap[id]) sMap[id]={sample:r.registered_samples,params:[]};
    sMap[id].params.push(r);
  }
  let rows=Object.values(sMap).sort(
    (a,b)=>new Date(b.sample?.registered_at||0)-new Date(a.sample?.registered_at||0)
  );

  if(search.trim()){
    const q=search.trim().toLowerCase();
    rows=rows.filter(r=>
      r.sample?.sample_name?.toLowerCase().includes(q)||
      r.sample?.sample_number?.toLowerCase().includes(q)||
      r.sample?.sample_types?.name?.toLowerCase().includes(q)
    );
  }

  // ── Collect unique tests for current tab ──────────────────
  const allTests=[]; const seenT=new Set(); const tMeta={};
  for(const row of rows){
    const sorted=[...row.params].sort((a,b)=>(a.tests?.display_order||0)-(b.tests?.display_order||0));
    for(const p of sorted){
      const name=p.tests?.name; if(!name) continue;
      if(!seenT.has(name)){
        seenT.add(name);
        const specs=p.tests?.test_specifications||[];
        const spec=specs.find(s=>!s.brand_id&&!s.subtype_id)||specs[0]||null;
        const specStr=spec?.display_spec
          ?spec.display_spec
          :(spec?.min_value!==undefined&&spec?.max_value!==undefined)
            ?`${spec.min_value} – ${spec.max_value}`:null;
        tMeta[name]={unit:p.tests?.unit||'',spec:specStr};
        allTests.push(name);
      }
    }
  }

  const todayCt=results.filter(r=>r.registered_samples?.registered_at?.startsWith(today)).length;
  const initials=(user?.full_name||'?').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

  const inp={border:'1.5px solid #DDD6FE',borderRadius:'8px',padding:'7px 11px',fontSize:'13px',fontFamily:'inherit',background:'#fff',color:'#1F2937'};

  return(
    <div style={{minHeight:'100vh',background:'#F5F3FF',paddingBottom:'50px'}}>

      {/* ════ PAGE HEADER ════ */}
      <header style={{
        background:`linear-gradient(135deg,${P} 0%,${PM} 100%)`,
        color:'#fff', boxShadow:'0 3px 16px rgba(107,33,168,0.45)',
        position:'sticky',top:0,zIndex:100,
      }}>
        <div style={{
          padding:'0 16px',minHeight:'58px',
          display:'grid',
          gridTemplateColumns:'1fr auto 1fr',
          alignItems:'center',gap:'12px',
        }}>
          {/* Left */}
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'38px',height:'38px',borderRadius:'10px',overflow:'hidden',flexShrink:0,boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
              {bulqcLogo
                ?<img src={bulqcLogo} alt="BUL QC" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                :<div style={{width:'100%',height:'100%',background:G}}/>
              }
            </div>
            <div>
              <div style={{fontWeight:'800',fontSize:'15px',lineHeight:1.1}}>Refinery Live Dashboard</div>
              <div style={{fontSize:'10px',color:'#DDD6FE'}}>Real-time QC Results</div>
            </div>
          </div>

          {/* Centre: Santos logo */}
          <div style={{display:'flex',justifyContent:'center',alignItems:'center'}}>
            {santosLogo?(
              <img src={santosLogo} alt="SantosInfographics" title="Designed by SantosInfographics"
                style={{height:'46px',width:'auto',objectFit:'contain',borderRadius:'8px',background:'#fff',padding:'4px 10px',boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}/>
            ):(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'6px 16px',border:'1px solid rgba(255,255,255,0.3)'}}>
                <span style={{fontSize:'10px',color:'#DDD6FE',fontWeight:'700'}}>Designed by</span>
                <span style={{fontSize:'15px',color:G,fontWeight:'900'}}>SantosInfographics</span>
              </div>
            )}
          </div>

          {/* Right */}
          <div style={{display:'flex',alignItems:'center',gap:'10px',justifyContent:'flex-end'}}>
            {/* Clock */}
            <div style={{background:'rgba(255,255,255,0.15)',borderRadius:'20px',padding:'5px 14px',fontSize:'15px',fontWeight:'800',fontFamily:'monospace',letterSpacing:'1px',border:'1px solid rgba(255,255,255,0.2)'}}>
              🕐 {format(clock,'HH:mm:ss')}
            </div>

            <NotificationBell departmentId={user?.department_id}/>

            {/* Avatar */}
            <div style={{position:'relative'}}>
              <div onClick={()=>setSA(!showAv)} title="Change profile picture"
                style={{width:'38px',height:'38px',borderRadius:'50%',background:avatar?'transparent':G,border:'2px solid rgba(255,255,255,0.5)',cursor:'pointer',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'800',fontSize:'14px',color:P,flexShrink:0}}>
                {avatar?<img src={avatar} alt="av" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:initials}
              </div>
              {showAv&&(
                <div style={{position:'absolute',right:0,top:'46px',background:'#fff',borderRadius:'14px',boxShadow:'0 8px 32px rgba(107,33,168,0.2)',border:`1.5px solid ${PL}`,minWidth:'220px',zIndex:200,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',background:'#F5F3FF',borderBottom:`1px solid ${PL}`}}>
                    <p style={{fontWeight:'700',color:'#1F2937',margin:0}}>{user?.full_name}</p>
                    <p style={{fontSize:'11px',color:PM,margin:'2px 0 0'}}>{user?.roles?.name}</p>
                  </div>
                  <div style={{padding:'12px 16px'}}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={uploadAv} style={{display:'none'}}/>
                    <button onClick={()=>fileRef.current?.click()} style={{width:'100%',background:PM,color:'#fff',border:'none',borderRadius:'8px',padding:'9px',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:'inherit'}}>📷 Upload Photo</button>
                    {avatar&&<button onClick={()=>{setAv(null);localStorage.removeItem('bul_qc_avatar_'+(user?.id||'g'));setSA(false);}} style={{width:'100%',background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA',borderRadius:'8px',padding:'7px',fontSize:'12px',cursor:'pointer',fontFamily:'inherit',marginTop:'6px'}}>🗑 Remove Photo</button>}
                  </div>
                </div>
              )}
            </div>

            <button onClick={logout} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:'8px',padding:'7px 14px',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:'inherit'}}>
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* Toasts */}
      <div style={{position:'fixed',top:'70px',right:'16px',zIndex:300,display:'flex',flexDirection:'column',gap:'8px',maxWidth:'300px'}}>
        {toasts.map(t=>(
          <div key={t.id} style={{background:t.type==='error'?'#FEF2F2':t.type==='success'?'#F0FDF4':'#EFF6FF',border:`1.5px solid ${t.type==='error'?'#FECACA':t.type==='success'?'#86EFAC':'#BFDBFE'}`,borderRadius:'12px',padding:'10px 14px',fontSize:'13px',fontWeight:'600',color:t.type==='error'?'#DC2626':t.type==='success'?'#16A34A':'#1D4ED8',boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>
            {t.msg}
          </div>
        ))}
      </div>

      <main style={{padding:'16px'}}>

        {/* Stats */}
        <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
          {[
            {label:'Today',      val:todayCt,             icon:'📅',col:PM},
            {label:'Loaded',     val:rows.length,          icon:'🧪',col:P},
            {label:'Pending',    val:stats.pending    ||0, icon:'⏳',col:'#6B7280'},
            {label:'In Progress',val:stats.in_progress||0, icon:'🔬',col:'#EA580C'},
            {label:'Complete',   val:stats.complete   ||0, icon:'✅',col:'#16A34A'},
            {label:'Out of Spec',val:stats.out_of_spec||0, icon:'⚠️',col:'#DC2626'},
          ].map(s=>(
            <div key={s.label} style={{flex:1,minWidth:'80px',background:'#fff',borderRadius:'12px',border:`2px solid ${s.col}22`,padding:'10px 8px',textAlign:'center'}}>
              <div style={{fontSize:'18px'}}>{s.icon}</div>
              <div style={{fontSize:'20px',fontWeight:'900',color:s.col}}>{s.val}</div>
              <div style={{fontSize:'10px',color:'#6B7280',fontWeight:'600'}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── TAB BUTTONS ── */}
        <div style={{
          display:'flex',gap:'8px',marginBottom:'16px',
          background:'#fff',padding:'12px 16px',
          borderRadius:'14px',border:`1.5px solid ${PL}`,
          flexWrap:'wrap',
        }}>
          {TABS.map(tab=>(
            <button key={tab.key} onClick={()=>setTab(tab.key)}
              style={{
                padding:'10px 24px',borderRadius:'10px',border:'none',
                cursor:'pointer',fontSize:'14px',fontWeight:'700',
                fontFamily:'inherit',transition:'all 0.2s',
                background: activeTab===tab.key
                  ? `linear-gradient(135deg,${P} 0%,${PM} 100%)`
                  : '#F5F3FF',
                color: activeTab===tab.key ? '#fff' : P,
                boxShadow: activeTab===tab.key
                  ? '0 4px 12px rgba(107,33,168,0.3)' : 'none',
                transform: activeTab===tab.key ? 'translateY(-1px)' : 'none',
              }}>
              {tab.icon} {tab.label}
              {/* Count of samples in this tab */}
              <span style={{
                marginLeft:'8px',
                background: activeTab===tab.key ? 'rgba(255,255,255,0.25)' : PL,
                color: activeTab===tab.key ? '#fff' : PM,
                borderRadius:'20px',padding:'1px 8px',
                fontSize:'12px',fontWeight:'800',
              }}>
                {(() => {
                  const tabCfg = TABS.find(t=>t.key===tab.key);
                  const cnt = dateFilt.filter(r=>
                    r.registered_samples?.sample_types?.sample_categories?.code===tabCfg.catCode
                  );
                  const unique=new Set(cnt.map(r=>r.registered_samples?.id));
                  return unique.size;
                })()}
              </span>
            </button>
          ))}

          <div style={{flex:1,display:'flex',justifyContent:'flex-end',alignItems:'center',gap:'6px',fontSize:'12px',color:'#6B7280'}}>
            <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#22C55E',boxShadow:'0 0 6px #22C55E'}}/>
            Live • {format(lastUpd,'HH:mm:ss')}
          </div>
        </div>

        {/* Search + Date Filter */}
        <div style={{background:'#fff',borderRadius:'14px',border:`1.5px solid ${PL}`,padding:'14px 16px',marginBottom:'14px',display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:1,minWidth:'160px'}}>
            <label style={{display:'block',fontSize:'11px',fontWeight:'700',color:'#4C1D95',marginBottom:'5px'}}>🔍 Search</label>
            <input type="text" value={search} onChange={e=>setSr(e.target.value)} placeholder="Sample name, number or type..." style={{...inp,width:'100%',cursor:'text'}}/>
          </div>
          <div>
            <label style={{display:'block',fontSize:'11px',fontWeight:'700',color:'#4C1D95',marginBottom:'5px'}}>Mode</label>
            <div style={{display:'flex',gap:'4px'}}>
              {['Single Day','Date Range'].map((l,i)=>(
                <button key={l} onClick={()=>setRg(i===1)} style={{padding:'7px 12px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'12px',fontWeight:'600',fontFamily:'inherit',background:(i===1)===range?PM:'#F3F4F6',color:(i===1)===range?'#fff':'#6B7280'}}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{display:'block',fontSize:'11px',fontWeight:'700',color:'#4C1D95',marginBottom:'5px'}}>{range?'From':'Date'}</label>
            <input type="date" value={from} onChange={e=>setFr(e.target.value)} style={{...inp,cursor:'pointer'}}/>
          </div>
          {range&&<>
            <div style={{alignSelf:'flex-end',paddingBottom:'8px',fontSize:'20px',color:PM,fontWeight:'700'}}>→</div>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:'700',color:'#4C1D95',marginBottom:'5px'}}>To</label>
              <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} style={{...inp,cursor:'pointer'}}/>
            </div>
          </>}
          <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
            <label style={{fontSize:'11px',fontWeight:'700',color:'#4C1D95'}}>Quick</label>
            <div style={{display:'flex',gap:'5px'}}>
              {[
                {l:'Today',f:today,t:today},
                {l:'Yesterday',f:format(new Date(Date.now()-86400000),'yyyy-MM-dd'),t:format(new Date(Date.now()-86400000),'yyyy-MM-dd')},
                {l:'Week',f:format(new Date(Date.now()-6*86400000),'yyyy-MM-dd'),t:today},
              ].map(q=>(
                <button key={q.l} onClick={()=>{setFr(q.f);setTo(q.t);setRg(q.f!==q.t);}} style={{padding:'5px 10px',borderRadius:'8px',border:`1.5px solid ${PL}`,background:'#F5F3FF',color:P,fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'inherit'}}>{q.l}</button>
              ))}
            </div>
          </div>
          <div style={{alignSelf:'flex-end'}}>
            <button onClick={()=>load()} style={{background:PM,color:'#fff',border:'none',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:'inherit'}}>🔄 Refresh</button>
          </div>
        </div>

        {/* Tab label */}
        <div style={{marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontSize:'16px'}}>{tabConfig.icon}</span>
          <span style={{fontWeight:'800',fontSize:'15px',color:P}}>{tabConfig.label}</span>
          <span style={{fontSize:'12px',color:'#6B7280'}}>
            — {rows.length} sample(s) with {allTests.length} parameter(s)
          </span>
        </div>

        {/* ════ RESULTS TABLE ════ */}
        {loading?(
          <LoadingSpinner text="Loading live results..."/>
        ):rows.length===0?(
          <div style={{textAlign:'center',padding:'80px',background:'#fff',borderRadius:'16px',border:`1.5px solid ${PL}`}}>
            <div style={{fontSize:'56px',marginBottom:'16px'}}>
              {tabConfig.icon}
            </div>
            <p style={{fontWeight:'700',color:'#374151',fontSize:'16px'}}>
              No {tabConfig.label} results yet
            </p>
            <p style={{fontSize:'13px',color:'#9CA3AF',marginTop:'6px'}}>
              Results will appear here as analysts submit them for {tabConfig.types.join(', ')}.
            </p>
          </div>
        ):(
          <div style={{borderRadius:'16px',border:`2px solid ${PL}`,boxShadow:'0 4px 20px rgba(107,33,168,0.12)',background:'#fff',overflow:'hidden'}}>

            {/* Info bar */}
            <div style={{padding:'10px 16px',background:'#F5F3FF',borderBottom:`1px solid ${PL}`,fontSize:'12px',color:P,fontWeight:'600',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>📋 {rows.length} sample(s) • {allTests.length} parameter(s)</span>
              <span style={{color:'#9CA3AF',fontSize:'11px'}}>← Scroll right for more parameters →</span>
            </div>

            <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'calc(100vh - 420px)'}}>
              <table style={{borderCollapse:'separate',borderSpacing:0,fontSize:'13px'}}>

                {/* ════ THEAD ════ */}
                <thead>
                  {/* Row 1: SAMPLE INFO + PARAMETERS group */}
                  <tr>
                    <th rowSpan={2} style={{
                      position:'sticky',top:0,left:0,zIndex:80,
                      width:`${INFO_W}px`,minWidth:`${INFO_W}px`,maxWidth:`${INFO_W}px`,
                      padding:'16px 14px',textAlign:'center',verticalAlign:'middle',
                      background:HEAD_BG,color:'#fff',fontWeight:'800',fontSize:'13px',
                      borderRight:'3px solid rgba(255,255,255,0.5)',
                      borderBottom:'2px solid rgba(255,255,255,0.3)',
                      boxShadow:'4px 0 10px rgba(0,0,0,0.2)',
                    }}>
                      <div>SAMPLE INFO</div>
                      <div style={{fontSize:'11px',color:'#DDD6FE',fontWeight:'400',marginTop:'5px'}}>Name · Date · Time</div>
                    </th>
                    <th colSpan={allTests.length||1} style={{
                      position:'sticky',top:0,zIndex:70,
                      padding:'10px 14px',textAlign:'center',fontWeight:'800',
                      fontSize:'13px',letterSpacing:'1px',color:'#fff',
                      background:HEAD_BG,borderBottom:'1px solid rgba(255,255,255,0.2)',
                    }}>
                      ⚗️ PARAMETERS ({allTests.length} test{allTests.length!==1?'s':''})
                    </th>
                  </tr>

                  {/* Row 2: Test name + spec merged */}
                  <tr>
                    {allTests.map(name=>{
                      const m=tMeta[name]||{};
                      return(
                        <th key={name} style={{
                          position:'sticky',top:'41px',zIndex:70,
                          width:`${TEST_W}px`,minWidth:`${TEST_W}px`,maxWidth:`${TEST_W}px`,
                          padding:'8px 8px 10px',textAlign:'center',verticalAlign:'middle',
                          background:HEAD_BG,
                          borderLeft:'2px solid rgba(255,255,255,0.25)',
                          borderBottom:'3px solid rgba(255,255,255,0.5)',
                        }}>
                          <div style={{fontWeight:'800',fontSize:'14px',color:G,letterSpacing:'0.3px',lineHeight:1.2}}>
                            {name}
                          </div>
                          {m.spec?(
                            <div style={{fontSize:'12px',color:G,fontWeight:'700',marginTop:'3px',lineHeight:1.2}}>
                              ({m.spec}){m.unit&&<span style={{fontWeight:'800',marginLeft:'3px'}}>{m.unit}</span>}
                            </div>
                          ):m.unit?(
                            <div style={{fontSize:'12px',color:G,fontWeight:'700',marginTop:'3px'}}>[{m.unit}]</div>
                          ):null}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* ════ TBODY ════ */}
                <tbody>
                  {rows.map((row,rowIdx)=>{
                    const isEven=rowIdx%2===0;
                    const rowBg=isEven?'#FAFAFA':'#ffffff';
                    const stickyBg=isEven?'#F5F3FF':'#ffffff';
                    const pByTest={};
                    for(const p of row.params){if(p.tests?.name) pByTest[p.tests.name]=p;}
                    const hasOOS=row.params.some(p=>p.result_status==='fail_low'||p.result_status==='fail_high');

                    return(
                      <tr key={row.sample?.id||rowIdx}
                        style={{outline:hasOOS?'2px solid #FECACA':'none',outlineOffset:'-1px'}}
                        onMouseEnter={e=>{e.currentTarget.style.filter='brightness(0.96)';}}
                        onMouseLeave={e=>{e.currentTarget.style.filter='none';}}
                      >
                        {/* Sample info — sticky left */}
                        <td style={{
                          position:'sticky',left:0,zIndex:30,
                          width:`${INFO_W}px`,minWidth:`${INFO_W}px`,maxWidth:`${INFO_W}px`,
                          padding:'12px 14px',verticalAlign:'top',
                          background:stickyBg,
                          borderRight:'3px solid #DDD6FE',
                          borderBottom:'1px solid #EDE9FE',
                          boxShadow:'4px 0 10px rgba(107,33,168,0.08)',
                        }}>
                          {/* Sample type label */}
                          <div style={{
                            fontSize:'10px',fontWeight:'700',
                            color:PM,background:'#F5F3FF',
                            padding:'1px 6px',borderRadius:'6px',
                            display:'inline-block',marginBottom:'4px',
                            border:`1px solid ${PL}`,
                          }}>
                            {row.sample?.sample_types?.name}
                          </div>
                          <div style={{fontWeight:'900',fontSize:'14px',color:'#1F2937',marginBottom:'4px',lineHeight:1.3}}>
                            {row.sample?.sample_name}
                          </div>
                          <div style={{fontSize:'11px',color:PM,fontFamily:'monospace',marginBottom:'5px',fontWeight:'700'}}>
                            {row.sample?.sample_number}
                          </div>
                          {row.sample?.registered_at&&(
                            <div style={{background:isEven?'#EDE9FE':'#F5F3FF',borderRadius:'8px',padding:'6px 9px',display:'inline-block'}}>
                              <div style={{fontSize:'12px',color:'#374151',fontWeight:'700'}}>
                                📅 {format(new Date(row.sample.registered_at),'dd MMM yyyy')}
                              </div>
                              <div style={{fontSize:'13px',color:PM,fontWeight:'900',fontFamily:'monospace',marginTop:'2px'}}>
                                🕐 {format(new Date(row.sample.registered_at),'HH:mm:ss')}
                              </div>
                            </div>
                          )}
                          {hasOOS&&(
                            <div style={{marginTop:'6px',fontSize:'11px',color:'#DC2626',fontWeight:'800',background:'#FEF2F2',padding:'3px 8px',borderRadius:'6px',display:'inline-block',border:'1px solid #FECACA'}}>
                              ⚠️ OUT OF SPEC
                            </div>
                          )}
                        </td>

                        {/* Result cells */}
                        {allTests.map(testName=>{
                          const p=pByTest[testName];
                          const m=tMeta[testName]||{};
                          if(!p){
                            return(
                              <td key={testName} style={{width:`${TEST_W}px`,minWidth:`${TEST_W}px`,maxWidth:`${TEST_W}px`,padding:'10px 8px',textAlign:'center',background:rowBg,borderLeft:'2px solid #EDE9FE',borderBottom:'1px solid #EDE9FE',verticalAlign:'middle'}}>
                                <span style={{color:'#D1D5DB',fontSize:'18px'}}>—</span>
                              </td>
                            );
                          }
                          const cs=getCS(p.result_status);
                          return(
                            <td key={testName} style={{width:`${TEST_W}px`,minWidth:`${TEST_W}px`,maxWidth:`${TEST_W}px`,padding:'10px 8px',textAlign:'center',background:rowBg,borderLeft:'2px solid #EDE9FE',borderBottom:'1px solid #EDE9FE',verticalAlign:'top'}}>
                              {p.result_value?(
                                <div>
                                  <div style={{display:'inline-block',background:cs.bg,color:cs.color,border:`2px solid ${cs.border}`,borderRadius:'8px',padding:'6px 12px',fontWeight:'900',fontSize:'17px',letterSpacing:'0.3px',minWidth:'70px'}}>
                                    {p.result_value}
                                    {m.unit&&<span style={{fontSize:'12px',fontWeight:'700',marginLeft:'2px',opacity:0.8}}>{m.unit}</span>}
                                  </div>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'3px',marginTop:'4px'}}>
                                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:cs.dot}}/>
                                    <span style={{fontSize:'10px',color:cs.color,fontWeight:'800'}}>
                                      {p.result_status==='fail_low'?'LOW':p.result_status==='fail_high'?'HIGH':(p.result_status==='pass'||p.result_status==='ok')?'OK':p.result_value==='Negative'?'PASS':p.result_value==='Positive'?'FAIL':p.result_value==='NIL'?'OK':p.result_value==='Traces'?'FAIL':''}
                                    </span>
                                  </div>
                                  {p.submitted_at&&(
                                    <div style={{marginTop:'6px',background:'#F9FAFB',borderRadius:'7px',padding:'4px 8px',display:'inline-block',border:'1px solid #E5E7EB'}}>
                                      <div style={{fontSize:'11px',color:'#374151',fontWeight:'700'}}>{format(new Date(p.submitted_at),'dd/MM/yyyy')}</div>
                                      <div style={{fontSize:'13px',color:PM,fontWeight:'900',fontFamily:'monospace',marginTop:'1px'}}>{format(new Date(p.submitted_at),'HH:mm')}</div>
                                    </div>
                                  )}
                                </div>
                              ):(
                                <div style={{color:'#D1D5DB',fontSize:'12px',fontStyle:'italic',padding:'8px 0'}}>Pending...</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{padding:'8px 16px',background:'#F5F3FF',borderTop:`1px solid ${PL}`,fontSize:'11px',color:'#9CA3AF',display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'6px'}}>
              <span>Header fixed • Scroll down for more results</span>
              <span>🟢 Green = OK &nbsp;|&nbsp; 🔴 Red = Out of Spec &nbsp;|&nbsp; — = Not Tested</span>
            </div>
          </div>
        )}
      </main>

      <PageFooter/>
    </div>
  );
}
