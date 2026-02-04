// --- Configuration ---
Chart.defaults.font.family = "'Bai Jamjuree', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

const SHEET_URLS = {
    machines: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=0&single=true&output=csv',
    fuel: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=700157187&single=true&output=csv',
    maintenance: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=1964968763&single=true&output=csv'
};

let appData = { machines: [], fuel: [], maintenance: [], alerts: { expired: [], warning: [], all: [] } };
let currentGraphMode = 'fuel'; 
let chartState = { trendInstance: null, rankInstance: null, view: 'year', selectedMachine: 'ALL', selectedProject: 'ALL', selectedYear: null, selectedMonth: null, selectedDay: null };
let lastModalType = 'all'; 

// Modal Chart Instances
let modalFuelChartInstance = null;
let modalMaintChartInstance = null;
let modalChartState = { view: 'year', year: null, month: null, machineCode: null }; 
let subModalChartInstance = null; 

// Page Project Chart Instances (New View)
let pageProjectChartInstance = null;
let pageProjectRankInstance = null;
let pageProjectState = { projectName: null, graphMode: 'fuel', view: 'year', year: null, month: null };

let modalProjectChartInstance = null;
let modalProjectRankChartInstance = null;

let html5QrCode = null;

// --- Helpers ---
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

// --- Core Functions ---
function updateChartColors() {
    if(currentGraphMode === 'fuel') updateChart();
    else updateChart();
}

function updateModalUI() {
        const isRoot = modalChartState.view === 'year';
        const btnBack = document.getElementById('btn-modal-drill-back');
        if(btnBack) btnBack.classList.toggle('hidden', isRoot);
}

// --- Navigation ---
function openProjectPage(projName) {
    closeModal();

    // Hide Dashboard, Show Project Page
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-project').classList.remove('hidden');
    
    // Scroll to top
    window.scrollTo(0, 0);

    // Set Data
    document.getElementById('project-page-title').innerText = projName;
    
    // Calc stats
    let totalFuel = 0, totalCost = 0;
    appData.fuel.forEach(f => { if(f['โครงการ'] === projName) totalFuel += parseNumber(f['ปริมาณ(ลิตร)']); });
    appData.maintenance.forEach(m => { if(m['โครงการ'] === projName) totalCost += parseNumber(m['ค่าซ่อมบำรุง']); });
    
    document.getElementById('project-total-fuel').innerText = formatNumber(totalFuel) + " L";
    document.getElementById('project-total-cost').innerText = formatNumber(totalCost) + " ฿";

    // Init State
    pageProjectState = { projectName: projName, graphMode: 'fuel', view: 'year', year: null, month: null };
    
    setTimeout(() => {
        setProjectPageMode('fuel', document.getElementById('btn-proj-mode-fuel'));
    }, 50);
}

function backToDashboard() {
    document.getElementById('view-project').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    
    // Destroy page charts to save memory
    if (pageProjectChartInstance) { pageProjectChartInstance.destroy(); pageProjectChartInstance = null; }
    if (pageProjectRankInstance) { pageProjectRankInstance.destroy(); pageProjectRankInstance = null; }
    
    updateChartColors();
}

function setProjectPageMode(mode, btn) {
    pageProjectState.graphMode = mode;
    
    // Visual Update
    const btnFuel = document.getElementById('btn-proj-mode-fuel');
    const btnMaint = document.getElementById('btn-proj-mode-maint');
    
    // Reset styles
    btnFuel.className = "px-6 py-2 rounded-lg text-sm font-bold transition text-gray-400 hover:text-white";
    btnMaint.className = "px-6 py-2 rounded-lg text-sm font-bold transition text-gray-400 hover:text-white";
    
    // Active style
    if (mode === 'fuel') {
        btnFuel.className = "px-6 py-2 rounded-lg text-sm font-bold transition bg-[var(--crystal-emerald)] text-black shadow-lg shadow-emerald-500/20";
    } else {
        btnMaint.className = "px-6 py-2 rounded-lg text-sm font-bold transition bg-[var(--crystal-purple)] text-black shadow-lg shadow-purple-500/20";
    }
    
    // Reset View
    pageProjectState.view = 'year';
    pageProjectState.year = null;
    pageProjectState.month = null;
    
    updateProjectPageUI();
    updateProjectPageCharts();
}

