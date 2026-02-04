let chartState = { trendInstance: null, rankInstance: null, view: 'year', selectedMachine: 'ALL', selectedProject: 'ALL', selectedYear: null, selectedMonth: null, selectedDay: null };
let subModalChartInstance = null;
let html5QrCode = null;

window.addEventListener('load', () => {
    loadData(initDashboard);
});

function initDashboard() {
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('th-TH');
    document.getElementById('total-machines').innerText = appData.machines.length;
    
    const selector = document.getElementById('machine-select');
    const codes = [...new Set(appData.machines.map(m => m['รหัส']).filter(c => c))].sort();
    codes.forEach(code => { const opt = document.createElement('option'); opt.value = code; opt.innerText = code; selector.appendChild(opt); });

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
    
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').style.display = 'none', 500);
}

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
    appData.machines.forEach(machine => {
        const code = machine['รหัส']; if (!code) return;
        const entry = { info: machine, expiredIssues: [], warningIssues: [] };
        
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
        
        appData.alerts.all.push(entry);
        if (entry.expiredIssues.length > 0) appData.alerts.expired.push(entry);
        if (entry.warningIssues.length > 0) appData.alerts.warning.push(entry);
    });
    
    document.getElementById('val-expired').innerText = appData.alerts.expired.length;
    document.getElementById('val-warning').innerText = appData.alerts.warning.length;
}

// Alert Tab Switching (Specific to dashboard modal content)
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

// Open Modal Override for Dashboard specific content (Alerts, Projects)
const _originalOpenModal = window.openModal; 
window.openModal = function(type) {
    _originalOpenModal(type); // Call common one first
    
    const body = document.getElementById('modal-body');
    
    if (type === 'alerts') {
        body.innerHTML = `
            <div class="flex gap-2 mb-4 border-b border-white/10 pb-2">
                <button id="tab-expired" onclick="switchAlertTab('expired')" class="flex-1 py-2 text-sm border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition rounded-xl">หมดอายุ (${appData.alerts.expired.length})</button>
                <button id="tab-warning" onclick="switchAlertTab('warning')" class="flex-1 py-2 text-sm border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition rounded-xl">ใกล้หมด (${appData.alerts.warning.length})</button>
            </div>
            <div id="alert-list-container"></div>
        `;
        setTimeout(() => switchAlertTab('expired'), 0);
    } else if (type === 'project') {
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
    }
}

// ... Rest of Chart Logic (Trend & Rank) similar to before but without Modal logic ...
let currentGraphMode = 'fuel'; 
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
        const d = filterAndSumTrend((date) => date.getFullYear());
        labels = Object.keys(d).sort(); data = labels.map(k => d[k]);
    } else if (chartState.view === 'month') {
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const d = filterAndSumTrend((date) => date.getMonth());
        labels = months; data = new Array(12).fill(0).map((_, i) => d[i] || 0);
    } else if (chartState.view === 'day' || chartState.view === 'single_day') {
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
            onClick: (e, activeEls) => { if(activeEls.length > 0) { const index = activeEls[0].index; showMachineDetails(labels[index], { view: chartState.view, year: chartState.selectedYear, month: chartState.selectedMonth }); } },
            onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
        }
    });
}

// Sub modal and QR functions (Dashboard specific triggers)
function openQRScanner() {
    document.getElementById('qr-modal').classList.add('show');
    if(!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, (decodedText) => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().then(() => document.getElementById('qr-modal').classList.remove('show')); showMachineDetails(decodedText); })
    .catch(err => { console.error("Error", err); alert("ไม่สามารถเปิดกล้องได้: " + err); if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().then(() => document.getElementById('qr-modal').classList.remove('show')); document.getElementById('qr-modal').classList.remove('show'); });
}
function closeQRModal() { if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().then(() => document.getElementById('qr-modal').classList.remove('show')); } else { document.getElementById('qr-modal').classList.remove('show'); } }
function printQRCodes() {
    const searchText = document.getElementById('machine-search').value.toLowerCase().trim();
    const filterType = document.getElementById('machine-type-filter').value;
    const filtered = appData.machines.filter(item => { return (!searchText || (item['รหัส']||'').toLowerCase().includes(searchText)) && (!filterType || (item['ประเภทรถ'] === filterType)); });
    if (filtered.length === 0) { alert('ไม่พบข้อมูลที่จะพิมพ์'); return; }
    if (filtered.length > 50 && !confirm(`ต้องการพิมพ์ QR Code จำนวน ${filtered.length} รายการ?`)) return;
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`<html><head><title>Print QR Codes</title><style>body { font-family: sans-serif; padding: 20px; } .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; } .qr-item { border: 1px solid #ccc; padding: 10px; text-align: center; page-break-inside: avoid; border-radius: 8px; } .qr-img { width: 100px; height: 100px; } .qr-code { font-weight: bold; margin-top: 5px; font-size: 14px; } .qr-name { font-size: 12px; color: #666; } @media print { .no-print { display: none; } }</style></head><body><div class="no-print" style="margin-bottom: 20px;"><button onclick="window.print()">พิมพ์ (Print)</button><button onclick="window.close()">ปิด (Close)</button></div><div class="qr-grid">${filtered.map(item => `<div class="qr-item"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item['รหัส'])}" class="qr-img"><div class="qr-code">${item['รหัส']}</div><div class="qr-name">${item['ทะเบียน']||''}</div></div>`).join('')}</div></body></html>`);
    printWindow.document.close();
}