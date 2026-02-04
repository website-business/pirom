// --- Configuration & Shared Data ---
const SHEET_URLS = {
    machines: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=0&single=true&output=csv',
    fuel: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=700157187&single=true&output=csv',
    maintenance: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=1964968763&single=true&output=csv'
};

const CACHE_KEY = 'machinery_data_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 นาที

let appData = { machines: [], fuel: [], maintenance: [], alerts: { expired: [], warning: [], all: [] } };

// Variables for Modal Logic
let modalFuelChartInstance = null;
let modalMaintChartInstance = null;
let modalChartState = { view: 'year', year: null, month: null, machineCode: null }; 
let lastModalType = 'all'; 

// --- Chart Global Settings ---
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Bai Jamjuree', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
}

// --- Helper Functions ---
function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1; 
            let year = parseInt(parts[2], 10);
            if (year > 2400) year -= 543;
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d;
        }
    }
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
            if (d.getFullYear() > 2400) { d.setFullYear(d.getFullYear() - 543); }
            return d;
    }
    return null;
}

function formatDateTH(date) { return date ? date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'; }
function formatNumber(num) { return num.toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
function parseNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(String(val).replace(/,/g, '')) || 0;
}
function getCssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function cleanCSV(data) {
    if (!data || data.length === 0) return [];
    return data.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => { newRow[key.trim()] = row[key] ? row[key].trim() : ""; });
        return newRow;
    });
}

// --- Data Loading Logic ---
async function loadData(onSuccess) {
    // 1. Check Cache
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
        const parsedCache = JSON.parse(cached);
        const now = new Date().getTime();
        if (now - parsedCache.timestamp < CACHE_DURATION) {
            console.log("Using cached data");
            appData = parsedCache.data;
            if(onSuccess) onSuccess();
            return;
        }
    }

    // 2. Fetch New
    try {
        const [machinesRes, fuelRes, maintRes] = await Promise.all([
            fetch(SHEET_URLS.machines).then(r => r.ok ? r.text() : ""),
            fetch(SHEET_URLS.fuel).then(r => r.ok ? r.text() : ""),
            fetch(SHEET_URLS.maintenance).then(r => r.ok ? r.text() : "")
        ]);
        
        appData.machines = cleanCSV(Papa.parse(machinesRes, { header: true, skipEmptyLines: true }).data);
        appData.fuel = cleanCSV(Papa.parse(fuelRes, { header: true, skipEmptyLines: true }).data);
        
        if (maintRes) {
            const parsedMaint = Papa.parse(maintRes, { header: true, skipEmptyLines: true }).data;
            appData.maintenance = cleanCSV(parsedMaint);
            appData.maintenance.forEach(row => {
                const costKey = Object.keys(row).find(k => k.includes('ค่าใช้จ่าย') || k.includes('ค่าซ่อม'));
                if (costKey) row['ค่าซ่อมบำรุง'] = row[costKey];
                const projKey = Object.keys(row).find(k => k.includes('โครงการ'));
                if (projKey) row['โครงการ'] = row[projKey];
                const machineKey = Object.keys(row).find(k => k.includes('รหัสรถ') || k.includes('รหัส') || k.toLowerCase().includes('machine') || k.toLowerCase().includes('code'));
                if(machineKey) row['รหัสรถ'] = row[machineKey];
            });
        }

        // Normalize Data keys
        const normalize = (dataset) => {
            dataset.forEach(row => {
                const valKey = Object.keys(row).find(k => k.includes('ปริมาณ') || k.includes('ลิตร'));
                if (valKey) row['ปริมาณ(ลิตร)'] = row[valKey];
                const projKey = Object.keys(row).find(k => k.includes('โครงการ'));
                if (projKey) row['โครงการ'] = row[projKey];
                const machineKey = Object.keys(row).find(k => k === 'รหัส' || k.includes('รหัส') || k.toLowerCase().includes('machine'));
                if(machineKey && machineKey !== 'รหัส') row['รหัส'] = row[machineKey];
                if(machineKey && machineKey !== 'รหัสรถ') row['รหัสรถ'] = row[machineKey];
            });
        };
        normalize(appData.fuel);
        normalize(appData.machines);

        if(!appData.machines.length) throw new Error("Empty Data");

        appData.fuel.sort((a, b) => { const da = parseDate(a['วันที่']); const db = parseDate(b['วันที่']); return (da && db) ? da - db : 0; });
        appData.maintenance.sort((a, b) => { const da = parseDate(a['วันที่']); const db = parseDate(b['วันที่']); return (da && db) ? da - db : 0; });

        // 3. Save Cache
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: new Date().getTime(), data: appData }));

        if(onSuccess) onSuccess();

    } catch (error) {
        console.error("Load Error:", error);
        if(document.getElementById('loading-text')) {
            document.getElementById('loading-text').innerText = "เชื่อมต่อล้มเหลว...";
            document.getElementById('loading-text').classList.add('text-red-500');
            document.getElementById('btn-retry').classList.remove('hidden');
        }
    }
}