function updateProjectPageUI() {
        const isRoot = pageProjectState.view === 'year';
        const btnBack = document.getElementById('btn-proj-back-level');
        if(btnBack) btnBack.classList.toggle('hidden', isRoot);

        // Update Breadcrumb
        const breadcrumb = document.getElementById('project-breadcrumb');
        if (pageProjectState.view === 'year') {
            breadcrumb.innerHTML = `<i class="fas fa-calendar-alt"></i> ภาพรวมรายปี`;
        } else if (pageProjectState.view === 'month') {
            breadcrumb.innerHTML = `<i class="fas fa-calendar-day"></i> ปี ${pageProjectState.year}`;
        } else if (pageProjectState.view === 'day') {
            const mName = new Date(pageProjectState.year, pageProjectState.month).toLocaleString('th-TH', { month: 'long' });
            breadcrumb.innerHTML = `<i class="fas fa-clock"></i> ${mName} ${pageProjectState.year}`;
        }
}

function stepBackProjectCharts() {
    if (pageProjectState.view === 'day') {
        pageProjectState.view = 'month';
        pageProjectState.month = null;
    } else if (pageProjectState.view === 'month') {
        pageProjectState.view = 'year';
        pageProjectState.year = null;
    }
    updateProjectPageUI();
    updateProjectPageCharts();
}

function updateProjectPageCharts() {
    renderPageProjectChart();
    renderPageProjectRankChart();
}

// --- Other Functions ---
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
    // Update stats when switching modes
    updateAllStats();
}

function resetChartToYear() { 
    chartState.view = 'year'; 
    chartState.selectedYear = null; 
    chartState.selectedMonth = null; 
    chartState.selectedDay = null; 
    updateChart();
    updateAllStats(); 
}

function goBackLevel() { 
    if (chartState.view === 'single_day') { 
        chartState.view = 'day'; 
        chartState.selectedDay = null; 
    } else if (chartState.view === 'day') { 
        chartState.view = 'month'; 
        chartState.selectedMonth = null; 
    } else if (chartState.view === 'month') { 
        chartState.view = 'year'; 
        chartState.selectedYear = null; 
    } 
    updateChart();
    updateAllStats(); 
}

function setupFuelChart() { 
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
    updateChart(); 
}

// --- Chart Click Handlers (Dashboard) ---
function handleTrendClick(index, labels) {
    if (chartState.view === 'year') {
        chartState.selectedYear = parseInt(labels[index]); 
        chartState.view = 'month'; 
        updateChart(); 
        updateAllStats();
    } else if (chartState.view === 'month') {
        chartState.selectedMonth = index; 
        chartState.view = 'day'; 
        updateChart(); 
        updateAllStats();
    } else if (chartState.view === 'day' || chartState.view === 'single_day') {
            showMainDailyDetail(index + 1);
    }
}

function handleRankClick(index, labels) {
    const machineCode = labels[index];
    let context = { view: 'year' }; 
    if (chartState.view === 'month') { context = { view: 'month', year: chartState.selectedYear }; } 
    else if (chartState.view === 'day' || chartState.view === 'single_day') { context = { view: 'day', year: chartState.selectedYear, month: chartState.selectedMonth }; }
    showMachineDetails(machineCode, context);
}

function showMainDailyDetail(day) {
    const year = chartState.selectedYear;
    const month = chartState.selectedMonth;
    const mode = currentGraphMode;
    
    let dataSource = mode === 'fuel' ? appData.fuel : appData.maintenance;
    let valKey = mode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
    let unit = mode === 'fuel' ? 'L' : '฿';
    let chartColor = mode === 'fuel' ? getCssVar('--crystal-emerald') : getCssVar('--crystal-purple');

    const dailyItems = dataSource.filter(item => {
        const d = parseDate(item['วันที่']);
        if (!d) return false;
        let match = d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        if (chartState.selectedProject !== 'ALL' && item['โครงการ'] !== chartState.selectedProject) match = false;
        if (chartState.selectedMachine !== 'ALL' && item['รหัสรถ'] !== chartState.selectedMachine) match = false;
        return match;
    });

    const dateStr = `${day}/${month+1}/${year}`;
    document.getElementById('sub-modal-title').innerText = `วันที่ ${dateStr}`;
    const container = document.getElementById('sub-modal-body');
    
    if (subModalChartInstance) { subModalChartInstance.destroy(); subModalChartInstance = null; }

    if (dailyItems.length === 0) {
        container.innerHTML = `<div class="text-center text-[var(--text-muted)] py-10">ไม่มีข้อมูลในวันนี้</div>`;
    } else {
        const grouped = {};
        dailyItems.forEach(item => {
            const val = parseFloat(item[valKey]) || 0;
            const machine = item['รหัสรถ'] || 'ไม่ระบุ';
            grouped[machine] = (grouped[machine] || 0) + val;
        });

        const sorted = Object.entries(grouped).sort(([,a], [,b]) => b - a);
        const labels = sorted.map(k => k[0]);
        const data = sorted.map(k => k[1]);

        const dynamicHeight = Math.max(300, labels.length * 40);
        container.innerHTML = `<div style="position: relative; height: ${dynamicHeight}px; width: 100%;"><canvas id="subModalChart"></canvas></div>`;

        const ctx = document.getElementById('subModalChart').getContext('2d');
        subModalChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: unit,
                    data: data,
                    backgroundColor: chartColor,
                    borderRadius: 6,
                    barPercentage: 0.6
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } }
                },
                onClick: (e, activeEls) => {
                    if (activeEls.length > 0) {
                        const index = activeEls[0].index;
                        const machineCode = labels[index];
                        closeSubModal();
                        showMachineDetails(machineCode, { view: 'day', year: year, month: month });
                    }
                },
                onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
            }
        });
    }
    document.getElementById('sub-modal').classList.add('show');
}

