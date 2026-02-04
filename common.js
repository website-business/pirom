const SHEET_URLS = {
    machines: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=0&single=true&output=csv',
    fuel: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=700157187&single=true&output=csv',
    maintenance: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=1964968763&single=true&output=csv'
};

const CACHE_KEY = 'machinery_data_v4'; // เปลี่ยน key เพื่อบังคับโหลดใหม่
const CACHE_DURATION = 5 * 60 * 1000; 

// คืนค่า appData ให้มีโครงสร้าง alerts ตามเดิม (สำหรับ Dashboard)
let appData = { machines: [], fuel: [], maintenance: [], alerts: { expired: [], warning: [], all: [] } };

// --- Chart Defaults ---
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Bai Jamjuree', sans-serif";
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
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
    // 1. Check Cache
    try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            // เช็คว่าแคชยังไม่หมดอายุและมีข้อมูลอยู่จริง
            if (new Date().getTime() - timestamp < CACHE_DURATION && data.machines && data.machines.length > 0) {
                console.log("Using cached data");
                appData = data;
                if (onSuccess) onSuccess();
                return;
            }
        }
    } catch (e) {
        console.warn("Cache corrupted, reloading...");
        sessionStorage.removeItem(CACHE_KEY);
    }

    // 2. Fetch New
    try {
        if (typeof Papa === 'undefined') throw new Error("PapaParse library not loaded");

        // เพิ่ม timestamp เพื่อป้องกัน cache ของ browser และ redirect: 'follow'
        const fetchOptions = { redirect: 'follow' };
        const getUrl = (url) => `${url}&t=${new Date().getTime()}`;

        const responses = await Promise.all([
            fetch(getUrl(SHEET_URLS.machines), fetchOptions),
            fetch(getUrl(SHEET_URLS.fuel), fetchOptions),
            fetch(getUrl(SHEET_URLS.maintenance), fetchOptions)
        ]);

        // Check for HTTP Errors
        for (const r of responses) {
            if (!r.ok) throw new Error(`HTTP Error: ${r.status}`);
        }

        const [mText, fText, maText] = await Promise.all(responses.map(r => r.text()));

        // เช็คว่าข้อมูลที่ได้มาไม่ใช่หน้า Login ของ Google (กรณีไม่ได้เปิด Public)
        if (mText.includes("<!DOCTYPE html") || fText.includes("<!DOCTYPE html")) {
            throw new Error("สิทธิ์การเข้าถึงถูกปฏิเสธ (กรุณาตรวจสอบการแชร์ Google Sheet เป็น 'Publish to web')");
        }

        appData.machines = cleanCSV(Papa.parse(mText, { header: true, skipEmptyLines: true }).data);
        appData.fuel = cleanCSV(Papa.parse(fText, { header: true, skipEmptyLines: true }).data);
        appData.maintenance = cleanCSV(Papa.parse(maText, { header: true, skipEmptyLines: true }).data);

        // Validate Data
        if (!appData.machines.length || !appData.fuel.length) {
            throw new Error("ไม่พบข้อมูลในไฟล์ CSV (Empty Data)");
        }

        // Standardize Keys
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

        // Sort Data
        appData.fuel.sort((a, b) => { const da = parseDate(a['วันที่']); const db = parseDate(b['วันที่']); return (da && db) ? da - db : 0; });

        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: new Date().getTime(), data: appData }));
        
        if (onSuccess) onSuccess();

    } catch (e) {
        console.error("Load Failed", e);
        sessionStorage.removeItem(CACHE_KEY); // Clear bad cache
        alert(`เกิดข้อผิดพลาด: ${e.message}\nกรุณาตรวจสอบอินเทอร์เน็ต หรือตั้งค่า Google Sheet เป็น 'Publish to web'`);
        // Hide loader even on error
        const loader = document.getElementById('loading');
        if(loader) loader.style.display = 'none';
    }
}