// --- SHARED MODAL SYSTEM ---

function openModal(type) {
    lastModalType = type;
    const modal = document.getElementById('modal');
    if(!modal) return;
    
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    body.innerHTML = '';
    
    const filterBar = document.getElementById('modal-filter-bar');
    if(filterBar) filterBar.classList.add('hidden');

    // Logic for Alerts (Only needed if alerts exist in appData)
    if (type === 'alerts') {
        title.innerText = 'รายการแจ้งเตือน';
        // (Simplified alert logic for brevity, make sure processAlerts is run in dashboard)
        body.innerHTML = `<div id="alert-list-container">กำลังโหลด...</div>`;
        // In common.js we assume alerts are populated or we re-run logic. 
        // Better to let dashboard populate alerts, but here we just render placeholders or shared structure.
        // For simplicity, we skip full alert rendering here as it is dashboard specific usually.
    } 
    else if (type === 'all') {
        title.innerText = 'ฐานข้อมูลเครื่องจักร';
        if(filterBar) {
            filterBar.classList.remove('hidden');
            document.getElementById('machine-search').value = '';
            document.getElementById('btn-print-qr').classList.remove('hidden');
            populateTypeFilter();
            filterModalList();
        }
    }
    
    modal.classList.add('show');
}

function closeModal() { 
    if(modalFuelChartInstance) modalFuelChartInstance.destroy(); 
    if(modalMaintChartInstance) modalMaintChartInstance.destroy(); 
    const modal = document.getElementById('modal');
    if(modal) modal.classList.remove('show'); 
}

