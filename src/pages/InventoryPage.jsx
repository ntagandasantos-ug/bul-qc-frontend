// ============================================================
// FILE: frontend/bul-qc-app/src/pages/InventoryPage.jsx
// Full laboratory inventory management system
// 7 categories · stock per location · export · breakage
// Desktop: original table view (unchanged)
// Mobile/Tablet (<=1024px): card-based responsive layout
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import api from '../services/api';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  RequisitionModal,
  TransferModal,
  UsageModal,
  StockBalanceSheet,
} from '../components/InventoryModals';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';
const RD = '#DC2626';

const CATS = [
  { code:'SOLID_CHEM',  name:'Solid Chemicals',    icon:'🧪', color:'#0369A1', light:'#E0F2FE' },
  { code:'LIQUID_CHEM', name:'Liquid Chemicals',   icon:'⚗️', color:'#7C3AED', light:'#EDE9FE' },
  { code:'INDICATORS',  name:'Indicators',         icon:'🔴', color:'#DC2626', light:'#FEF2F2' },
  { code:'PH_BUFFER',   name:'pH Buffer Capsules', icon:'💊', color:'#059669', light:'#ECFDF5' },
  { code:'GLASSWARE',   name:'Glassware',          icon:'🫙', color:'#0891B2', light:'#ECFEFF' },
  { code:'UTILITIES',   name:'Utilities',          icon:'🔧', color:'#EA580C', light:'#FFF7ED' },
  { code:'LOGBOOKS',    name:'Logbooks',           icon:'📒', color:'#7C2D12', light:'#FFF7ED' },
];

const LOCS = [
  { code:'CHEMICAL_STORE', label:'Chemical Store', color:'#7C3AED' },
  { code:'MAIN_LAB',       label:'Main Lab',       color:'#0369A1' },
  { code:'DET_LAB',        label:'Detergent Lab',  color:'#059669' },
];

const hasInUse = (code) => ['GLASSWARE','UTILITIES','LOGBOOKS'].includes(code);
const isChemical = (code) => ['SOLID_CHEM','LIQUID_CHEM','INDICATORS','PH_BUFFER'].includes(code);

