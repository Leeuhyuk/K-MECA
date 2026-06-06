/* ════════ 실시간 자동 동기화 (Firestore onSnapshot) ════════ */
/* localStorage(클라우드에서 갱신됨)의 값을 메모리 전역 변수로 다시 반영 */
function cloudResyncGlobals(){
  const L=(k,cur)=>loadStorage(k,cur);
  clients=L('clients',clients); products=L('products',products); materials=L('materials',materials);
  workOrders=L('workOrders',workOrders); workers=L('workers',workers); defects=L('defects',defects);
  claims=L('claims',claims); checkRecords=L('checkRecords',checkRecords); inventory=L('inventory',inventory);
  deliveries=L('deliveries',deliveries); trash=L('trash',trash); rfqList=L('rfqList',rfqList);
  poList=L('poList',poList); partners=L('partners',partners); statementList=L('statementList',statementList);
  taxList=L('taxList',taxList); quoteList=L('quoteList',quoteList); orderList=L('orderList',orderList);
  financeData=L('financeData',financeData); attendance=L('attendance',attendance); leaves=L('leaves',leaves);
  asList=L('asList',asList); bomList=L('bomList',bomList);
}
/* 다른 사용자의 변경을 실시간 수신 → localStorage 갱신 → 전역 반영 → 현재 화면 새로고침 */
function cloudSubscribe(){
  if (!_cloudActive || _cloudUnsub || !_fbDb) return;
  _cloudUnsub = _fbDb.collection('mes_state').onSnapshot(snap=>{
    let remote=false;
    snap.docChanges().forEach(ch=>{
      if (ch.type==='removed') return;
      if (ch.doc.metadata.hasPendingWrites) return;     // 내가 쓴 변경(로컬 에코)은 무시
      const d=ch.doc.data(); if(!d || d.value===undefined) return;
      localStorage.setItem('mes_'+ch.doc.id, JSON.stringify(d.value));
      remote=true;
    });
    if (!remote) return;
    cloudResyncGlobals();
    // 입력 중 모달이 열려 있으면 화면 새로고침은 보류(데이터만 갱신)
    if (!document.querySelector('.overlay.open')) {
      try { refreshPage(currentPage); } catch(e){}
    }
    try { updateDlvBadge(); updateAsBadge(); updateTrashBadge(); } catch(e){}
    _cloudChip('synced'); setTimeout(()=>_cloudChip('online'), 1500);
  }, err=>{ console.warn('실시간 동기화 구독 오류', err); });

  // 권한 설정(roles: 페이지/컬럼/버튼) 실시간 반영 — 관리자가 바꾸면 모든 기기에 즉시 적용
  _fbDb.collection('roles').onSnapshot(snap=>{
    let changed=false;
    snap.docChanges().forEach(ch=>{
      if (ch.type==='removed') return;
      const id=ch.doc.id, d=ch.doc.data();
      if (id==='config'){ saveStorageLocalOnly('rolePages', d); changed=true; }
      else if (id==='columns'){ saveStorageLocalOnly('roleColumns', d); changed=true; }
      else if (id==='features'){ saveStorageLocalOnly('roleFeatures', d); changed=true; }
    });
    if (!changed) return;
    allowedPages = roleAllowedSet(currentRole);   // 페이지 권한 재계산 후 재적용
    applyRoleGating(); applyColumnGating(); applyFeatureGating();
    if (currentPage==='permissions' && !document.querySelector('.overlay.open')) { try{ renderPermissions(); }catch(e){} }
    _cloudChip('synced'); setTimeout(()=>_cloudChip('online'), 1500);
  }, err=>{ console.warn('권한 실시간 동기화 오류', err); });

  // 로그인 계정 목록(users) 실시간 캐시 — 인사 명부와 조인
  _fbDb.collection('users').onSnapshot(snap=>{
    cloudUsers = snap.docs.map(d=>Object.assign({uid:d.id}, d.data()));
    saveStorageLocalOnly('cloudUsers_cache', cloudUsers);
    if (!document.querySelector('.overlay.open')){
      if (currentPage==='workers') { try{ renderWorkers(); }catch(e){} }
      if (currentPage==='permissions') { try{ renderPermissions(); }catch(e){} }
    }
  }, err=>{ console.warn('계정 목록 동기화 오류', err); });
}

