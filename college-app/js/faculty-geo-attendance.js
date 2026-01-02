const db = firebase.firestore();
let currentSessionId = null;

/* =========================
   DOM REFERENCES (FIX)
========================= */
const subject = document.getElementById("subject");
const classSection = document.getElementById("classSection");
const yearSem = document.getElementById("yearSem");
const duration = document.getElementById("duration");
const studentTable = document.getElementById("studentTable");

/* =========================
   LOAD DROPDOWNS
========================= */
window.onload = () => {
  loadDropdowns();
};

function loadDropdowns() {
  subject.innerHTML = `<option value="">Select Subject</option>`;
  classSection.innerHTML = `<option value="">Select Class</option>`;
  yearSem.innerHTML = `<option value="">Select Year-Sem</option>`;

  // Load class & year from students
  db.collection("students").get().then(snapshot => {
    const classSet = new Set();
    const yearSet = new Set();

    snapshot.forEach(doc => {
      const s = doc.data();
      if (s.classSection) classSet.add(s.classSection);
      if (s.yearSem) yearSet.add(s.yearSem);
    });

    classSet.forEach(c => {
      classSection.innerHTML += `<option value="${c}">${c}</option>`;
    });

    yearSet.forEach(y => {
      yearSem.innerHTML += `<option value="${y}">${y}</option>`;
    });
  });

  // Load subjects from faculty
  firebase.auth().onAuthStateChanged(user => {
    if (!user) return;

    db.collection("faculty")
      .where("email", "==", user.email)
      .get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          (doc.data().subjects || []).forEach(sub => {
            subject.innerHTML += `<option value="${sub}">${sub}</option>`;
          });
        });
      });
  });
}

/* =========================
   START ATTENDANCE SESSION
========================= */
function startAttendance() {
  const subjectVal = subject.value;
  const classVal = classSection.value;
  const yearVal = yearSem.value;
  const durationVal = Number(duration.value);

  if (!subjectVal || !classVal || !yearVal || !durationVal) {
    alert("Fill all fields");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const endTime = Date.now() + durationVal * 60000;

  firebase.auth().onAuthStateChanged(user => {
    if (!user) return;

    db.collection("attendanceSessions").add({
      facultyEmail: user.email,
      subject: subjectVal,
      classSection: classVal,
      yearSem: yearVal,
      date: today,
      endTime,
      active: true
    }).then(doc => {
      currentSessionId = doc.id;
      loadStudents(classVal, yearVal);
      startTimer(endTime);
      alert("Attendance session started");
    });
  });
}

/* =========================
   LOAD STUDENTS (DEFAULT ABSENT)
========================= */
function loadStudents(cls, yr) {
  studentTable.innerHTML = "";

  db.collection("students")
    .where("classSection", "==", cls)
    .where("yearSem", "==", yr)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const s = doc.data();
        studentTable.innerHTML += `
          <tr>
            <td>${s.rollNo}</td>
            <td>${s.name}</td>
            <td id="status-${s.rollNo}" style="color:red;font-weight:bold">
              Absent
            </td>
          </tr>
        `;
      });

      listenLiveAttendance();
    });
}

/* =========================
   LIVE PRESENT UPDATE
========================= */
function listenLiveAttendance() {
  db.collection("attendance")
    .where("sessionId", "==", currentSessionId)
    .onSnapshot(snapshot => {
      snapshot.forEach(doc => {
        const a = doc.data();
        const cell = document.getElementById(`status-${a.rollNo}`);
        if (cell) {
          cell.innerText = "Present";
          cell.style.color = "green";
        }
      });
    });
}

/* =========================
   TIMER
========================= */
function startTimer(endTime) {
  const interval = setInterval(() => {
    if (Date.now() >= endTime) {
      clearInterval(interval);
      finalizeSession();
    }
  }, 1000);
}

/* =========================
   FINALIZE SESSION
========================= */
function finalizeSession() {
  if (!currentSessionId) return;

  db.collection("attendanceSessions")
    .doc(currentSessionId)
    .update({ active: false });

  alert("Attendance session ended");
}
