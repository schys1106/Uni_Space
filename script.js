/* =====================================================
   UNISPACE — CORE APPLICATION LOGIC (Vanilla JS)
   ===================================================== */

const TIME_SLOTS = [
  "8:00 AM - 9:00 AM",
  "9:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 1:00 PM",
  "1:00 PM - 2:00 PM",
  "2:00 PM - 3:00 PM",
  "3:00 PM - 4:00 PM",
  "4:00 PM - 5:00 PM"
];

/* ---------- Build Room Infrastructure ---------- */
function buildRoomData(){
  const rooms = [];
  for(let i = 401; i <= 415; i++){
    rooms.push({ id:"R"+i, number:String(i), floor:4, type:"Theory", capacity:42, equipment:["Projector","42 Seats"] });
  }
  for(let i = 621; i <= 628; i++){
    rooms.push({ id:"R"+i, number:String(i), floor:6, type:"Theory", capacity:42, equipment:["Projector","42 Seats"] });
  }
  for(let i = 601; i <= 610; i++){
    rooms.push({ id:"R"+i, number:String(i), floor:6, type:"Lab", capacity:45, equipment:["45 PCs","AC","Projector"] });
  }
  for(let i = 901; i <= 908; i++){
    rooms.push({ id:"R"+i, number:String(i), floor:9, type:"Theory", capacity:42, equipment:["Projector","42 Seats"] });
  }
  for(let i = 911; i <= 915; i++){
    rooms.push({ id:"R"+i, number:String(i), floor:9, type:"Lab", capacity:45, equipment:["45 PCs","AC","Projector"] });
  }
  for(let i = 1001; i <= 1008; i++){
    rooms.push({ id:"R"+i, number:String(i), floor:10, type:"Theory", capacity:42, equipment:["Projector","42 Seats"] });
  }
  for(let i = 1011; i <= 1015; i++){
    rooms.push({ id:"R"+i, number:String(i), floor:10, type:"Lab", capacity:45, equipment:["45 PCs","AC","Projector"] });
  }
  return rooms;
}

function buildSpecialCells(){
  return [
    { label:"Library", floor:4, note:"Reading Zone" },
    { label:"T601", floor:6, note:"Teacher Room" },
    { label:"T602", floor:6, note:"Teacher Room" },
    { label:"T603", floor:6, note:"Teacher Room" },
    { label:"T901", floor:9, note:"Teacher Room" },
    { label:"T902", floor:9, note:"Teacher Room" },
    { label:"T1001", floor:10, note:"Teacher Room" },
    { label:"T1002", floor:10, note:"Teacher Room" }
  ];
}

const ROOMS = buildRoomData();
const SPECIAL_CELLS = buildSpecialCells();
const ADMIN_PASSCODE = "3613";

let currentCR = null;
let currentBookingRoom = null;
let filteredDate = "";
let filteredSlot = "";
let filteredFloor = "";
let filteredType = "";
let filteredSearch = "";
let adminSearchTerm = "";

/* ---------- LocalStorage Helpers ---------- */
function getUsers(){ return JSON.parse(localStorage.getItem("unispace_users") || "[]"); }
function saveUsers(users){ localStorage.setItem("unispace_users", JSON.stringify(users)); }
function getBookings(){ return JSON.parse(localStorage.getItem("unispace_bookings") || "{}"); }
function saveBookings(bookings){ localStorage.setItem("unispace_bookings", JSON.stringify(bookings)); }
function saveSession(user){ localStorage.setItem("unispace_session", JSON.stringify(user)); }
function getSession(){ const s = localStorage.getItem("unispace_session"); return s ? JSON.parse(s) : null; }
function clearSession(){ localStorage.removeItem("unispace_session"); }

function bookingKey(roomId, date, slot){ return roomId + "_" + date + "_" + slot; }

function getRoomStatus(roomId, date, slot){
  if(!date || !slot) return { status:"available", info:null };
  const bookings = getBookings();
  const record = bookings[bookingKey(roomId, date, slot)];
  if(!record) return { status:"available", info:null };
  if(record.status === "pending") return { status:"pending", info:record };
  if(record.status === "approved") return { status:"booked", info:record };
  return { status:"available", info:null };
}

