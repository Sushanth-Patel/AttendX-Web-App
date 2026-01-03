const db = firebase.firestore();

/* =========================
   COLLEGE GEO CONFIG
========================= */
const COLLEGE_LAT = 17.385044;
const COLLEGE_LNG = 78.486671;
const ALLOWED_RADIUS = 200; // meters

let activeSession = null;
let studentData = null;

/* =========================
   AUTH CHECK (BOTH ROLES)
========================= */
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  db.collection("students")
    .where("email", "==", user.email)
    .get()
    .then(stuSnap => {
      if (!stuSnap.empty) {
        studentData = stuSnap.docs[0].data();
        loadActiveSessionForStudent();
      }
    });
});

/* ==========================================================
   STUDENT SIDE
========================================================== */

function loadActiveSessionForStudent() {
  const today = new Date().toISOString().split("T")[0];

  db.collection("attendanceSessions")
    .where("classSection", "==", studentData.classSection)
    .where("yearSem", "==", studentData.yearSem)
    .where("date", "==", today)
    .where("active", "==", true)
    .where("mode", "==", "Geolocation")
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        sessionInfo.innerText = "❌ No active attendance session";
        markBtn.disabled = true;
        return;
      }

      activeSession = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };

      showStudentSession(activeSession);
    });
}

function showStudentSession(session) {
  const remaining = Math.max(
    0,
    Math.floor((session.endTime - Date.now()) / 1000)
  );

  sessionInfo.innerHTML = `
    <b>Subject:</b> ${session.subject}<br>
    <b>Time Remaining:</b> <span id="timer">${remaining}</span> sec
  `;

  markBtn.disabled = false;
  startCountdown(session.endTime);
}

function startCountdown(endTime) {
  const timerEl = document.getElementById("timer");

  const interval = setInterval(() => {
    const remaining = Math.floor((endTime - Date.now()) / 1000);

    if (remaining <= 0) {
      clearInterval(interval);
      sessionInfo.innerHTML = "⏰ Attendance time expired";
      markBtn.disabled = true;
    } else {
      timerEl.innerText = remaining;
    }
  }, 1000);
}

function markAttendance() {
  if (!activeSession || !studentData) return;

  navigator.geolocation.getCurrentPosition(position => {
    const distance = getDistance(
      COLLEGE_LAT,
      COLLEGE_LNG,
      position.coords.latitude,
      position.coords.longitude
    );

    if (distance > ALLOWED_RADIUS) {
      alert("❌ You are outside college premises");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    db.collection("attendance")
      .where("rollNo", "==", studentData.rollNo)
      .where("sessionId", "==", activeSession.id)
      .get()
      .then(snapshot => {
        if (!snapshot.empty) {
          alert("Attendance already marked");
          markBtn.disabled = true;
          return;
        }

        db.collection("attendance").add({
          rollNo: studentData.rollNo,
          name: studentData.name,
          classSection: studentData.classSection,
          yearSem: studentData.yearSem,
          subject: activeSession.subject,
          date: today,
          status: "Present",
          mode: "Geolocation",
          sessionId: activeSession.id
        }).then(() => {
          alert("✅ Attendance marked successfully");
          markBtn.disabled = true;
        });
      });
  });
}

/* ==========================================================
   FACULTY SIDE
========================================================== */

function startAttendance() {
  const subject = document.getElementById("subject").value;
  const classSection = document.getElementById("classSection").value;
  const yearSem = document.getElementById("yearSem").value;
  const duration = Number(document.getElementById("duration").value);

  if (!subject || !classSection || !yearSem || !duration) {
    alert("Fill all fields");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const startTime = Date.now();
  const endTime = startTime + duration * 60000;

  db.collection("attendanceSessions")
    .where("subject", "==", subject)
    .where("classSection", "==", classSection)
    .where("yearSem", "==", yearSem)
    .where("date", "==", today)
    .where("active", "==", true)
    .where("mode", "==", "Geolocation")
    .get()
    .then(snapshot => {
      if (!snapshot.empty) {
        alert("Attendance session already active");
        return;
      }

      db.collection("attendanceSessions").add({
        subject,
        classSection,
        yearSem,
        date: today,
        startTime,
        endTime,
        active: true,
        mode: "Geolocation"
      }).then(doc => {
        activeSession = { id: doc.id };
        alert("✅ Attendance session started");

        setTimeout(() => autoMarkAbsent({ ...activeSession, subject, classSection, yearSem, date: today }), duration * 60000);
      });
    });
}

function autoMarkAbsent(session) {
  db.collection("students")
    .where("classSection", "==", session.classSection)
    .where("yearSem", "==", session.yearSem)
    .get()
    .then(studentsSnap => {
      studentsSnap.forEach(studentDoc => {
        const s = studentDoc.data();

        db.collection("attendance")
          .where("rollNo", "==", s.rollNo)
          .where("sessionId", "==", session.id)
          .get()
          .then(attSnap => {
            if (attSnap.empty) {
              db.collection("attendance").add({
                rollNo: s.rollNo,
                name: s.name,
                classSection: s.classSection,
                yearSem: s.yearSem,
                subject: session.subject,
                date: session.date,
                status: "Absent",
                mode: "Geolocation",
                sessionId: session.id
              });
            }
          });
      });
    });

  db.collection("attendanceSessions")
    .doc(session.id)
    .update({ active: false });
}

/* =========================
   DISTANCE
========================= */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
