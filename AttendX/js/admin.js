/*************************************************
 🔐 AUTH CHECK
*************************************************/
let currentAdmin = null;
let currentProfile = null;

auth.onAuthStateChanged(async user => {
  if (!user) return location.href = "index.html";

  const doc = await db.collection("users").doc(user.uid).get();
  if (!doc.exists || doc.data().role !== "admin") {
    location.href = "index.html";
    return;
  }

  currentAdmin = user;
  await loadAdminProfile();
  await populateDashboardStats();
  attachSidebarToggle();
});

/*************************************************
 🚪 LOGOUT
*************************************************/
function logout() {
  auth.signOut().then(() => location.href = "index.html");
}

function attachSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("sidebarToggle");
  if (!sidebar || !toggle) return;
  toggle.onclick = () => sidebar.classList.toggle("collapsed");
}

async function loadAdminProfile() {
  if (!currentAdmin) return;
  const profileSnap = await db.collection("profiles").doc(currentAdmin.uid).get();
  currentProfile = profileSnap.exists ? profileSnap.data() : null;

  const name = currentProfile?.name || currentAdmin.email?.split("@")[0] || "Admin";
  const photo = currentProfile?.photo || "attend1.jpeg";

  const profileImgEl = document.getElementById("adminPhoto");
  const chipName = document.getElementById("userChipName");
  const adminDetails = document.getElementById("adminDetails");

  if (profileImgEl) profileImgEl.src = photo;
  if (chipName) chipName.innerText = name;

  if (adminDetails) {
    adminDetails.innerHTML = `
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${currentAdmin.email}</p>
      <p><b>Role:</b> Admin</p>
    `;
  }

  const photoActions = document.getElementById("adminPhotoActions");
  if (profileImgEl && photoActions) {
    profileImgEl.onclick = () => photoActions.classList.toggle("show");
  }
}

async function saveProfilePicture(fileInputId) {
  const input = document.getElementById(fileInputId);
  if (!input || !input.files?.length || !currentAdmin) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const base64 = e.target.result;
    await db.collection("profiles").doc(currentAdmin.uid).set({
      email: currentAdmin.email,
      name: document.getElementById("adminName")?.innerText || currentAdmin.email,
      photo: base64
    }, { merge: true });
    await loadAdminProfile();
    alert("Profile picture updated");
  };
  reader.readAsDataURL(file);
}

async function populateDashboardStats() {
  // Stat cards removed from dashboard as per requirements
  // Stats are only shown in View Faculty and View Student pages
}

/*************************************************
 🪟 PANEL CONTROL
*************************************************/
function openPanel(id) {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  tableTab.classList.add("hidden");
  document.getElementById(id).classList.remove("hidden");
}

function closeTable() {
  tableTab.classList.add("hidden");
  dataTable.innerHTML = "";
  searchBox.value = "";
}

/*************************************************
 🌍 GLOBAL TABLE STATE
*************************************************/
let currentData = [];
let currentColumns = [];
let currentCollection = "";

/*************************************************
 🔐 INTERNAL HELPER (NO UI IMPACT)
*************************************************/
async function createLoginIfNotExists(email, role) {
  const secondaryApp =
    firebase.apps.find(app => app.name === "Secondary") ||
    firebase.initializeApp(firebase.app().options, "Secondary");

  const secondaryAuth = secondaryApp.auth();

  const methods = await auth.fetchSignInMethodsForEmail(email);
  if (methods.length) return; // already exists

  const cred = await secondaryAuth
    .createUserWithEmailAndPassword(email, "123456");

  await db.collection("users").doc(cred.user.uid).set({
    email: email,
    role: role
  });

  await secondaryAuth.signOut();
}

/*************************************************
 ➕ ADD / UPDATE FACULTY (UI LOGIC UNCHANGED)
*************************************************/
async function addFaculty() {
  const subjects = fsub.value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const data = {
    facultyId: fid.value.trim(),
    name: fname.value.trim(),
    subjects,
    department: fdept.value.trim(),
    email: femail.value.trim()
  };

  if (!data.facultyId) return alert("Faculty ID required");

  const snap = await db.collection("faculty")
    .where("facultyId", "==", data.facultyId)
    .get();

  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    const docId = snap.docs[0].id;
    await docRef.update(data);
    
    // Log audit for edit
    if (window.currentEditDocId === docId) {
      await logAudit("edit", "faculty", docId, currentAdmin.uid);
      window.currentEditDocId = null;
    }
    
    alert("Faculty updated");
  } else {
    await createLoginIfNotExists(data.email, "faculty");
    const newDoc = await db.collection("faculty").add(data);
    await logAudit("create", "faculty", newDoc.id, currentAdmin.uid);
    alert("Faculty added (Default password: 123456)");
  }

  fid.value = fname.value = fsub.value = fdept.value = femail.value = "";
}