/* ---------- Bangladeshi Mobile Number Validation ---------- */
function normalizeBDMobile(input){
  let num = input.replace(/[\s\-]/g, "");
  if(num.startsWith("+880")) num = "0" + num.slice(4);
  else if(num.startsWith("880")) num = "0" + num.slice(3);
  return num;
}

function validateBDMobile(input){
  const num = normalizeBDMobile(input);

  // Format: 01 + operator digit (3-9) + 8 more digits = 11 digits
  if(!/^01[3-9]\d{8}$/.test(num)){
    return { valid:false, message:"Enter a valid 11-digit Bangladeshi mobile number (e.g. 01792489611)." };
  }

  const local = num.slice(3); // the 8 digits after the operator code
  const fakeMsg = "This mobile number looks invalid. Please enter your real number.";

  // Reject all-same digits like 01711111111
  if(/^(\d)\1{7}$/.test(local)){
    return { valid:false, message:fakeMsg };
  }

  // Reject simple sequences like 12345678 or 87654321
  if("0123456789".includes(local) || "9876543210".includes(local)){
    return { valid:false, message:fakeMsg };
  }

  // Reject repeating pair patterns like 12121212
  if(/^(\d{2})\1{3}$/.test(local)){
    return { valid:false, message:fakeMsg };
  }

  return { valid:true, number:num };
}

// Allow only digits (and a leading +) while typing in the mobile field
const regMobileInput = document.getElementById("regMobile");
if(regMobileInput){
  regMobileInput.setAttribute("maxlength", "14");
  regMobileInput.setAttribute("inputmode", "tel");
  regMobileInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^\d+]/g, "");
  });
}

function showToast(message){
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

function showAlertBanner(message, type){
  const banner = document.getElementById("alertBanner");
  banner.innerHTML = "";
  const alertEl = document.createElement("div");
  alertEl.className = "alert show " + type;
  alertEl.textContent = message;
  banner.appendChild(alertEl);
  setTimeout(() => alertEl.classList.remove("show"), 4500);
}

/* ---------- Small Modal Control ---------- */
function openModal(id){ document.getElementById(id).classList.add("show"); document.body.classList.add("lock-scroll"); }
function closeModal(id){ document.getElementById(id).classList.remove("show"); document.body.classList.remove("lock-scroll"); }

document.querySelectorAll(".modal-close").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay){ overlay.classList.remove("show"); document.body.classList.remove("lock-scroll"); }
  });
});

/* ---------- Full-Screen Admin Dashboard Control ---------- */
function openAdminDashboard(){
  document.getElementById("adminDashModal").classList.add("show");
  document.body.classList.add("lock-scroll");
}
function closeAdminDashboard(){
  document.getElementById("adminDashModal").classList.remove("show");
  document.body.classList.remove("lock-scroll");
}
document.getElementById("closeAdminDash").addEventListener("click", closeAdminDashboard);

/* ---------- Navbar: hamburger for links, three-dot for account ---------- */
document.getElementById("hamburger").addEventListener("click", () => {
  document.getElementById("navLinks").classList.toggle("show");
});
document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    document.getElementById("navLinks").classList.remove("show");
  });
});
document.getElementById("heroFindBtn").addEventListener("click", () => {
  document.getElementById("roomfinder").scrollIntoView({ behavior:"smooth" });
});
document.getElementById("heroMapBtn").addEventListener("click", () => {
  document.getElementById("floormap").scrollIntoView({ behavior:"smooth" });
});

const accountMenuBtn = document.getElementById("accountMenuBtn");
const accountDropdown = document.getElementById("accountDropdown");
accountMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  accountDropdown.classList.toggle("show");
});
document.addEventListener("click", (e) => {
  if(!accountDropdown.contains(e.target) && e.target !== accountMenuBtn){
    accountDropdown.classList.remove("show");
  }
});

