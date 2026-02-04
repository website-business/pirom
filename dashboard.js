// --- Global State ---
let currentGraphMode = 'fuel'; 
let chartState = { trendInstance: null, rankInstance: null, view: 'year', selectedMachine: 'ALL', selectedProject: 'ALL', selectedYear: null, selectedMonth: null, selectedDay: null };
let lastModalType = 'all'; 
let modalFuelChartInstance = null;
let modalMaintChartInstance = null;
let modalChartState = { view: 'year', year: null, month: null, machineCode: null }; 
let subModalChartInstance = null;
let html5QrCode = null;

// --- Initialize ---
window.addEventListener('load', () => {
    loadData(initDashboard);
});

function initDashboard() {
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('th-TH');
    document.getElementById('total-machines').innerText = appData.machines.length;
    
    // Populate Select
    const selector = document.getElementById('machine-select');
    const codes = [...new Set(appData.machines.map(m => m['รหัส']).filter(c => c))].sort();
    codes.forEach(code => { const opt = document.createElement('option'); opt.value = code; opt.innerText = code; selector.appendChild(opt); });

    // Events
    document.getElementById('chart-back-btn').addEventListener('click', goBackLevel); 
    document.getElementById('chart-home-btn').addEventListener('click', () => { 
        chartState.selectedMachine = 'ALL'; 
        chartState.selectedProject = 'ALL'; 
        document.getElementById('machine-select').value = 'ALL'; 
        resetChartToYear(); 
    }); 
    document.getElementById('machine-select').addEventListener('change', (e) => { 
        chartState.selectedMachine = e.target.value; 
        resetChartToYear(); 
    });

    processAlerts();
    updateAllStats();
    updateChart();
    
    // Hide Loader
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').style.display = 'none', 500);
}

// --- Main Dashboard Logic ---
function updateAllStats() {
    let totalCost = 0; let totalFuel = 0; 
    const selectedProj = chartState.selectedProject;
    const selectedMachine = chartState.selectedMachine;

    const isDateInView = (dateStr) => {
        if(!dateStr) return false;
        const d = parseDate(dateStr);
        if(!d) return false;
        if(chartState.view === 'year') return true;
        if(chartState.view === 'month') return d.getFullYear() === chartState.selectedYear;
        if(chartState.view === 'day' || chartState.view === 'single_day') return d.getFullYear() === chartState.selectedYear && d.getMonth() === chartState.selectedMonth;
        return true;
    };

    appData.maintenance.forEach(item => {
        if (selectedProj !== 'ALL' && item['โครงการ'] !== selectedProj) return;
        if (selectedMachine !== 'ALL' && item['รหัสรถ'] !== selectedMachine) return;
        if (isDateInView(item['วันที่'])) totalCost += parseNumber(item['ค่าซ่อมบำรุง']);
    });

    appData.fuel.forEach(item => {
        if (selectedProj !== 'ALL' && item['โครงการ'] !== selectedProj) return;
        if (selectedMachine !== 'ALL' && item['รหัสรถ'] !== selectedMachine) return;
        if (isDateInView(item['วันที่'])) totalFuel += parseNumber(item['ปริมาณ(ลิตร)']);
    });
    
    document.getElementById('total-maintenance').innerText = formatNumber(totalCost);
    document.getElementById('total-fuel').innerText = formatNumber(totalFuel);
    
    const projects = new Set();
    appData.fuel.forEach(f => { if(f['โครงการ']) projects.add(f['โครงการ']); });
    appData.maintenance.forEach(m => { if(m['โครงการ']) projects.add(m['โครงการ']); });
    document.getElementById('total-projects').innerText = projects.size;
    
    let timeLabel = "";
    if (chartState.view === 'month') timeLabel = `(${chartState.selectedYear})`;
    else if (chartState.view === 'day' || chartState.view === 'single_day') {
        const mName = new Date(chartState.selectedYear, chartState.selectedMonth).toLocaleString('th-TH', { month: 'short' });
        timeLabel = `(${mName} ${String(chartState.selectedYear).slice(-2)})`;
    }
    document.getElementById('label-total-fuel').innerText = `Fuel Usage ${timeLabel}`;
    document.getElementById('label-total-maint').innerText = `Maintenance ${timeLabel}`;
}

