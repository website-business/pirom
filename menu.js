// menu.js - จัดการเมนูอย่างเดียว
document.addEventListener("DOMContentLoaded", function() {
    const navHTML = `
        <a href="index.html" id="link-index">🚜 ข้อมูลเครื่องจักร</a>
        <a href="fuel.html" id="link-fuel">⛽ บันทึกน้ำมัน</a>
        <a href="repair.html" id="link-repair">🔧 บันทึกค่าซ่อม</a>
    `;
    
    document.getElementById('navbar-container').innerHTML = navHTML;

    // ไฮไลท์เมนูของหน้าที่เปิดอยู่
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    if(currentPage.includes("index")) document.getElementById("link-index").classList.add("active");
    if(currentPage.includes("fuel")) document.getElementById("link-fuel").classList.add("active");
    if(currentPage.includes("repair")) document.getElementById("link-repair").classList.add("active");
});