function closeSubModal() {
    document.getElementById('sub-modal').classList.remove('show');
    if (subModalChartInstance) { subModalChartInstance.destroy(); subModalChartInstance = null; }
}

function showProjectDailyList(dayIndex) {
    const day = dayIndex + 1;
    const year = pageProjectState.year;
    const month = pageProjectState.month;
    const project = pageProjectState.projectName;
    const mode = pageProjectState.graphMode; 
    
    let dataSource = mode === 'fuel' ? appData.fuel : appData.maintenance;
    let valKey = mode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
    let unit = mode === 'fuel' ? 'L' : '฿';
    let chartColor = mode === 'fuel' ? getCssVar('--crystal-emerald') : getCssVar('--crystal-purple');

    // Filter
    const dailyItems = dataSource.filter(item => {
        const d = parseDate(item['วันที่']);
        if (!d) return false;
        let match = d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        if (project) match = match && item['โครงการ'] === project;
        return match;
    });
    
    const dateStr = `${day}/${month+1}/${year}`;
    document.getElementById('sub-modal-title').innerText = `รายละเอียดวันที่ ${dateStr}`;
    const container = document.getElementById('sub-modal-body');
    
    if (subModalChartInstance) { subModalChartInstance.destroy(); subModalChartInstance = null; }

    if (dailyItems.length === 0) {
        container.innerHTML = `<div class="text-center text-[var(--text-muted)] py-10">ไม่มีข้อมูลในวันนี้</div>`;
    } else {
        const grouped = {};
        dailyItems.forEach(item => {
            const val = parseFloat(item[valKey]) || 0;
            const machine = item['รหัสรถ'] || 'ไม่ระบุ';
            grouped[machine] = (grouped[machine] || 0) + val;
        });
        const sorted = Object.entries(grouped).sort(([,a], [,b]) => b - a);
        const labels = sorted.map(k => k[0]);
        const data = sorted.map(k => k[1]);
        const dynamicHeight = Math.max(300, labels.length * 40);
        container.innerHTML = `<div style="position: relative; height: ${dynamicHeight}px; width: 100%;"><canvas id="subModalChart"></canvas></div>`;
        const ctx = document.getElementById('subModalChart').getContext('2d');
        subModalChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: unit,
                    data: data,
                    backgroundColor: chartColor,
                    borderRadius: 6,
                    barPercentage: 0.6
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } }
                },
                onClick: (e, activeEls) => {
                    if (activeEls.length > 0) {
                        const index = activeEls[0].index;
                        const machineCode = labels[index];
                        closeSubModal();
                        showMachineDetails(machineCode, { view: 'day', year: year, month: month });
                    }
                },
                onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
            }
        });
    }
    document.getElementById('sub-modal').classList.add('show');
}