function showMachineDetails(code, ctx={}) { 
     const machine = appData.machines.find(m => m['รหัส'] === code);
     if (!machine) { alert('ไม่พบข้อมูลเครื่องจักร: ' + code); return; }
     
     // Close any existing modal first if needed, or just switch content
     const modal = document.getElementById('modal');
     if(!modal) return;

     document.getElementById('modal-title').innerText = `รหัส: ${code}`;
     const filterBar = document.getElementById('modal-filter-bar');
     if(filterBar) filterBar.classList.add('hidden');
     
     modalChartState = { machineCode: code, view: ctx.view || 'year', year: ctx.year!==undefined?ctx.year:null, month: ctx.month!==undefined?ctx.month:null };
     
     // Status Logic
     const today = new Date(); today.setHours(0,0,0,0);
     const getStatus = (dateStr) => {
         if(!dateStr || dateStr === '-') return { color: 'text-white', label: 'text-[var(--crystal-cyan)]', status: '' };
         const d = parseDate(dateStr);
         if(!d) return { color: 'text-white', label: 'text-[var(--crystal-cyan)]', status: '' };
         const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
         if(diff < 0) return { color: 'text-red-500', label: 'text-red-400', status: '(ขาด)' }; 
         if(diff <= 30) return { color: 'text-yellow-500', label: 'text-yellow-400', status: '(ใกล้หมด)' };
         return { color: 'text-emerald-400', label: 'text-[var(--crystal-cyan)]', status: '' }; 
     };
     
     const taxSt = getStatus(machine['วันที่ทะเบียนขาด']);
     const insSt = getStatus(machine['วันที่ประกัน+พรบ.ขาด']);

     document.getElementById('modal-body').innerHTML = `
        <div class="space-y-6 animate-fade-in">
            <div class="flex justify-between items-center">
                <button onclick="closeModal()" class="btn-crystal px-4 py-2 text-xs flex items-center gap-2"><i class="fas fa-times"></i> ปิด</button>
            </div>
            <div class="bg-white/5 p-5 rounded-2xl border border-white/10 backdrop-blur-md">
                 <div class="grid grid-cols-2 gap-4 text-sm text-gray-300">
                   <div><span class="block text-[var(--crystal-cyan)] text-xs mb-1 font-bold">ทะเบียน</span> <div class="font-bold text-white text-lg">${machine['ทะเบียน'] || '-'}</div></div>
                   <div><span class="block text-[var(--crystal-cyan)] text-xs mb-1 font-bold">ประเภท</span> <div class="font-bold text-white text-lg">${machine['ประเภทรถ'] || '-'}</div></div>
                   <div><span class="block text-[var(--crystal-cyan)] text-xs mb-1 font-bold">ยี่ห้อ</span> <div class="font-bold text-white">${machine['ยี่ห้อรถ'] || '-'}</div></div>
                   <div><span class="block text-[var(--crystal-cyan)] text-xs mb-1 font-bold">เลขเครื่อง</span> <div class="font-bold text-white">${machine['เลขเครื่อง'] || '-'}</div></div>
                   <div class="col-span-2 border-t border-white/10 pt-3 mt-1 grid grid-cols-2 gap-4">
                       <div><span class="block ${taxSt.label} text-xs mb-1 font-bold">วันครบกำหนดภาษี</span> <div class="font-bold ${taxSt.color}">${machine['วันที่ทะเบียนขาด'] || '-'} <span class="text-xs opacity-80">${taxSt.status}</span></div></div>
                       <div><span class="block ${insSt.label} text-xs mb-1 font-bold">วันครบกำหนดประกัน</span> <div class="font-bold ${insSt.color}">${machine['วันที่ประกัน+พรบ.ขาด'] || '-'} <span class="text-xs opacity-80">${insSt.status}</span></div></div>
                   </div>
                 </div>
            </div>
            <div class="bg-white/5 p-5 rounded-2xl border border-white/10 backdrop-blur-md">
                 <div class="flex justify-between items-center mb-4"><h4 class="text-white font-bold flex items-center gap-2"><i class="fas fa-chart-line text-[var(--crystal-amber)]"></i> สถิติการใช้งาน</h4><button onclick="resetModalChartToYear()" class="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded-full transition">รีเซ็ต</button></div>
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div><h5 class="text-[var(--crystal-emerald)] text-xs font-bold mb-2 uppercase">FUEL USAGE <span id="val-modal-fuel" class="text-white ml-2"></span></h5><div class="h-48 relative"><canvas id="modalFuelChart"></canvas></div></div>
                     <div><h5 class="text-[var(--crystal-purple)] text-xs font-bold mb-2 uppercase">MAINTENANCE <span id="val-modal-maint" class="text-white ml-2"></span></h5><div class="h-48 relative"><canvas id="modalMaintChart"></canvas></div></div>
                 </div>
            </div>
        </div>`;
     
     modal.classList.add('show');
     setTimeout(() => { updateModalCharts(); }, 100);
}