/* ---------- CR Authentication ---------- */
document.getElementById("crAuthBtn").addEventListener("click", () => {
  accountDropdown.classList.remove("show");
  if(currentCR){
    currentCR = null;
    clearSession();
    updateCRButtonUI();
    showToast("You have been logged out.");
  } else {
    openModal("crAuthModal");
  }
});

document.getElementById("tabLogin").addEventListener("click", () => {
  document.getElementById("tabLogin").classList.add("active");
  document.getElementById("tabRegister").classList.remove("active");
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("registerForm").classList.add("hidden");
});
document.getElementById("tabRegister").addEventListener("click", () => {
  document.getElementById("tabRegister").classList.add("active");
  document.getElementById("tabLogin").classList.remove("active");
  document.getElementById("registerForm").classList.remove("hidden");
  document.getElementById("loginForm").classList.add("hidden");
});

document.getElementById("registerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const mobile = document.getElementById("regMobile").value.trim();
  const password = document.getElementById("regPassword").value;
  const batch = document.getElementById("regBatch").value.trim();
  const semester = document.getElementById("regSemester").value.trim();
  const section = document.getElementById("regSection").value.trim();

  const users = getUsers();
  const msgEl = document.getElementById("registerMsg");

  const nameRegex = /^[A-Za-z\s.]+$/;
  if(!nameRegex.test(name)){
    msgEl.textContent = "Full Name should contain only letters (no numbers or symbols).";
    msgEl.className = "form-msg error";
    return;
  }

  // Mobile number validation
  const mobileCheck = validateBDMobile(mobile);
  if(!mobileCheck.valid){
    msgEl.textContent = mobileCheck.message;
    msgEl.className = "form-msg error";
    return;
  }

  if(users.some(u => u.email === email)){
    msgEl.textContent = "An account with this email already exists.";
    msgEl.className = "form-msg error";
    return;
  }

  // Optional: prevent the same mobile number being used twice
  if(users.some(u => u.mobile === mobileCheck.number)){
    msgEl.textContent = "This mobile number is already registered.";
    msgEl.className = "form-msg error";
    return;
  }

  users.push({ name, email, mobile: mobileCheck.number, password, batch, semester, section });
  saveUsers(users);

  msgEl.textContent = "Registration successful! You can now log in.";
  msgEl.className = "form-msg success";
  document.getElementById("registerForm").reset();

  setTimeout(() => {
    document.getElementById("tabLogin").click();
    msgEl.textContent = "";
  }, 1400);
});

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const users = getUsers();
  const msgEl = document.getElementById("loginMsg");

  const user = users.find(u => u.email === email && u.password === password);
  if(!user){
    msgEl.textContent = "Invalid email or password.";
    msgEl.className = "form-msg error";
    return;
  }

  currentCR = user;
  saveSession(user);
  msgEl.textContent = "Login successful!";
  msgEl.className = "form-msg success";
  updateCRButtonUI();

  setTimeout(() => {
    closeModal("crAuthModal");
    document.getElementById("loginForm").reset();
    msgEl.textContent = "";
    showToast("Welcome back, " + user.name + "!");
  }, 900);
});

function updateCRButtonUI(){
  const btn = document.getElementById("crAuthBtn");
  const myBookingsBtn = document.getElementById("myBookingsBtn");
  btn.textContent = currentCR ? ("Hi, " + currentCR.name.split(" ")[0]) : "CR Login";
  myBookingsBtn.style.display = currentCR ? "block" : "none";
}

/* ---------- My Bookings (CR view) ---------- */
document.getElementById("myBookingsBtn").addEventListener("click", () => {
  accountDropdown.classList.remove("show");
  renderMyBookings();
  openModal("myBookingsModal");
});