function openModal(type) {
    cleanupModalCharts();
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
            <div onclick="openProjectPage('${p.name}')" class="border border-white/10 bg-white/5 p-4 mb-3 hover:border-[var(--crystal-cyan)] hover:bg-white/10 transition rounded-xl cursor-pointer group backdrop-blur-sm">
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

function closeModal() { cleanupModalCharts(); document.getElementById('modal').classList.remove('show'); }

function showMachineDetails(code, ctx={}) { 
        const machine = appData.machines.find(m => m['รหัส'] === code);
        if (!machine) return;
        openModal('none'); 
        document.getElementById('modal-title').innerText = `รหัส: ${code}`;
        document.getElementById('modal-filter-bar').classList.add('hidden');
        
        modalChartState = { machineCode: code, view: ctx.view || 'year', year: ctx.year!==undefined?ctx.year:null, month: ctx.month!==undefined?ctx.month:null };
        
        // --- NEW LOGIC FOR DYNAMIC STATUS ---
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
        // --- END NEW LOGIC ---

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
                        <div>
                            <span class="block ${taxSt.label} text-xs mb-1 font-bold">วันครบกำหนดภาษี</span> 
                            <div class="font-bold ${taxSt.color}">${machine['วันที่ทะเบียนขาด'] || '-'} <span class="text-xs opacity-80">${taxSt.status}</span></div>
                        </div>
                        <div>
                            <span class="block ${insSt.label} text-xs mb-1 font-bold">วันครบกำหนดประกัน</span> 
                            <div class="font-bold ${insSt.color}">${machine['วันที่ประกัน+พรบ.ขาด'] || '-'} <span class="text-xs opacity-80">${insSt.status}</span></div>
                        </div>
                    </div>
                    </div>
            </div>
            <div class="bg-white/5 p-5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-white font-bold flex items-center gap-2"><i class="fas fa-chart-line text-[var(--crystal-amber)]"></i> สถิติการใช้งาน</h4>
                        <button onclick="resetModalChartToYear()" class="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded-full transition">รีเซ็ต</button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><h5 class="text-[var(--crystal-emerald)] text-xs font-bold mb-2 uppercase">FUEL USAGE <span id="val-modal-fuel" class="text-white ml-2"></span></h5><div class="h-48 relative"><canvas id="modalFuelChart"></canvas></div></div>
                        <div><h5 class="text-[var(--crystal-purple)] text-xs font-bold mb-2 uppercase">MAINTENANCE <span id="val-modal-maint" class="text-white ml-2"></span></h5><div class="h-48 relative"><canvas id="modalMaintChart"></canvas></div></div>
                    </div>
            </div>
        </div>`;
        setTimeout(() => { updateModalCharts(); }, 100);
}

function cleanupModalCharts() {
    if (modalFuelChartInstance) { modalFuelChartInstance.destroy(); modalFuelChartInstance = null; }
    if (modalMaintChartInstance) { modalMaintChartInstance.destroy(); modalMaintChartInstance = null; }
    if (modalProjectChartInstance) { modalProjectChartInstance.destroy(); modalProjectChartInstance = null; }
    if (modalProjectRankChartInstance) { modalProjectRankChartInstance.destroy(); modalProjectRankChartInstance = null; }
}
function switchAlertTab(t) { renderAlertList(t); }
function renderAlertList(t) { 
    const container = document.getElementById('alert-list-container');
    const list = t==='expired' ? appData.alerts.expired : appData.alerts.warning;
    if(list.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 py-6">ไม่พบรายการ</div>`;
        return;
    }
    container.innerHTML = list.map(item => `
        <div onclick="showMachineDetails('${item.info['รหัส']}')" class="bg-white/5 border-l-4 ${t==='expired'?'border-red-500':'border-yellow-500'} p-3 mb-2 rounded-xl shadow-lg cursor-pointer hover:bg-white/10 transition backdrop-blur-sm">
            <div class="flex justify-between">
                <span class="font-bold text-white">${item.info['รหัส']}</span>
                <span class="text-xs text-gray-400">${item.info['ทะเบียน']}</span>
            </div>
            ${t==='expired' ? item.expiredIssues.map(i=>`<div class="text-xs text-red-400 mt-1">• ${i}</div>`).join('') : item.warningIssues.map(i=>`<div class="text-xs text-yellow-400 mt-1">• ${i}</div>`).join('')}
        </div>
    `).join('');
}

// --- Modal Chart Logic ---

function updateModalCharts() {
    if(!document.getElementById('modalFuelChart')) return;
    renderModalFuelChart();
    renderModalMaintChart();
}

function renderModalFuelChart() { renderSyncedModalChart('fuel', 'modalFuelChart', 'val-modal-fuel'); }
function renderModalMaintChart() { renderSyncedModalChart('maint', 'modalMaintChart', 'val-modal-maint'); }

