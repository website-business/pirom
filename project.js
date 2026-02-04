let pageProjectChartInstance = null;
let pageProjectRankInstance = null;
let pageProjectState = { projectName: null, graphMode: 'fuel', view: 'year', year: null, month: null };

window.addEventListener('load', () => {
    loadData(initProjectPage);
});

function initProjectPage() {
    const params = new URLSearchParams(window.location.search);
    const projName = params.get('name');
    
    if (!projName) {
        alert('ไม่พบข้อมูลโครงการ');
        window.location.href = 'index.html';
        return;
    }

    pageProjectState.projectName = decodeURIComponent(projName);
    document.getElementById('project-page-title').innerText = pageProjectState.projectName;

    // Calc stats
    let totalFuel = 0, totalCost = 0;
    appData.fuel.forEach(f => { if(f['โครงการ'] === pageProjectState.projectName) totalFuel += parseNumber(f['ปริมาณ(ลิตร)']); });
    appData.maintenance.forEach(m => { if(m['โครงการ'] === pageProjectState.projectName) totalCost += parseNumber(m['ค่าซ่อมบำรุง']); });
    
    document.getElementById('project-total-fuel').innerText = formatNumber(totalFuel) + " L";
    document.getElementById('project-total-cost').innerText = formatNumber(totalCost) + " ฿";

    // Set Default Mode
    setProjectPageMode('fuel');

    // Hide Loader
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').style.display = 'none', 500);
}

function setProjectPageMode(mode) {
    pageProjectState.graphMode = mode;
    
    // Visual Update
    const btnFuel = document.getElementById('btn-proj-mode-fuel');
    const btnMaint = document.getElementById('btn-proj-mode-maint');
    
    btnFuel.className = "px-6 py-2 rounded-lg text-sm font-bold transition text-gray-400 hover:text-white";
    btnMaint.className = "px-6 py-2 rounded-lg text-sm font-bold transition text-gray-400 hover:text-white";
    
    if (mode === 'fuel') {
        btnFuel.className = "px-6 py-2 rounded-lg text-sm font-bold transition bg-[var(--crystal-emerald)] text-black shadow-lg shadow-emerald-500/20";
    } else {
        btnMaint.className = "px-6 py-2 rounded-lg text-sm font-bold transition bg-[var(--crystal-purple)] text-black shadow-lg shadow-purple-500/20";
    }
    
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

function renderPageProjectChart() {
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
        data: { labels: labels, datasets: [{ label: pageProjectState.graphMode, data: data, backgroundColor: color, borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { display: true, ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } }, y: { display: true, ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } } },
            onClick: (e, activeEls) => {
                if (activeEls.length > 0) {
                    const index = activeEls[0].index;
                    if (pageProjectState.view === 'year') { pageProjectState.year = parseInt(labels[index]); pageProjectState.view = 'month'; updateProjectPageUI(); updateProjectPageCharts(); } 
                    else if (pageProjectState.view === 'month') { pageProjectState.month = index; pageProjectState.view = 'day'; updateProjectPageUI(); updateProjectPageCharts(); }
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
        let color = pageProjectState.graphMode === 'fuel' ? '#fbbf24' : '#f87171';
        
        dataSource = dataSource.filter(item => item['โครงการ'] === pageProjectState.projectName);
        dataSource = dataSource.filter(item => {
            const d = parseDate(item['วันที่']); if (!d) return false;
            if (pageProjectState.view === 'month' && d.getFullYear() !== pageProjectState.year) return false;
            if (pageProjectState.view === 'day' && (d.getFullYear() !== pageProjectState.year || d.getMonth() !== pageProjectState.month)) return false;
            return true;
        });

        const grouped = {};
        dataSource.forEach(item => { const val = parseFloat(item[valKey]) || 0; const key = item['รหัสรถ']; if (key) grouped[key] = (grouped[key] || 0) + val; });
        const sorted = Object.entries(grouped).sort(([,a], [,b]) => b - a).slice(0, 10);
        const labels = sorted.map(k => k[0]); const data = sorted.map(k => k[1]);

        pageProjectRankInstance = new Chart(ctx, {
            type: 'bar', data: { labels: labels, datasets: [{ label: 'Top 10', data: data, backgroundColor: color, borderRadius: 6 }] },
            options: { 
                indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: {size: 9} } }, y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } } }, 
                onClick: (e, activeEls) => { 
                    if(activeEls.length > 0) { 
                        const index = activeEls[0].index; 
                        // HERE IS THE FIX: Call showMachineDetails with current context
                        showMachineDetails(labels[index], { view: pageProjectState.view, year: pageProjectState.year, month: pageProjectState.month }); 
                    } 
                }, 
                onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default' 
            }
        });
}