function cloudLogin(){
  const email=(inp('cl-email').value||'').trim(), pw=inp('cl-pw').value||'';
  if(!email||!pw){ _cloudMsg('이메일과 비밀번호를 입력하세요.'); return; }
  _cloudMsg('로그인 중…','#8a93ad');
  _fbAuth.signInWithEmailAndPassword(email,pw).catch(e=>_cloudMsg(_cloudErr(e)));
}
function cloudSignup(){
  const name=(inp('cl-name').value||'').trim(), email=(inp('cl-email').value||'').trim(), pw=inp('cl-pw').value||'';
  if(!name){ _cloudMsg('이름을 입력하세요.'); return; }
  if(!email||pw.length<6){ _cloudMsg('이메일과 6자 이상 비밀번호를 입력하세요.'); return; }
  _cloudMsg('계정 생성 중…','#8a93ad');
  sessionStorage.setItem('mes_signupName', name);   // 계정 문서 생성 시 사용
  _fbAuth.createUserWithEmailAndPassword(email,pw)
    .then(cred=>{ if(cred.user) return cred.user.updateProfile({ displayName:name }); })
    .catch(e=>{ sessionStorage.removeItem('mes_signupName'); _cloudMsg(_cloudErr(e)); });
}
function cloudLogout(){
  if(!_fbAuth) return;
  if(!confirm('로그아웃 하시겠습니까?')) return;
  sessionStorage.removeItem('mes_cloud_synced');
  _fbAuth.signOut().then(()=>location.reload());
}
function _cloudErr(e){
  const m={'auth/invalid-credential':'이메일 또는 비밀번호가 올바르지 않습니다.','auth/user-not-found':'등록되지 않은 계정입니다.','auth/wrong-password':'비밀번호가 올바르지 않습니다.','auth/email-already-in-use':'이미 가입된 이메일입니다.','auth/invalid-email':'이메일 형식이 올바르지 않습니다.','auth/weak-password':'비밀번호는 6자 이상이어야 합니다.'};
  return m[e.code]||('오류: '+(e.message||e.code));
}
function _showLogin(){ const el=inp('cloud-login'); if(el) el.style.display='flex'; const c=inp('cloud-chip'); if(c) c.style.display='none'; }
function _hideLogin(){ const el=inp('cloud-login'); if(el) el.style.display='none'; }
function _cloudMsg(t,color){ const el=inp('cl-msg'); if(el){ el.textContent=t||''; el.style.color=color||'#ff8787'; } }
function _cloudChip(state){
  const chip=inp('cloud-chip'), ic=inp('cloud-chip-icon'), tx=inp('cloud-chip-txt');
  if(!chip) return;
  if(state==='local'){ chip.style.display='none'; return; }
  chip.style.display='flex';
  const map={ online:['ti-cloud-check','#37b24d',(_cloudUser&&_cloudUser.email?_cloudUser.email:'클라우드 연결됨')],
              saving:['ti-cloud-up','#f59f00','동기화 중…'], synced:['ti-cloud-download','#4dabf7','업데이트 반영됨'], error:['ti-cloud-x','#fa5252','동기화 오류'] };
  const [icon,col,txt]=map[state]||map.online;
  if(ic){ ic.className='ti '+icon; ic.style.color=col; } if(tx) tx.textContent=txt;
}