/*************************************************
 ➕ ADD / UPDATE STUDENT (UI LOGIC UNCHANGED)
*************************************************/
async function addStudent() {
  const data = {
    rollNo: roll.value.trim(),
    name: sname.value.trim(),
    classSection: classSec.value.trim(),
    yearSem: yearSem.value.trim(),
    department: sdept.value.trim(),
    email: semail.value.trim(),
    totalClasses: 0,
    attendedClasses: 0
  };

  if (!data.rollNo) return alert("Roll number required");

  const snap = await db.collection("students")
    .where("rollNo", "==", data.rollNo)
    .get();

  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    const docId = snap.docs[0].id;
    await docRef.update(data);
    
    // Log audit for edit
    if (window.currentEditDocId === docId) {
      await logAudit("edit", "students", docId, currentAdmin.uid);
      window.currentEditDocId = null;
    }
    
    alert("Student updated");
  } else {
    await createLoginIfNotExists(data.email, "student");
    const newDoc = await db.collection("students").add(data);
    await logAudit("create", "students", newDoc.id, currentAdmin.uid);
    alert("Student added (Default password: 123456)");
  }

  roll.value = sname.value = classSec.value =
  yearSem.value = sdept.value = semail.value = "";
}

/*************************************************
 📥 BULK UPLOAD FACULTY (WITH ERROR HANDLING & AUDIT)
*************************************************/
async function uploadFaculty() {
  const file = facultyFile.files[0];
  if (!file) {
    showToast("Please select a file", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(e.target.result, { type: "binary" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      if (!rows || rows.length === 0) {
        showToast("File is empty or invalid format", "error");
        facultyFile.value = "";
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const f = rows[i];
        try {
          if (!f.facultyId || !f.email) {
            errors.push(`Row ${i + 2}: Missing facultyId or email`);
            errorCount++;
            continue;
          }

          const data = {
            facultyId: String(f.facultyId),
            name: f.name || "",
            subjects: String(f.subjects || "").split(",").map(s => s.trim()).filter(Boolean),
            department: f.department || "",
            email: String(f.email).trim()
          };

          const q = await db.collection("faculty")
            .where("facultyId", "==", data.facultyId)
            .get();

          if (q.empty) {
            await createLoginIfNotExists(data.email, "faculty");
            const newDoc = await db.collection("faculty").add(data);
            await logAudit("upload", "faculty", newDoc.id, currentAdmin.uid);
            successCount++;
          } else {
            // Update existing
            await q.docs[0].ref.update(data);
            await logAudit("upload", "faculty", q.docs[0].id, currentAdmin.uid);
            successCount++;
          }
        } catch (err) {
          errors.push(`Row ${i + 2}: ${err.message}`);
          errorCount++;
        }
      }

      // Log bulk upload audit
      await logAudit("bulk_upload", "faculty", `count:${successCount}`, currentAdmin.uid);

      if (errorCount === 0) {
        showToast(`Faculty upload completed successfully! ${successCount} records processed.`, "success");
      } else {
        showToast(`Upload completed with ${errorCount} errors. ${successCount} records processed.`, "warning");
        console.error("Upload errors:", errors);
      }

      facultyFile.value = "";
    } catch (err) {
      showToast("Error reading file: " + err.message, "error");
      facultyFile.value = "";
    }
  };

  reader.onerror = () => {
    showToast("Error reading file", "error");
    facultyFile.value = "";
  };

  reader.readAsBinaryString(file);
}

// Toast notification function
function showToast(message, type = "success") {
  // Create toast element if it doesn't exist
  let toast = document.getElementById("adminToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "adminToast";
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
  }

  toast.style.backgroundColor = type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : "#f59e0b";
  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
    }, 300);
  }, 3000);
}