function renderSyncedModalChart(type, canvasId, valId) {
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
        
        // Update Title/Val
        if(document.getElementById(valId)) document.getElementById(valId).innerText = `${formatNumber(total)} ${unit}`;
        
        const chartVar = type === 'fuel' ? modalFuelChartInstance : modalMaintChartInstance;
        if (chartVar) chartVar.destroy();
        
        const ctx = document.getElementById(canvasId).getContext('2d');
        const chart = new Chart(ctx, {
            type: 'bar', 
            data: { 
            labels: labels, 
            datasets: [{ 
                label: unit, 
                data: data, 
                backgroundColor: color, 
                borderRadius: 4,
                barThickness: 'flex',
                maxBarThickness: 30
            }] 
            },
            options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } }, 
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 9 } } } 
            },
            onClick: (e, activeEls) => { 
                if (activeEls.length > 0) { 
                    const index = activeEls[0].index; 
                    if (modalChartState.view === 'year') { 
                        modalChartState.year = parseInt(labels[index]); 
                        modalChartState.view = 'month'; 
                        updateModalCharts(); 
                    } else if (modalChartState.view === 'month') { 
                        modalChartState.month = index; 
                        modalChartState.view = 'day'; 
                        updateModalCharts(); 
                    } 
                } 
            }
            }
        });
        
        if (type === 'fuel') modalFuelChartInstance = chart; else modalMaintChartInstance = chart;
}

// --- Project Page Charts ---
function renderPageProjectChart() {
    // Trend Chart
    const ctx = document.getElementById('pageProjectChart').getContext('2d');
    if (pageProjectChartInstance) pageProjectChartInstance.destroy();

    let dataSource = pageProjectState.graphMode === 'fuel' ? appData.fuel : appData.maintenance;
    let valKey = pageProjectState.graphMode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
    let color = pageProjectState.graphMode === 'fuel' ? getCssVar('--crystal-emerald') : getCssVar('--crystal-purple');

    dataSource = dataSource.filter(item => item['โครงการ'] === pageProjectState.projectName);

    let labels = [], data = [];
    const filterAndSum = (groupFn) => {
        const grouped = {};
        dataSource.forEach(item => {
                const d = parseDate(item['วันที่']); 
                if (!d) return;
                // View Filtering
                if (pageProjectState.view === 'month' && d.getFullYear() !== pageProjectState.year) return;
                if (pageProjectState.view === 'day' && (d.getFullYear() !== pageProjectState.year || d.getMonth() !== pageProjectState.month)) return;
                
                const val = parseFloat(item[valKey]) || 0;
                const key = groupFn(d);
                if (key !== null) grouped[key] = (grouped[key] || 0) + val;
        });
        return grouped;
    }

    if (pageProjectState.view === 'year') {
        const d = filterAndSum((date) => date.getFullYear());
        labels = Object.keys(d).sort(); data = labels.map(k => d[k]);
    } else if (pageProjectState.view === 'month') {
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const d = filterAndSum((date) => date.getMonth());
        labels = months; data = new Array(12).fill(0).map((_, i) => d[i] || 0);
    } else if (pageProjectState.view === 'day') {
        const daysInMonth = new Date(pageProjectState.year, pageProjectState.month + 1, 0).getDate();
        const d = filterAndSum((date) => date.getDate());
        labels = Array.from({length: daysInMonth}, (_, i) => i + 1); data = labels.map(k => d[k] || 0);
    }

    pageProjectChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: pageProjectState.graphMode,
                data: data,
                backgroundColor: color,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: true, ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
                y: { display: true, ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            onClick: (e, activeEls) => {
                if (activeEls.length > 0) {
                    const index = activeEls[0].index;
                    if (pageProjectState.view === 'year') {
                        pageProjectState.year = parseInt(labels[index]);
                        pageProjectState.view = 'month';
                        updateProjectPageUI();
                        updateProjectPageCharts();
                    } else if (pageProjectState.view === 'month') {
                        pageProjectState.month = index;
                        pageProjectState.view = 'day';
                        updateProjectPageUI();
                        updateProjectPageCharts();
                    } else if (pageProjectState.view === 'day') {
                        showProjectDailyList(index);
                    }
                }
            },
            onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
        }
    });
}