function processAlerts() {
    const today = new Date(); today.setHours(0,0,0,0);
    appData.alerts.all = []; appData.alerts.expired = []; appData.alerts.warning = [];
    const machineMap = new Map();
    appData.machines.forEach(machine => {
        const code = machine['รหัส']; if (!code) return;
        if(!machineMap.has(code)) { machineMap.set(code, { info: machine, expiredIssues: [], warningIssues: [] }); }
        const entry = machineMap.get(code);
        const checks = [
            { key: 'วันที่ทะเบียนขาด', label: 'ทะเบียน', date: parseDate(machine['วันที่ทะเบียนขาด']) },
            { key: 'วันที่ประกัน+พรบ.ขาด', label: 'ประกัน', date: parseDate(machine['วันที่ประกัน+พรบ.ขาด']) }
        ];
        checks.forEach(check => {
            if (!check.date) return;
            const diffDays = Math.ceil((check.date - today) / (1000 * 60 * 60 * 24));
            const issueText = `${check.label}: ${formatDateTH(check.date)}`;
            if (diffDays <= 0) entry.expiredIssues.push(issueText);
            else if (diffDays <= 30) entry.warningIssues.push(issueText);
        });
    });
    machineMap.forEach(data => {
        appData.alerts.all.push(data);
        if (data.expiredIssues.length > 0) appData.alerts.expired.push(data);
        if (data.warningIssues.length > 0) appData.alerts.warning.push(data);
    });
    document.getElementById('val-expired').innerText = appData.alerts.expired.length;
    document.getElementById('val-warning').innerText = appData.alerts.warning.length;
}

function updateChart() { renderTrendChart(); renderRankChart(); }
function switchGraphMode(mode) { 
    currentGraphMode = mode; 
    if (mode === 'fuel') { 
        document.getElementById('card-fuel').style.borderColor = 'var(--crystal-emerald)';
        document.getElementById('card-maintenance').style.borderColor = 'var(--glass-border)';
        document.getElementById('chart-title').innerText = 'สถิติน้ำมันเชื้อเพลิง'; 
    } else { 
        document.getElementById('card-fuel').style.borderColor = 'var(--glass-border)';
        document.getElementById('card-maintenance').style.borderColor = 'var(--crystal-purple)';
        document.getElementById('chart-title').innerText = 'ค่าซ่อมบำรุงรายเดือน'; 
    } 
    resetChartToYear(); 
    updateAllStats();
}
function resetChartToYear() { 
    chartState.view = 'year'; chartState.selectedYear = null; chartState.selectedMonth = null; chartState.selectedDay = null; 
    updateChart(); updateAllStats(); 
}
function goBackLevel() { 
    if (chartState.view === 'single_day') { chartState.view = 'day'; chartState.selectedDay = null; } 
    else if (chartState.view === 'day') { chartState.view = 'month'; chartState.selectedMonth = null; } 
    else if (chartState.view === 'month') { chartState.view = 'year'; chartState.selectedYear = null; } 
    updateChart(); updateAllStats(); 
}

