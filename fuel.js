let charts = {};
let currentFilterMachine = null;
let currentFilterDate = null; // เพิ่มตัวแปรเก็บวันที่ที่เลือก

window.addEventListener('load', () => loadData(initFuelPage));

function initFuelPage() {
    const projects = [...new Set(appData.fuel.map(i => i['โครงการ']).filter(x => x))].sort();
    const select = document.getElementById('project-filter');
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.innerText = p;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => {
        resetFilters();
        renderCharts();
        renderTable();
    });

    renderCharts();
    renderTable();
    document.getElementById('loading').style.display = 'none';
}

function resetFilters() {
    currentFilterMachine = null;
    currentFilterDate = null;
    document.getElementById('filter-badge').classList.add('hidden');
}

function getFilteredData() {
    const proj = document.getElementById('project-filter').value;
    return appData.fuel.filter(row => proj === 'ALL' || row['โครงการ'] === proj);
}

function renderCharts() {
    const data = getFilteredData();
    
    // --- Trend Chart (Yearly) ---
    const yearly = {};
    data.forEach(r => {
        const d = parseDate(r['วันที่']);
        if(d) {
            const y = d.getFullYear(); // ปรับเป็นดูรายปี หรือตามต้องการ
            yearly[y] = (yearly[y] || 0) + parseNumber(r['ปริมาณ(ลิตร)']);
        }
    });
    
    if(charts.trend) charts.trend.destroy();
    charts.trend = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: Object.keys(yearly),
            datasets: [{
                label: 'ปริมาณ (ลิตร)',
                data: Object.values(yearly),
                borderColor: '#34d399',
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                fill: true, tension: 0.4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            // เพิ่มการคลิกที่กราฟเส้น
            onClick: (e, els) => {
                if(els.length > 0) {
                    const idx = els[0].index;
                    const label = Object.keys(yearly)[idx]; // ได้ปีที่กด (เช่น "2025")
                    // เนื่องจากกราฟเป็นรายปี การกดคือการกรองดูปีนั้น
                    // ถ้าอยากให้ละเอียดกว่านี้ ต้องเปลี่ยนกราฟเป็นรายวัน/เดือน
                    // แต่เบื้องต้น ผมจะให้กรองตารางตาม "ปี" ที่กดครับ
                    filterTableByDate(label);
                }
            },
            onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
        }
    });

    // --- Rank Chart (Top 10) ---
    const byMachine = {};
    data.forEach(r => {
        const m = r['รหัสรถ'];
        if(m) byMachine[m] = (byMachine[m] || 0) + parseNumber(r['ปริมาณ(ลิตร)']);
    });
    
    const sorted = Object.entries(byMachine).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    if(charts.rank) charts.rank.destroy();
    charts.rank = new Chart(document.getElementById('rankChart'), {
        type: 'bar',
        data: {
            labels: sorted.map(x => x[0]),
            datasets: [{
                label: 'รวม (ลิตร)',
                data: sorted.map(x => x[1]),
                backgroundColor: '#fbbf24',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, 
            maintainAspectRatio: false,
            onClick: (e, els) => {
                if(els.length > 0) {
                    const idx = els[0].index;
                    const machineCode = sorted[idx][0];
                    filterTableByMachine(machineCode); 
                }
            },
            onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
        }
    });
}

function updateFilterBadge(text) {
    const badge = document.getElementById('filter-badge');
    const badgeName = document.getElementById('filter-name');
    badge.classList.remove('hidden');
    badgeName.innerText = text;
}

function filterTableByMachine(code) {
    currentFilterMachine = code;
    currentFilterDate = null; // Reset date filter when picking machine
    updateFilterBadge(`รหัส: ${code}`);
    renderTable();
    document.getElementById('table-body').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterTableByDate(yearStr) {
    currentFilterDate = yearStr;
    currentFilterMachine = null; // Reset machine filter when picking date
    updateFilterBadge(`ปี: ${yearStr}`);
    renderTable();
    document.getElementById('table-body').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearTableFilter() {
    resetFilters();
    renderTable();
}

function renderTable() {
    let data = getFilteredData();
    
    // กรองตามรหัสรถ (ถ้ามีการกด)
    if (currentFilterMachine) {
        data = data.filter(r => r['รหัสรถ'] === currentFilterMachine);
    }

    // กรองตามปี (ถ้ามีการกดกราฟเส้น)
    if (currentFilterDate) {
        data = data.filter(r => {
            const d = parseDate(r['วันที่']);
            return d && d.getFullYear().toString() === currentFilterDate;
        });
    }

    // เรียงวันที่ล่าสุด
    data.sort((a, b) => parseDate(b['วันที่']) - parseDate(a['วันที่']));

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    document.getElementById('row-count').innerText = `${data.length} รายการ`;

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500">ไม่พบข้อมูล</td></tr>`;
        return;
    }

    // แสดงผล (จำกัด 100 รายการ)
    data.slice(0, 100).forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition border-b border-white/5';
        tr.innerHTML = `
            <td class="p-4">${r['วันที่']}</td>
            <td class="p-4 font-bold text-white">${r['รหัสรถ']}</td>
            <td class="p-4 text-gray-400">${r['โครงการ']}</td>
            <td class="p-4 text-right text-emerald-400 font-mono">${formatNumber(parseNumber(r['ปริมาณ(ลิตร)']))}</td>
        `;
        tbody.appendChild(tr);
    });
}