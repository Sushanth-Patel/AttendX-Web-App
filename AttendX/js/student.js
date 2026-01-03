// =========================
// STUDENT DASHBOARD LOGIC
// =========================

// ❌ DO NOT initialize Firestore here
// db is already initialized in firebase.js

let studentData = null;

// =========================
// AUTH CHECK
// =========================
firebase.auth().onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  loadStudentProfile(user);
});

// =========================
// LOAD STUDENT PROFILE
// =========================
async function loadStudentProfile(user) {
  try {
    const userDoc = await db.collection("users").doc(user.uid).get();

    if (!userDoc.exists || userDoc.data().role !== "student") {
      document.getElementById("studentInfo").innerHTML =
        "<p style='color:red'>Student profile not found</p>";
      return;
    }

    const snapshot = await db
      .collection("students")
      .where("email", "==", user.email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      document.getElementById("studentInfo").innerHTML =
        "<p style='color:red'>Student record not found</p>";
      return;
    }

    studentData = snapshot.docs[0].data();
    showStudentInfo();
    loadSubjects();

  } catch (err) {
    console.error(err);
  }
}

// =========================
// SHOW STUDENT DETAILS
// =========================
function showStudentInfo() {
  document.getElementById("studentInfo").innerHTML = `
    <p><b>Name:</b> ${studentData.name}</p>
    <p><b>Roll No:</b> ${studentData.rollNo}</p>
    <p><b>Email:</b> ${studentData.email}</p>
    <p><b>Department:</b> ${studentData.department}</p>
    <p><b>Class:</b> ${studentData.classSection}</p>
    <p><b>Year/Sem:</b> ${studentData.yearSem}</p>
  `;
}

// =========================
// LOAD SUBJECT DROPDOWN
// =========================
async function loadSubjects() {
  const subjectSelect = document.getElementById("filterSubject");
  subjectSelect.innerHTML = `<option value="">All Subjects</option>`;

  const snapshot = await db
    .collection("attendance")
    .where("rollNo", "==", studentData.rollNo)
    .get();

  const subjects = new Set();
  snapshot.forEach(doc => subjects.add(doc.data().subject));

  subjects.forEach(sub => {
    subjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
  });
}

// =========================
// VIEW ATTENDANCE (BUTTON CLICK)
// =========================
async function loadMyAttendance() {
  const subject = document.getElementById("filterSubject").value;
  const dateVal = document.getElementById("filterDate").value;
  const tbody = document.getElementById("attendanceTable");

  tbody.innerHTML = "";

  if (!dateVal) {
    alert("Please select a date");
    return;
  }

  try {
    const snapshot = await db
      .collection("attendance")
      .where("rollNo", "==", studentData.rollNo)
      .get();

    let found = false;

    snapshot.forEach(doc => {
      const a = doc.data();

      // Convert Firestore Timestamp → yyyy-mm-dd
      let recordDate = a.date;
      if (a.date?.seconds) {
        recordDate = new Date(a.date.seconds * 1000)
          .toISOString()
          .split("T")[0];
      }

      if (recordDate !== dateVal) return;
      if (subject && a.subject !== subject) return;

      found = true;

      tbody.innerHTML += `
        <tr>
          <td>${studentData.rollNo}</td>
          <td>${a.subject}</td>
          <td>${recordDate}</td>
          <td style="color:${a.status === "Present" ? "green" : "red"}">
            ${a.status}
          </td>
        </tr>
      `;
    });

    if (!found) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;color:red;">
            No attendance found
          </td>
        </tr>
      `;
    }

  } catch (err) {
    console.error(err);
  }
}

// =========================
// LOGOUT
// =========================
function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "index.html";
  });
}
