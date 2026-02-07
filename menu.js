document.addEventListener("DOMContentLoaded", function() {
    const navHTML = `
        <div class="navbar">
            <a href="index.html" class="nav-item" id="link-home"><i class="fas fa-home"></i> หน้าหลัก</a>
            <a href="info.html" class="nav-item" id="link-info"><i class="fas fa-truck-monster"></i> ข้อมูลรถ</a>
            <a href="fuel.html" class="nav-item" id="link-fuel"><i class="fas fa-gas-pump"></i> น้ำมัน</a>
            <a href="repair.html" class="nav-item" id="link-repair"><i class="fas fa-tools"></i> ซ่อมบำรุง</a>
        </div>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    const path = window.location.pathname;
    const page = path.split("/").pop();

    if(page === "" || page === "index.html") document.getElementById("link-home").classList.add("active");
    else if(page.includes("info")) document.getElementById("link-info").classList.add("active");
    else if(page.includes("fuel")) document.getElementById("link-fuel").classList.add("active");
    else if(page.includes("repair")) document.getElementById("link-repair").classList.add("active");
});