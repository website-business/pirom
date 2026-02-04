let charts = {};
let currentFilterMachine = null;

window.addEventListener('load', () => loadData(initFuelPage));

function initFuelPage() {
    // 1. สร้างตัวเลือกโครงการ
    const projects = [...new Set(appData.fuel.map(i => i['โครงการ']).filter(x => x))].sort();
    const select = document.getElementById('project-filter');
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.innerText = p;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => {
        clearTableFilter(); // Reset machine filter when project changes
        renderCharts();
        renderTable();
    });

    renderCharts();
    renderTable();
    document.getElementById('loading').style.display = 'none';
}

function getFilteredData() {
    const proj = document.getElementById('project-filter').value;
    // กรองข้อมูลตามโครงการที่เลือก
    return appData.fuel.filter(row => proj === 'ALL' || row['โครงการ'] === proj);
}

function renderCharts() {
    const data = getFilteredData();
    
    // --- Trend Chart (Yearly) ---
    const yearly = {};
    data.forEach(r => {
        const d = parseDate(r['วันที่']);
        if(d) {
            const y = d.getFullYear();
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
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Rank Chart (Top 10) ---
    const byMachine = {};
    data.forEach(r => {
        const m = r['รหัสรถ'];
        if(m) byMachine[m] = (byMachine[m] || 0) + parseNumber(r['ปริมาณ(ลิตร)']);
    });
    
    // Sort and Take Top 10
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
                    // จุดสำคัญ: กดแล้วไปกรองตารางข้างล่าง แทนที่จะเปิด Modal
                    filterTableByMachine(machineCode);
                }
            },
            onHover: (e, els) => e.native.target.style.cursor = els[0] ? 'pointer' : 'default'
        }
    });
}

function filterTableByMachine(code) {
    currentFilterMachine = code;
    document.getElementById('filter-badge').classList.remove('hidden');
    document.getElementById('filter-name').innerText = code;
    renderTable();
    // เลื่อนหน้าจอลงมาที่ตาราง
    document.getElementById('table-body').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearTableFilter() {
    currentFilterMachine = null;
    document.getElementById('filter-badge').classList.add('hidden');
    renderTable();
}

function renderTable() {
    let data = getFilteredData();
    
    // ถ้ามีการกดกราฟ (เลือกเฉพาะรถคันนั้น)
    if (currentFilterMachine) {
        data = data.filter(r => r['รหัสรถ'] === currentFilterMachine);
    }

    // เรียงวันที่ล่าสุดขึ้นก่อน
    data.sort((a, b) => parseDate(b['วันที่']) - parseDate(a['วันที่']));

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    document.getElementById('row-count').innerText = `${data.length} รายการ`;

    // แสดงแค่ 100 รายการแรก กันเครื่องค้าง
    data.slice(0, 100).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r['วันที่']}</td>
            <td class="font-bold text-white">${r['รหัสรถ']}</td>
            <td>${r['โครงการ']}</td>
            <td class="text-right text-emerald-400 font-mono">${formatNumber(parseNumber(r['ปริมาณ(ลิตร)']))}</td>
        `;
        tbody.appendChild(tr);
    });
    
    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500">ไม่พบข้อมูล</td></tr>`;
    }
}