function updateModalCharts() {
    if(!document.getElementById('modalFuelChart')) return;
    const renderSynced = (type, canvasId, valId) => {
         const code = modalChartState.machineCode;
         const dataSource = type === 'fuel' ? appData.fuel : appData.maintenance;
         const valKey = type === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
         const unit = type === 'fuel' ? 'L' : '฿';
         const color = type === 'fuel' ? getCssVar('--crystal-emerald') : getCssVar('--crystal-purple');
         
         const dataFiltered = dataSource.filter(item => item['รหัสรถ'] === code);
         let labels = [], data = [], total = 0;

         if (modalChartState.view === 'year') {
             const grouped = {}; dataFiltered.forEach(item => { const d = parseDate(item['วันที่']); if (d) { const val = parseNumber(item[valKey]); grouped[d.getFullYear()] = (grouped[d.getFullYear()] || 0) + val; total += val; } });
             labels = Object.keys(grouped).sort(); data = labels.map(y => grouped[y]);
         } else if (modalChartState.view === 'month') {
             if(!modalChartState.year) { const years = [...new Set(dataFiltered.map(i => parseDate(i['วันที่'])?.getFullYear()).filter(y => y))].sort((a,b) => b-a); modalChartState.year = years[0] || new Date().getFullYear(); }
             const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
             const grouped = new Array(12).fill(0); dataFiltered.forEach(item => { const d = parseDate(item['วันที่']); if (d && d.getFullYear() === modalChartState.year) { const val = parseNumber(item[valKey]); grouped[d.getMonth()] += val; total += val; } });
             labels = months; data = grouped;
         } else if (modalChartState.view === 'day') {
             const days = new Date(modalChartState.year, modalChartState.month + 1, 0).getDate();
             const grouped = new Array(days).fill(0); dataFiltered.forEach(item => { const d = parseDate(item['วันที่']); if (d && d.getFullYear() === modalChartState.year && d.getMonth() === modalChartState.month) { const val = parseNumber(item[valKey]); grouped[d.getDate()-1] += val; total += val; } });
             labels = Array.from({length: days}, (_, i) => i + 1); data = grouped;
         }
         
         if(document.getElementById(valId)) document.getElementById(valId).innerText = `${formatNumber(total)} ${unit}`;
         const chartVar = type === 'fuel' ? modalFuelChartInstance : modalMaintChartInstance;
         if (chartVar) chartVar.destroy();
         const ctx = document.getElementById(canvasId).getContext('2d');
         const chart = new Chart(ctx, {
             type: 'bar', data: { labels: labels, datasets: [{ label: unit, data: data, backgroundColor: color, borderRadius: 4, barThickness: 'flex', maxBarThickness: 30 }] },
             options: { 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 9 } } } },
                onClick: (e, activeEls) => { 
                    if (activeEls.length > 0) { 
                        const index = activeEls[0].index; 
                        if (modalChartState.view === 'year') { modalChartState.year = parseInt(labels[index]); modalChartState.view = 'month'; updateModalCharts(); } 
                        else if (modalChartState.view === 'month') { modalChartState.month = index; modalChartState.view = 'day'; updateModalCharts(); } 
                    } 
                }
             }
         });
         if (type === 'fuel') modalFuelChartInstance = chart; else modalMaintChartInstance = chart;
    };
    renderSynced('fuel', 'modalFuelChart', 'val-modal-fuel');
    renderSynced('maint', 'modalMaintChart', 'val-modal-maint');
}

function resetModalChartToYear() { modalChartState.view = 'year'; modalChartState.year = null; modalChartState.month = null; updateModalCharts(); }

// --- Filter Logic for Modal (Shared) ---
function populateTypeFilter() {
    const select = document.getElementById('machine-type-filter');
    if(!select) return;
    select.innerHTML = '<option value="">ทั้งหมด</option>';
    const types = [...new Set(appData.machines.map(m => m['ประเภทรถ']).filter(t => t))].sort();
    types.forEach(type => { const opt = document.createElement('option'); opt.value = type; opt.innerText = type; select.appendChild(opt); });
}

function filterModalList() {
    const body = document.getElementById('modal-body');
    const searchInput = document.getElementById('machine-search');
    const typeInput = document.getElementById('machine-type-filter');
    if(!body || !searchInput || !typeInput) return;

    const searchText = searchInput.value.toLowerCase().trim();
    const filterType = typeInput.value;
    const filteredList = appData.machines.filter(item => { // Changed to filter from appData.machines directly for 'all'
        return (!searchText || (item['รหัส']||'').toLowerCase().includes(searchText)) && (!filterType || (item['ประเภทรถ'] === filterType));
    });
    
    // Sort logic to make sure we show alert logic if needed, but for 'all' view just list
    body.innerHTML = filteredList.map(item => `
        <div onclick="showMachineDetails('${item['รหัส']}')" class="bg-white/5 p-3 mb-2 rounded-xl hover:bg-white/10 cursor-pointer transition flex justify-between items-center border border-transparent hover:border-[var(--crystal-cyan)] backdrop-blur-sm">
            <div class="font-bold text-[var(--crystal-cyan)]">${item['รหัส']}</div>
            <div class="text-sm text-gray-400">${item['ทะเบียน'] || '-'}</div>
        </div>
    `).join('');
}