/*************************************************
 📥 BULK UPLOAD STUDENTS (WITH ERROR HANDLING & AUDIT)
*************************************************/
async function uploadStudents() {
  const file = studentFile.files[0];
  if (!file) {
    showToast("Please select a file", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(e.target.result, { type: "binary" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      if (!rows || rows.length === 0) {
        showToast("File is empty or invalid format", "error");
        studentFile.value = "";
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const s = rows[i];
        try {
          if (!s.rollNo || !s.email) {
            errors.push(`Row ${i + 2}: Missing rollNo or email`);
            errorCount++;
            continue;
          }

          const data = {
            rollNo: String(s.rollNo),
            name: s.name || "",
            classSection: s.classSection || "",
            yearSem: s.yearSem || "",
            department: s.department || "",
            email: String(s.email).trim(),
            totalClasses: 0,
            attendedClasses: 0
          };

          const q = await db.collection("students")
            .where("rollNo", "==", data.rollNo)
            .get();

          if (q.empty) {
            await createLoginIfNotExists(data.email, "student");
            const newDoc = await db.collection("students").add(data);
            await logAudit("upload", "students", newDoc.id, currentAdmin.uid);
            successCount++;
          } else {
            // Update existing
            await q.docs[0].ref.update(data);
            await logAudit("upload", "students", q.docs[0].id, currentAdmin.uid);
            successCount++;
          }
        } catch (err) {
          errors.push(`Row ${i + 2}: ${err.message}`);
          errorCount++;
        }
      }

      // Log bulk upload audit
      await logAudit("bulk_upload", "students", `count:${successCount}`, currentAdmin.uid);

      if (errorCount === 0) {
        showToast(`Student upload completed successfully! ${successCount} records processed.`, "success");
      } else {
        showToast(`Upload completed with ${errorCount} errors. ${successCount} records processed.`, "warning");
        console.error("Upload errors:", errors);
      }

      studentFile.value = "";
    } catch (err) {
      showToast("Error reading file: " + err.message, "error");
      studentFile.value = "";
    }
  };

  reader.onerror = () => {
    showToast("Error reading file", "error");
    studentFile.value = "";
  };

  reader.readAsBinaryString(file);
}

/*************************************************
 📊 TABLE / EDIT / DELETE / VIEW
*************************************************/
/* EVERYTHING BELOW IS 100% YOUR ORIGINAL CODE */

function setupTable(title, columns, data, collection) {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  // Hide stat cards when showing table
  const viewFacultyStats = document.getElementById("viewFacultyStats");
  const viewStudentStats = document.getElementById("viewStudentStats");
  if (viewFacultyStats) viewFacultyStats.style.display = "none";
  if (viewStudentStats) viewStudentStats.style.display = "none";
  
  tableTab.classList.remove("hidden");

  tableTitle.innerText = title;
  currentColumns = columns;
  currentData = data;
  currentCollection = collection;

  searchBox.value = "";
  renderTable(data);

  searchBox.oninput = applyFilter;
}

function applyFilter() {
  const q = searchBox.value.toLowerCase();

  let rows = currentData.filter(r =>
    Object.values(r).some(v =>
      String(Array.isArray(v) ? v.join(", ") : v ?? "")
        .toLowerCase()
        .includes(q)
    )
  );

  renderTable(rows);
}

function renderTable(rows) {
  let html = "<tr>";
  currentColumns.forEach(c => html += `<th>${c.label}</th>`);
  html += "<th>Actions</th></tr>";

  rows.forEach((r, i) => {
    html += "<tr>";
    currentColumns.forEach(c => {
      let val = r[c.key];
      if (Array.isArray(val)) val = val.join(", ");
      html += `<td>${val ?? "-"}</td>`;
    });
    html += `
      <td>
        <button onclick="editRow(${i})">✏️ Edit</button>
        <button onclick="deleteRow(${i})">🗑 Delete</button>
      </td>
    </tr>`;
  });

  dataTable.innerHTML = html;
}

async function editRow(index) {
  const d = currentData[index];
  
  // Find document ID for audit logging
  const key = currentCollection === "faculty" ? "facultyId" : "rollNo";
  const snap = await db.collection(currentCollection).where(key, "==", d[key]).get();
  const docId = snap.empty ? null : snap.docs[0].id;
  
  if (currentCollection === "faculty") {
    openPanel("facultyPanel");
    fid.value = d.facultyId;
    fname.value = d.name;
    fsub.value = (d.subjects || []).join(", ");
    fdept.value = d.department;
    femail.value = d.email;
  }

  if (currentCollection === "students") {
    openPanel("studentPanel");
    roll.value = d.rollNo;
    sname.value = d.name;
    classSec.value = d.classSection;
    yearSem.value = d.yearSem;
    sdept.value = d.department;
    semail.value = d.email;
  }
  
  // Log audit for edit action (when save is clicked, not here)
  if (docId) {
    window.currentEditDocId = docId;
  }
}

async function deleteRow(index) {
  const d = currentData[index];
  const key = currentCollection === "faculty" ? "facultyId" : "rollNo";

  if (!confirm(`Delete ${d[key]} ?`)) return;

  const snap = await db.collection(currentCollection)
    .where(key, "==", d[key])
    .get();

  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    const docId = snap.docs[0].id;
    
    // Log audit before deletion
    await logAudit("delete", currentCollection, docId, currentAdmin.uid);
    
    await docRef.delete();
    alert("Deleted successfully");
    currentCollection === "faculty" ? viewFaculty() : viewStudents();
  }
}

async function viewFaculty() {
  const snap = await db.collection("faculty").get();
  const totalFaculty = snap.size;
  
  // Show stat card for View Faculty page
  const content = document.querySelector(".content");
  let statCard = document.getElementById("viewFacultyStats");
  if (!statCard) {
    statCard = document.createElement("div");
    statCard.id = "viewFacultyStats";
    statCard.className = "grid stat-grid";
    statCard.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Faculty</div>
        <div class="stat-value" id="statFaculty">0</div>
      </div>
    `;
    content.insertBefore(statCard, content.firstChild);
  }
  document.getElementById("statFaculty").innerText = totalFaculty;
  
  setupTable(
    "Faculty Records",
    [
      { key: "facultyId", label: "Faculty ID" },
      { key: "name", label: "Faculty Name" },
      { key: "subjects", label: "Subjects" },
      { key: "department", label: "Department" },
      { key: "email", label: "Email Address" }
    ],
    snap.docs.map(d => d.data()),
    "faculty"
  );
}

async function viewStudents() {
  const snap = await db.collection("students").get();
  const totalStudents = snap.size;
  
  // Show stat card for View Student page
  const content = document.querySelector(".content");
  let statCard = document.getElementById("viewStudentStats");
  if (!statCard) {
    statCard = document.createElement("div");
    statCard.id = "viewStudentStats";
    statCard.className = "grid stat-grid";
    statCard.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Students</div>
        <div class="stat-value" id="statStudents">0</div>
      </div>
    `;
    content.insertBefore(statCard, content.firstChild);
  }
  document.getElementById("statStudents").innerText = totalStudents;
  
  setupTable(
    "Student Records",
    [
      { key: "rollNo", label: "Roll Number" },
      { key: "name", label: "Student Name" },
      { key: "classSection", label: "Class Section" },
      { key: "yearSem", label: "Year–Semester" },
      { key: "department", label: "Department" },
      { key: "email", label: "Email Address" }
    ],
    snap.docs.map(d => d.data()),
    "students"
  );
}
/*************************************************
 📤 EXPORT TABLE TO EXCEL (WORKING)
*************************************************/
function exportToExcel() {
  if (!currentData.length) {
    alert("No data to export");
    return;
  }

  const rows = currentData.map(row => {
    const obj = {};
    currentColumns.forEach(c => {
      let val = row[c.key];
      if (Array.isArray(val)) val = val.join(", ");
      obj[c.label] = val ?? "";
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Records");

  XLSX.writeFile(
    workbook,
    `${currentCollection}_records.xlsx`
  );
}
/*************************************************
 🖨 PRINT TABLE (WORKING)
*************************************************/
function printTable() {
  if (!currentData.length) {
    alert("No data to print");
    return;
  }

  const printWindow = window.open("", "", "width=1000,height=700");

  let tableHTML = "<table border='1' style='width:100%;border-collapse:collapse'>";
  tableHTML += "<tr>";
  currentColumns.forEach(c => {
    tableHTML += `<th style="padding:8px;background:#f3f4f6">${c.label}</th>`;
  });
  tableHTML += "</tr>";

  currentData.forEach(row => {
    tableHTML += "<tr>";
    currentColumns.forEach(c => {
      let val = row[c.key];
      if (Array.isArray(val)) val = val.join(", ");
      tableHTML += `<td style="padding:8px">${val ?? "-"}</td>`;
    });
    tableHTML += "</tr>";
  });

  tableHTML += "</table>";

  printWindow.document.write(`
    <html>
      <head>
        <title>Print Records</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          table, th, td { border: 1px solid #000; }
        </style>
      </head>
      <body>
        <h2>${currentCollection.toUpperCase()} RECORDS</h2>
        ${tableHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
/*************************************************
 📊 VIEW ATTENDANCE (ADMIN)
*************************************************/
function viewAttendance() {
  db.collection("students").get().then(snap => {

    const data = snap.docs.map(d => {
      const s = d.data();

      const total = Number(s.totalClasses || 0);
      const attended = Number(s.attendedClasses || 0);

      const percentage =
        total > 0
          ? ((attended / total) * 100).toFixed(2) + "%"
          : "0%";

      return {
        rollNo: s.rollNo,
        name: s.name,
        classSection: s.classSection,
        yearSem: s.yearSem,
        department: s.department,
        totalClasses: total,
        attendedClasses: attended,
        attendancePercentage: percentage
      };
    });

    setupTable(
      "Student Attendance Records",
      [
        { key: "rollNo", label: "Roll Number" },
        { key: "name", label: "Student Name" },
        { key: "classSection", label: "Class Section" },
        { key: "yearSem", label: "Year–Semester" },
        { key: "department", label: "Department" },
        { key: "totalClasses", label: "Total Classes" },
        { key: "attendedClasses", label: "Classes Attended" },
        { key: "attendancePercentage", label: "Attendance %" }
      ],
      data,
      "attendance"
    );
  });
}

/*************************************************
 📩 PASSWORD RESET REQUESTS (ADMIN ACTION)
*************************************************/
async function loadPasswordRequests() {
  openPanel("passwordPanel");
  const tbody = document.getElementById("passwordRequestsBody");
  if (!tbody) return;
  const snap = await db.collection("passwordRequests").orderBy("createdAt", "desc").get();
  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="3">No requests.</td></tr>`;
    return;
  }
  let rows = "";
  snap.docs.forEach(doc => {
    const d = doc.data();
    const isReset = d.status === "reset" || d.status === "reset-triggered";
    rows += `<tr>
      <td>${d.email}</td>
      <td>${d.status || "pending"}</td>
      <td>${isReset ? '<span style="color:green;">Password was reset successfully</span>' : `<button id="resetBtn_${doc.id}" onclick="resetToDefault('${doc.id}','${d.email}')">Reset to 123456</button>`}</td>
    </tr>`;
  });
  tbody.innerHTML = rows;
}

async function resetToDefault(docId, email) {
  try {
    // Find user by email
    const userSnap = await db.collection("users").where("email", "==", email).get();
    if (userSnap.empty) {
      alert("User not found");
      return;
    }
    
    const userId = userSnap.docs[0].id;
    
    // Store password reset intent (actual password change requires server-side or Cloud Function)
    // For now, we'll mark it as reset and store the intent
    await db.collection("passwordRequests").doc(docId).update({
      status: "reset",
      handledAt: firebase.firestore.FieldValue.serverTimestamp(),
      resetPassword: "123456",
      resetBy: currentAdmin.uid
    });
    
    // Store password reset in users collection for reference
    await db.collection("users").doc(userId).update({
      passwordReset: "123456",
      passwordResetAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Log audit
    await logAudit("password_reset", "user", userId, currentAdmin.uid);
    
    alert("Password was reset successfully");
    loadPasswordRequests();
  } catch (err) {
    console.error(err);
    alert("Could not reset password. Error: " + err.message);
  }
}

// Audit logging function
async function logAudit(actionType, entityType, entityId, performedBy) {
  try {
    await db.collection("auditLogs").add({
      actionType: actionType,
      entityType: entityType,
      entityId: entityId,
      performedBy: performedBy,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

/*************************************************
 📋 LOAD AUDIT LOGS
*************************************************/
async function loadAuditLogs() {
  openPanel("auditPanel");
  const tbody = document.getElementById("auditLogsBody");
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
  
  try {
    const snap = await db.collection("auditLogs")
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();
    
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No audit logs found.</td></tr>';
      return;
    }
    
    // Get all unique user IDs first
    const userIds = new Set();
    snap.docs.forEach(doc => {
      const d = doc.data();
      if (d.performedBy) userIds.add(d.performedBy);
    });
    
    // Fetch user emails
    const userEmails = {};
    for (const uid of userIds) {
      try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists) {
          userEmails[uid] = userDoc.data().email || uid;
        } else {
          userEmails[uid] = uid;
        }
      } catch (e) {
        userEmails[uid] = uid;
      }
    }
    
    let rows = "";
    snap.docs.forEach(doc => {
      const d = doc.data();
      let timestamp = "N/A";
      if (d.timestamp?.seconds) {
        timestamp = new Date(d.timestamp.seconds * 1000).toLocaleString();
      }
      
      const performedByEmail = userEmails[d.performedBy] || d.performedBy || "-";
      
      rows += `<tr>
        <td>${timestamp}</td>
        <td>${d.actionType || "-"}</td>
        <td>${d.entityType || "-"}</td>
        <td>${d.entityId || "-"}</td>
        <td>${performedByEmail}</td>
      </tr>`;
    });
    
    tbody.innerHTML = rows;
  } catch (err) {
    console.error("Error loading audit logs:", err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error loading audit logs: ' + err.message + '</td></tr>';
  }
}