function renderPageProjectRankChart() {
        const ctx = document.getElementById('pageProjectRankChart').getContext('2d');
        if (pageProjectRankInstance) pageProjectRankInstance.destroy();
        
        let dataSource = pageProjectState.graphMode === 'fuel' ? appData.fuel : appData.maintenance;
        let valKey = pageProjectState.graphMode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
        let color = pageProjectState.graphMode === 'fuel' ? '#fbbf24' : '#f87171'; // Amber/Rose
        
        dataSource = dataSource.filter(item => item['โครงการ'] === pageProjectState.projectName);

        // Filter by time context
        dataSource = dataSource.filter(item => {
            const d = parseDate(item['วันที่']);
            if (!d) return false;
            if (pageProjectState.view === 'month' && d.getFullYear() !== pageProjectState.year) return false;
            if (pageProjectState.view === 'day' && (d.getFullYear() !== pageProjectState.year || d.getMonth() !== pageProjectState.month)) return false;
            return true;
        });

        const grouped = {};
        dataSource.forEach(item => {
            const val = parseFloat(item[valKey]) || 0;
            const key = item['รหัสรถ'];
            if (key) grouped[key] = (grouped[key] || 0) + val;
        });

        const sorted = Object.entries(grouped).sort(([,a], [,b]) => b - a).slice(0, 10);
        const labels = sorted.map(k => k[0]);
        const data = sorted.map(k => k[1]);

        pageProjectRankInstance = new Chart(ctx, {
            type: 'bar', 
            data: { labels: labels, datasets: [{ label: 'Top 10', data: data, backgroundColor: color, borderRadius: 6 }] },
            options: { 
                indexAxis: 'y', 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                scales: { 
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: {size: 9} } }, 
                    y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } } 
                },
                // Click on Rank bar -> Go to machine detail with CURRENT CONTEXT
                onClick: (e, activeEls) => { 
                    if(activeEls.length > 0) {
                        const index = activeEls[0].index;
                        const machineCode = labels[index];
                        showMachineDetails(machineCode, { 
                            view: pageProjectState.view,
                            year: pageProjectState.year,
                            month: pageProjectState.month
                        }); 
                    }
                },
                onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
            }
        });
}

// --- Reset Modal ---
function resetModalChartToYear() {
    modalChartState.view = 'year';
    modalChartState.year = null;
    modalChartState.month = null;
    updateModalUI();
    if (modalChartState.projectName) {
        // Not used in new page flow, but kept for compatibility
    } else {
        updateModalCharts();
    }
}

// --- NEW FUNCTIONS FOR QR & SCANNER ---
function printQRCodes() {
    const searchText = document.getElementById('machine-search').value.toLowerCase().trim();
    const filterType = document.getElementById('machine-type-filter').value;
    
    // Filter based on alerts.all list logic to match view
    const filtered = appData.alerts.all.filter(item => {
        return (!searchText || (item.info['รหัส']||'').toLowerCase().includes(searchText)) && (!filterType || (item.info['ประเภทรถ'] === filterType));
    });

    if (filtered.length === 0) { alert('ไม่พบข้อมูลที่จะพิมพ์'); return; }
    if (filtered.length > 50 && !confirm(`ต้องการพิมพ์ QR Code จำนวน ${filtered.length} รายการ?`)) return;

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Print QR Codes</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; }
                .qr-item { border: 1px solid #ccc; padding: 10px; text-align: center; page-break-inside: avoid; border-radius: 8px; }
                .qr-img { width: 100px; height: 100px; }
                .qr-code { font-weight: bold; margin-top: 5px; font-size: 14px; }
                .qr-name { font-size: 12px; color: #666; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 20px;">
                <button onclick="window.print()">พิมพ์ (Print)</button>
                <button onclick="window.close()">ปิด (Close)</button>
            </div>
            <div class="qr-grid">
                ${filtered.map(item => `
                    <div class="qr-item">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.info['รหัส'])}" class="qr-img">
                        <div class="qr-code">${item.info['รหัส']}</div>
                        <div class="qr-name">${item.info['ทะเบียน']||''}</div>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function openQRScanner() {
    document.getElementById('qr-modal').classList.add('show');
    if(!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        console.error("Error starting scanner", err);
        alert("ไม่สามารถเปิดกล้องได้: " + err);
        closeQRModal();
    });
}

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Scan result: ${decodedText}`, decodedResult);
    closeQRModal();
    // Try to find machine
    const machine = appData.machines.find(m => m['รหัส'] === decodedText);
    if(machine) {
        showMachineDetails(decodedText);
    } else {
        alert(`ไม่พบข้อมูลเครื่องจักร: ${decodedText}`);
    }
}

function closeQRModal() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            document.getElementById('qr-modal').classList.remove('show');
        }).catch(err => console.error(err));
    } else {
        document.getElementById('qr-modal').classList.remove('show');
    }
}