function renderMyBookings(){
  const tbody = document.getElementById("myBookingsTableBody");
  const noMsg = document.getElementById("noMyBookingsMsg");
  tbody.innerHTML = "";
  if(!currentCR) return;

  const bookings = getBookings();
  const myEntries = Object.values(bookings).filter(rec => rec.crEmail === currentCR.email);

  if(myEntries.length === 0){ noMsg.classList.remove("hidden"); } else { noMsg.classList.add("hidden"); }

  myEntries.forEach(rec => {
    const tr = document.createElement("tr");
    let badgeClass = "status-pending", badgeText = "Pending";
    if(rec.status === "approved"){ badgeClass = "status-booked"; badgeText = "Approved"; }
    tr.innerHTML = `
      <td>${rec.roomNumber}</td>
      <td>${rec.date}</td>
      <td>${rec.slot}</td>
      <td>${rec.course}</td>
      <td>${rec.teacher}</td>
      <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
      <td>${rec.approvedBy ? rec.approvedBy : "&mdash;"}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Admin Authentication ---------- */
document.getElementById("adminBtn").addEventListener("click", () => {
  accountDropdown.classList.remove("show");
  openModal("adminPassModal");
});

document.getElementById("adminPassForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("adminPassInput").value.trim();
  const msgEl = document.getElementById("adminPassMsg");

  if(input === ADMIN_PASSCODE){
    msgEl.textContent = "";
    document.getElementById("adminPassForm").reset();
    closeModal("adminPassModal");
    renderAdminDashboard();
    openAdminDashboard();
  } else {
    msgEl.textContent = "Incorrect passcode. Please try again.";
    msgEl.className = "form-msg error";
  }
});

/* ---------- Admin Tabs ---------- */
document.querySelectorAll(".admin-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".admin-tab-panel").forEach(p => p.classList.add("hidden"));
    document.getElementById("tabPanel" + capitalize(btn.dataset.tab)).classList.remove("hidden");
  });
});
function capitalize(str){ return str.charAt(0).toUpperCase() + str.slice(1); }

document.getElementById("adminPendingSearch").addEventListener("input", (e) => {
  adminSearchTerm = e.target.value.trim().toLowerCase();
  renderAdminPendingTable();
});

/* ---------- Render Full Admin Dashboard ---------- */
function renderAdminDashboard(){
  const users = getUsers();
  document.getElementById("adminTotalRooms").textContent = ROOMS.length;
  document.getElementById("adminCRCount").textContent = users.length;
  renderAdminPendingTable();
  renderApprovedTable();
  renderRoomsOverviewTable();
}

function renderAdminPendingTable(){
  const bookings = getBookings();
  const tbody = document.getElementById("adminTableBody");
  const noMsg = document.getElementById("noPendingMsg");
  tbody.innerHTML = "";

  let pendingEntries = Object.entries(bookings).filter(([key, rec]) => rec.status === "pending");
  document.getElementById("adminPendingCount").textContent = pendingEntries.length;

  if(adminSearchTerm){
    pendingEntries = pendingEntries.filter(([key, rec]) =>
      rec.crName.toLowerCase().includes(adminSearchTerm) ||
      rec.roomNumber.toLowerCase().includes(adminSearchTerm) ||
      rec.course.toLowerCase().includes(adminSearchTerm)
    );
  }

  if(pendingEntries.length === 0){ noMsg.classList.remove("hidden"); } else { noMsg.classList.add("hidden"); }

  pendingEntries.forEach(([key, rec]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.crName}</td>
      <td>${rec.batch}/${rec.semester}/${rec.section}</td>
      <td>${rec.roomNumber}</td>
      <td>${rec.date}</td>
      <td>${rec.slot}</td>
      <td>${rec.course}</td>
      <td>${rec.teacher}</td>
      <td class="action-cell">
        <button class="btn btn-sm btn-approve" data-key="${key}" data-action="approve">Approve</button>
        <button class="btn btn-sm btn-reject" data-key="${key}" data-action="reject">Reject</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => handleAdminAction(btn.dataset.key, btn.dataset.action));
  });
}

function renderApprovedTable(){
  const bookings = getBookings();
  const tbody = document.getElementById("approvedTableBody");
  const noMsg = document.getElementById("noApprovedMsg");
  tbody.innerHTML = "";

  const approvedEntries = Object.values(bookings).filter(rec => rec.status === "approved");
  document.getElementById("adminApprovedCount").textContent = approvedEntries.length;

  if(approvedEntries.length === 0){ noMsg.classList.remove("hidden"); } else { noMsg.classList.add("hidden"); }

  approvedEntries.forEach(rec => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.crName}</td>
      <td>${rec.roomNumber}</td>
      <td>${rec.date}</td>
      <td>${rec.slot}</td>
      <td>${rec.course}</td>
      <td>${rec.teacher}</td>
      <td>${rec.approvedBy ? rec.approvedBy : "&mdash;"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRoomsOverviewTable(){
  const tbody = document.getElementById("roomsOverviewTableBody");
  tbody.innerHTML = "";
  ROOMS.forEach(room => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${room.number}</td>
      <td>${room.floor}</td>
      <td>${room.type}</td>
      <td>${room.capacity}</td>
      <td>${room.equipment.join(", ")}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Approve / Reject Workflow — INSTANT, no extra prompts ---------- */
function handleAdminAction(key, action){
  const bookings = getBookings();
  const rec = bookings[key];
  if(!rec) return;

  if(action === "approve"){
    rec.status = "approved";
    rec.approvedBy = "Teacher / Admin Panel";
    bookings[key] = rec;
    saveBookings(bookings);
    showAlertBanner("Booking for Room " + rec.roomNumber + " has been APPROVED.", "success");
  } else {
    delete bookings[key];
    saveBookings(bookings);
    showAlertBanner("Booking request for Room " + rec.roomNumber + " has been REJECTED.", "error");
  }

  renderAdminDashboard();
  renderRoomGrid();
  renderFloorMap();
  updateSnapshot();
}

/* ---------- Room Finder ---------- */
function populateSlotDropdowns(){
  const filterSlot = document.getElementById("filterSlot");
  const bookSlot = document.getElementById("bookSlot");
  TIME_SLOTS.forEach(slot => {
    const opt1 = document.createElement("option");
    opt1.value = slot; opt1.textContent = slot;
    filterSlot.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = slot; opt2.textContent = slot;
    bookSlot.appendChild(opt2);
  });
}

function renderRoomGrid(){
  const grid = document.getElementById("roomGrid");
  grid.innerHTML = "";

  let visibleRooms = ROOMS.slice();
  if(filteredFloor){ visibleRooms = visibleRooms.filter(r => String(r.floor) === filteredFloor); }
  if(filteredType){ visibleRooms = visibleRooms.filter(r => r.type === filteredType); }
  if(filteredSearch){ visibleRooms = visibleRooms.filter(r => r.number.includes(filteredSearch)); }

  visibleRooms.forEach(room => {
    const statusData = getRoomStatus(room.id, filteredDate, filteredSlot);
    const card = document.createElement("div");
    card.className = "room-card";

    let badgeClass = "status-available", badgeText = "Available";
    if(statusData.status === "pending"){ badgeClass = "status-pending"; badgeText = "Pending Approval"; }
    else if(statusData.status === "booked"){ badgeClass = "status-booked"; badgeText = "Booked"; }

    const equipmentTags = room.equipment.map(eq => `<span class="room-tag">${eq}</span>`).join("");

    let bookingInfoHTML = "";
    let actionButtonHTML = "";

    if(statusData.status === "available"){
      actionButtonHTML = `<button class="btn btn-gold btn-sm" data-book="${room.id}">Book Room</button>`;
    } else if(statusData.info){
      bookingInfoHTML = `<div class="booking-info">Course: ${statusData.info.course}<br>Teacher: ${statusData.info.teacher}${statusData.info.approvedBy ? "<br>Approved by: " + statusData.info.approvedBy : ""}</div>`;
      actionButtonHTML = `<button class="btn btn-outline btn-sm" disabled>Unavailable</button>`;
    } else {
      actionButtonHTML = `<button class="btn btn-outline btn-sm" data-book="${room.id}">Select Date &amp; Slot to Book</button>`;
    }

    card.innerHTML = `
      <div class="room-card-head">
        <div>
          <div class="room-number">Room ${room.number}</div>
          <div class="room-floor-tag">Floor ${room.floor} &middot; ${room.type}</div>
        </div>
        <span class="status-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="room-type">Capacity: ${room.capacity} seats</div>
      <div class="room-tags">${equipmentTags}</div>
      ${bookingInfoHTML}
      <div class="room-card-footer">${actionButtonHTML}</div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll("button[data-book]").forEach(btn => {
    btn.addEventListener("click", () => openBookingModal(btn.dataset.book));
  });

  document.getElementById("statTotalRooms").textContent = ROOMS.length;
  document.getElementById("statLabs").textContent = ROOMS.filter(r => r.type === "Lab").length;
  updateSnapshot();
}

function updateSnapshot(){
  const today = new Date().toISOString().split("T")[0];
  let available = 0, pending = 0, booked = 0;
  ROOMS.forEach(room => {
    let counted = false;
    TIME_SLOTS.forEach(slot => {
      const statusData = getRoomStatus(room.id, today, slot);
      if(statusData.status === "pending"){ pending++; counted = true; }
      else if(statusData.status === "booked"){ booked++; counted = true; }
    });
    if(!counted) available++;
  });
  document.getElementById("snapAvailable").textContent = available;
  document.getElementById("snapPending").textContent = pending;
  document.getElementById("snapBooked").textContent = booked;
}

/* ---------- Apply Filters (rejects expired/past dates) ---------- */
document.getElementById("applyFilterBtn").addEventListener("click", () => {
  const selectedDate = document.getElementById("filterDate").value;
  const today = new Date().toISOString().split("T")[0];

  if(selectedDate && selectedDate < today){
    showToast("Please select a valid date. Expired dates cannot be used for filtering.");
    document.getElementById("filterDate").value = "";
    return;
  }

  filteredSearch = document.getElementById("filterSearch").value.trim();
  filteredDate = selectedDate;
  filteredSlot = document.getElementById("filterSlot").value;
  filteredFloor = document.getElementById("filterFloor").value;
  filteredType = document.getElementById("filterType").value;
  renderRoomGrid();
  renderFloorMap();
});

document.getElementById("resetFilterBtn").addEventListener("click", () => {
  document.getElementById("filterSearch").value = "";
  document.getElementById("filterDate").value = "";
  document.getElementById("filterSlot").value = "";
  document.getElementById("filterFloor").value = "";
  document.getElementById("filterType").value = "";
  filteredSearch = ""; filteredDate = ""; filteredSlot = ""; filteredFloor = ""; filteredType = "";
  renderRoomGrid();
  renderFloorMap();
});

/* ---------- Booking Workflow ---------- */
function openBookingModal(roomId){
  if(!currentCR){
    showToast("Please log in as a CR before booking a room.");
    openModal("crAuthModal");
    return;
  }
  currentBookingRoom = ROOMS.find(r => r.id === roomId);
  document.getElementById("bookingRoomLabel").textContent = currentBookingRoom.number;
  document.getElementById("bookDate").value = filteredDate || "";
  document.getElementById("bookSlot").value = filteredSlot || "";
  openModal("bookingModal");
}

document.getElementById("bookingForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const course = document.getElementById("bookCourseName").value.trim();
  const teacher = document.getElementById("bookTeacherName").value.trim();
  const date = document.getElementById("bookDate").value;
  const slot = document.getElementById("bookSlot").value;
  const msgEl = document.getElementById("bookingMsg");

  if(!date || !slot){
    msgEl.textContent = "Please select both a date and a time slot.";
    msgEl.className = "form-msg error";
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  if(date < today){
    msgEl.textContent = "Please select a valid date. Expired dates cannot be booked.";
    msgEl.className = "form-msg error";
    return;
  }

  const key = bookingKey(currentBookingRoom.id, date, slot);
  const bookings = getBookings();

  if(bookings[key] && bookings[key].status !== "rejected"){
    msgEl.textContent = "This room is no longer available for the selected slot.";
    msgEl.className = "form-msg error";
    return;
  }

  bookings[key] = {
    roomId: currentBookingRoom.id,
    roomNumber: currentBookingRoom.number,
    date, slot, course, teacher,
    crName: currentCR.name,
    crEmail: currentCR.email,
    batch: currentCR.batch,
    semester: currentCR.semester,
    section: currentCR.section,
    status: "pending",
    approvedBy: ""
  };
  saveBookings(bookings);

  msgEl.textContent = "Booking request submitted! Awaiting admin approval.";
  msgEl.className = "form-msg success";

  setTimeout(() => {
    closeModal("bookingModal");
    document.getElementById("bookingForm").reset();
    msgEl.textContent = "";
    showAlertBanner("Booking request for Room " + currentBookingRoom.number + " sent to Admin queue.", "info");
    filteredDate = date;
    filteredSlot = slot;
    document.getElementById("filterDate").value = date;
    document.getElementById("filterSlot").value = slot;
    renderRoomGrid();
    renderFloorMap();
  }, 1000);
});

/* ---------- Floor Map — clickable to book directly ---------- */
function renderFloorMap(){
  const container = document.getElementById("floorMapContainer");
  container.innerHTML = "";
  const floors = [4, 6, 9, 10];

  floors.forEach(floorNum => {
    const floorRooms = ROOMS.filter(r => r.floor === floorNum);
    const floorSpecials = SPECIAL_CELLS.filter(c => c.floor === floorNum);

    const block = document.createElement("div");
    block.className = "floor-block";

    const title = document.createElement("div");
    title.className = "floor-title";
    title.innerHTML = `${floorNum}th Floor <span>(${floorRooms.length} bookable rooms &mdash; tap a green room to book)</span>`;
    block.appendChild(title);

    const cellsWrap = document.createElement("div");
    cellsWrap.className = "floor-cells";

    floorRooms.forEach(room => {
      const statusData = getRoomStatus(room.id, filteredDate, filteredSlot);
      const cell = document.createElement("div");
      let cellClass = "floor-cell";
      let hint = "Book";
      if(statusData.status === "pending"){ cellClass += " cell-pending"; hint = "Pending"; }
      if(statusData.status === "booked"){ cellClass += " cell-booked"; hint = "Booked"; }
      cell.className = cellClass;
      cell.innerHTML = `${room.number}<small>${room.type}</small><span class="cell-hint">${hint}</span>`;
      cell.addEventListener("click", () => handleFloorMapClick(room.id, statusData.status));
      cellsWrap.appendChild(cell);
    });

    floorSpecials.forEach(sp => {
      const cell = document.createElement("div");
      cell.className = "floor-cell cell-special";
      cell.innerHTML = `${sp.label}<small>${sp.note}</small>`;
      cellsWrap.appendChild(cell);
    });

    block.appendChild(cellsWrap);
    container.appendChild(block);
  });
}

function handleFloorMapClick(roomId, status){
  if(status !== "available"){
    showToast("This room is not available for the currently selected date & slot.");
    return;
  }
  if(!filteredDate || !filteredSlot){
    showToast("Pick a Date and Time Slot in Room Finder first, then tap a room here.");
    document.getElementById("roomfinder").scrollIntoView({ behavior:"smooth" });
    return;
  }
  openBookingModal(roomId);
}

/* ---------- FAQ Accordion ---------- */
function initFaqAccordion(){
  document.querySelectorAll(".faq-item").forEach(item => {
    const question = item.querySelector(".faq-question");
    question.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach(i => i.classList.remove("open"));
      if(!isOpen) item.classList.add("open");
    });
  });
}

/* ---------- Initialization ---------- */
function init(){
  populateSlotDropdowns();

  const session = getSession();
  if(session){
    currentCR = session;
    updateCRButtonUI();
  }

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("filterDate").min = today;
  document.getElementById("bookDate").min = today;

  renderRoomGrid();
  renderFloorMap();
  initFaqAccordion();
}

document.addEventListener("DOMContentLoaded", init);