// --- Chart Rendering (Trend & Rank) ---
function renderTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    if (chartState.trendInstance) chartState.trendInstance.destroy();
    
    let dataSource = currentGraphMode === 'fuel' ? appData.fuel : appData.maintenance;
    let valKey = currentGraphMode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
    let colorStart = currentGraphMode === 'fuel' ? 'rgba(52, 211, 153, 0.5)' : 'rgba(129, 140, 248, 0.5)';
    let colorEnd = currentGraphMode === 'fuel' ? 'rgba(52, 211, 153, 0.05)' : 'rgba(129, 140, 248, 0.05)';
    let borderColor = currentGraphMode === 'fuel' ? '#34d399' : '#818cf8';
    
    dataSource = dataSource.filter(item => {
        if (chartState.selectedProject !== 'ALL' && item['โครงการ'] !== chartState.selectedProject) return false;
        if (chartState.selectedMachine !== 'ALL' && item['รหัสรถ'] !== chartState.selectedMachine) return false;
        return true;
    });

    let labels = [], data = [];
    const filterAndSumTrend = (groupFn) => {
        const grouped = {}; 
        dataSource.forEach(item => { 
            const d = parseDate(item['วันที่']); if (!d) return;
            if (chartState.view === 'month' && d.getFullYear() !== chartState.selectedYear) return;
            if ((chartState.view === 'day' || chartState.view === 'single_day') && (d.getFullYear() !== chartState.selectedYear || d.getMonth() !== chartState.selectedMonth)) return;
            const val = parseNumber(item[valKey]); const key = groupFn(d);
            if (key !== null) grouped[key] = (grouped[key] || 0) + val;
        });
        return grouped;
    }

    if (chartState.view === 'year') {
        document.getElementById('chart-breadcrumb').innerText = "ภาพรวมรายปี";
        document.getElementById('chart-back-btn').classList.add('hidden');
        document.getElementById('chart-home-btn').classList.add('hidden');
        const d = filterAndSumTrend((date) => date.getFullYear());
        labels = Object.keys(d).sort(); data = labels.map(k => d[k]);
    } else if (chartState.view === 'month') {
        document.getElementById('chart-breadcrumb').innerText = `ปี: ${chartState.selectedYear}`;
        document.getElementById('chart-back-btn').classList.remove('hidden');
        document.getElementById('chart-home-btn').classList.remove('hidden');
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const d = filterAndSumTrend((date) => date.getMonth());
        labels = months; data = new Array(12).fill(0).map((_, i) => d[i] || 0);
    } else if (chartState.view === 'day' || chartState.view === 'single_day') {
        const mName = new Date(chartState.selectedYear, chartState.selectedMonth).toLocaleString('th-TH', { month: 'long' });
        document.getElementById('chart-breadcrumb').innerText = `${mName} ${chartState.selectedYear}`;
        const days = new Date(chartState.selectedYear, chartState.selectedMonth + 1, 0).getDate();
        const d = filterAndSumTrend((date) => date.getDate());
        labels = Array.from({length: days}, (_, i) => i + 1); data = labels.map(k => d[k] || 0);
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, colorStart); gradient.addColorStop(1, colorEnd);

    chartState.trendInstance = new Chart(ctx, {
        type: 'bar', 
        data: { labels: labels, datasets: [{ label: currentGraphMode === 'fuel' ? 'น้ำมัน' : 'ซ่อมบำรุง', data: data, backgroundColor: gradient, borderColor: borderColor, borderWidth: 1, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { x: { grid: { color: getCssVar('--chart-grid') }, ticks: { color: getCssVar('--text-muted') } }, y: { grid: { color: getCssVar('--chart-grid') }, ticks: { color: getCssVar('--text-muted') } } },
            onClick: (e, activeEls) => { if(activeEls.length > 0) handleTrendClick(activeEls[0].index, labels); },
            onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
        }
    });
}

function handleTrendClick(index, labels) {
    if (chartState.view === 'year') { chartState.selectedYear = parseInt(labels[index]); chartState.view = 'month'; updateChart(); updateAllStats(); }
    else if (chartState.view === 'month') { chartState.selectedMonth = index; chartState.view = 'day'; updateChart(); updateAllStats(); }
    else if (chartState.view === 'day' || chartState.view === 'single_day') { showMainDailyDetail(index + 1); }
}

function renderRankChart() {
    const ctx = document.getElementById('rankChart').getContext('2d');
    if (chartState.rankInstance) chartState.rankInstance.destroy();
    let dataSource = currentGraphMode === 'fuel' ? appData.fuel : appData.maintenance;
    let valKey = currentGraphMode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
    let color = currentGraphMode === 'fuel' ? '#fbbf24' : '#f87171';
    
    dataSource = dataSource.filter(item => {
        if (chartState.selectedProject !== 'ALL' && item['โครงการ'] !== chartState.selectedProject) return false;
        const d = parseDate(item['วันที่']); if (!d) return false;
        if (chartState.view === 'month' && d.getFullYear() !== chartState.selectedYear) return false;
        if ((chartState.view === 'day' || chartState.view === 'single_day') && (d.getFullYear() !== chartState.selectedYear || d.getMonth() !== chartState.selectedMonth)) return false;
        return true;
    });

    const grouped = {};
    dataSource.forEach(item => { const val = parseNumber(item[valKey]); const key = item['รหัสรถ']; if (key) grouped[key] = (grouped[key] || 0) + val; });
    const sorted = Object.entries(grouped).sort(([,a], [,b]) => b - a).slice(0, 10);
    const labels = sorted.map(k => k[0]); const data = sorted.map(k => k[1]);

    chartState.rankInstance = new Chart(ctx, {
        type: 'bar', data: { labels: labels, datasets: [{ label: 'Top 10', data: data, backgroundColor: color, borderRadius: 6 }] },
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { x: { grid: { color: getCssVar('--chart-grid') }, ticks: { color: getCssVar('--text-muted') } }, y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } } },
            onClick: (e, activeEls) => { if(activeEls.length > 0) handleRankClick(activeEls[0].index, labels); },
            onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
        }
    });
}

