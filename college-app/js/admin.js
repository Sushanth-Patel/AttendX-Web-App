/*************************************************
 🔐 AUTH CHECK
*************************************************/
auth.onAuthStateChanged(async user => {
  if (!user) return location.href = "index.html";

  const doc = await db.collection("users").doc(user.uid).get();
  if (!doc.exists || doc.data().role !== "admin") {
    location.href = "index.html";
  }
});

/*************************************************
 🚪 LOGOUT
*************************************************/
function logout() {
  auth.signOut().then(() => location.href = "index.html");
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
  sortBy.innerHTML = `<option value="">Sort By</option>`;
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
    await snap.docs[0].ref.update(data);
    alert("Faculty updated");
  } else {
    await createLoginIfNotExists(data.email, "faculty");
    await db.collection("faculty").add(data);
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
    await snap.docs[0].ref.update(data);
    alert("Student updated");
  } else {
    await createLoginIfNotExists(data.email, "student");
    await db.collection("students").add(data);
    alert("Student added (Default password: 123456)");
  }

  roll.value = sname.value = classSec.value =
  yearSem.value = sdept.value = semail.value = "";
}

/*************************************************
 📥 BULK UPLOAD FACULTY (LOGIC SAME)
*************************************************/
function uploadFaculty() {
  const file = facultyFile.files[0];
  if (!file) return alert("Select a file");

  const reader = new FileReader();
  reader.onload = async e => {
    const wb = XLSX.read(e.target.result, { type: "binary" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    for (const f of rows) {
      const data = {
        facultyId: String(f.facultyId),
        name: f.name,
        subjects: String(f.subjects).split(",").map(s => s.trim()),
        department: f.department,
        email: f.email
      };

      const q = await db.collection("faculty")
        .where("facultyId", "==", data.facultyId)
        .get();

      if (q.empty) {
        await createLoginIfNotExists(data.email, "faculty");
        await db.collection("faculty").add(data);
      }
    }

    alert("Faculty upload completed");
    facultyFile.value = "";
  };

  reader.readAsBinaryString(file);
}

/*************************************************
 📥 BULK UPLOAD STUDENTS (LOGIC SAME)
*************************************************/
function uploadStudents() {
  const file = studentFile.files[0];
  if (!file) return alert("Select a file");

  const reader = new FileReader();
  reader.onload = async e => {
    const wb = XLSX.read(e.target.result, { type: "binary" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    for (const s of rows) {
      const data = {
        rollNo: String(s.rollNo),
        name: s.name,
        classSection: s.classSection,
        yearSem: s.yearSem,
        department: s.department,
        email: s.email,
        totalClasses: 0,
        attendedClasses: 0
      };

      const q = await db.collection("students")
        .where("rollNo", "==", data.rollNo)
        .get();

      if (q.empty) {
        await createLoginIfNotExists(data.email, "student");
        await db.collection("students").add(data);
      }
    }

    alert("Student upload completed");
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
  tableTab.classList.remove("hidden");

  tableTitle.innerText = title;
  currentColumns = columns;
  currentData = data;
  currentCollection = collection;

  sortBy.innerHTML = `<option value="">Sort By</option>`;
  columns.forEach(c => {
    sortBy.innerHTML += `<option value="${c.key}">${c.label}</option>`;
  });

  searchBox.value = "";
  renderTable(data);

  searchBox.oninput = applyFilter;
  sortBy.onchange = applyFilter;
}

function applyFilter() {
  const q = searchBox.value.toLowerCase();
  const key = sortBy.value;

  let rows = currentData.filter(r =>
    Object.values(r).some(v =>
      String(Array.isArray(v) ? v.join(", ") : v ?? "")
        .toLowerCase()
        .includes(q)
    )
  );

  if (key) rows.sort((a, b) =>
    String(a[key]).localeCompare(String(b[key]))
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

function editRow(index) {
  const d = currentData[index];

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
}

async function deleteRow(index) {
  const d = currentData[index];
  const key = currentCollection === "faculty" ? "facultyId" : "rollNo";

  if (!confirm(`Delete ${d[key]} ?`)) return;

  const snap = await db.collection(currentCollection)
    .where(key, "==", d[key])
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.delete();
    alert("Deleted successfully");
    currentCollection === "faculty" ? viewFaculty() : viewStudents();
  }
}

function viewFaculty() {
  db.collection("faculty").get().then(snap => {
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
  });
}

function viewStudents() {
  db.collection("students").get().then(snap => {
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
  });
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