/* ════════ 권한 관리 화면 ════════ */
async function renderPermissions(){
  const body=inp('perm-body'); if(!body) return;
  if (!_cloudActive){ body.innerHTML=`<div class="card"><div class="empty"><i class="ti ti-cloud-off"></i>클라우드 로그인 후 사용할 수 있는 기능입니다. (Firebase 미설정 시 로컬 전용)</div></div>`; return; }
  if (currentRole!=='admin'){ body.innerHTML=`<div class="card"><div class="empty"><i class="ti ti-lock"></i>권한 관리는 관리자만 접근할 수 있습니다.</div></div>`; return; }
  body.innerHTML = `
    <div class="card" style="margin-bottom:16px;background:var(--bg-s);"><div style="display:flex;align-items:center;gap:10px;padding:4px 2px;">
      <i class="ti ti-users" style="font-size:20px;color:var(--tx-i);"></i>
      <div style="flex:1;"><div style="font-weight:700;">직원 계정·역할·승인은 「인사 관리」에서 관리합니다</div>
        <div style="font-size:11.5px;color:var(--tx-s);margin-top:2px;">직원 명부에서 이메일로 로그인 계정을 연결해 역할 지정·승인을 함께 처리하세요.</div></div>
      <button class="btn btn-sm btn-primary" onclick="go('workers')"><i class="ti ti-external-link"></i>인사 관리로 이동</button>
    </div></div>
    <div class="card" style="margin-bottom:16px;"><div class="card-hd"><span class="card-ttl"><i class="ti ti-table-options"></i>역할별 접근 페이지</span>
      <span style="font-size:11px;color:var(--tx-t);">관리자는 항상 전체 · 변경 즉시 저장</span></div>
      <div id="perm-matrix"></div></div>
    <div class="card" style="margin-bottom:16px;"><div class="card-hd"><span class="card-ttl"><i class="ti ti-columns-3"></i>역할별 표시 컬럼 (열 권한)</span>
      <span style="font-size:11px;color:var(--tx-t);">체크 해제 시 해당 역할에게 그 열이 숨겨짐 · 관리자는 항상 전체</span></div>
      <div id="perm-columns"></div></div>
    <div class="card" style="margin-bottom:16px;"><div class="card-hd"><span class="card-ttl"><i class="ti ti-tool"></i>역할별 기능 권한 (내보내기 · 출력)</span>
      <span style="font-size:11px;color:var(--tx-t);">엑셀 CSV 내보내기 / PDF·인쇄 출력 허용 여부 · 관리자는 항상 전체</span></div>
      <div id="perm-features"></div></div>
    <div class="card"><div class="card-hd"><span class="card-ttl"><i class="ti ti-database-cog"></i>데이터 백업 · 복구</span>
      <span style="font-size:11px;color:var(--tx-t);">전체 데이터를 파일로 내보내거나 파일에서 복구 · 관리자 전용</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 2px;">
        <button class="btn btn-sm" onclick="exportAllXLS()"><i class="ti ti-file-spreadsheet"></i>엑셀(XLS) 내보내기</button>
        <button class="btn btn-sm" onclick="inp('xls-import-input').click()"><i class="ti ti-upload"></i>엑셀(XLS) 불러오기</button>
        <button class="btn btn-sm" onclick="exportDataJSON()"><i class="ti ti-file-code-2"></i>JSON 내보내기</button>
        <button class="btn btn-sm" onclick="inp('json-import-input').click()"><i class="ti ti-database-import"></i>JSON 불러오기</button>
        <input type="file" id="xls-import-input" accept=".xlsx,.xls" style="display:none;" onchange="importAllXLS(this)">
        <input type="file" id="json-import-input" accept=".json,application/json" style="display:none;" onchange="importDataJSON(this)">
      </div></div>`;
  renderPermMatrix();
  renderPermColumns();
  renderPermFeatures();
}
function renderPermUsers(users){
  const el=inp('perm-users'); if(!el) return;
  const rows = users.length ? users.map(u=>{
    const isOwner = BOOTSTRAP_ADMIN_EMAILS.includes((u.email||'').toLowerCase());
    const act = u.active!==false;
    return `<tr>
      <td style="font-weight:700;">${u.name?u.name+' ':''}<span style="font-weight:400;color:var(--tx-t);font-size:11px;">${u.email||u.uid}</span>${isOwner?' <span class="bd bd-info" style="font-size:9px;">소유자</span>':''}</td>
      <td><select onchange="permSetRole('${u.uid}',this.value)" ${isOwner?'disabled':''}>
        ${['admin','manager','staff'].map(r=>`<option value="${r}"${(u.role||'staff')===r?' selected':''}>${ROLE_LABEL[r]}</option>`).join('')}</select></td>
      <td style="text-align:center;"><span class="bd ${act?'bd-ok':'bd-err'}">${act?'활성':'대기/비활성'}</span></td>
      <td style="text-align:center;">${isOwner?'—':`<button class="btn btn-sm" onclick="permToggleActive('${u.uid}',${act})">${act?'비활성화':'승인'}</button>`}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="4">${empty('등록된 사용자가 없습니다.')}</td></tr>`;
  el.innerHTML = `<div style="overflow-x:auto;"><table><thead><tr><th>이메일</th><th>역할</th><th style="text-align:center;">상태</th><th style="text-align:center;">관리</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderPermMatrix(){
  const el=inp('perm-matrix'); if(!el) return;
  const cfg = rolePagesConfig();
  const role = permColRole;
  const allowed = new Set(cfg[role]||[]);
  const RB='1px solid var(--br)';
  const tab=(r,label)=>`<button onclick="setPermRole('${r}')" style="border:none;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;background:${role===r?'#1971c2':'transparent'};color:${role===r?'#fff':'var(--tx-s)'};">${label}</button>`;
  const chips = PAGE_LIST.map(p=>{
    const on=allowed.has(p.id);
    return `<span onclick="permToggleRolePage('${role}','${p.id}',${!on})" style="display:inline-flex;align-items:center;padding:4px 8px;margin:2px;border-radius:11px;font-size:10px;cursor:pointer;user-select:none;transition:all .12s;border:1px solid ${on?'#1971c2':'var(--br)'};background:${on?'#1971c2':'transparent'};color:${on?'#fff':'var(--tx-t)'};font-weight:${on?'600':'400'};">${p.label}</span>`;
  }).join('');
  const RL={manager:'중간관리자',staff:'평사원'};
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--tx-s);font-weight:700;">역할 선택</span>
      <div style="display:inline-flex;border:${RB};border-radius:8px;overflow:hidden;">${tab('manager','중간관리자')}${tab('staff','평사원')}</div>
      <span style="font-size:11px;color:var(--tx-t);"><b style="color:#1971c2;">파란 칩</b> = 접근 허용 · 흐린 칩 = 차단 · 관리자는 항상 전체</span>
      <span style="margin-left:auto;font-size:10.5px;white-space:nowrap;">
        <a onclick="permSetAllPages('${role}',true)" style="color:var(--tx-i);cursor:pointer;">전체</a>
        <span style="color:var(--tx-t);"> · </span>
        <a onclick="permSetAllPages('${role}',false)" style="color:var(--tx-d);cursor:pointer;">해제</a>
      </span>
    </div>
    <div style="font-size:11.5px;color:var(--tx-s);margin-bottom:8px;"><b>${RL[role]}</b> 가 접근할 수 있는 페이지를 선택합니다.</div>
    <div>${chips}</div>`;
}
async function permSetAllPages(role, all){
  const cfg = rolePagesConfig();
  cfg[role] = all ? PAGE_LIST.map(p=>p.id) : [];
  saveStorageLocalOnly('rolePages', cfg);
  if (role===currentRole){ allowedPages=roleAllowedSet(currentRole); applyRoleGating(); }
  renderPermMatrix();
  try{ await _fbDb.collection('roles').doc('config').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
}
let permColRole = 'manager';   // 권한 화면에서 현재 편집 중인 역할(페이지·컬럼 공유)
function setPermRole(r){ permColRole = r; renderPermMatrix(); renderPermColumns(); renderPermFeatures(); }
function setPermColRole(r){ setPermRole(r); }
function renderPermColumns(){
  const el=inp('perm-columns'); if(!el) return;
  const cfg=roleColumnsConfig();
  const role=permColRole;
  const hiddenOf=(tk)=> new Set(((cfg[role]||{})[tk])||[]);
  const RB='1px solid var(--br)';
  const tab=(r,label)=>`<button onclick="setPermColRole('${r}')" style="border:none;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;background:${permColRole===r?'#1971c2':'transparent'};color:${permColRole===r?'#fff':'var(--tx-s)'};">${label}</button>`;
  const chip=(label, shown, onclick)=>`<span onclick="${onclick}" style="display:inline-flex;align-items:center;padding:4px 8px;margin:2px;border-radius:11px;font-size:10px;cursor:pointer;user-select:none;transition:all .12s;border:1px solid ${shown?'#1971c2':'var(--br)'};background:${shown?'#1971c2':'transparent'};color:${shown?'#fff':'var(--tx-t)'};font-weight:${shown?'600':'400'};">${label}</span>`;
  const cards = Object.keys(COLUMN_TABLES).map(tk=>{
    const t=COLUMN_TABLES[tk]; const hidden=hiddenOf(tk);
    const chips=t.cols.map(c=>{
      const shown=!hidden.has(c);
      return chip(c, shown, `permToggleRoleColumn('${role}','${tk}','${c.replace(/'/g,"\\'")}',${!shown})`);
    }).join('');
    let addChip='';
    if (t.addBtn){
      const shown=!hidden.has(ADD_KEY);
      addChip = `<span style="display:inline-block;width:1px;height:20px;background:var(--br);margin:0 6px;vertical-align:middle;"></span>` + chip('＋ 등록 버튼', shown, `permToggleRoleColumn('${role}','${tk}','${ADD_KEY}',${!shown})`);
    }
    return `<div style="border:${RB};border-radius:10px;margin-bottom:12px;background:var(--bg-p);overflow:hidden;">
      <div style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--bg-s);border-bottom:${RB};">
        <i class="ti ti-table" style="color:var(--tx-i);font-size:15px;"></i>
        <span style="font-weight:700;font-size:13px;">${t.label}</span>
        <span style="margin-left:auto;font-size:10.5px;white-space:nowrap;">
          <a onclick="permSetAllColumns('${role}','${tk}',true)" style="color:var(--tx-i);cursor:pointer;">전체</a>
          <span style="color:var(--tx-t);"> · </span>
          <a onclick="permSetAllColumns('${role}','${tk}',false)" style="color:var(--tx-d);cursor:pointer;">해제</a>
        </span>
      </div>
      <div style="padding:8px 10px;">${chips}${addChip}</div>
    </div>`;
  }).join('');
  const RL={manager:'중간관리자',staff:'평사원'};
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--tx-s);font-weight:700;">역할 선택</span>
      <div style="display:inline-flex;border:${RB};border-radius:8px;overflow:hidden;">${tab('manager','중간관리자')}${tab('staff','평사원')}</div>
      <span style="font-size:11px;color:var(--tx-t);"><b style="color:#1971c2;">파란 칩</b> = 표시 · 흐린 칩 = 숨김 · 클릭하여 전환 · 관리자는 항상 전체</span>
    </div>
    <div style="font-size:11.5px;color:var(--tx-s);margin-bottom:10px;"><b>${RL[role]}</b> 에게 보일 컬럼/등록버튼을 설정합니다.</div>
    ${cards}`;
}
/* 기능 권한(내보내기·PDF) 칩 렌더 */
function renderPermFeatures(){
  const el=inp('perm-features'); if(!el) return;
  const role=permColRole;
  const f=roleFeaturesConfig()[role]||{};
  const RL={manager:'중간관리자',staff:'평사원'};
  const chip=(def)=>{ const on=(f[def.key]!==false); return `<span onclick="permToggleFeature('${role}','${def.key}',${!on})" style="display:inline-flex;align-items:center;padding:5px 10px;margin:2px;border-radius:12px;font-size:10.5px;cursor:pointer;user-select:none;border:1px solid ${on?'#1971c2':'var(--br)'};background:${on?'#1971c2':'transparent'};color:${on?'#fff':'var(--tx-t)'};font-weight:${on?'600':'400'};">${def.label}</span>`; };
  el.innerHTML = `<div style="font-size:11.5px;color:var(--tx-s);margin-bottom:8px;"><b>${RL[role]}</b> 에게 허용할 기능을 선택합니다. (앱 전체 공통 적용)</div>
    <div>${FEATURE_DEFS.map(chip).join('')}</div>`;
}
async function permToggleFeature(role, key, allowed){
  const cfg=roleFeaturesConfig(); cfg[role]=cfg[role]||{};
  cfg[role][key]=allowed;
  saveStorageLocalOnly('roleFeatures', cfg);
  if(role===currentRole) applyFeatureGating();
  renderPermFeatures();
  try{ await _fbDb.collection('roles').doc('features').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
}
/* 한 역할의 표 전체 컬럼/등록버튼 일괄 표시·해제 */
async function permSetAllColumns(role, tk, visible){
  const cfg=roleColumnsConfig(); cfg[role]=cfg[role]||{};
  const t=COLUMN_TABLES[tk];
  const all=t.cols.slice(); if(t.addBtn) all.push(ADD_KEY);
  cfg[role][tk] = visible ? [] : all;   // 표시=숨김없음 / 해제=전부 숨김
  saveStorageLocalOnly('roleColumns', cfg);
  try{ await _fbDb.collection('roles').doc('columns').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
  if(role===currentRole) applyColumnGating();
  renderPermColumns();
}
async function permToggleRoleColumn(role, tk, col, visible){
  const cfg=roleColumnsConfig();
  cfg[role]=cfg[role]||{};
  const set=new Set(cfg[role][tk]||[]);   // 숨김 컬럼 집합
  if(visible) set.delete(col); else set.add(col);
  cfg[role][tk]=[...set];
  saveStorageLocalOnly('roleColumns', cfg);
  if(role===currentRole) applyColumnGating();
  renderPermColumns();   // 칩 상태 즉시 갱신
  try{ await _fbDb.collection('roles').doc('columns').set(cfg); }
  catch(e){ showToast('저장 실패: '+e.message,'error'); }
}
async function permSetRole(uid, role){
  try{ await _fbDb.collection('users').doc(uid).update({role}); showToast('역할이 변경되었습니다. (해당 사용자 새로고침 시 반영)'); }
  catch(e){ showToast('변경 실패: '+e.message,'error'); }
}
async function permToggleActive(uid, currentlyActive){
  try{ await _fbDb.collection('users').doc(uid).update({active:!currentlyActive}); showToast(currentlyActive?'비활성화했습니다.':'승인(활성화)했습니다.'); renderPermissions(); }
  catch(e){ showToast('변경 실패: '+e.message,'error'); }
}
async function permToggleRolePage(role, pageId, on){
  const cfg = rolePagesConfig();
  const set = new Set(cfg[role]||[]);
  if(on) set.add(pageId); else set.delete(pageId);
  cfg[role] = [...set];
  saveStorageLocalOnly('rolePages', cfg);
  if (role===currentRole){ allowedPages=roleAllowedSet(currentRole); applyRoleGating(); }
  renderPermMatrix();   // 칩 즉시 갱신
  try{ await _fbDb.collection('roles').doc('config').set(cfg); }
  catch(e){ showToast('저장 실패: '+e.message,'error'); }
}

/* ════════ 일괄 선택/동작 (테이블 비종속) — 체크박스 + 전체 선택 + 0건 시 비활성 ════════
   각 표의 행 삭제 버튼 onclick에서 id를 추출하므로 렌더 함수 수정 불필요. */
const BULK_CFG = {
  rfq:        {sel:'#rfq-table',        del:'deleteRfq',       edit:'openRfqEdit',    pdf:'openRfqPrint', csv:'exportRfqXLS', email:'openEmailModal'},
  materials:  {sel:'#mat-table',        del:'deleteMat',       edit:'openMatEdit'},
  inventory:  {sel:'#inventory-table',  del:'deleteInventory', edit:'openInvEdit'},
  orders:     {sel:'#orders-table',     del:'deleteOrder',     edit:'openOrderEdit'},
  defects:    {sel:'#defect-table',     del:'deleteDefect',    edit:'openDefectEdit'},
  checks:     {sel:'#check-table',      del:'deleteCheck',     edit:'openCheckEdit'},
  claims:     {sel:'#claims-table-full',del:'deleteClaim',     edit:'openClaimEdit'},
  deliveries: {sel:'#dlv-table',        del:'deleteDelivery',  edit:null},
  workers:    {sel:'#workers-table',    del:'deleteWorker',    edit:'openWorkerEdit'},
  as:         {sel:'#as-body',          del:'deleteAS',        edit:'openAsEdit'},
  partners:   {sel:'#bp-table',         del:'deletePartner',   edit:'openPartnerModal'},
  statement:  {sel:'#st-table', type:'statement', del:'deleteSalesDoc', edit:'openSalesDocEdit', pdf:'openSalesDocPrint', email:'openEmailModal'},
  tax:        {sel:'#tx-table', type:'tax',       del:'deleteSalesDoc', edit:'openSalesDocEdit', pdf:'openSalesDocPrint', email:'openEmailModal'},
  quote:      {sel:'#qt-table', type:'quote',     del:'deleteSODoc',    edit:'openSODocEdit',    pdf:'openSODocPrint',    email:'openEmailModal'},
  order:      {sel:'#so-table', type:'order',     del:'deleteSODoc',    edit:'openSODocEdit',    pdf:'openSODocPrint',    email:'openEmailModal'}
};
const bulkSel = {};
function _escRe(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function enhanceBulk(key){
  const c=BULK_CFG[key]; if(!c) return;
  const cont=document.querySelector(c.sel); if(!cont) return;
  const table=cont.querySelector('table'); if(!table) return;
  const headRow=table.querySelector('thead tr'); if(!headRow) return;
  if(table.dataset.bulk){ updateBulkBar(key); return; }
  table.dataset.bulk='1';
  bulkSel[key]=new Set();
  // (type,id) 시그니처 함수는 두 번째 인자가 id
  const delRe = c.type
    ? new RegExp(_escRe(c.del)+"\\(\\s*['\"][^'\"]*['\"]\\s*,\\s*['\"]([^'\"]+)['\"]")
    : new RegExp(_escRe(c.del)+"\\(\\s*['\"]([^'\"]+)['\"]");
  const hideFns=[c.del,c.pdf,c.csv,c.email].filter(Boolean);
  const th=document.createElement('th'); th.style.cssText='width:24px;padding:6px 3px;text-align:center;';
  th.innerHTML=`<input type="checkbox" title="전체 선택" onclick="bulkToggleAll('${key}',this.checked)" style="width:12px;height:12px;accent-color:#1971c2;cursor:pointer;vertical-align:middle;">`;
  headRow.insertBefore(th, headRow.firstChild);
  [...table.querySelectorAll('tbody tr')].forEach(tr=>{
    let id=null;
    tr.querySelectorAll('[onclick]').forEach(b=>{ const m=(b.getAttribute('onclick')||'').match(delRe); if(m && id==null) id=m[1]; });
    const td=document.createElement('td'); td.style.cssText='text-align:center;padding:6px 3px;';
    if(id!=null){
      td.innerHTML=`<input type="checkbox" data-bid="${id}" onclick="bulkToggle('${key}','${id.replace(/'/g,"\\'")}',this.checked)" style="width:12px;height:12px;accent-color:#1971c2;cursor:pointer;vertical-align:middle;">`;
      tr.querySelectorAll('[onclick]').forEach(b=>{ const oc=b.getAttribute('onclick')||''; if(c.edit && oc.includes(c.edit+'(')) return; if(hideFns.some(fn=>oc.includes(fn+'('))) b.style.display='none'; });
    }
    tr.insertBefore(td, tr.firstChild);
  });
  ensureBulkBar(key, table);
  updateBulkBar(key);
}
function ensureBulkBar(key, table){
  if(document.getElementById('bulkbar-'+key)) return;
  const c=BULK_CFG[key]; const wrap=table.parentElement; if(!wrap||!wrap.parentNode) return;
  let btns='';
  if(c.pdf)   btns+=`<button class="btn btn-sm" data-act onclick="bulkRun('${key}','pdf')"><i class="ti ti-printer"></i>선택 PDF 출력</button>`;
  if(c.csv)   btns+=`<button class="btn btn-sm" data-act onclick="bulkRun('${key}','csv')"><i class="ti ti-file-spreadsheet"></i>선택 엑셀</button>`;
  if(c.email) btns+=`<button class="btn btn-sm" data-act onclick="bulkRun('${key}','email')"><i class="ti ti-mail"></i>선택 이메일</button>`;
  btns+=`<button class="btn btn-sm btn-danger" data-act onclick="bulkRun('${key}','delete')"><i class="ti ti-trash"></i>선택 삭제</button>`;
  const bar=document.createElement('div'); bar.id='bulkbar-'+key;
  bar.style.cssText='display:none;align-items:center;gap:8px;margin:0 0 12px;padding:9px 14px;background:var(--bg-i);border:1px solid var(--br-i);border-radius:8px;flex-wrap:wrap;';
  bar.innerHTML=`<span style="font-weight:700;font-size:12.5px;color:var(--tx-i);"><i class="ti ti-checkbox"></i> <span id="bulkcnt-${key}">0</span>건 선택됨</span>${btns}<button class="btn btn-sm" style="margin-left:auto;" onclick="bulkToggleAll('${key}',false)"><i class="ti ti-x"></i>선택 해제</button>`;
  wrap.parentNode.insertBefore(bar, wrap);
}
function updateBulkBar(key){
  const n=(bulkSel[key]||new Set()).size;
  const cnt=document.getElementById('bulkcnt-'+key); if(cnt) cnt.textContent=n;
  const bar=document.getElementById('bulkbar-'+key); if(bar) bar.style.display = n>0 ? 'flex' : 'none';   // 선택 시에만 표시
}
function bulkToggle(key,id,on){ const s=bulkSel[key]=bulkSel[key]||new Set(); if(on)s.add(id);else s.delete(id); updateBulkBar(key); }
function bulkToggleAll(key,on){ const s=bulkSel[key]=new Set(); const cont=document.querySelector(BULK_CFG[key].sel); if(cont) cont.querySelectorAll('tbody input[type=checkbox][data-bid]').forEach(cb=>{ cb.checked=on; if(on) s.add(cb.getAttribute('data-bid')); }); updateBulkBar(key); }
function bulkRun(key, action){
  const c=BULK_CFG[key]; const ids=[...(bulkSel[key]||[])]; if(!ids.length) return;
  if(action==='delete'){
    if(!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
    const oc=window.confirm; window.confirm=()=>true;
    const ocf=window.confirm_; window.confirm_=(t,m,fn)=>{ try{ fn&&fn(); }catch(e){} };   // 커스텀 확인창도 자동 승인
    try{ ids.forEach(id=>{ try{ c.type ? window[c.del](c.type,id) : window[c.del](id); }catch(e){} }); }
    finally { window.confirm=oc; window.confirm_=ocf; }
    bulkSel[key]=new Set(); showToast(`${ids.length}건이 삭제되었습니다.`);
  } else if(action==='pdf' && c.pdf){
    if(c.type){ try{ window[c.pdf](c.type, ids); }catch(e){} }    // 선택 건 한 창에 개별 페이지
    else ids.forEach(id=>{ try{ window[c.pdf](id); }catch(e){} });
  }
  else if(action==='csv' && c.csv){ ids.forEach(id=>{ try{ window[c.csv](id); }catch(e){} }); }
  else if(action==='email' && c.email){
    if(ids.length!==1){ showToast('이메일은 한 건만 선택해 발송하세요.','info'); return; }
    const obj=_bulkFindObj(key, ids[0]); if(obj){ try{ window[c.email](obj, c.type||key); }catch(e){} }
  }
}
function _bulkFindObj(key, id){
  const map={ po:poList, rfq:rfqList, statement:statementList, tax:taxList, quote:quoteList, order:orderList };
  const list=map[key]; return list ? list.find(x=>x.id===id) : null;
}
function watchBulk(){
  try {
    Object.keys(BULK_CFG).forEach(key=>{
      const c=BULK_CFG[key]; const cont=document.querySelector(c.sel); if(!cont) return;
      if(!cont._bulkObs){
        const obs=new MutationObserver(()=>{ obs.disconnect(); try{ enhanceBulk(key); }catch(e){} obs.observe(cont,{childList:true,subtree:true}); });
        cont._bulkObs=obs; obs.observe(cont,{childList:true,subtree:true});
      }
      try{ enhanceBulk(key); }catch(e){}
    });
  } catch(e){ /* BULK_CFG 초기화 이전(부팅 중) 호출 — 무시 */ }
}

cloudBootstrap();   // 클라우드(Firebase) 연동 시작 — 설정 시 로그인 게이트 활성화
initRole();         // 역할 기반 접근제어(RBAC) 적용 — 사이드바/페이지 권한
watchBulk();        // 일괄 선택/동작 활성화

function tick() {
  const n = new Date();
  const yr = n.getFullYear();
  const mo = String(n.getMonth() + 1).padStart(2, '0');
  const dy = String(n.getDate()).padStart(2, '0');
  const hh = String(n.getHours()).padStart(2, '0');
  const mm = String(n.getMinutes()).padStart(2, '0');
  const ss = String(n.getSeconds()).padStart(2, '0');
  const clock = inp('clock');
  if (clock) clock.textContent = `${yr}-${mo}-${dy} ${hh}:${mm}:${ss}`;
}
tick();
setInterval(tick, 1000);