function handleRankClick(index, labels) {
    const machineCode = labels[index];
    let context = { view: 'year' }; 
    if (chartState.view === 'month') { context = { view: 'month', year: chartState.selectedYear }; } 
    else if (chartState.view === 'day' || chartState.view === 'single_day') { context = { view: 'day', year: chartState.selectedYear, month: chartState.selectedMonth }; }
    showMachineDetails(machineCode, context);
}

// --- Modals & Popups ---
function openModal(type) {
    lastModalType = type;
    const modal = document.getElementById('modal'), title = document.getElementById('modal-title'), body = document.getElementById('modal-body');
    body.innerHTML = '';
    document.getElementById('modal-filter-bar').classList.add('hidden');

    if (type === 'alerts') {
        title.innerText = 'รายการแจ้งเตือน';
        body.innerHTML = `
            <div class="flex gap-2 mb-4 border-b border-white/10 pb-2">
                <button id="tab-expired" onclick="switchAlertTab('expired')" class="flex-1 py-2 text-sm border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition rounded-xl">หมดอายุ (${appData.alerts.expired.length})</button>
                <button id="tab-warning" onclick="switchAlertTab('warning')" class="flex-1 py-2 text-sm border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition rounded-xl">ใกล้หมด (${appData.alerts.warning.length})</button>
            </div>
            <div id="alert-list-container"></div>
        `;
        setTimeout(() => switchAlertTab('expired'), 0);
    } else if (type === 'project') {
        title.innerText = 'ภาพรวมโครงการ';
        const projStats = {};
        const addStat = (p, f, c) => { if(!p) p='N/A'; if(!projStats[p]) projStats[p]={fuel:0,cost:0,name:p}; projStats[p].fuel+=f; projStats[p].cost+=c; };
        appData.fuel.forEach(f=>addStat(f['โครงการ'],parseNumber(f['ปริมาณ(ลิตร)']),0));
        appData.maintenance.forEach(m=>addStat(m['โครงการ'],0,parseNumber(m['ค่าซ่อมบำรุง'])));
        const projects = Object.values(projStats).sort((a,b)=>b.cost-a.cost);
        body.innerHTML = projects.map(p => `
            <div onclick="window.location.href='project.html?name=${encodeURIComponent(p.name)}'" class="border border-white/10 bg-white/5 p-4 mb-3 hover:border-[var(--crystal-cyan)] hover:bg-white/10 transition rounded-xl cursor-pointer group backdrop-blur-sm">
                <div class="flex justify-between text-lg font-semibold text-white"><span>${p.name}</span><i class="fas fa-chevron-right opacity-0 group-hover:opacity-100 transition"></i></div>
                <div class="flex justify-between text-sm mt-2 text-gray-400">
                    <span><i class="fas fa-gas-pump mr-2 text-[var(--crystal-emerald)]"></i> ${formatNumber(p.fuel)}</span>
                    <span><i class="fas fa-wrench mr-2 text-[var(--crystal-purple)]"></i> ${formatNumber(p.cost)}</span>
                </div>
            </div>
        `).join('');
    } else if (type === 'all') {
        title.innerText = 'ฐานข้อมูลเครื่องจักร';
        document.getElementById('modal-filter-bar').classList.remove('hidden');
        document.getElementById('machine-search').value = '';
        document.getElementById('btn-print-qr').classList.remove('hidden');
        populateTypeFilter();
        filterModalList();
    }
    modal.classList.add('show');
}

function closeModal() { if(modalFuelChartInstance) modalFuelChartInstance.destroy(); if(modalMaintChartInstance) modalMaintChartInstance.destroy(); document.getElementById('modal').classList.remove('show'); }