export default function InventoryPage() {
  const { user } = useAuth();

  // ── Responsive breakpoint detection ──────────────────────
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [activeCat,  setActiveCat]  = useState('SOLID_CHEM');
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterLoc,  setFilterLoc]  = useState('ALL');
  const [filterOrig, setFilterOrig] = useState('');
  const [showLow,    setShowLow]    = useState(false);

  // Modals
  const [addModal,     setAddModal]     = useState(false);
  const [editItem,     setEditItem]     = useState(null);
  const [stockModal,   setStockModal]   = useState(null);
  const [breakModal,   setBreakModal]   = useState(null);
  const [txnModal,     setTxnModal]     = useState(null);
  const [reqModal,     setReqModal]     = useState(false);
  const [transferModal,setTransferModal]= useState(false);
  const [usageModal,   setUsageModal]   = useState(false);
  const [balanceSheet, setBalanceSheet] = useState(false);
  const [toast,        setToast]        = useState(null);
  const [saving,       setSaving]       = useState(false);

  // Mobile-only UI state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSheetOpen,  setMobileSheetOpen]  = useState(false);
  const [expandedCard,     setExpandedCard]     = useState(null);

  const showToast = (msg, type='success') => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/items');
      let data = res.data?.items || [];

      const catName = CATS.find(c => c.code === activeCat)?.name;
      if (catName) {
        data = data.filter(item => item.category_name === catName);
      }

      if (search) {
        const q = search.toLowerCase();
        data = data.filter(item =>
          item.item_name?.toLowerCase().includes(q) ||
          item.item_code?.toLowerCase().includes(q)
        );
      }

      if (filterOrig) {
        data = data.filter(item => item.country_of_origin === filterOrig);
      }

      if (filterLoc !== 'ALL') {
        data = data.filter(item =>
          (item.inventory_stock||[]).some(s => s.location === filterLoc && s.quantity > 0)
        );
      }

      if (showLow) {
        data = data.filter(item => item.is_low_stock === true);
      }

      setItems(data);
    } catch(e) {
      console.error(e);
    } finally { setLoading(false); }
  }, [activeCat, search, filterOrig, showLow, filterLoc]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = supabase.channel('inventory_live')
      .on('postgres_changes', { event:'*', schema:'public', table:'inventory_stock' }, () => load())
      .subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  const getStock = (item, location) => {
    const map = {
      CHEMICAL_STORE: { quantity: item.chemical_store_qty, in_stock: item.chemical_store_qty, in_use: 0 },
      MAIN_LAB:       { quantity: item.main_lab_qty,       in_stock: item.main_lab_not_in_use, in_use: item.main_lab_in_use },
      DET_LAB:        { quantity: item.det_lab_qty,        in_stock: item.det_lab_qty - (item.det_lab_in_use||0), in_use: item.det_lab_in_use },
    };
    const s = map[location];
    return s || { quantity:0, in_stock:0, in_use:0 };
  };

  const totalStock = (item) =>
    (item.chemical_store_qty||0) + (item.main_lab_qty||0) + (item.det_lab_qty||0);

  const isLow = (item) => item.is_low_stock === true;

  const exportExcel = () => {
    const catName = CATS.find(c=>c.code===activeCat)?.name || activeCat;
    const rows = [];
    for (const item of items) {
      const cs = getStock(item,'CHEMICAL_STORE');
      const ml = getStock(item,'MAIN_LAB');
      const dl = getStock(item,'DET_LAB');
      const row = {
        'Item Name'          : item.item_name,
        'Item Code'          : item.item_code || '',
        'Category'           : catName,
        'Reorder Level'      : item.reorder_level,
        'Unit'               : item.unit_of_measurement || '',
        'Country of Origin'  : item.country_of_origin || '',
        'Expiry Date'        : item.expiry_date || '',
        'Chemical Store'     : cs.quantity,
        'Main Lab'           : ml.quantity,
        'Detergent Lab'      : dl.quantity,
      };
      if (hasInUse(activeCat)) {
        row['Main Lab In-Use']   = ml.in_use;
        row['Main Lab In-Stock'] = ml.in_stock;
        row['Det Lab In-Use']    = dl.in_use;
        row['Det Lab In-Stock']  = dl.in_stock;
      }
      if (isChemical(activeCat)) {
        row['Specifications']     = item.specifications || '';
        row['Storage Conditions'] = item.storage_conditions || '';
        row['Restrictions']       = item.restrictions || '';
      }
      row['Comments'] = item.comments || '';
      rows.push(row);
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, catName.substring(0,31));
    XLSX.writeFile(wb, `BUL_QC_Inventory_${catName.replace(/ /g,'_')}_${format(new Date(),'yyyyMMdd')}.xlsx`);
    showToast('✅ Excel exported');
  };

  const exportPDF = async () => {
    try {
      const catName = CATS.find(c=>c.code===activeCat)?.name || activeCat;
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });

      doc.setFillColor(107,33,168);
      doc.rect(0,0,297,22,'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(13); doc.setFont(undefined,'bold');
      doc.text(`BUL QC LIMS — ${catName} Inventory Report`, 14, 10);
      doc.setFontSize(9); doc.setFont(undefined,'normal');
      doc.text(`Generated: ${format(new Date(),'dd/MM/yyyy HH:mm')} by ${user?.full_name||''}`, 14, 17);

      const head = [['Item','Code','Reorder Lvl','Unit','Origin','Exp Date','Chem Store','Main Lab','Det Lab','Comments']];
      const body = items.map(item => {
        const cs = getStock(item,'CHEMICAL_STORE');
        const ml = getStock(item,'MAIN_LAB');
        const dl = getStock(item,'DET_LAB');
        return [
          item.item_name, item.item_code||'',
          item.reorder_level, item.unit_of_measurement||'',
          item.country_of_origin||'', item.expiry_date||'',
          cs.quantity, ml.quantity, dl.quantity,
          (item.comments||'').substring(0,40),
        ];
      });

      autoTable(doc, {
        startY: 26, head, body, theme:'striped',
        headStyles: { fillColor:[107,33,168], textColor:255, fontSize:8, fontStyle:'bold' },
        bodyStyles: { fontSize:7.5 },
        alternateRowStyles: { fillColor:[245,243,255] },
        didDrawCell: (data) => {
          if (data.section==='body' && data.column.index >= 6) {
            const item = items[data.row.index];
            if (item && data.column.index===7 && isLow(item)) doc.setTextColor(220,38,38);
          }
        },
      });

      const pages = doc.getNumberOfPages();
      for(let i=1;i<=pages;i++){
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(150);
        doc.text('BUL QC LIMS · Designed by SantosInfographics',14,doc.internal.pageSize.height-5);
        doc.text(`Page ${i} of ${pages}`,280,doc.internal.pageSize.height-5,{align:'right'});
      }
      doc.save(`BUL_QC_Inventory_${catName.replace(/ /g,'_')}_${format(new Date(),'yyyyMMdd')}.pdf`);
      showToast('✅ PDF exported');
    } catch(e) {
      showToast('PDF export failed. Run: npm install jspdf jspdf-autotable','error');
    }
  };

  const origins = [...new Set(items.map(i=>i.country_of_origin).filter(Boolean))].sort();
  const cat = CATS.find(c=>c.code===activeCat);
  const lowCount = items.filter(isLow).length;
  const anyFilterActive = search || filterOrig || filterLoc !== 'ALL' || showLow;

  const inp = { border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', boxSizing:'border-box', width:'100%' };
  const sel = { ...inp, cursor:'pointer', appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 9px center', paddingRight:'28px' };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom: isMobile ? '90px' : '56px' }}>
      <Navbar />

      {toast && (
        <div style={{ position:'fixed', top:'70px', right:'16px', left: isMobile ? '16px' : 'auto', zIndex:600, background:toast.type==='error'?'#FEF2F2':'#F0FDF4', border:`1.5px solid ${toast.type==='error'?'#FECACA':'#86EFAC'}`, borderRadius:'12px', padding:'12px 18px', color:toast.type==='error'?RD:GR, fontSize:'13px', fontWeight:'700', boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '230px 1fr', minHeight:'calc(100vh - 110px)' }}>

        {!isMobile && (
        <div style={{ background:'#fff', borderRight:`1.5px solid ${PL}`, padding:'16px 12px', overflowY:'auto' }}>
          <div style={{ fontSize:'11px', fontWeight:'800', color:'#9CA3AF', letterSpacing:'1px', marginBottom:'10px', paddingLeft:'6px' }}>
            INVENTORY CATEGORIES
          </div>

          {CATS.map(c => {
            const active = activeCat === c.code;
            return (
              <button key={c.code} onClick={() => { setActiveCat(c.code); setSearch(''); setFilterOrig(''); setFilterLoc('ALL'); setShowLow(false); }}
                style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'10px 10px', border:'none', borderRadius:'10px', cursor:'pointer', fontFamily:'inherit', textAlign:'left', marginBottom:'4px', background:active?`linear-gradient(135deg,${P},${PM})`:'transparent', color:active?'#fff':'#374151', transition:'all 0.15s' }}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.background='#F5F3FF';}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}}
              >
                <span style={{ fontSize:'18px' }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:'700' }}>{c.name}</div>
                </div>
              </button>
            );
          })}

          <div style={{ marginTop:'16px', padding:'12px', background:'#F5F3FF', borderRadius:'10px', border:`1px solid ${PL}` }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:P, marginBottom:'8px' }}>Quick Actions</div>
            <button onClick={() => setReqModal(true)}
              style={{ width:'100%', padding:'7px', background:PM, color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', marginBottom:'5px', textAlign:'left' }}>
              📋 New Requisition
            </button>
            <button onClick={() => setTransferModal(true)}
              style={{ width:'100%', padding:'7px', background:'#EA580C', color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', marginBottom:'5px', textAlign:'left' }}>
              🔄 Lab-to-Lab Transfer
            </button>
            <button onClick={() => setUsageModal(true)}
              style={{ width:'100%', padding:'7px', background:'#0369A1', color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', marginBottom:'5px', textAlign:'left' }}>
              🔬 Record Lab Usage
            </button>
            <button onClick={() => setBreakModal({})}
              style={{ width:'100%', padding:'7px', background:'#FEF2F2', color:RD, border:`1px solid #FECACA`, borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', marginBottom:'5px', textAlign:'left' }}>
              💔 Record Breakage
            </button>
            <button onClick={() => setTxnModal(true)}
              style={{ width:'100%', padding:'7px', background:'#F9FAFB', color:'#374151', border:`1px solid #E5E7EB`, borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', marginBottom:'5px', textAlign:'left' }}>
              📜 Transaction Log
            </button>
            <button onClick={() => setBalanceSheet(true)}
              style={{ width:'100%', padding:'7px', background:'#F5F3FF', color:P, border:`1px solid ${PL}`, borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
              📊 Stock Balance Sheet
            </button>
          </div>
        </div>
        )}

        <div style={{ padding: isMobile ? '12px 12px' : '16px 18px', overflowY:'auto' }}>

          {isMobile && (
            <div style={{ display:'flex', gap:'8px', overflowX:'auto', WebkitOverflowScrolling:'touch', marginBottom:'12px', paddingBottom:'4px' }}>
              {CATS.map(c => {
                const active = activeCat === c.code;
                return (
                  <button key={c.code} onClick={() => { setActiveCat(c.code); setSearch(''); setFilterOrig(''); setFilterLoc('ALL'); setShowLow(false); }}
                    style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'6px', padding:'7px 13px', borderRadius:'20px', border:'none', background: active?`linear-gradient(135deg,${P},${PM})`:'#fff', color: active?'#fff':'#5B21B6', fontSize:'12.5px', fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', boxShadow: active?'none':`0 0 0 1px ${PL}` }}>
                    <span style={{ fontSize:'14px' }}>{c.icon}</span>{c.name}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display:'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              {!isMobile && (
                <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:cat?.light, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'26px', border:`1.5px solid ${cat?.color}33` }}>
                  {cat?.icon}
                </div>
              )}
              <div>
                <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight:'900', color:'#1F2937', margin:'0 0 2px' }}>{cat?.name}</h2>
                <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>
                  {items.length} item(s) · {lowCount > 0 && <span style={{ color:RD, fontWeight:'700' }}>{lowCount} below reorder level</span>}
                </p>
              </div>
            </div>

            {!isMobile && (
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                <button onClick={()=>setAddModal(true)}
                  style={{ padding:'8px 16px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  + Add Item
                </button>
                <button onClick={exportExcel} disabled={items.length===0}
                  style={{ padding:'8px 14px', background:'linear-gradient(135deg,#16A34A,#15803D)', color:'#fff', border:'none', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  📊 Excel
                </button>
                <button onClick={exportPDF} disabled={items.length===0}
                  style={{ padding:'8px 14px', background:'linear-gradient(135deg,#DC2626,#B91C1C)', color:'#fff', border:'none', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  📄 PDF
                </button>
                <button onClick={() => window.print()}
                  style={{ padding:'8px 14px', background:'#fff', color:P, border:`1.5px solid ${PL}`, borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  🖨 Print
                </button>
              </div>
            )}

            {isMobile && (
              <button onClick={()=>setAddModal(true)}
                style={{ padding:'8px 14px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                + Add Item
              </button>
            )}
          </div>

          {!isMobile && (
            <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'12px 14px', marginBottom:'14px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder={`🔍 Search ${cat?.name}...`}
                style={{ ...inp, flex:2, minWidth:'180px', cursor:'text' }}/>

              <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)} style={{ ...sel, flex:1, minWidth:'140px' }}>
                <option value="ALL">All Locations</option>
                {LOCS.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
              </select>

              <select value={filterOrig} onChange={e=>setFilterOrig(e.target.value)} style={{ ...sel, flex:1, minWidth:'140px' }}>
                <option value="">All Origins</option>
                {origins.map(o=><option key={o} value={o}>{o}</option>)}
              </select>

              <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', fontWeight:'600', color:RD, cursor:'pointer', whiteSpace:'nowrap' }}>
                <input type="checkbox" checked={showLow} onChange={e=>setShowLow(e.target.checked)} style={{ accentColor:RD }}/>
                Low Stock Only
              </label>

              {anyFilterActive && (
                <button onClick={()=>{setSearch('');setFilterOrig('');setFilterLoc('ALL');setShowLow(false);}}
                  style={{ padding:'6px 12px', border:`1px solid ${PL}`, borderRadius:'8px', background:'#F5F3FF', color:P, fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  ✕ Clear
                </button>
              )}
            </div>
          )}

          {isMobile && (
            <>
              <div style={{ display:'flex', gap:'8px', marginBottom: mobileFilterOpen ? '8px' : '12px' }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', background:'#fff', border:`1.5px solid ${PL}`, borderRadius:'10px', padding:'0 12px' }}>
                  <span style={{ fontSize:'13px', marginRight:'6px' }}>🔍</span>
                  <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder={`Search ${cat?.name}...`}
                    style={{ border:'none', outline:'none', fontSize:'13px', padding:'9px 0', width:'100%', background:'transparent' }}/>
                </div>
                <button onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                  style={{ width:'42px', flexShrink:0, borderRadius:'10px', border:`1.5px solid ${anyFilterActive?RD:PL}`, background: anyFilterActive ? '#FEF2F2' : '#fff', color: anyFilterActive ? RD : '#6B7280', fontSize:'15px', cursor:'pointer', position:'relative' }}>
                  ⚙️
                  {anyFilterActive && <span style={{ position:'absolute', top:'-3px', right:'-3px', width:'9px', height:'9px', borderRadius:'50%', background:RD, border:'1.5px solid #fff' }} />}
                </button>
              </div>

              {mobileFilterOpen && (
                <div style={{ background:'#fff', border:`1.5px solid ${PL}`, borderRadius:'12px', padding:'12px 14px', marginBottom:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                    <span style={{ fontSize:'11px', fontWeight:800, color:P, letterSpacing:'0.4px' }}>FILTERS</span>
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      {anyFilterActive && (
                        <button onClick={()=>{setSearch('');setFilterOrig('');setFilterLoc('ALL');setShowLow(false);}}
                          style={{ border:'none', background:'none', color:RD, fontSize:'12px', fontWeight:700 }}>
                          Clear
                        </button>
                      )}
                      <button onClick={() => setMobileFilterOpen(false)} style={{ border:'none', background:'none', color:'#9CA3AF', fontSize:'13px' }}>Done</button>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)} style={{ ...sel }}>
                      <option value="ALL">All Locations</option>
                      {LOCS.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <select value={filterOrig} onChange={e=>setFilterOrig(e.target.value)} style={{ ...sel }}>
                      <option value="">All Origins</option>
                      {origins.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                    <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', fontWeight:700, color: showLow ? RD : '#374151', cursor:'pointer', padding:'6px 2px' }}>
                      <input type="checkbox" checked={showLow} onChange={e=>setShowLow(e.target.checked)} style={{ width:'17px', height:'17px', accentColor:RD }} />
                      Low Stock Only
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {loading ? (
            <div style={{ textAlign:'center', padding:'60px', color:PM, fontWeight:'600' }}>Loading inventory...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign:'center', padding: isMobile ? '40px 16px' : '60px', background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}` }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>{cat?.icon}</div>
              <p style={{ fontWeight:'700', color:'#374151', fontSize:'15px' }}>No items found</p>
              <p style={{ fontSize:'12px', color:'#9CA3AF' }}>Click + Add Item to add your first {cat?.name} item</p>
              <button onClick={()=>setAddModal(true)} style={{ marginTop:'14px', padding:'10px 22px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                + Add First Item
              </button>
            </div>
          ) : isMobile ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {items.map((item) => {
                const cs = getStock(item,'CHEMICAL_STORE');
                const ml = getStock(item,'MAIN_LAB');
                const dl = getStock(item,'DET_LAB');
                const low = isLow(item);
                const expanded = expandedCard === item.item_id;
                return (
                  <div key={item.item_id} style={{ background:'#fff', borderRadius:'14px', overflow:'hidden', boxShadow:'0 1px 4px rgba(107,33,168,0.08)', border:`1px solid ${PL}`, display:'flex' }}>
                    <div style={{ width:'4px', background: low?RD:GR, flexShrink:0 }} />
                    <div style={{ flex:1, padding:'12px 14px', minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:800, fontSize:'14px', color:'#1F2937', lineHeight:1.3 }}>{item.item_name}</div>
                          <div style={{ fontFamily:'monospace', fontSize:'10.5px', color:PM, fontWeight:700, marginTop:'2px' }}>{item.item_code||'—'}</div>
                        </div>
                        {low && <span style={{ background:'#FEE2E2', color:RD, fontSize:'10px', fontWeight:800, padding:'3px 8px', borderRadius:'20px', whiteSpace:'nowrap', flexShrink:0 }}>⚠ LOW</span>}
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', marginTop:'10px' }}>
                        {[
                          { label:'Store', val:cs.quantity, hl:false, onClick:()=>setStockModal({ item, location:'CHEMICAL_STORE', locationLabel:'Chemical Store' }) },
                          { label:'Main Lab', val:ml.quantity, hl:true, onClick:()=>setStockModal({ item, location:'MAIN_LAB', locationLabel:'Main Lab' }) },
                          { label:'Det Lab', val:dl.quantity, hl:false, onClick:()=>setStockModal({ item, location:'DET_LAB', locationLabel:'Detergent Lab' }) },
                        ].map((s,si)=>(
                          <button key={si} onClick={s.onClick} style={{ background: s.hl ? (low?'#FEF2F2':'#F0FDF4') : '#F9FAFB', border:'none', borderRadius:'9px', padding:'6px 4px', textAlign:'center', cursor:'pointer' }}>
                            <div style={{ fontSize:'9.5px', color:'#9CA3AF', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.3px' }}>{s.label}</div>
                            <div style={{ fontSize:'16px', fontWeight:800, color: s.hl ? (low?RD:GR) : '#374151', marginTop:'1px' }}>{s.val}</div>
                          </button>
                        ))}
                      </div>

                      {hasInUse(activeCat) && (
                        <div style={{ display:'flex', gap:'10px', marginTop:'7px', fontSize:'10.5px', color:'#6B7280' }}>
                          <span>Main: <strong style={{ color:'#EA580C' }}>{ml.in_use||0}</strong> in use, <strong style={{ color:GR }}>{ml.in_stock||0}</strong> free</span>
                        </div>
                      )}

                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'9px' }}>
                        <span style={{ fontSize:'11px', color:'#9CA3AF' }}>Reorder: <strong style={{ color:'#6B7280' }}>{item.reorder_level} {item.unit_of_measurement}</strong></span>
                        <button onClick={() => setExpandedCard(expanded ? null : item.item_id)}
                          style={{ border:'none', background:'none', color:PM, fontSize:'11px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'3px' }}>
                          {expanded ? 'Less' : 'Details'} <span style={{ fontSize:'9px', transform: expanded?'rotate(180deg)':'none', display:'inline-block' }}>▾</span>
                        </button>
                      </div>

                      {expanded && (
                        <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:`1px dashed ${PL}`, display:'flex', flexDirection:'column', gap:'6px' }}>
                          {isChemical(activeCat) && (
                            <>
                              <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Specifications:</strong> {item.specifications||'—'}</div>
                              <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Storage:</strong> {item.storage_conditions||'—'}</div>
                              <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Restrictions:</strong> {item.restrictions||'—'}</div>
                            </>
                          )}
                          {activeCat==='PH_BUFFER' && (
                            <>
                              <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Brand:</strong> {item.brand_name||'—'}</div>
                              <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>pH Range:</strong> {item.ph_range||'—'}</div>
                            </>
                          )}
                          {hasInUse(activeCat) && (
                            <>
                              <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Capacity:</strong> {item.capacity||'—'}</div>
                              <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Type/Brand:</strong> {item.type_or_brand||'—'}</div>
                            </>
                          )}
                          <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Origin:</strong> {item.country_of_origin||'—'}</div>
                          <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Expiry:</strong> {item.expiry_date||'—'}</div>
                          {item.comments && <div style={{ fontSize:'11.5px', color:'#6B7280' }}><strong style={{ color:'#374151' }}>Comments:</strong> {item.comments}</div>}
                          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                            <button onClick={() => setEditItem(item)} style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', background:PL, color:P, fontSize:'12px', fontWeight:700 }}>✏️ Edit</button>
                            <button onClick={() => setBreakModal({ item_id:item.item_id, item_name:item.item_name, unit:item.unit_of_measurement })} style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', background:'#FEF2F2', color:RD, fontSize:'12px', fontWeight:700 }}>💔 Breakage</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <button onClick={exportExcel} disabled={items.length===0} style={{ flex:1, padding:'10px', background:'linear-gradient(135deg,#16A34A,#15803D)', color:'#fff', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700' }}>📊 Excel</button>
                <button onClick={exportPDF} disabled={items.length===0} style={{ flex:1, padding:'10px', background:'linear-gradient(135deg,#DC2626,#B91C1C)', color:'#fff', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700' }}>📄 PDF</button>
              </div>
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, overflow:'hidden', boxShadow:'0 2px 8px rgba(107,33,168,0.06)' }}>
              <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 300px)' }}>
                <table style={{ borderCollapse:'separate', borderSpacing:0, width:'100%', fontSize:'12px' }}>
                  <thead>
                    <tr>
                      {[
                        'Item Name','Code',
                        ...(isChemical(activeCat)?['Specifications','Storage','Restrictions']:cat?.code==='PH_BUFFER'?['Brand','pH Range','Storage']:['Capacity','Type/Brand']),
                        'Unit','Origin','Expiry','Reorder Lvl',
                        'Chemical Store','Main Lab','Det Lab',
                        ...(hasInUse(activeCat)?['ML In-Use','ML In-Stock','DL In-Use','DL In-Stock']:[]),
                        'Comments','Actions',
                      ].map((h, hi) => (
                        <th key={h} style={{
                          position:'sticky', top:0,
                          left: hi===0 ? 0 : undefined,
                          background:`linear-gradient(180deg,${P},#5B1894)`,
                          color: ['Chemical Store','Reorder Lvl'].includes(h)?G:'#fff',
                          padding:'9px 10px', textAlign:'left', fontSize:'11px', fontWeight:'800',
                          whiteSpace:'nowrap', borderBottom:'2px solid rgba(255,255,255,0.2)',
                          borderRight:'1px solid rgba(255,255,255,0.15)',
                          zIndex: hi===0 ? 60 : 50,
                          boxShadow: hi===0 ? '2px 0 4px rgba(0,0,0,0.15)' : 'none',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const even = i%2===0;
                      const cs = getStock(item,'CHEMICAL_STORE');
                      const ml = getStock(item,'MAIN_LAB');
                      const dl = getStock(item,'DET_LAB');
                      const low = isLow(item);
                      const td = (content, opts={}) => (
                        <td style={{ padding:'9px 10px', borderBottom:'1px solid #EDE9FE', borderRight:'1px solid #F5F3FF', background:even?'#FAFAFA':'#fff', verticalAlign:'top', whiteSpace:'nowrap', ...opts.style }}>
                          {content}
                        </td>
                      );
                      return (
                        <tr key={item.item_id}
                          style={{ outline:low?'2px solid #FECACA':'none', outlineOffset:'-1px' }}
                          onMouseEnter={e=>e.currentTarget.style.filter='brightness(0.96)'}
                          onMouseLeave={e=>e.currentTarget.style.filter='none'}
                        >
                          <td style={{
                            position:'sticky', left:0,
                            padding:'9px 10px', borderBottom:'1px solid #EDE9FE',
                            background:even?'#F5F3FF':'#fff',
                            fontWeight:'700', color:'#1F2937', whiteSpace:'nowrap',
                            borderRight:'1px solid #EDE9FE',
                            zIndex:40,
                            boxShadow:'2px 0 4px rgba(0,0,0,0.08)',
                          }}>
                            {low && <span style={{ fontSize:'10px', color:RD, fontWeight:'800', display:'block', marginBottom:'2px' }}>⚠️ LOW STOCK</span>}
                            {item.item_name}
                          </td>
                          {td(<span style={{ fontFamily:'monospace', fontSize:'11px', color:PM, fontWeight:'700' }}>{item.item_code||'—'}</span>)}

                          {isChemical(activeCat) && <>
                            {td(<span style={{ maxWidth:'140px', display:'block', whiteSpace:'normal', lineHeight:1.4, fontSize:'11px' }}>{item.specifications||'—'}</span>, {style:{whiteSpace:'normal'}})}
                            {td(<span style={{ maxWidth:'120px', display:'block', whiteSpace:'normal', lineHeight:1.4, fontSize:'11px' }}>{item.storage_conditions||'—'}</span>, {style:{whiteSpace:'normal'}})}
                            {td(<span style={{ maxWidth:'120px', display:'block', whiteSpace:'normal', lineHeight:1.4, fontSize:'11px' }}>{item.restrictions||'—'}</span>, {style:{whiteSpace:'normal'}})}
                          </>}
                          {activeCat==='PH_BUFFER' && <>
                            {td(item.brand_name||'—')}
                            {td(item.ph_range||'—')}
                            {td(<span style={{ fontSize:'11px' }}>{item.storage_conditions||'—'}</span>)}
                          </>}
                          {hasInUse(activeCat) && <>
                            {td(item.capacity||'—')}
                            {td(item.type_or_brand||'—')}
                          </>}

                          {td(item.unit_of_measurement||'—')}
                          {td(item.country_of_origin||'—')}
                          {td(item.expiry_date ? (
                            <span style={{ color: new Date(item.expiry_date) < new Date() ? RD : '#374151', fontWeight: new Date(item.expiry_date) < new Date() ? '700':'400' }}>
                              {item.expiry_date}
                            </span>
                          ) : '—')}
                          {td(<span style={{ fontWeight:'700', color: low?RD:'#374151' }}>{item.reorder_level}</span>)}

                          {[cs,ml,dl].map((s,si) => (
                            <td key={si} style={{ padding:'9px 10px', borderBottom:'1px solid #EDE9FE', borderRight:'1px solid #F5F3FF', background:even?'#FAFAFA':'#fff', textAlign:'center', verticalAlign:'top' }}>
                              <div style={{ fontWeight:'900', fontSize:'15px', color: si===1&&low ? RD : s.quantity===0 ? '#9CA3AF' : '#1F2937' }}>
                                {s.quantity}
                              </div>
                              <div style={{ fontSize:'10px', color:'#9CA3AF' }}>{item.unit_of_measurement||''}</div>
                              <button onClick={() => setStockModal({ item, location:LOCS[si].code, locationLabel:LOCS[si].label })}
                                style={{ fontSize:'10px', padding:'2px 7px', background:PL, color:P, border:'none', borderRadius:'5px', cursor:'pointer', fontFamily:'inherit', fontWeight:'600', marginTop:'3px' }}>
                                Update
                              </button>
                            </td>
                          ))}

                          {hasInUse(activeCat) && <>
                            {[{s:ml,loc:'MAIN_LAB'},{s:dl,loc:'DET_LAB'}].flatMap(({s,loc}) => [
                              <td key={`${item.item_id}-${loc}-iu`} style={{ padding:'9px 10px', borderBottom:'1px solid #EDE9FE', background:even?'#FAFAFA':'#fff', textAlign:'center', color:'#EA580C', fontWeight:'700' }}>{s.in_use||0}</td>,
                              <td key={`${item.item_id}-${loc}-is`} style={{ padding:'9px 10px', borderBottom:'1px solid #EDE9FE', background:even?'#FAFAFA':'#fff', textAlign:'center', color:GR, fontWeight:'700' }}>{s.in_stock||0}</td>,
                            ])}
                          </>}

                          {td(<span style={{ maxWidth:'120px', display:'block', whiteSpace:'normal', fontSize:'11px', color:'#6B7280' }}>{item.comments||'—'}</span>, {style:{whiteSpace:'normal'}})}

                          <td style={{ padding:'8px 10px', borderBottom:'1px solid #EDE9FE', background:even?'#FAFAFA':'#fff', whiteSpace:'nowrap' }}>
                            <div style={{ display:'flex', gap:'4px' }}>
                              <button onClick={() => setEditItem(item)}
                                style={{ padding:'4px 8px', background:'#F5F3FF', color:P, border:`1px solid ${PL}`, borderRadius:'6px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit', fontWeight:'600' }}>
                                ✏️
                              </button>
                              <button onClick={() => setBreakModal({ item_id:item.item_id, item_name:item.item_name, unit:item.unit_of_measurement })}
                                style={{ padding:'4px 8px', background:'#FEF2F2', color:RD, border:'1px solid #FECACA', borderRadius:'6px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit', fontWeight:'600' }}>
                                💔
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:'6px 14px', background:'#F5F3FF', borderTop:`1px solid ${PL}`, fontSize:'11px', color:'#9CA3AF', display:'flex', justifyContent:'space-between' }}>
                <span>{items.length} item(s) · Scroll horizontally for all columns</span>
                <span>⚠️ = below reorder level · Update buttons update stock per location</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {isMobile && (
        <button onClick={() => setMobileSheetOpen(true)}
          style={{ position:'fixed', bottom:'90px', right:'20px', width:'56px', height:'56px', borderRadius:'50%', background:`linear-gradient(135deg,${P},${PM})`, border:'none', color:'#fff', fontSize:'26px', boxShadow:'0 6px 20px rgba(107,33,168,0.4)', cursor:'pointer', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center' }}>
          +
        </button>
      )}

      {isMobile && mobileSheetOpen && (
  <div onClick={() => setMobileSheetOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:550, display:'flex', alignItems:'flex-end' }}>
    <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'75vh', overflowY:'auto', padding:'10px 16px calc(28px + 80px)' }}>
      <div style={{ width:'36px', height:'4px', background:'#E5E7EB', borderRadius:'10px', margin:'4px auto 14px', position:'sticky', top:0 }} />
      <div style={{ fontWeight:800, fontSize:'14px', color:'#1F2937', marginBottom:'12px' }}>Quick Actions</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
              <button onClick={() => { setMobileSheetOpen(false); setReqModal(true); }}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'13px 12px', borderRadius:'12px', border:'none', background:PM, color:'#fff', fontSize:'13px', fontWeight:700 }}>
                <span style={{ fontSize:'17px' }}>📋</span>Requisition
              </button>
              <button onClick={() => { setMobileSheetOpen(false); setTransferModal(true); }}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'13px 12px', borderRadius:'12px', border:'none', background:'#EA580C14', color:'#EA580C', fontSize:'13px', fontWeight:700 }}>
                <span style={{ fontSize:'17px' }}>🔄</span>Transfer
              </button>
              <button onClick={() => { setMobileSheetOpen(false); setUsageModal(true); }}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'13px 12px', borderRadius:'12px', border:'none', background:'#0369A114', color:'#0369A1', fontSize:'13px', fontWeight:700 }}>
                <span style={{ fontSize:'17px' }}>🔬</span>Usage
              </button>
              <button onClick={() => { setMobileSheetOpen(false); setBreakModal({}); }}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'13px 12px', borderRadius:'12px', border:'none', background:'#FEF2F2', color:RD, fontSize:'13px', fontWeight:700 }}>
                <span style={{ fontSize:'17px' }}>💔</span>Breakage
              </button>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => { setMobileSheetOpen(false); setTxnModal(true); }}
                style={{ flex:1, padding:'11px', borderRadius:'10px', border:`1px solid ${PL}`, background:'#F9FAFB', color:'#374151', fontSize:'12.5px', fontWeight:700 }}>📜 Transaction Log</button>
              <button onClick={() => { setMobileSheetOpen(false); setBalanceSheet(true); }}
                style={{ flex:1, padding:'11px', borderRadius:'10px', border:`1px solid ${PL}`, background:'#F5F3FF', color:P, fontSize:'12.5px', fontWeight:700 }}>📊 Balance Sheet</button>
            </div>
          </div>
        </div>
      )}

      {(addModal || editItem) && (
        <ItemModal
          item={editItem ? {
            ...editItem,
            unit_of_measurement: editItem.unit_of_measurement || editItem.unit || '',
          } : null}
          catCode={activeCat}
          catName={cat?.name}
          onClose={() => { setAddModal(false); setEditItem(null); }}
          onSave={async (data) => {
            setSaving(true);
            try {
              if (editItem) {
                await api.put(`/inventory/items/${editItem.item_id}`, data);
                showToast('Item updated');
              } else {
                const catRes = await supabase.from('inventory_categories').select('id').eq('code',activeCat).single();
                const { qty_chemical_store, qty_main_lab, qty_det_lab, ...itemData } = data;

                const res = await api.post('/inventory/items', {
                  ...itemData,
                  category_id: catRes.data?.id,
                });

                const newItem = res.data?.item;

                const locs = [
                  { loc:'CHEMICAL_STORE', qty: parseFloat(data.qty_chemical_store||0) },
                  { loc:'MAIN_LAB',       qty: parseFloat(data.qty_main_lab||0) },
                  { loc:'DET_LAB',        qty: parseFloat(data.qty_det_lab||0) },
                ];
                for (const { loc, qty } of locs) {
                  if (qty > 0 && newItem?.id) {
                    await supabase.from('inventory_stock').upsert({
                      item_id    : newItem.id,
                      location   : loc,
                      quantity   : qty,
                      in_stock   : qty,
                      in_use     : 0,
                      last_updated: new Date().toISOString(),
                    }, { onConflict:'item_id,location' });
                  }
                }
                showToast('Item added with initial quantities');
              }
              setAddModal(false); setEditItem(null);
              load();
            } catch(e) { showToast(e.response?.data?.error || e.message, 'error'); }
            finally { setSaving(false); }
          }}
        />
      )}

      {stockModal && (
        <StockModal
          data={stockModal}
          hasInUse={hasInUse(activeCat)}
          onClose={() => setStockModal(null)}
          onSave={async (payload) => {
            setSaving(true);
            try {
              if (payload.in_use !== undefined) {
                await api.post('/inventory/in-use-update', { item_id:stockModal.item.item_id, location:stockModal.location, ...payload });
              } else {
                await api.post('/inventory/stock-update', { item_id:stockModal.item.item_id, location:stockModal.location, ...payload });
              }
              showToast('Stock updated · Email notification sent to QC Head');
              setStockModal(null); load();
            } catch(e) { showToast(e.response?.data?.error || e.message, 'error'); }
            finally { setSaving(false); }
          }}
        />
      )}

      {breakModal && (
        <BreakageModal
          item={breakModal}
          onClose={() => setBreakModal(null)}
          onSave={async (payload) => {
            setSaving(true);
            try {
              await api.post('/inventory/breakage', payload);
              showToast('Breakage recorded · QC Head notified via email');
              setBreakModal(null); load();
            } catch(e) { showToast(e.response?.data?.error || e.message, 'error'); }
            finally { setSaving(false); }
          }}
        />
      )}

      {reqModal && (
        <RequisitionModal
          onClose={() => setReqModal(false)}
          onSuccess={() => { setReqModal(false); load(); }}
          showToast={showToast}
        />
      )}

      {transferModal && (
        <TransferModal
          onClose={() => setTransferModal(false)}
          onSuccess={() => { setTransferModal(false); load(); }}
          showToast={showToast}
        />
      )}

      {usageModal && (
        <UsageModal
          onClose={() => setUsageModal(false)}
          onSuccess={() => { setUsageModal(false); load(); }}
          showToast={showToast}
        />
      )}

      {txnModal && (
        <TransactionModal onClose={() => setTxnModal(false)} />
      )}

      {balanceSheet && (
        <StockBalanceSheet onClose={() => setBalanceSheet(false)} />
      )}

      <PageFooter />
    </div>
  );
}

// ── ADD / EDIT ITEM MODAL ─────────────────────────────────
function ItemModal({ item, catCode, catName, onClose, onSave }) {
  const [form, setForm] = useState({
    item_name:'', unit_of_measurement:'', country_of_origin:'',
    reorder_level:0, expiry_date:'', comments:'',
    specifications:'', storage_conditions:'', restrictions:'',
    usage_description:'', brand_name:'', ph_range:'',
    capacity:'', type_or_brand:'',
    qty_chemical_store: 0,
    qty_main_lab      : 0,
    qty_det_lab       : 0,
    ...item,
  });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const inp2 = { border:`1.5px solid #EDE9FE`, borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', boxSizing:'border-box', width:'100%' };
  const fld2 = { marginBottom:'12px' };
  const lbl2 = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' };
  const isChemical_ = ['SOLID_CHEM','LIQUID_CHEM','INDICATORS','PH_BUFFER'].includes(catCode);
  const hasInUse_   = ['GLASSWARE','UTILITIES','LOGBOOKS'].includes(catCode);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 1024;

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:500, display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center', padding: isMobile ? 0 : '16px' }}>
      <div style={{ background:'#fff', borderRadius: isMobile ? '20px 20px 0 0' : '18px', maxWidth: isMobile ? '100%' : '680px', width:'100%', maxHeight: isMobile ? '85vh' : '92vh', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column' }}>
        <div style={{ background:`linear-gradient(135deg,#6B21A8,#7C3AED)`, padding:'16px 22px', color:'#fff', flexShrink:0 }}>
          <div style={{ fontWeight:'900', fontSize:'16px' }}>{item?'Edit':'Add'} {catName} Item</div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div style={{ gridColumn:'1/3', ...fld2 }}>
              <label style={lbl2}>Item Name *</label>
              <input type="text" value={form.item_name} onChange={e=>set('item_name',e.target.value)} style={inp2}/>
            </div>
            {catCode==='PH_BUFFER'&&<>
              <div style={fld2}><label style={lbl2}>Brand Name</label><input type="text" value={form.brand_name||''} onChange={e=>set('brand_name',e.target.value)} style={inp2}/></div>
              <div style={fld2}><label style={lbl2}>pH Range</label><input type="text" value={form.ph_range||''} onChange={e=>set('ph_range',e.target.value)} style={inp2} placeholder="e.g. 4.0 – 7.0"/></div>
            </>}
            {hasInUse_&&<>
              <div style={fld2}><label style={lbl2}>Capacity</label><input type="text" value={form.capacity||''} onChange={e=>set('capacity',e.target.value)} style={inp2} placeholder="e.g. 250ml"/></div>
              <div style={fld2}><label style={lbl2}>Type / Brand</label><input type="text" value={form.type_or_brand||''} onChange={e=>set('type_or_brand',e.target.value)} style={inp2}/></div>
            </>}
            {isChemical_&&<>
              <div style={{ gridColumn:'1/3', ...fld2 }}><label style={lbl2}>Specifications</label><input type="text" value={form.specifications||''} onChange={e=>set('specifications',e.target.value)} style={inp2}/></div>
              <div style={fld2}><label style={lbl2}>Storage Conditions</label><input type="text" value={form.storage_conditions||''} onChange={e=>set('storage_conditions',e.target.value)} style={inp2}/></div>
              <div style={fld2}><label style={lbl2}>Restrictions</label><input type="text" value={form.restrictions||''} onChange={e=>set('restrictions',e.target.value)} style={inp2}/></div>
              <div style={{ gridColumn:'1/3', ...fld2 }}><label style={lbl2}>Usage Description</label><textarea value={form.usage_description||''} onChange={e=>set('usage_description',e.target.value)} style={{ ...inp2, minHeight:'50px', resize:'vertical' }}/></div>
            </>}
            <div style={fld2}><label style={lbl2}>Unit of Measurement</label><input type="text" value={form.unit_of_measurement||''} onChange={e=>set('unit_of_measurement',e.target.value)} style={inp2} placeholder="e.g. g, ml, pcs"/></div>
            <div style={fld2}><label style={lbl2}>Country of Origin</label><input type="text" value={form.country_of_origin||''} onChange={e=>set('country_of_origin',e.target.value)} style={inp2}/></div>
            <div style={fld2}><label style={lbl2}>Reorder Level (Chemical Store)</label><input type="number" value={form.reorder_level||0} onChange={e=>set('reorder_level',e.target.value)} style={inp2}/></div>
            <div style={fld2}><label style={lbl2}>Expiry Date</label><input type="date" value={form.expiry_date||''} onChange={e=>set('expiry_date',e.target.value)} style={inp2}/></div>

            {!item && (
              <div style={{ gridColumn:'1/3', background:'#F5F3FF', borderRadius:'12px', padding:'14px', border:`1.5px solid #EDE9FE`, marginBottom:'4px' }}>
                <div style={{ fontSize:'12px', fontWeight:'800', color:'#4C1D95', marginBottom:'10px' }}>
                  📦 Initial Stock Quantities
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                  <div>
                    <label style={lbl2}>Chemical Store</label>
                    <input type="number" min="0" value={form.qty_chemical_store||0} onChange={e=>set('qty_chemical_store',e.target.value)} style={inp2} placeholder="0"/>
                  </div>
                  <div>
                    <label style={lbl2}>Main Lab</label>
                    <input type="number" min="0" value={form.qty_main_lab||0} onChange={e=>set('qty_main_lab',e.target.value)} style={inp2} placeholder="0"/>
                  </div>
                  <div>
                    <label style={lbl2}>Detergent Lab</label>
                    <input type="number" min="0" value={form.qty_det_lab||0} onChange={e=>set('qty_det_lab',e.target.value)} style={inp2} placeholder="0"/>
                  </div>
                </div>
                <p style={{ fontSize:'11px', color:'#6B7280', margin:'8px 0 0' }}>
                  These quantities will be set immediately when the item is added.
                </p>
              </div>
            )}

            <div style={{ gridColumn:'1/3', ...fld2 }}><label style={lbl2}>Comments / Remarks</label><textarea value={form.comments||''} onChange={e=>set('comments',e.target.value)} style={{ ...inp2, minHeight:'60px', resize:'vertical' }}/></div>
          </div>
        </div>
        <div style={{ padding: isMobile ? '14px 24px calc(14px + 80px)' : '14px 24px', borderTop:`1.5px solid #EDE9FE`, background:'#F9FAFB', display:'flex', gap:'10px', flexShrink:0 }}>
  <button onClick={()=>onSave(form)} disabled={!form.item_name.trim()}
    style={{ flex:1, padding:'11px', background:!form.item_name.trim()?'#A78BFA':`linear-gradient(135deg,#6B21A8,#7C3AED)`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:!form.item_name.trim()?'not-allowed':'pointer', fontFamily:'inherit' }}>
    {item?'✅ Update Item':'✅ Add Item'}
  </button>
  <button onClick={onClose} style={{ flex:1, padding:'11px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
</div>
      </div>
    </div>
  );
}

// ── STOCK UPDATE MODAL ────────────────────────────────────
function StockModal({ data, hasInUse, onClose, onSave }) {
  const [type,    setType]    = useState('STOCK_IN');
  const [qty,     setQty]     = useState('');
  const [inUse,   setInUse]   = useState('');
  const [inStock, setInStock] = useState('');
  const [notes,   setNotes]   = useState('');
  const inp2={ border:`1.5px solid #EDE9FE`, borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', boxSizing:'border-box', width:'100%' };
  const types=['STOCK_IN','STOCK_OUT','ADJUSTMENT'];
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', maxWidth:'420px', width:'100%', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ background:`linear-gradient(135deg,#6B21A8,#7C3AED)`, padding:'14px 20px', color:'#fff' }}>
          <div style={{ fontWeight:'900', fontSize:'15px' }}>📦 Update Stock — {data.locationLabel}</div>
          <div style={{ fontSize:'12px', color:'#DDD6FE', marginTop:'2px' }}>{data.item?.item_name}</div>
        </div>
        <div style={{ padding:'20px' }}>
          {!hasInUse ? <>
            <div style={{ marginBottom:'12px' }}>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Transaction Type</label>
              <div style={{ display:'flex', gap:'5px' }}>
                {types.map(t=>(
                  <button key={t} onClick={()=>setType(t)} style={{ flex:1, padding:'7px', border:`1.5px solid ${type===t?'#7C3AED':'#EDE9FE'}`, borderRadius:'8px', background:type===t?'#EDE9FE':'#fff', color:type===t?'#6B21A8':'#6B7280', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                    {t.replace('_',' ')}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:'12px' }}>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Quantity *</label>
              <input type="number" value={qty} onChange={e=>setQty(e.target.value)} style={inp2} placeholder="Enter quantity"/>
            </div>
          </> : <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>In Use</label>
                <input type="number" value={inUse} onChange={e=>setInUse(e.target.value)} style={inp2}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>In Stock</label>
                <input type="number" value={inStock} onChange={e=>setInStock(e.target.value)} style={inp2}/>
              </div>
            </div>
          </>}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Notes</label>
            <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} style={inp2} placeholder="Optional reason or reference..."/>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={()=>onSave(hasInUse?{in_use:parseFloat(inUse||0),in_stock:parseFloat(inStock||0),notes}:{transaction_type:type,quantity:qty,notes})}
              style={{ flex:1, padding:'10px', background:`linear-gradient(135deg,#6B21A8,#7C3AED)`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
              ✅ Update Stock
            </button>
            <button onClick={onClose} style={{ flex:1, padding:'10px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BREAKAGE MODAL ────────────────────────────────────────
function BreakageModal({ item, onClose, onSave }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    item_id:'', item_name:'', quantity_broken:'', unit:'',
    location:'MAIN_LAB', broken_by_name:user?.full_name||'',
    supervisor_name:'', circumstances:'', shift:'',
    ...item,
  });
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const inp2={ border:`1.5px solid #EDE9FE`, borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', boxSizing:'border-box', width:'100%' };
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', maxWidth:'480px', width:'100%', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ background:'linear-gradient(135deg,#DC2626,#B91C1C)', padding:'14px 20px', color:'#fff' }}>
          <div style={{ fontWeight:'900', fontSize:'15px' }}>💔 Record Item Breakage</div>
          <div style={{ fontSize:'11px', color:'#FCA5A5', marginTop:'2px' }}>This will notify QC Head & Assistant via email</div>
        </div>
        <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'10px' }}>
          <div><label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#991B1B', marginBottom:'4px' }}>Item Name *</label><input type="text" value={form.item_name||''} onChange={e=>set('item_name',e.target.value)} style={inp2} placeholder="Name of broken item"/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div><label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#991B1B', marginBottom:'4px' }}>Quantity Broken *</label><input type="number" value={form.quantity_broken||''} onChange={e=>set('quantity_broken',e.target.value)} style={inp2}/></div>
            <div><label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#991B1B', marginBottom:'4px' }}>Location</label>
              <select value={form.location} onChange={e=>set('location',e.target.value)} style={{ ...inp2, cursor:'pointer' }}>
                <option value="CHEMICAL_STORE">Chemical Store</option>
                <option value="MAIN_LAB">Main Lab</option>
                <option value="DET_LAB">Detergent Lab</option>
              </select>
            </div>
          </div>
          <div><label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#991B1B', marginBottom:'4px' }}>Broken By (Name) *</label><input type="text" value={form.broken_by_name||''} onChange={e=>set('broken_by_name',e.target.value)} style={inp2}/></div>
          <div><label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#991B1B', marginBottom:'4px' }}>Shift Supervisor</label><input type="text" value={form.supervisor_name||''} onChange={e=>set('supervisor_name',e.target.value)} style={inp2}/></div>
          <div><label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#991B1B', marginBottom:'4px' }}>Circumstances</label><textarea value={form.circumstances||''} onChange={e=>set('circumstances',e.target.value)} style={{ ...inp2, minHeight:'60px', resize:'vertical' }} placeholder="Describe how the breakage occurred..."/></div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={()=>onSave(form)} disabled={!form.item_name||!form.quantity_broken}
              style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#DC2626,#B91C1C)', color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
              🚨 Record Breakage
            </button>
            <button onClick={onClose} style={{ flex:1, padding:'11px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TRANSACTION LOG MODAL ─────────────────────────────────
function TransactionModal({ onClose }) {
  const [txns, setTxns]   = useState([]);
  const [loading, setL]   = useState(true);
  const [fromDate,setFr]  = useState(format(new Date(),'yyyy-MM-dd'));
  const [toDate,  setTo]  = useState(format(new Date(),'yyyy-MM-dd'));

  const load = useCallback(async () => {
    setL(true);
    try {
      const res = await api.get(`/inventory/transactions?from_date=${fromDate}&to_date=${toDate}&limit=100`);
      setTxns(res.data?.transactions||[]);
    } catch(e){} finally{setL(false);}
  },[fromDate,toDate]);

  useEffect(()=>{load();},[load]);

  const TYPE_COLOR = { STOCK_IN:'#16A34A', STOCK_OUT:'#7C3AED', REQUISITION:'#0369A1', TRANSFER:'#EA580C', BREAKAGE:'#DC2626', ADJUSTMENT:'#6B7280', EXPIRY_REMOVAL:'#9333EA' };

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', maxWidth:'900px', width:'100%', maxHeight:'90vh', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.25)', display:'flex', flexDirection:'column' }}>
        <div style={{ background:`linear-gradient(135deg,#6B21A8,#7C3AED)`, padding:'14px 20px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:'900', fontSize:'15px' }}>📜 Inventory Transaction Log</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', fontSize:'20px', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'12px 16px', borderBottom:`1px solid #EDE9FE`, display:'flex', gap:'8px', alignItems:'center' }}>
          <input type="date" value={fromDate} onChange={e=>setFr(e.target.value)} style={{ border:`1.5px solid #EDE9FE`, borderRadius:'8px', padding:'6px 10px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer' }}/>
          <span style={{ color:'#9CA3AF' }}>→</span>
          <input type="date" value={toDate} min={fromDate} onChange={e=>setTo(e.target.value)} style={{ border:`1.5px solid #EDE9FE`, borderRadius:'8px', padding:'6px 10px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer' }}/>
          <button onClick={load} style={{ padding:'6px 14px', background:`linear-gradient(135deg,#6B21A8,#7C3AED)`, color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Search</button>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div>
          : txns.length===0 ? <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF' }}>No transactions for this period</div>
          : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead><tr style={{ background:'#F5F3FF' }}>
                {['Date & Time','Item','Type','Qty','From','To','By','Notes'].map(h=>(
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:'700', color:'#4C1D95', fontSize:'11px', borderBottom:'1px solid #EDE9FE', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {txns.map((t,i)=>(
                  <tr key={t.id} style={{ background:i%2===0?'#FAFAFA':'#fff' }}>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid #EDE9FE', whiteSpace:'nowrap', fontSize:'11px', color:'#6B7280' }}>{t.transaction_date?format(new Date(t.transaction_date),'dd/MM/yy HH:mm'):''}</td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid #EDE9FE', fontWeight:'600', color:'#1F2937' }}>{t.item_name}</td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid #EDE9FE' }}><span style={{ background:`${TYPE_COLOR[t.transaction_type]||'#374151'}18`, color:TYPE_COLOR[t.transaction_type]||'#374151', padding:'2px 8px', borderRadius:'6px', fontSize:'10px', fontWeight:'800', whiteSpace:'nowrap' }}>{t.transaction_type}</span></td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid #EDE9FE', fontWeight:'700' }}>{t.quantity} {t.unit||''}</td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid #EDE9FE', fontSize:'11px' }}>{t.from_location?.replace('_',' ')||'—'}</td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid #EDE9FE', fontSize:'11px' }}>{t.to_location?.replace('_',' ')||'—'}</td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid #EDE9FE', fontSize:'11px' }}>{t.performed_by_name||'—'}</td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid #EDE9FE', fontSize:'11px', color:'#6B7280', maxWidth:'150px' }}>{t.notes||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