// --- Data Loading ---
async function loadData() {
    const fetchTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000));
    try {
        const [machinesRes, fuelRes, maintRes] = await Promise.race([
            Promise.all([
                fetch(SHEET_URLS.machines).then(r => { if (!r.ok) throw new Error("Net"); return r.text(); }),
                fetch(SHEET_URLS.fuel).then(r => { if (!r.ok) throw new Error("Net"); return r.text(); }),
                fetch(SHEET_URLS.maintenance).then(r => { if (!r.ok) return ""; return r.text(); }).catch(() => "") 
            ]),
            fetchTimeout
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
        appData.fuel.forEach(row => {
            const valKey = Object.keys(row).find(k => k.includes('ปริมาณ') || k.includes('ลิตร') || k.toLowerCase().includes('fuel') || k.toLowerCase().includes('qty'));
            if (valKey) row['ปริมาณ(ลิตร)'] = row[valKey];
            const projKey = Object.keys(row).find(k => k.includes('โครงการ'));
            if (projKey) row['โครงการ'] = row[projKey];
            const machineKey = Object.keys(row).find(k => k.includes('รหัสรถ') || k.includes('รหัส') || k.toLowerCase().includes('machine') || k.toLowerCase().includes('code'));
            if(machineKey) row['รหัสรถ'] = row[machineKey];
        });
        appData.machines.forEach(row => {
                const machineKey = Object.keys(row).find(k => k === 'รหัส' || k.includes('รหัส') || k.toLowerCase().includes('machine') || k.toLowerCase().includes('code'));
                if(machineKey && machineKey !== 'รหัส') row['รหัส'] = row[machineKey];
        });

        if(!appData.machines.length || !appData.fuel.length) throw new Error("Empty Data");
        finalizeLoad();
    } catch (error) {
        console.error("Critical Load Error:", error);
        document.getElementById('loading-text').innerText = "เชื่อมต่อล้มเหลว...";
        document.getElementById('loading-text').classList.add('text-red-500');
        document.getElementById('btn-retry').classList.remove('hidden');
    }
}

function cleanCSV(data) {
    if (!data || data.length === 0) return [];
    return data.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => { newRow[key.trim()] = row[key] ? row[key].trim() : ""; });
        return newRow;
    });
}

function finalizeLoad() {
    appData.fuel.sort((a, b) => { const da = parseDate(a['วันที่']); const db = parseDate(b['วันที่']); return (da && db) ? da - db : 0; });
    appData.maintenance.sort((a, b) => { const da = parseDate(a['วันที่']); const db = parseDate(b['วันที่']); return (da && db) ? da - db : 0; });
    initializeApp();
}

// --- UPDATED STATS FUNCTION TO FIX DATE FILTERING ---
function updateAllStats() {
        let totalCost = 0; 
        let totalFuel = 0; 
        const selectedProj = chartState.selectedProject;
        const selectedMachine = chartState.selectedMachine;

        // Helper to check if date matches current view context
        const isDateInView = (dateStr) => {
            if(!dateStr) return false;
            const d = parseDate(dateStr);
            if(!d) return false;
            
            // View: Year (Show All/Total History for now, OR filter by nothing)
            if(chartState.view === 'year') return true;
            
            // View: Month (Show Total for Selected Year)
            if(chartState.view === 'month') {
                return d.getFullYear() === chartState.selectedYear;
            }
            
            // View: Day (Show Total for Selected Month/Year)
            if(chartState.view === 'day' || chartState.view === 'single_day') {
                return d.getFullYear() === chartState.selectedYear && d.getMonth() === chartState.selectedMonth;
            }
            return true;
        };

        // Calculate Maintenance
        appData.maintenance.forEach(item => {
            if (selectedProj !== 'ALL' && item['โครงการ'] !== selectedProj) return;
            if (selectedMachine !== 'ALL' && item['รหัสรถ'] !== selectedMachine) return;
            
            if (isDateInView(item['วันที่'])) {
            totalCost += parseNumber(item['ค่าซ่อมบำรุง']);
            }
        });

        // Calculate Fuel
        appData.fuel.forEach(item => {
            if (selectedProj !== 'ALL' && item['โครงการ'] !== selectedProj) return;
            if (selectedMachine !== 'ALL' && item['รหัสรถ'] !== selectedMachine) return;

            if (isDateInView(item['วันที่'])) {
            totalFuel += parseNumber(item['ปริมาณ(ลิตร)']);
            }
        });
        
        document.getElementById('total-maintenance').innerText = formatNumber(totalCost);
        document.getElementById('total-fuel').innerText = formatNumber(totalFuel);
        
        // Update Project Count (Global)
        const projects = new Set();
        appData.fuel.forEach(f => { if(f['โครงการ']) projects.add(f['โครงการ']); });
        appData.maintenance.forEach(m => { if(m['โครงการ']) projects.add(m['โครงการ']); });
        document.getElementById('total-projects').innerText = projects.size;
        
        // Dynamic Labels based on context
        let timeLabel = "";
        if (chartState.view === 'month') {
            timeLabel = `(${chartState.selectedYear})`;
        } else if (chartState.view === 'day' || chartState.view === 'single_day') {
            const mName = new Date(chartState.selectedYear, chartState.selectedMonth).toLocaleString('th-TH', { month: 'short' });
            timeLabel = `(${mName} ${String(chartState.selectedYear).slice(-2)})`;
        }

        document.getElementById('label-total-fuel').innerText = `Fuel Usage ${timeLabel}`;
        document.getElementById('label-total-maint').innerText = `Maintenance ${timeLabel}`;
}

