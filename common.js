const SHEET_URLS = {
    machines: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=0&single=true&output=csv',
    fuel: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=700157187&single=true&output=csv',
    maintenance: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=1964968763&single=true&output=csv'
};

const CACHE_KEY = 'machinery_data_v2';
const CACHE_DURATION = 5 * 60 * 1000; 

let appData = { machines: [], fuel: [], maintenance: [] };

// --- Chart Defaults ---
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Bai Jamjuree', sans-serif";
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
}

// --- Helpers ---
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        let y = parseInt(parts[2]);
        if (y > 2400) y -= 543;
        return new Date(y, parseInt(parts[1])-1, parseInt(parts[0]));
    }
    return new Date(dateStr);
}

function formatNumber(num) { return num.toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
function parseNumber(val) { return parseFloat(String(val).replace(/,/g, '')) || 0; }

function cleanCSV(data) {
    return data.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => newRow[key.trim()] = row[key] ? row[key].trim() : "");
        return newRow;
    });
}

// --- Data Loader ---
async function loadData(onSuccess) {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (new Date().getTime() - timestamp < CACHE_DURATION) {
            appData = data;
            if (onSuccess) onSuccess();
            return;
        }
    }

    try {
        const [mRes, fRes, maRes] = await Promise.all([
            fetch(SHEET_URLS.machines).then(r => r.text()),
            fetch(SHEET_URLS.fuel).then(r => r.text()),
            fetch(SHEET_URLS.maintenance).then(r => r.text())
        ]);

        appData.machines = cleanCSV(Papa.parse(mRes, { header: true, skipEmptyLines: true }).data);
        appData.fuel = cleanCSV(Papa.parse(fRes, { header: true, skipEmptyLines: true }).data);
        appData.maintenance = cleanCSV(Papa.parse(maRes, { header: true, skipEmptyLines: true }).data);

        // Normalize Keys (แก้ปัญหากรณีชื่อคอลัมน์ไม่ตรง)
        const normalize = (list) => {
            list.forEach(row => {
                const findKey = (partial) => Object.keys(row).find(k => k.includes(partial));
                if (!row['รหัสรถ']) row['รหัสรถ'] = row[findKey('รหัส')] || row['Machine Code'];
                if (!row['ปริมาณ(ลิตร)']) row['ปริมาณ(ลิตร)'] = row[findKey('ปริมาณ')] || row[findKey('ลิตร')];
                if (!row['ค่าซ่อมบำรุง']) row['ค่าซ่อมบำรุง'] = row[findKey('ค่าซ่อม')] || row[findKey('Cost')];
                if (!row['โครงการ']) row['โครงการ'] = row[findKey('โครงการ')] || 'N/A';
            });
        };
        
        normalize(appData.machines);
        normalize(appData.fuel);
        normalize(appData.maintenance);

        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: new Date().getTime(), data: appData }));
        if (onSuccess) onSuccess();
    } catch (e) {
        console.error("Load Failed", e);
        alert("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรช");
    }
}