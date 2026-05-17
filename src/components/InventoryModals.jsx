// ============================================================
// FILE: frontend/bul-qc-app/src/components/InventoryModals.jsx
// Contains:
//   - RequisitionModal (select items, reduce store, increase lab)
//   - TransferModal (lab to lab transfer with counter-sign)
//   - UsageModal (record item picked for use from lab)
//   - StockBalanceSheet (filtered print/export)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import api from '../services/api';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';
const RD = '#DC2626';

const inp = {
  border:`1.5px solid ${PL}`, borderRadius:'8px',
  padding:'8px 11px', fontSize:'13px', fontFamily:'inherit',
  background:'#fff', color:'#111827', outline:'none', boxSizing:'border-box',
};
const sel = {
  ...inp, cursor:'pointer', appearance:'none',
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat:'no-repeat', backgroundPosition:'right 9px center', paddingRight:'28px',
};
const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' };
const fld = { marginBottom:'12px' };

// ── Overlay wrapper ──────────────────────────────────────
const Overlay = ({ onClose, children, maxWidth=560 }) => (
  <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.58)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
    <div style={{ background:'#fff', borderRadius:'18px', maxWidth, width:'100%', maxHeight:'92vh', overflow:'hidden', boxShadow:'0 28px 80px rgba(0,0,0,0.35)', display:'flex', flexDirection:'column' }}>
      {children}
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════
// 1. REQUISITION MODAL
// ════════════════════════════════════════════════════════════
export function RequisitionModal({ onClose, onSuccess, showToast }) {
  const { user } = useAuth();
  const [allItems,    setAllItems]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [requestingLab, setReqLab]   = useState('MAIN_LAB');
  const [requesterName, setReqName]  = useState(user?.full_name || '');
  const [notes,       setNotes]       = useState('');
  const [selItems,    setSelItems]    = useState([]); // [{item, quantity}]
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [reqNo,       setReqNo]       = useState('');
  const [searchQ,     setSearchQ]     = useState('');

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('inventory_items')
          .select(`
            id, item_name, item_code, unit_of_measurement,
            inventory_categories(name, code),
            inventory_stock(location, quantity)
          `)
          .eq('is_active', true)
          .order('item_name');
        setAllItems(data || []);
      } finally { setLoading(false); }
    };
    loadItems();
  }, []);

  const storeQty = (item) => {
    const s = (item.inventory_stock||[]).find(x=>x.location==='CHEMICAL_STORE');
    return s?.quantity || 0;
  };

  const addItem = (item) => {
    if (selItems.find(x=>x.item.id===item.id)) return;
    setSelItems(prev=>[...prev,{ item, quantity:'' }]);
  };

  const removeItem = (id) => setSelItems(prev=>prev.filter(x=>x.item.id!==id));

  const updateQty = (id, val) =>
    setSelItems(prev=>prev.map(x=>x.item.id===id?{...x,quantity:val}:x));

  const handleSubmit = async () => {
    if (!requesterName.trim()) { showToast('Enter requester name','error'); return; }
    if (selItems.length === 0) { showToast('Select at least one item','error'); return; }
    for (const si of selItems) {
      if (!si.quantity || parseFloat(si.quantity) <= 0) { showToast(`Enter quantity for ${si.item.item_name}`,'error'); return; }
      if (parseFloat(si.quantity) > storeQty(si.item)) { showToast(`Not enough stock for ${si.item.item_name} (Available: ${storeQty(si.item)})`,'error'); return; }
    }

    setSubmitting(true);
    try {
      // Create requisition
      const res = await api.post('/inventory/requisition', {
        requesting_lab : requestingLab,
        requester_name : requesterName.trim(),
        notes          : notes.trim() || null,
        items          : selItems.map(si=>({
          item_id  : si.item.id,
          item_name: si.item.item_name,
          quantity : parseFloat(si.quantity),
          unit     : si.item.unit_of_measurement,
        })),
      });

      setReqNo(res.data?.requisition?.requisition_no || 'REQ-NEW');

      // Auto-reduce chemical store + increase requesting lab for each item
      for (const si of selItems) {
        // Reduce chemical store
        await api.post('/inventory/stock-update', {
          item_id         : si.item.id,
          location        : 'CHEMICAL_STORE',
          quantity        : parseFloat(si.quantity),
          transaction_type: 'STOCK_OUT',
          to_location     : requestingLab,
          notes           : `Issued to ${requestingLab.replace('_',' ')} via requisition`,
        });
        // Increase requesting lab
        await api.post('/inventory/stock-update', {
          item_id         : si.item.id,
          location        : requestingLab,
          quantity        : parseFloat(si.quantity),
          transaction_type: 'STOCK_IN',
          notes           : `Received from Chemical Store via requisition`,
        });
      }

      setDone(true);
      if (onSuccess) onSuccess();
    } catch(e) {
      showToast('Requisition failed: ' + e.message, 'error');
    } finally { setSubmitting(false); }
  };

  const filtered = allItems.filter(item =>
    !searchQ || item.item_name.toLowerCase().includes(searchQ.toLowerCase()) || (item.item_code||'').toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <Overlay onClose={onClose} maxWidth={760}>
      <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'16px 22px', color:'#fff', flexShrink:0 }}>
        <div style={{ fontWeight:'900', fontSize:'16px' }}>📋 New Requisition — Chemical Store → Lab</div>
        <div style={{ fontSize:'12px', color:'#DDD6FE', marginTop:'2px' }}>Select items and quantities · stock adjusts automatically</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 22px' }}>
        {done ? (
          <div style={{ textAlign:'center', padding:'30px' }}>
            <div style={{ fontSize:'56px', marginBottom:'12px' }}>✅</div>
            <div style={{ fontWeight:'900', color:GR, fontSize:'18px', marginBottom:'6px' }}>Requisition Submitted!</div>
            <div style={{ fontSize:'13px', color:'#6B7280' }}>Requisition No: <strong>{reqNo}</strong></div>
            <div style={{ fontSize:'13px', color:'#6B7280', marginTop:'4px' }}>
              {selItems.length} item(s) issued from Chemical Store to {requestingLab.replace('_',' ')}
            </div>
            <div style={{ marginTop:'12px', background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:'12px', padding:'12px 16px', textAlign:'left' }}>
              {selItems.map(si => (
                <div key={si.item.id} style={{ fontSize:'13px', color:'#15803D', marginBottom:'3px' }}>
                  ✅ {si.item.item_name} — {si.quantity} {si.item.unit_of_measurement||''}
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ marginTop:'16px', padding:'10px 26px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>Close</button>
          </div>
        ) : (
          <>
            {/* Header fields */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
              <div style={fld}>
                <label style={lbl}>Requesting Lab *</label>
                <select value={requestingLab} onChange={e=>setReqLab(e.target.value)} style={{ ...sel, width:'100%' }}>
                  <option value="MAIN_LAB">Main Lab</option>
                  <option value="DET_LAB">Detergent Lab</option>
                </select>
              </div>
              <div style={fld}>
                <label style={lbl}>Requested By *</label>
                <input type="text" value={requesterName} onChange={e=>setReqName(e.target.value)} style={{ ...inp, width:'100%' }} placeholder="Full name of requester"/>
              </div>
              <div style={{ gridColumn:'1/3', ...fld }}>
                <label style={lbl}>Notes / Justification</label>
                <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} style={{ ...inp, width:'100%' }} placeholder="Optional reason for requisition"/>
              </div>
            </div>

            {/* Date & time — auto */}
            <div style={{ background:'#F5F3FF', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', color:P, fontWeight:'600', marginBottom:'14px' }}>
              📅 Date & Time: {format(new Date(),'dd MMMM yyyy · HH:mm:ss')} (auto-captured)
            </div>

            {/* Item search */}
            <div style={{ marginBottom:'10px' }}>
              <label style={lbl}>Search & Add Items from Chemical Store</label>
              <input type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                placeholder="🔍 Type item name or code..."
                style={{ ...inp, width:'100%', marginBottom:'8px' }}/>

              <div style={{ maxHeight:'200px', overflowY:'auto', border:`1.5px solid ${PL}`, borderRadius:'10px', background:'#FAFAFA' }}>
                {loading ? (
                  <div style={{ padding:'20px', textAlign:'center', color:'#9CA3AF', fontSize:'13px' }}>Loading items...</div>
                ) : filtered.length===0 ? (
                  <div style={{ padding:'20px', textAlign:'center', color:'#9CA3AF', fontSize:'13px' }}>No items found</div>
                ) : filtered.map((item,i) => {
                  const sq = storeQty(item);
                  const already = selItems.find(x=>x.item.id===item.id);
                  return (
                    <div key={item.id} onClick={()=>{ if(!already) addItem(item); }}
                      style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'9px 14px',
                        borderBottom: i<filtered.length-1 ? `1px solid ${PL}` : 'none',
                        background: already?'#F5F3FF':'#fff',
                        cursor: already?'default':'pointer',
                        transition:'background 0.12s',
                      }}
                      onMouseEnter={e=>{ if(!already) e.currentTarget.style.background='#F5F3FF'; }}
                      onMouseLeave={e=>{ if(!already) e.currentTarget.style.background=already?'#F5F3FF':'#fff'; }}
                    >
                      <div>
                        <div style={{ fontWeight:'700', fontSize:'13px', color:'#1F2937' }}>{item.item_name}</div>
                        <div style={{ fontSize:'11px', color:'#6B7280' }}>
                          {item.item_code} · {item.inventory_categories?.name}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'12px', fontWeight:'700', color:sq<5?RD:GR }}>{sq} {item.unit_of_measurement||''}</div>
                          <div style={{ fontSize:'10px', color:'#9CA3AF' }}>in store</div>
                        </div>
                        {already ? (
                          <span style={{ fontSize:'11px', color:PM, fontWeight:'700' }}>Added ✓</span>
                        ) : (
                          <span style={{ fontSize:'11px', background:PL, color:P, padding:'3px 8px', borderRadius:'6px', fontWeight:'700' }}>+ Add</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected items with quantities */}
            {selItems.length > 0 && (
              <div style={{ marginTop:'14px' }}>
                <div style={{ fontSize:'12px', fontWeight:'800', color:P, marginBottom:'8px' }}>
                  Selected Items ({selItems.length})
                </div>
                <div style={{ border:`1.5px solid ${PL}`, borderRadius:'10px', overflow:'hidden' }}>
                  {selItems.map((si,i) => {
                    const sq = storeQty(si.item);
                    const over = si.quantity && parseFloat(si.quantity) > sq;
                    return (
                      <div key={si.item.id} style={{
                        display:'grid', gridTemplateColumns:'1fr 160px 60px 32px',
                        gap:'8px', alignItems:'center',
                        padding:'10px 14px',
                        borderBottom: i<selItems.length-1 ? `1px solid ${PL}` : 'none',
                        background: over?'#FEF2F2':i%2===0?'#FAFAFA':'#fff',
                      }}>
                        <div>
                          <div style={{ fontWeight:'700', fontSize:'12px', color:'#1F2937' }}>{si.item.item_name}</div>
                          <div style={{ fontSize:'10px', color:'#9CA3AF' }}>Available in store: {sq} {si.item.unit_of_measurement||''}</div>
                          {over && <div style={{ fontSize:'10px', color:RD, fontWeight:'700' }}>⚠️ Exceeds available stock</div>}
                        </div>
                        <div>
                          <input type="number" value={si.quantity}
                            onChange={e=>updateQty(si.item.id, e.target.value)}
                            min="0" max={sq}
                            placeholder="Qty"
                            style={{ ...inp, width:'100%', borderColor:over?RD:PL }}/>
                          <div style={{ fontSize:'10px', color:'#9CA3AF', marginTop:'2px' }}>{si.item.unit_of_measurement||''}</div>
                        </div>
                        <div style={{ fontSize:'11px', color:'#6B7280', textAlign:'center', fontWeight:'600' }}>
                          {si.item.unit_of_measurement||'—'}
                        </div>
                        <button onClick={()=>removeItem(si.item.id)}
                          style={{ width:'28px', height:'28px', background:'#FEF2F2', color:RD, border:'1px solid #FECACA', borderRadius:'6px', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!done && (
        <div style={{ padding:'14px 22px', borderTop:`1.5px solid ${PL}`, background:'#F9FAFB', display:'flex', gap:'10px', flexShrink:0 }}>
          <button onClick={handleSubmit} disabled={submitting||selItems.length===0}
            style={{ flex:1, padding:'12px', background:selItems.length===0?'#A78BFA':`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:selItems.length===0?'not-allowed':'pointer', fontFamily:'inherit' }}>
            {submitting ? 'Submitting...' : `✅ Submit Requisition (${selItems.length} item${selItems.length!==1?'s':''})`}
          </button>
          <button onClick={onClose} style={{ padding:'12px 20px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        </div>
      )}
    </Overlay>
  );
}


// ════════════════════════════════════════════════════════════
// 2. TRANSFER MODAL (lab ↔ lab)
// ════════════════════════════════════════════════════════════
export function TransferModal({ onClose, onSuccess, showToast }) {
  const { user } = useAuth();
  const [allItems,    setAllItems]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fromLab,     setFromLab]     = useState('MAIN_LAB');
  const [toLab,       setToLab]       = useState('DET_LAB');
  const [selItem,     setSelItem]     = useState('');
  const [quantity,    setQuantity]    = useState('');
  const [clerkName,   setClerkName]   = useState(user?.full_name || '');
  const [counterSign, setCounterSign] = useState('');
  const [notes,       setNotes]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, item_name, item_code, unit_of_measurement, inventory_stock(location, quantity)')
        .eq('is_active', true)
        .order('item_name');
      setAllItems(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const fromQty = () => {
    if (!selItem) return 0;
    const item = allItems.find(i=>i.id===selItem);
    const s = (item?.inventory_stock||[]).find(x=>x.location===fromLab);
    return s?.quantity || 0;
  };

  const handleTransfer = async () => {
    if (!selItem)           { showToast('Select an item','error'); return; }
    if (!quantity || parseFloat(quantity)<=0) { showToast('Enter a valid quantity','error'); return; }
    if (parseFloat(quantity) > fromQty()) { showToast(`Only ${fromQty()} available in ${fromLab.replace('_',' ')}`,'error'); return; }
    if (!clerkName.trim())  { showToast('Enter your name (transferring clerk)','error'); return; }
    if (!counterSign.trim()){ showToast('Counter-sign is required','error'); return; }
    if (fromLab === toLab)  { showToast('From and To labs must be different','error'); return; }

    setSubmitting(true);
    try {
      const item = allItems.find(i=>i.id===selItem);

      // Reduce from-lab
      await api.post('/inventory/stock-update', {
        item_id         : selItem,
        location        : fromLab,
        quantity        : parseFloat(quantity),
        transaction_type: 'TRANSFER',
        to_location     : toLab,
        notes           : `Transfer to ${toLab.replace('_',' ')} by ${clerkName} · Counter-signed: ${counterSign}`,
      });

      // Increase to-lab
      await api.post('/inventory/stock-update', {
        item_id         : selItem,
        location        : toLab,
        quantity        : parseFloat(quantity),
        transaction_type: 'STOCK_IN',
        notes           : `Transfer received from ${fromLab.replace('_',' ')} by ${clerkName}`,
      });

      setDone(true);
      if (onSuccess) onSuccess();
    } catch(e) {
      showToast('Transfer failed: ' + e.message,'error');
    } finally { setSubmitting(false); }
  };

  const item = allItems.find(i=>i.id===selItem);

  return (
    <Overlay onClose={onClose} maxWidth={500}>
      <div style={{ background:`linear-gradient(135deg,#EA580C,#C2410C)`, padding:'16px 22px', color:'#fff', flexShrink:0 }}>
        <div style={{ fontWeight:'900', fontSize:'16px' }}>🔄 Stock Transfer Between Labs</div>
        <div style={{ fontSize:'12px', color:'#FED7AA', marginTop:'2px' }}>Counter-signature required · Adjusts both lab stocks automatically</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 22px' }}>
        {done ? (
          <div style={{ textAlign:'center', padding:'30px' }}>
            <div style={{ fontSize:'56px', marginBottom:'12px' }}>✅</div>
            <div style={{ fontWeight:'900', color:GR, fontSize:'18px', marginBottom:'6px' }}>Transfer Completed</div>
            <div style={{ fontSize:'13px', color:'#6B7280' }}>
              {quantity} {item?.unit_of_measurement||''} of <strong>{item?.item_name}</strong><br/>
              transferred from <strong>{fromLab.replace('_',' ')}</strong> to <strong>{toLab.replace('_',' ')}</strong>
            </div>
            <button onClick={onClose} style={{ marginTop:'16px', padding:'10px 26px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>Close</button>
          </div>
        ) : (
          <>
            {/* From / To */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'8px', alignItems:'center', marginBottom:'14px' }}>
              <div style={fld}>
                <label style={lbl}>From Lab *</label>
                <select value={fromLab} onChange={e=>{ setFromLab(e.target.value); setToLab(e.target.value==='MAIN_LAB'?'DET_LAB':'MAIN_LAB'); }} style={{ ...sel, width:'100%' }}>
                  <option value="MAIN_LAB">Main Lab</option>
                  <option value="DET_LAB">Detergent Lab</option>
                </select>
              </div>
              <div style={{ textAlign:'center', fontSize:'22px', fontWeight:'800', color:'#EA580C', paddingTop:'14px' }}>→</div>
              <div style={fld}>
                <label style={lbl}>To Lab *</label>
                <select value={toLab} onChange={e=>setToLab(e.target.value)} style={{ ...sel, width:'100%' }}>
                  <option value="MAIN_LAB">Main Lab</option>
                  <option value="DET_LAB">Detergent Lab</option>
                </select>
              </div>
            </div>

            {/* Item selector */}
            <div style={fld}>
              <label style={lbl}>Select Item *</label>
              <select value={selItem} onChange={e=>setSelItem(e.target.value)} style={{ ...sel, width:'100%' }}>
                <option value="">— Choose item —</option>
                {allItems.map(i=>(
                  <option key={i.id} value={i.id}>{i.item_name} ({i.item_code||'—'})</option>
                ))}
              </select>
              {selItem && (
                <div style={{ marginTop:'6px', fontSize:'12px', color: fromQty()<1?RD:GR, fontWeight:'700' }}>
                  Available in {fromLab.replace('_',' ')}: {fromQty()} {item?.unit_of_measurement||''}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div style={fld}>
              <label style={lbl}>Quantity to Transfer *</label>
              <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)}
                min="0" max={fromQty()} placeholder="Enter quantity"
                style={{ ...inp, width:'100%', borderColor: quantity&&parseFloat(quantity)>fromQty()?RD:PL }}/>
              {quantity && parseFloat(quantity)>fromQty() && (
                <div style={{ fontSize:'11px', color:RD, marginTop:'3px', fontWeight:'700' }}>⚠️ Exceeds available stock</div>
              )}
            </div>

            {/* Date / time auto */}
            <div style={{ background:'#FFF7ED', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', color:'#92400E', fontWeight:'600', marginBottom:'14px' }}>
              📅 {format(new Date(),'dd MMMM yyyy · HH:mm:ss')}
            </div>

            {/* Clerk names */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <div style={fld}>
                <label style={lbl}>Transferring Clerk Name *</label>
                <input type="text" value={clerkName} onChange={e=>setClerkName(e.target.value)} style={{ ...inp, width:'100%' }} placeholder="Your full name"/>
              </div>
              <div style={fld}>
                <label style={lbl}>Counter-Sign (Receiving Clerk) *</label>
                <input type="text" value={counterSign} onChange={e=>setCounterSign(e.target.value)} style={{ ...inp, width:'100%' }} placeholder="Receiving clerk's name"/>
              </div>
            </div>

            <div style={fld}>
              <label style={lbl}>Notes</label>
              <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} style={{ ...inp, width:'100%' }} placeholder="Optional notes..."/>
            </div>
          </>
        )}
      </div>

      {!done && (
        <div style={{ padding:'14px 22px', borderTop:`1.5px solid ${PL}`, background:'#F9FAFB', display:'flex', gap:'10px', flexShrink:0 }}>
          <button onClick={handleTransfer} disabled={submitting}
            style={{ flex:1, padding:'12px', background:`linear-gradient(135deg,#EA580C,#C2410C)`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
            {submitting ? 'Processing...' : '🔄 Confirm Transfer'}
          </button>
          <button onClick={onClose} style={{ padding:'12px 20px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        </div>
      )}
    </Overlay>
  );
}


// ════════════════════════════════════════════════════════════
// 3. STOCK USAGE MODAL (item picked for use in lab)
// ════════════════════════════════════════════════════════════
export function UsageModal({ onClose, onSuccess, showToast }) {
  const { user } = useAuth();
  const [allItems,   setAllItems]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [lab,        setLab]        = useState('MAIN_LAB');
  const [selItem,    setSelItem]    = useState('');
  const [quantity,   setQuantity]   = useState('');
  const [staffName,  setStaffName]  = useState(user?.full_name || '');
  const [purpose,    setPurpose]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);

  useEffect(()=>{
    const load=async()=>{
      const{data}=await supabase
        .from('inventory_items')
        .select('id, item_name, item_code, unit_of_measurement, inventory_stock(location, quantity)')
        .eq('is_active',true).order('item_name');
      setAllItems(data||[]);
      setLoading(false);
    };
    load();
  },[]);

  const labQty=()=>{
    if(!selItem) return 0;
    const item=allItems.find(i=>i.id===selItem);
    const s=(item?.inventory_stock||[]).find(x=>x.location===lab);
    return s?.quantity||0;
  };

  const handleUsage=async()=>{
    if(!selItem)          { showToast('Select an item','error'); return; }
    if(!quantity||parseFloat(quantity)<=0){ showToast('Enter quantity used','error'); return; }
    if(parseFloat(quantity)>labQty()){ showToast(`Only ${labQty()} available in this lab`,'error'); return; }
    if(!staffName.trim()) { showToast('Enter your name','error'); return; }

    setSubmitting(true);
    try{
      await api.post('/inventory/stock-update',{
        item_id         : selItem,
        location        : lab,
        quantity        : parseFloat(quantity),
        transaction_type: 'STOCK_OUT',
        notes           : `Used by ${staffName.trim()} for: ${purpose||'Lab analysis'}`,
      });
      setDone(true);
      if(onSuccess) onSuccess();
    }catch(e){
      showToast('Failed to record usage: '+e.message,'error');
    }finally{setSubmitting(false);}
  };

  const item=allItems.find(i=>i.id===selItem);

  return(
    <Overlay onClose={onClose} maxWidth={460}>
      <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'16px 22px', color:'#fff', flexShrink:0 }}>
        <div style={{ fontWeight:'900', fontSize:'16px' }}>🔬 Record Lab Stock Usage</div>
        <div style={{ fontSize:'12px', color:'#DDD6FE', marginTop:'2px' }}>Record items removed from lab for analysis or use</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 22px' }}>
        {done?(
          <div style={{ textAlign:'center', padding:'30px' }}>
            <div style={{ fontSize:'56px', marginBottom:'12px' }}>✅</div>
            <div style={{ fontWeight:'900', color:GR, fontSize:'18px', marginBottom:'6px' }}>Usage Recorded</div>
            <div style={{ fontSize:'13px', color:'#6B7280' }}>
              {quantity} {item?.unit_of_measurement||''} of <strong>{item?.item_name}</strong><br/>
              removed from <strong>{lab.replace('_',' ')}</strong> by <strong>{staffName}</strong>
            </div>
            <button onClick={onClose} style={{ marginTop:'16px', padding:'10px 26px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>Close</button>
          </div>
        ):(
          <>
            <div style={fld}>
              <label style={lbl}>Lab Section *</label>
              <select value={lab} onChange={e=>setLab(e.target.value)} style={{ ...sel, width:'100%' }}>
                <option value="MAIN_LAB">Main Lab</option>
                <option value="DET_LAB">Detergent Lab</option>
              </select>
            </div>

            <div style={fld}>
              <label style={lbl}>Item Used *</label>
              <select value={selItem} onChange={e=>setSelItem(e.target.value)} style={{ ...sel, width:'100%' }}>
                <option value="">— Choose item —</option>
                {allItems.map(i=>(
                  <option key={i.id} value={i.id}>{i.item_name}</option>
                ))}
              </select>
              {selItem&&(
                <div style={{ marginTop:'5px', fontSize:'12px', fontWeight:'700', color:labQty()<1?RD:GR }}>
                  Available in {lab.replace('_',' ')}: {labQty()} {item?.unit_of_measurement||''}
                </div>
              )}
            </div>

            <div style={fld}>
              <label style={lbl}>Quantity Used *</label>
              <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)}
                min="0" max={labQty()} placeholder="How much was used?"
                style={{ ...inp, width:'100%', borderColor:quantity&&parseFloat(quantity)>labQty()?RD:PL }}/>
            </div>

            <div style={fld}>
              <label style={lbl}>Staff Name (who picked it) *</label>
              <input type="text" value={staffName} onChange={e=>setStaffName(e.target.value)} style={{ ...inp, width:'100%' }} placeholder="Your full name"/>
            </div>

            <div style={fld}>
              <label style={lbl}>Purpose / Test Name</label>
              <input type="text" value={purpose} onChange={e=>setPurpose(e.target.value)} style={{ ...inp, width:'100%' }} placeholder="e.g. FFA determination, Moisture test..."/>
            </div>

            <div style={{ background:'#F5F3FF', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', color:P, fontWeight:'600' }}>
              📅 {format(new Date(),'dd MMMM yyyy · HH:mm:ss')}
            </div>
          </>
        )}
      </div>

      {!done&&(
        <div style={{ padding:'14px 22px', borderTop:`1.5px solid ${PL}`, background:'#F9FAFB', display:'flex', gap:'10px', flexShrink:0 }}>
          <button onClick={handleUsage} disabled={submitting}
            style={{ flex:1, padding:'12px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
            {submitting?'Recording...':'✅ Record Usage'}
          </button>
          <button onClick={onClose} style={{ padding:'12px 20px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        </div>
      )}
    </Overlay>
  );
}


// ════════════════════════════════════════════════════════════
// 4. STOCK BALANCE SHEET (date range filter + export)
// ════════════════════════════════════════════════════════════
export function StockBalanceSheet({ onClose }) {
  const [fromDate, setFr]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [toDate,   setTo]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [cat,      setCat]  = useState('ALL');
  const [loc,      setLoc]  = useState('ALL');
  const [items,    setItems]= useState([]);
  const [loading,  setL]    = useState(false);

  const CATS=[{code:'ALL',name:'All Categories'},{code:'SOLID_CHEM',name:'Solid Chemicals'},{code:'LIQUID_CHEM',name:'Liquid Chemicals'},{code:'INDICATORS',name:'Indicators'},{code:'PH_BUFFER',name:'pH Buffer Capsules'},{code:'GLASSWARE',name:'Glassware'},{code:'UTILITIES',name:'Utilities'},{code:'LOGBOOKS',name:'Logbooks'}];
  const LOCS=[{code:'ALL',name:'All Locations'},{code:'CHEMICAL_STORE',name:'Chemical Store'},{code:'MAIN_LAB',name:'Main Lab'},{code:'DET_LAB',name:'Detergent Lab'}];

  const load=useCallback(async()=>{
    setL(true);
    try{
      let q=supabase.from('inventory_items').select(`
        id, item_name, item_code, unit_of_measurement,
        country_of_origin, reorder_level, expiry_date,
        inventory_categories(name,code),
        inventory_stock(location, quantity, in_stock, in_use, last_updated)
      `).eq('is_active',true).order('item_name');
      const{data}=await q;
      let filtered=data||[];
      if(cat!=='ALL') filtered=filtered.filter(i=>i.inventory_categories?.code===cat);
      setItems(filtered);
    }finally{setL(false);}
  },[cat]);

  useEffect(()=>{load();},[load]);

  const getStock=(item,location)=>{
    const s=(item.inventory_stock||[]).find(x=>x.location===location);
    return s||{quantity:0,in_stock:0,in_use:0};
  };

  const exportExcel=()=>{
    const rows=items.map(item=>{
      const cs=getStock(item,'CHEMICAL_STORE');
      const ml=getStock(item,'MAIN_LAB');
      const dl=getStock(item,'DET_LAB');
      return{
        'Item Name':item.item_name,'Code':item.item_code||'',
        'Category':item.inventory_categories?.name||'',
        'Unit':item.unit_of_measurement||'','Origin':item.country_of_origin||'',
        'Expiry':item.expiry_date||'','Reorder Level':item.reorder_level,
        'Chemical Store':cs.quantity,'Main Lab':ml.quantity,'Detergent Lab':dl.quantity,
        'ML In-Use':ml.in_use,'ML In-Stock':ml.in_stock,
        'DL In-Use':dl.in_use,'DL In-Stock':dl.in_stock,
        'Grand Total':cs.quantity+ml.quantity+dl.quantity,
      };
    });
    const ws=XLSX.utils.json_to_sheet(rows);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Stock Balance');
    XLSX.writeFile(wb,`BUL_QC_StockBalance_${fromDate}_to_${toDate}.xlsx`);
  };

  const handlePrint=()=>{
    window.print();
  };

  return(
    <Overlay onClose={onClose} maxWidth={900}>
      <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'16px 22px', color:'#fff', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontWeight:'900', fontSize:'16px' }}>📊 Stock Balance Sheet</div>
          <div style={{ fontSize:'12px', color:'#DDD6FE', marginTop:'2px' }}>Filter by date range, category or location then export or print</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', fontSize:'22px', cursor:'pointer' }}>✕</button>
      </div>

      {/* Filter bar */}
      <div style={{ padding:'12px 18px', borderBottom:`1px solid ${PL}`, background:'#F5F3FF', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
          <span style={{ fontSize:'11px', fontWeight:'700', color:P }}>From:</span>
          <input type="date" value={fromDate} onChange={e=>setFr(e.target.value)} style={{ ...inp, fontSize:'12px', cursor:'pointer' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
          <span style={{ fontSize:'11px', fontWeight:'700', color:P }}>To:</span>
          <input type="date" value={toDate} min={fromDate} onChange={e=>setTo(e.target.value)} style={{ ...inp, fontSize:'12px', cursor:'pointer' }}/>
        </div>
        <select value={cat} onChange={e=>setCat(e.target.value)} style={{ ...sel, fontSize:'12px', minWidth:'160px' }}>
          {CATS.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select value={loc} onChange={e=>setLoc(e.target.value)} style={{ ...sel, fontSize:'12px', minWidth:'140px' }}>
          {LOCS.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <button onClick={load} style={{ padding:'7px 14px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>Apply Filter</button>
        <button onClick={exportExcel} disabled={items.length===0} style={{ padding:'7px 14px', background:'linear-gradient(135deg,#16A34A,#15803D)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>📊 Excel</button>
        <button onClick={handlePrint} style={{ padding:'7px 14px', background:'#fff', color:P, border:`1.5px solid ${PL}`, borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>🖨 Print</button>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {loading?(
          <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div>
        ):(
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead>
              <tr>
                {['Item Name','Code','Category','Unit','Origin','Expiry','Reorder','Chem Store','Main Lab','Det Lab','ML In-Use','ML In-Stock','DL In-Use','DL In-Stock','Total'].map(h=>(
                  <th key={h} style={{ position:'sticky', top:0, background:`linear-gradient(180deg,${P},#5B1894)`, color:['Chem Store','Reorder'].includes(h)?G:'#fff', padding:'8px 10px', textAlign:'left', fontSize:'10px', fontWeight:'800', whiteSpace:'nowrap', borderBottom:'2px solid rgba(255,255,255,0.2)', borderRight:'1px solid rgba(255,255,255,0.12)', zIndex:10 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.filter(item=>{
                if(loc==='ALL') return true;
                const s=getStock(item,loc);
                return s.quantity>0;
              }).map((item,i)=>{
                const even=i%2===0;
                const bg=even?'#FAFAFA':'#fff';
                const cs=getStock(item,'CHEMICAL_STORE');
                const ml=getStock(item,'MAIN_LAB');
                const dl=getStock(item,'DET_LAB');
                const total=cs.quantity+ml.quantity+dl.quantity;
                const low=cs.quantity<=item.reorder_level;
                const td=(v,opts={})=>(
                  <td style={{ padding:'8px 10px', borderBottom:'1px solid #EDE9FE', background:bg, fontSize:'12px', whiteSpace:'nowrap', ...opts }}>
                    {v}
                  </td>
                );
                return(
                  <tr key={item.id} style={{ outline:low?'1.5px solid #FECACA':'none', outlineOffset:'-1px' }}>
                    {td(<span style={{ fontWeight:'700', color:'#1F2937' }}>{item.item_name}{low&&<span style={{ marginLeft:'5px', fontSize:'10px', color:RD }}>⚠️</span>}</span>)}
                    {td(<span style={{ fontFamily:'monospace', color:PM, fontWeight:'700', fontSize:'11px' }}>{item.item_code||'—'}</span>)}
                    {td(item.inventory_categories?.name||'—')}
                    {td(item.unit_of_measurement||'—')}
                    {td(item.country_of_origin||'—')}
                    {td(<span style={{ color:item.expiry_date&&new Date(item.expiry_date)<new Date()?RD:'#374151', fontWeight:item.expiry_date&&new Date(item.expiry_date)<new Date()?'700':'400' }}>{item.expiry_date||'—'}</span>)}
                    {td(<span style={{ fontWeight:'700', color:low?RD:'#374151' }}>{item.reorder_level}</span>)}
                    {td(<span style={{ fontWeight:'900', color:low?RD:cs.quantity===0?'#9CA3AF':'#1F2937', fontSize:'14px' }}>{cs.quantity}</span>)}
                    {td(<span style={{ fontWeight:'700', color:ml.quantity===0?'#9CA3AF':'#1F2937' }}>{ml.quantity}</span>)}
                    {td(<span style={{ fontWeight:'700', color:dl.quantity===0?'#9CA3AF':'#1F2937' }}>{dl.quantity}</span>)}
                    {td(ml.in_use||0,{ color:'#EA580C', fontWeight:'700' })}
                    {td(ml.in_stock||0,{ color:GR, fontWeight:'700' })}
                    {td(dl.in_use||0,{ color:'#EA580C', fontWeight:'700' })}
                    {td(dl.in_stock||0,{ color:GR, fontWeight:'700' })}
                    {td(<span style={{ fontWeight:'900', color:total===0?'#9CA3AF':P, fontSize:'14px' }}>{total}</span>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ padding:'8px 18px', background:'#F5F3FF', borderTop:`1px solid ${PL}`, fontSize:'11px', color:'#9CA3AF', flexShrink:0 }}>
        {items.length} item(s) · ⚠️ = below reorder level (Chemical Store)
      </div>
    </Overlay>
  );
}
