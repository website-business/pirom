window.addEventListener('load', () => loadData(initMachinePage));

function initMachinePage() {
    const search = document.getElementById('search-box');
    search.addEventListener('input', (e) => renderList(e.target.value));
    renderList();
    document.getElementById('loading').style.display = 'none';
}

function renderList(filter = '') {
    const container = document.getElementById('machine-list');
    container.innerHTML = '';
    
    const term = filter.toLowerCase();
    const list = appData.machines.filter(m => 
        (m['รหัสรถ']||'').toLowerCase().includes(term) || 
        (m['ทะเบียน']||'').toLowerCase().includes(term)
    ).slice(0, 50); // Show max 50 items

    if(list.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-gray-500 py-8">ไม่พบข้อมูล</div>`;
        return;
    }

    list.forEach(m => {
        const div = document.createElement('div');
        div.className = 'glass-card p-4 hover:bg-white/5 cursor-pointer transition border-l-4 border-transparent hover:border-l-blue-400';
        div.onclick = () => openDetail(m);
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <div class="text-lg font-bold text-blue-400">${m['รหัสรถ']}</div>
                    <div class="text-sm text-gray-400">${m['ประเภทรถ'] || '-'}</div>
                </div>
                <div class="text-right text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">${m['ทะเบียน'] || 'ไม่มีทะเบียน'}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function openDetail(machine) {
    document.getElementById('modal-title').innerText = machine['รหัสรถ'];
    const content = document.getElementById('modal-content');
    
    // Check Tax Date
    const today = new Date(); today.setHours(0,0,0,0);
    const taxDate = parseDate(machine['วันที่ทะเบียนขาด']);
    const isTaxExp = taxDate && taxDate < today;
    
    const insDate = parseDate(machine['วันที่ประกัน+พรบ.ขาด']);
    const isInsExp = insDate && insDate < today;

    const renderDate = (label, dateObj, isExpired) => `
        <div class="flex justify-between items-center p-3 rounded-lg ${isExpired ? 'bg-red-500/10 border border-red-500/30' : 'bg-white/5'}">
            <span class="text-gray-400 text-sm">${label}</span>
            <div class="text-right">
                <div class="${isExpired ? 'text-red-400 font-bold' : 'text-emerald-400'}">${dateObj ? formatDateTH(dateObj) : '-'}</div>
                ${isExpired ? '<span class="text-[10px] text-red-400">(ขาดแล้ว)</span>' : ''}
            </div>
        </div>
    `;
    
    content.innerHTML = `
        <div class="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><label class="text-xs text-gray-500">ทะเบียน</label><div class="text-white font-medium">${machine['ทะเบียน'] || '-'}</div></div>
            <div><label class="text-xs text-gray-500">ยี่ห้อ</label><div class="text-white font-medium">${machine['ยี่ห้อรถ'] || '-'}</div></div>
            <div><label class="text-xs text-gray-500">เลขเครื่อง</label><div class="text-white font-medium">${machine['เลขเครื่อง'] || '-'}</div></div>
            <div><label class="text-xs text-gray-500">เลขตัวถัง</label><div class="text-white font-medium">${machine['เลขตัวถัง'] || '-'}</div></div>
        </div>
        
        <div class="space-y-2 border-t border-white/10 pt-4">
            <h4 class="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">สถานะเอกสาร</h4>
            ${renderDate('วันต่อภาษี', taxDate, isTaxExp)}
            ${renderDate('วันต่อประกัน', insDate, isInsExp)}
        </div>
    `;
    document.getElementById('machine-modal').classList.add('show');
}