function initializeApp() {
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('th-TH');
    document.getElementById('total-machines').innerText = appData.machines.length;
    const selector = document.getElementById('machine-select');
    const codes = [...new Set(appData.machines.map(m => m['รหัส']).filter(c => c))].sort();
    codes.forEach(code => { const opt = document.createElement('option'); opt.value = code; opt.innerText = code; selector.appendChild(opt); });

    updateAllStats();
    updateChartColors();
    processAlerts();
    setupFuelChart();
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').style.display = 'none', 500);
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

function updateChart() { 
    renderTrendChart(); 
    renderRankChart();
}

// --- Render Functions ---

function renderTrendChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (chartState.trendInstance) chartState.trendInstance.destroy();
        
        let dataSource = currentGraphMode === 'fuel' ? appData.fuel : appData.maintenance;
        let valKey = currentGraphMode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
        // Colors for Theme
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
                const d = parseDate(item['วันที่']); 
                if (!d) return;
                if (chartState.view === 'month' && d.getFullYear() !== chartState.selectedYear) return;
                if ((chartState.view === 'day' || chartState.view === 'single_day') && (d.getFullYear() !== chartState.selectedYear || d.getMonth() !== chartState.selectedMonth)) return;
                
                const val = parseNumber(item[valKey]);
                const key = groupFn(d);
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

        // Create Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);

        chartState.trendInstance = new Chart(ctx, {
            type: 'bar', 
            data: { 
                labels: labels, 
                datasets: [{ 
                    label: currentGraphMode === 'fuel' ? 'น้ำมัน' : 'ซ่อมบำรุง', 
                    data: data, 
                    backgroundColor: gradient,
                    borderColor: borderColor,
                    borderWidth: 1,
                    borderRadius: 4,
                }] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    x: { grid: { color: getCssVar('--chart-grid') }, ticks: { color: getCssVar('--text-muted') } }, 
                    y: { grid: { color: getCssVar('--chart-grid') }, ticks: { color: getCssVar('--text-muted') } } 
                },
                onClick: (e, activeEls) => { if(activeEls.length > 0) handleTrendClick(activeEls[0].index, labels); },
                onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
            }
        });
}

function renderRankChart() {
        const ctx = document.getElementById('rankChart').getContext('2d');
        if (chartState.rankInstance) chartState.rankInstance.destroy();
        
        let dataSource = currentGraphMode === 'fuel' ? appData.fuel : appData.maintenance;
        let valKey = currentGraphMode === 'fuel' ? 'ปริมาณ(ลิตร)' : 'ค่าซ่อมบำรุง';
        let color = currentGraphMode === 'fuel' ? '#fbbf24' : '#f87171'; // Amber/Rose
        
        dataSource = dataSource.filter(item => {
            if (chartState.selectedProject !== 'ALL' && item['โครงการ'] !== chartState.selectedProject) return false;
            const d = parseDate(item['วันที่']);
            if (!d) return false;
            if (chartState.view === 'month' && d.getFullYear() !== chartState.selectedYear) return false;
            if ((chartState.view === 'day' || chartState.view === 'single_day') && (d.getFullYear() !== chartState.selectedYear || d.getMonth() !== chartState.selectedMonth)) return false;
            return true;
        });

        const grouped = {};
        dataSource.forEach(item => {
            const val = parseNumber(item[valKey]);
            const key = item['รหัสรถ'];
            if (key) grouped[key] = (grouped[key] || 0) + val;
        });

        const sorted = Object.entries(grouped).sort(([,a], [,b]) => b - a).slice(0, 10);
        const labels = sorted.map(k => k[0]);
        const data = sorted.map(k => k[1]);

        chartState.rankInstance = new Chart(ctx, {
            type: 'bar', 
            data: { labels: labels, datasets: [{ label: 'Top 10', data: data, backgroundColor: color, borderRadius: 6 }] },
            options: { 
                indexAxis: 'y', 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                scales: { 
                    x: { grid: { color: getCssVar('--chart-grid') }, ticks: { color: getCssVar('--text-muted') } }, 
                    y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } } 
                },
                onClick: (e, activeEls) => { if(activeEls.length > 0) handleRankClick(activeEls[0].index, labels); },
                onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
            }
        });
}

loadData();