// (Include other helper functions like showMachineDetails, printQRCodes, openQRScanner here... copied from original script but simplified for brevity in this response)
// ... [REST OF DASHBOARD FUNCTIONS FROM ORIGINAL SCRIPT: showMachineDetails, renderAlertList, printQRCodes, etc.] ...
// For completeness, here are the critical ones for dashboard interaction:

function populateTypeFilter() {
    const select = document.getElementById('machine-type-filter');
    select.innerHTML = '<option value="">ทั้งหมด</option>';
    const types = [...new Set(appData.machines.map(m => m['ประเภทรถ']).filter(t => t))].sort();
    types.forEach(type => { const opt = document.createElement('option'); opt.value = type; opt.innerText = type; select.appendChild(opt); });
}

function filterModalList() {
    const type = lastModalType; if (type !== 'all') return;
    const body = document.getElementById('modal-body');
    const searchText = document.getElementById('machine-search').value.toLowerCase().trim();
    const filterType = document.getElementById('machine-type-filter').value;
    const filteredList = appData.alerts.all.filter(item => {
        return (!searchText || (item.info['รหัส']||'').toLowerCase().includes(searchText)) && (!filterType || (item.info['ประเภทรถ'] === filterType));
    });
    body.innerHTML = filteredList.map(item => `
        <div onclick="showMachineDetails('${item.info['รหัส']}')" class="bg-white/5 p-3 mb-2 rounded-xl hover:bg-white/10 cursor-pointer transition flex justify-between items-center border border-transparent hover:border-[var(--crystal-cyan)] backdrop-blur-sm">
            <div class="font-bold text-[var(--crystal-cyan)]">${item.info['รหัส']}</div>
            <div class="text-sm text-gray-400">${item.info['ทะเบียน'] || '-'}</div>
        </div>
    `).join('');
}

function switchAlertTab(t) { 
    const container = document.getElementById('alert-list-container');
    const list = t==='expired' ? appData.alerts.expired : appData.alerts.warning;
    if(list.length === 0) { container.innerHTML = `<div class="text-center text-gray-500 py-6">ไม่พบรายการ</div>`; return; }
    container.innerHTML = list.map(item => `
        <div onclick="showMachineDetails('${item.info['รหัส']}')" class="bg-white/5 border-l-4 ${t==='expired'?'border-red-500':'border-yellow-500'} p-3 mb-2 rounded-xl shadow-lg cursor-pointer hover:bg-white/10 transition backdrop-blur-sm">
            <div class="flex justify-between"><span class="font-bold text-white">${item.info['รหัส']}</span><span class="text-xs text-gray-400">${item.info['ทะเบียน']}</span></div>
            ${t==='expired' ? item.expiredIssues.map(i=>`<div class="text-xs text-red-400 mt-1">• ${i}</div>`).join('') : item.warningIssues.map(i=>`<div class="text-xs text-yellow-400 mt-1">• ${i}</div>`).join('')}
        </div>
    `).join('');
}

