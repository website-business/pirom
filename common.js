// --- Configuration & Shared Data ---
const SHEET_URLS = {
    machines: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=0&single=true&output=csv',
    fuel: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=700157187&single=true&output=csv',
    maintenance: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLxlqlfXntTk-z4x45kGjZ1OjHFnpCeaqjGZGpkfohr3difiJQsI-p-3iZwgyM7UO35kRztltMKgbd/pub?gid=1964968763&single=true&output=csv'
};

const CACHE_KEY = 'machinery_data_v6_fixed_links'; // เปลี่ยน Key เพื่อล้างค่าเก่าและโหลดใหม่ทันที
const CACHE_DURATION = 5 * 60 * 1000; // 5 นาที

let appData = { machines: [], fuel: [], maintenance: [] };

// --- Chart Defaults ---
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
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        let y = parseInt(parts[2]);
        if (y > 2400) y -= 543; // แปลง พ.ศ. เป็น ค.ศ.
        return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr);
}

function formatNumber(num) {
    return num.toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function parseNumber(val) {
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(/,/g, '')) || 0;
}

function cleanCSV(data) {
    return data.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => {
            // ลบช่องว่างหน้าหลังชื่อคอลัมน์
            newRow[key.trim()] = row[key] ? row[key].trim() : "";
        });
        return newRow;
    });
}

// --- Data Loader (Simple Version) ---
async function loadData(onSuccess) {
    // 1. ลองเช็คในเครื่องก่อน (Cache)
    try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            // ถ้าข้อมูลยังไม่เก่าเกิน 5 นาที และมีข้อมูลอยู่จริง
            if (new Date().getTime() - timestamp < CACHE_DURATION && data.machines && data.machines.length > 0) {
                console.log("Using cached data");
                appData = data;
                if (onSuccess) onSuccess();
                return;
            }
        }
    } catch (e) {
        console.warn("Cache error, reloading...");
        sessionStorage.removeItem(CACHE_KEY);
    }

    // 2. ถ้าไม่มีในเครื่อง ให้ไปดึงจาก Google Sheets ใหม่
    try {
        // ใช้ fetch แบบธรรมดาที่สุด
        const [mRes, fRes, maRes] = await Promise.all([
            fetch(SHEET_URLS.machines).then(r => {
                if (!r.ok) throw new Error("โหลดข้อมูลเครื่องจักรไม่ได้ (HTTP Error)");
                return r.text();
            }),
            fetch(SHEET_URLS.fuel).then(r => {
                if (!r.ok) throw new Error("โหลดข้อมูลน้ำมันไม่ได้ (HTTP Error)");
                return r.text();
            }),
            fetch(SHEET_URLS.maintenance).then(r => {
                if (!r.ok) return ""; // ถ้าโหลดซ่อมบำรุงไม่ได้ ให้ข้ามไปก่อน (ไม่ให้เว็บพัง)
                return r.text();
            })
        ]);

        // ตรวจสอบว่าได้ HTML กลับมาแทน CSV หรือไม่ (กรณีสิทธิ์ผิด)
        if (mRes.includes("<!DOCTYPE html") || fRes.includes("<!DOCTYPE html")) {
            throw new Error("ลิงก์ Google Sheet ไม่ได้เป็น CSV (อาจต้องกด File > Share > Publish to web อีกครั้ง)");
        }

        appData.machines = cleanCSV(Papa.parse(mRes, { header: true, skipEmptyLines: true }).data);
        appData.fuel = cleanCSV(Papa.parse(fRes, { header: true, skipEmptyLines: true }).data);
        appData.maintenance = maRes ? cleanCSV(Papa.parse(maRes, { header: true, skipEmptyLines: true }).data) : [];

        // --- ปรับชื่อคอลัมน์ให้ตรงกัน (Normalize Keys) ---
        const normalize = (list) => {
            list.forEach(row => {
                const findKey = (partial) => Object.keys(row).find(k => k.includes(partial));
                
                // จับคู่ชื่อคอลัมน์ (เผื่อใน Sheet พิมพ์ไม่ตรงเป๊ะ)
                if (!row['รหัสรถ']) row['รหัสรถ'] = row[findKey('รหัส')] || row['Machine Code'];
                if (!row['ปริมาณ(ลิตร)']) row['ปริมาณ(ลิตร)'] = row[findKey('ปริมาณ')] || row[findKey('ลิตร')];
                if (!row['ค่าซ่อมบำรุง']) row['ค่าซ่อมบำรุง'] = row[findKey('ค่าซ่อม')] || row[findKey('Cost')];
                if (!row['โครงการ']) row['โครงการ'] = row[findKey('โครงการ')] || 'ไม่ระบุโครงการ';
            });
        };
        
        normalize(appData.machines);
        normalize(appData.fuel);
        normalize(appData.maintenance);

        // ตรวจสอบความถูกต้องข้อมูลขั้นต่ำ
        if (appData.machines.length === 0 || appData.fuel.length === 0) {
            throw new Error("ดึงข้อมูลสำเร็จ แต่ไม่พบรายการในไฟล์ CSV");
        }

        // เรียงลำดับข้อมูลตามวันที่
        appData.fuel.sort((a, b) => { 
            const da = parseDate(a['วันที่']); 
            const db = parseDate(b['วันที่']); 
            return (db || 0) - (da || 0); // ใหม่ -> เก่า
        });

        // 3. บันทึกลงเครื่อง
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ 
            timestamp: new Date().getTime(), 
            data: appData 
        }));

        if (onSuccess) onSuccess();

    } catch (e) {
        console.error("Load Failed:", e);
        sessionStorage.removeItem(CACHE_KEY); // ลบ Cache ที่อาจจะเสีย
        
        // แจ้งเตือนผู้ใช้และปิดหน้าโหลด
        alert(`เกิดข้อผิดพลาด: ${e.message}\nลองรีเฟรชหน้าเว็บอีกครั้ง`);
        const loader = document.getElementById('loading');
        if (loader) loader.style.display = 'none';
    }
}

// Global functions for Modal & QR (คงไว้เพื่อให้ไฟล์อื่นเรียกใช้ได้)
let modalFuelChartInstance = null;
let modalMaintChartInstance = null;
let modalChartState = { view: 'year', year: null, month: null, machineCode: null }; 
let lastModalType = 'all'; 

function openModal(type) {
    // ฟังก์ชันนี้จะถูก Override โดยไฟล์ JS ของแต่ละหน้า (เช่น fuel.js)
    // แต่ถ้าหน้านั้นไม่ได้เขียนทับ จะใช้ Logic พื้นฐานนี้
    console.log("Open Modal Type:", type);
}

function closeModal() { 
    const modal = document.getElementById('modal');
    if(modal) modal.classList.remove('show'); 
}