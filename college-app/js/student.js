const db = firebase.firestore();
let studentData = null;

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  loadStudentProfile(user.email);
});

/* =========================
   LOAD STUDENT PROFILE
========================= */
function loadStudentProfile(email) {
  db.collection("students")
    .where("email", "==", email)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        alert("Student record not found");
        return;
      }

      studentData = snapshot.docs[0].data();
      showStudentInfo();
    });
}

function showStudentInfo() {
  studentInfo.innerHTML = `
    <b>Name:</b> ${studentData.name}<br>
    <b>Roll No:</b> ${studentData.rollNo}<br>
    <b>Class:</b> ${studentData.classSection}<br>
    <b>Year/Sem:</b> ${studentData.yearSem}
  `;
}

/* =========================
   LOAD ATTENDANCE (STEP-2)
========================= */
function loadMyAttendance() {
  if (!studentData) return;

  attendanceTable.innerHTML = `
    <div style="margin-bottom:10px;">
      <label>Subject:</label>
      <select id="subjectFilter">
        <option value="">All Subjects</option>
      </select>

      <label>From:</label>
      <input type="date" id="fromDate">

      <label>To:</label>
      <input type="date" id="toDate">

      <button onclick="applyAttendanceFilter()">Apply</button>
    </div>

    <table border="1" cellpadding="10" cellspacing="0" width="100%">
      <thead>
        <tr>
          <th>Date</th>
          <th>Subject</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="attendanceBody"></tbody>
    </table>
  `;

  loadAttendanceData();
}

let presentRecords = [];
let allDates = new Set();

/* =========================
   LOAD RAW DATA
========================= */
function loadAttendanceData() {
  presentRecords = [];
  allDates.clear();

  db.collection("attendance")
    .where("rollNo", "==", studentData.rollNo)
    .get()
    .then(snapshot => {
      const subjectSet = new Set();

      snapshot.forEach(doc => {
        const a = doc.data();
        presentRecords.push(a);
        subjectSet.add(a.subject);
        allDates.add(a.date);
      });

      // Populate subject dropdown
      const subjectFilter = document.getElementById("subjectFilter");
      subjectSet.forEach(sub => {
        subjectFilter.innerHTML += `<option value="${sub}">${sub}</option>`;
      });

      renderAttendance();
    });
}

/* =========================
   APPLY FILTERS
========================= */
function applyAttendanceFilter() {
  renderAttendance();
}

/* =========================
   RENDER ATTENDANCE TABLE
========================= */
function renderAttendance() {
  const tbody = document.getElementById("attendanceBody");
  tbody.innerHTML = "";

  const subjectVal = document.getElementById("subjectFilter").value;
  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;

  // Build map: date -> subject(s)
  const presentMap = {};

  presentRecords.forEach(a => {
    if (!presentMap[a.date]) {
      presentMap[a.date] = [];
    }
    presentMap[a.date].push(a.subject);
  });

  // Sort dates
  const dates = Array.from(allDates).sort();

  dates.forEach(date => {
    if (fromDate && date < fromDate) return;
    if (toDate && date > toDate) return;

    const subjectsPresent = presentMap[date] || [];

    if (subjectVal && !subjectsPresent.includes(subjectVal)) {
      // If filtered subject & not present → Absent
      tbody.innerHTML += `
        <tr>
          <td>${date}</td>
          <td>${subjectVal}</td>
          <td style="color:red; font-weight:bold;">Absent</td>
        </tr>
      `;
      return;
    }

    if (subjectsPresent.length === 0) {
      tbody.innerHTML += `
        <tr>
          <td>${date}</td>
          <td>-</td>
          <td style="color:red; font-weight:bold;">Absent</td>
        </tr>
      `;
    } else {
      subjectsPresent.forEach(sub => {
        if (subjectVal && sub !== subjectVal) return;

        tbody.innerHTML += `
          <tr>
            <td>${date}</td>
            <td>${sub}</td>
            <td style="color:green; font-weight:bold;">Present</td>
          </tr>
        `;
      });
    }
  });
}

/* =========================
   LOGOUT
========================= */
function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "index.html";
  });
}
