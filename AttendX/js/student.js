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
  attachSidebarToggle();
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
    const chip = document.getElementById("studentEmail");
    if (chip) chip.innerText = studentData.name || user.email;
    const profileSnap = await db.collection("profiles").doc(user.uid).get();
    if (profileSnap.exists) {
      const photo = profileSnap.data().photo;
      const img = document.getElementById("studentPhoto");
      if (img && photo) img.src = photo;
    }
    const actions = document.getElementById("studentPhotoActions");
    const photoEl = document.getElementById("studentPhoto");
    if (photoEl && actions) {
      photoEl.onclick = () => actions.classList.toggle("show");
    }
    showStudentInfo();
    setupRealTimeNotifications(user);

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
    <p><b>Email:</b> ${studentData.email}</p>
    <p><b>Role:</b> Student</p>
    <p><b>Department:</b> ${studentData.department}</p>
    <p><b>Roll No:</b> ${studentData.rollNo}</p>
    <p><b>Class:</b> ${studentData.classSection}</p>
    <p><b>Year/Sem:</b> ${studentData.yearSem}</p>
  `;
}

function attachSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("sidebarToggle");
  if (!sidebar || !toggle) return;
  toggle.onclick = () => sidebar.classList.toggle("collapsed");
}

async function saveStudentPhoto() {
  const input = document.getElementById("studentPhotoInput");
  if (!input || !input.files?.length) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const base64 = e.target.result;
    await db.collection("profiles").doc(user.uid).set({
      email: user.email,
      name: studentData?.name || user.email,
      photo: base64
    }, { merge: true });
    const img = document.getElementById("studentPhoto");
    if (img) img.src = base64;
    alert("Photo updated");
  };
  reader.readAsDataURL(input.files[0]);
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
// VIEW ATTENDANCE (BUTTON CLICK) - Updated to show day-wise table
// =========================
async function loadMyAttendance() {
  const subject = document.getElementById("filterSubject").value;
  const tbody = document.getElementById("attendanceTable");

  tbody.innerHTML = "";

  try {
    let query = db.collection("attendance").where("rollNo", "==", studentData.rollNo);
    const snapshot = await query.orderBy("date", "desc").get();

    if (snapshot.empty) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;color:red;">
            No attendance found
          </td>
        </tr>
      `;
      return;
    }

    snapshot.forEach(doc => {
      const a = doc.data();

      // Convert Firestore Timestamp → yyyy-mm-dd
      let recordDate = a.date;
      let markedTime = "";
      if (a.date?.seconds) {
        const dateObj = new Date(a.date.seconds * 1000);
        recordDate = dateObj.toISOString().split("T")[0];
        markedTime = dateObj.toLocaleTimeString();
      } else if (typeof a.date === "string") {
        recordDate = a.date;
      }

      if (subject && a.subject !== subject) return;

      tbody.innerHTML += `
        <tr>
          <td>${recordDate}</td>
          <td>${a.subject || "-"}</td>
          <td style="color:${a.status === "Present" ? "green" : "red"}">
            ${a.status}
          </td>
          <td>${markedTime || "-"}</td>
        </tr>
      `;
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:red;">
          Error loading attendance
        </td>
      </tr>
    `;
  }
}

// =========================
// REAL-TIME NOTIFICATIONS USING FIRESTORE ONSNAPSHOT
// =========================
function setupRealTimeNotifications(user) {
  // Request notification permission
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Get student rollNo first
  db.collection("students")
    .where("email", "==", user.email)
    .limit(1)
    .get()
    .then(snapshot => {
      if (snapshot.empty) return;
      
      const rollNo = snapshot.docs[0].data().rollNo;
      
      // 1. Listen for attendance sessions starting (geoAttendance)
      db.collection("geoAttendance")
        .where("active", "==", true)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
              const data = change.doc.data();
              // Check if this session is for the student's class
              db.collection("students")
                .where("email", "==", user.email)
                .get()
                .then(studentSnap => {
                  if (!studentSnap.empty) {
                    const student = studentSnap.docs[0].data();
                    if (data.classSection === student.classSection && 
                        data.yearSem === student.yearSem &&
                        Notification.permission === "granted") {
                      new Notification("Attendance Started", {
                        body: `${data.subject} attendance session is now active`
                      });
                    }
                  }
                });
            }
          });
        });
      
      // 2. Listen for attendance being marked successfully
      db.collection("attendance")
        .where("rollNo", "==", rollNo)
        .orderBy("timestamp", "desc")
        .limit(1)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
              const data = change.doc.data();
              if (Notification.permission === "granted") {
                new Notification("Attendance Marked Successfully", {
                  body: `Your attendance for ${data.subject} has been marked as ${data.status}`
                });
              }
            }
          });
        });
      
      // 3. Listen for attendance percentage changes
      db.collection("students")
        .where("email", "==", user.email)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === "modified") {
              const data = change.doc.data();
              const total = Number(data.totalClasses || 0);
              const attended = Number(data.attendedClasses || 0);
              const percentage = total > 0 ? (attended / total) * 100 : 0;
              
              if (percentage < 65 && total > 0 && Notification.permission === "granted") {
                new Notification("Low Attendance Alert", {
                  body: `Your attendance is ${percentage.toFixed(1)}%, which is below 65%`
                });
              }
            }
          });
        });
    });
}

// =========================
// LOGOUT
// =========================
function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "index.html";
  });
}