function showMachineDetails(code, ctx={}) { 
     const machine = appData.machines.find(m => m['รหัส'] === code);
     if (!machine) return;
     const modal = document.getElementById('modal');
     document.getElementById('modal-title').innerText = `รหัส: ${code}`;
     document.getElementById('modal-filter-bar').classList.add('hidden');
     modalChartState = { machineCode: code, view: ctx.view || 'year', year: ctx.year!==undefined?ctx.year:null, month: ctx.month!==undefined?ctx.month:null };
     
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
            <button onclick="openModal(lastModalType)" class="btn-crystal px-4 py-2 text-xs flex items-center gap-2"><i class="fas fa-arrow-left"></i> ย้อนกลับ</button>
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

function showMainDailyDetail(day) {
    const year = chartState.selectedYear; const month = chartState.selectedMonth; const mode = currentGraphMode;
    let dataSource = mode === 'fuel' ? appData.fuel : appData.maintenance;
    let valKey = mode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
    let unit = mode === 'fuel' ? 'L' : '฿';
    let chartColor = mode === 'fuel' ? getCssVar('--crystal-emerald') : getCssVar('--crystal-purple');

    const dailyItems = dataSource.filter(item => {
        const d = parseDate(item['วันที่']); if (!d) return false;
        let match = d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        if (chartState.selectedProject !== 'ALL' && item['โครงการ'] !== chartState.selectedProject) match = false;
        if (chartState.selectedMachine !== 'ALL' && item['รหัสรถ'] !== chartState.selectedMachine) match = false;
        return match;
    });

    const dateStr = `${day}/${month+1}/${year}`;
    document.getElementById('sub-modal-title').innerText = `วันที่ ${dateStr}`;
    const container = document.getElementById('sub-modal-body');
    if (subModalChartInstance) { subModalChartInstance.destroy(); subModalChartInstance = null; }

    if (dailyItems.length === 0) { container.innerHTML = `<div class="text-center text-[var(--text-muted)] py-10">ไม่มีข้อมูลในวันนี้</div>`; } else {
        const grouped = {}; dailyItems.forEach(item => { const val = parseFloat(item[valKey]) || 0; const machine = item['รหัสรถ'] || 'ไม่ระบุ'; grouped[machine] = (grouped[machine] || 0) + val; });
        const sorted = Object.entries(grouped).sort(([,a], [,b]) => b - a);
        const labels = sorted.map(k => k[0]); const data = sorted.map(k => k[1]);
        const dynamicHeight = Math.max(300, labels.length * 40);
        container.innerHTML = `<div style="position: relative; height: ${dynamicHeight}px; width: 100%;"><canvas id="subModalChart"></canvas></div>`;
        const ctx = document.getElementById('subModalChart').getContext('2d');
        subModalChartInstance = new Chart(ctx, {
            type: 'bar', data: { labels: labels, datasets: [{ label: unit, data: data, backgroundColor: chartColor, borderRadius: 6, barPercentage: 0.6 }] },
            options: { indexAxis: 'y', maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } } }, onClick: (e, activeEls) => { if (activeEls.length > 0) { const index = activeEls[0].index; const machineCode = labels[index]; closeSubModal(); showMachineDetails(machineCode, { view: 'day', year: year, month: month }); } }, onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default' }
        });
    }
    document.getElementById('sub-modal').classList.add('show');
}
function closeSubModal() { document.getElementById('sub-modal').classList.remove('show'); if (subModalChartInstance) { subModalChartInstance.destroy(); subModalChartInstance = null; } }

function printQRCodes() {
    const searchText = document.getElementById('machine-search').value.toLowerCase().trim();
    const filterType = document.getElementById('machine-type-filter').value;
    const filtered = appData.alerts.all.filter(item => { return (!searchText || (item.info['รหัส']||'').toLowerCase().includes(searchText)) && (!filterType || (item.info['ประเภทรถ'] === filterType)); });
    if (filtered.length === 0) { alert('ไม่พบข้อมูลที่จะพิมพ์'); return; }
    if (filtered.length > 50 && !confirm(`ต้องการพิมพ์ QR Code จำนวน ${filtered.length} รายการ?`)) return;
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`<html><head><title>Print QR Codes</title><style>body { font-family: sans-serif; padding: 20px; } .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; } .qr-item { border: 1px solid #ccc; padding: 10px; text-align: center; page-break-inside: avoid; border-radius: 8px; } .qr-img { width: 100px; height: 100px; } .qr-code { font-weight: bold; margin-top: 5px; font-size: 14px; } .qr-name { font-size: 12px; color: #666; } @media print { .no-print { display: none; } }</style></head><body><div class="no-print" style="margin-bottom: 20px;"><button onclick="window.print()">พิมพ์ (Print)</button><button onclick="window.close()">ปิด (Close)</button></div><div class="qr-grid">${filtered.map(item => `<div class="qr-item"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.info['รหัส'])}" class="qr-img"><div class="qr-code">${item.info['รหัส']}</div><div class="qr-name">${item.info['ทะเบียน']||''}</div></div>`).join('')}</div></body></html>`);
    printWindow.document.close();
}

function openQRScanner() {
    document.getElementById('qr-modal').classList.add('show');
    if(!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, (decodedText) => { closeQRModal(); const m = appData.machines.find(m => m['รหัส'] === decodedText); if(m) showMachineDetails(decodedText); else alert(`ไม่พบข้อมูลเครื่องจักร: ${decodedText}`); })
    .catch(err => { console.error("Error", err); alert("ไม่สามารถเปิดกล้องได้: " + err); closeQRModal(); });
}
function closeQRModal() { if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().then(() => document.getElementById('qr-modal').classList.remove('show')); } else { document.getElementById('qr-modal').classList.remove('show'); } }