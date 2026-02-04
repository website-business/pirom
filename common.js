// --- Configuration & Shared Data ---
const SHEET_URLS = {
    machines: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=0&single=true&output=csv',
    fuel: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=700157187&single=true&output=csv',
    maintenance: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=1964968763&single=true&output=csv'
};

let appData = { machines: [], fuel: [], maintenance: [], alerts: { expired: [], warning: [], all: [] } };

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
        
        // Handle Maintenance
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

        // Normalize Fuel
        appData.fuel.forEach(row => {
            const valKey = Object.keys(row).find(k => k.includes('ปริมาณ') || k.includes('ลิตร') || k.toLowerCase().includes('fuel') || k.toLowerCase().includes('qty'));
            if (valKey) row['ปริมาณ(ลิตร)'] = row[valKey];
            const projKey = Object.keys(row).find(k => k.includes('โครงการ'));
            if (projKey) row['โครงการ'] = row[projKey];
            const machineKey = Object.keys(row).find(k => k.includes('รหัสรถ') || k.includes('รหัส') || k.toLowerCase().includes('machine') || k.toLowerCase().includes('code'));
            if(machineKey) row['รหัสรถ'] = row[machineKey];
        });

        // Normalize Machines
        appData.machines.forEach(row => {
            const machineKey = Object.keys(row).find(k => k === 'รหัส' || k.includes('รหัส') || k.toLowerCase().includes('machine') || k.toLowerCase().includes('code'));
            if(machineKey && machineKey !== 'รหัส') row['รหัส'] = row[machineKey];
        });

        if(!appData.machines.length || !appData.fuel.length) throw new Error("Empty Data");

        // Sort Data
        appData.fuel.sort((a, b) => { const da = parseDate(a['วันที่']); const db = parseDate(b['วันที่']); return (da && db) ? da - db : 0; });
        appData.maintenance.sort((a, b) => { const da = parseDate(a['วันที่']); const db = parseDate(b['วันที่']); return (da && db) ? da - db : 0; });

        if(onSuccess) onSuccess();

    } catch (error) {
        console.error("Critical Load Error:", error);
        if(document.getElementById('loading-text')) {
            document.getElementById('loading-text').innerText = "เชื่อมต่อล้มเหลว...";
            document.getElementById('loading-text').classList.add('text-red-500');
            document.getElementById('btn-retry').classList.remove('hidden');
        }
    }
}