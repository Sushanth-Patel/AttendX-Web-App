const db = firebase.firestore();

const COLLEGE_LAT = 17.385044;
const COLLEGE_LNG = 78.486671;
const ALLOWED_RADIUS = 200;

let student = null;
let activeSession = null;

/* =========================
   AUTH & STUDENT LOAD
========================= */
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  db.collection("students")
    .where("email", "==", user.email)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        alert("Student record not found");
        return;
      }

      student = snapshot.docs[0].data();
      loadActiveSession();
    });
});

/* =========================
   LOAD ACTIVE SESSION
========================= */
function loadActiveSession() {
  const today = new Date().toISOString().split("T")[0];

  db.collection("attendanceSessions")
    .where("classSection", "==", student.classSection)
    .where("yearSem", "==", student.yearSem)
    .where("date", "==", today)
    .where("active", "==", true)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        sessionInfo.innerText = "No active attendance";
        markBtn.disabled = true;
        return;
      }

      activeSession = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };

      showSession(activeSession);
    });
}

/* =========================
   SHOW SESSION
========================= */
function showSession(session) {
  const remaining = Math.floor((session.endTime - Date.now()) / 1000);

  sessionInfo.innerHTML = `
    <b>Subject:</b> ${session.subject}<br>
    <b>Remaining:</b> <span id="timer">${remaining}</span>s
  `;

  markBtn.disabled = false;
  startCountdown(session.endTime);
}

/* =========================
   COUNTDOWN
========================= */
function startCountdown(endTime) {
  const timerEl = document.getElementById("timer");
  const msg = document.getElementById("msg");

  const interval = setInterval(() => {
    const remaining = Math.floor((endTime - Date.now()) / 1000);

    if (remaining <= 0) {
      clearInterval(interval);
      sessionInfo.innerHTML = "⏰ Attendance window closed";
      msg.innerText = "Attendance session has ended";
      msg.style.color = "red";
      markBtn.disabled = true;
    } else {
      timerEl.innerText = remaining;
    }
  }, 1000);
}

/* =========================
   MARK ATTENDANCE
========================= */
function markAttendance() {
  navigator.geolocation.getCurrentPosition(pos => {
    const dist = getDistance(
      COLLEGE_LAT,
      COLLEGE_LNG,
      pos.coords.latitude,
      pos.coords.longitude
    );

    if (dist > ALLOWED_RADIUS) {
      alert("Outside college premises");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    db.collection("attendance")
      .where("rollNo", "==", student.rollNo)
      .where("sessionId", "==", activeSession.id)
      .get()
      .then(snap => {
        if (!snap.empty) {
          alert("Already marked");
          return;
        }

        db.collection("attendance").add({
          rollNo: student.rollNo,
          name: student.name,
          classSection: student.classSection,
          yearSem: student.yearSem,
          subject: activeSession.subject,
          date: today,
          status: "Present",
          mode: "Geolocation",
          sessionId: activeSession.id
        }).then(() => {
          alert("Attendance marked");
          markBtn.disabled = true;
        });
      });
  });
}

/* =========================
   DISTANCE CALC
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
