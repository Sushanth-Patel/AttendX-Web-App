firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // 🔒 Auto set today's date (cannot be changed from UI)
  if (date) {
    date.value = new Date().toISOString().split("T")[0];
  }

  // 📘 Load faculty subjects (EMAIL BASED)
  db.collection("faculty")
    .where("email", "==", user.email)
    .get()
    .then(snapshot => {
      subject.innerHTML = `<option value="">Select Subject</option>`;
      snapshot.forEach(doc => {
        (doc.data().subjects || []).forEach(sub => {
          subject.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
      });
    });

  // 🧑‍🎓 Load classSection & yearSem from students
  db.collection("students").get().then(snapshot => {
    const classSet = new Set();
    const yearSet = new Set();

    snapshot.forEach(doc => {
      classSet.add(doc.data().classSection);
      yearSet.add(doc.data().yearSem);
    });

    classSection.innerHTML = `<option value="">Select Class</option>`;
    yearSem.innerHTML = `<option value="">Select Year/Sem</option>`;

    classSet.forEach(c =>
      classSection.innerHTML += `<option value="${c}">${c}</option>`
    );
    yearSet.forEach(y =>
      yearSem.innerHTML += `<option value="${y}">${y}</option>`
    );
  });
});

function loadStudents() {
  if (!subject.value || !classSection.value || !yearSem.value || !date.value) {
    alert("Select all fields");
    return;
  }

  studentTable.innerHTML = "";
  attendanceTable.style.display = "table";

  db.collection("students")
    .where("classSection", "==", classSection.value)
    .where("yearSem", "==", yearSem.value)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const s = doc.data();
        studentTable.innerHTML += `
          <tr>
            <td>${s.rollNo}</td>
            <td>${s.name}</td>
            <td>${s.classSection}</td>
            <td>${s.yearSem}</td>
            <td><input type="checkbox"></td>
          </tr>
        `;
      });
    });
}

function saveAttendance() {
  const rows = document.querySelectorAll("#studentTable tr");
  const user = firebase.auth().currentUser;

  // 🚫 Prevent duplicate attendance (subject + class + year + date)
  db.collection("attendance")
    .where("subject", "==", subject.value)
    .where("classSection", "==", classSection.value)
    .where("yearSem", "==", yearSem.value)
    .where("date", "==", date.value)
    .get()
    .then(snapshot => {
      if (!snapshot.empty) {
        alert("Attendance already taken for this subject on this date.");
        return;
      }

      const batch = db.batch();

      rows.forEach(row => {
        const ref = db.collection("attendance").doc();
        batch.set(ref, {
          facultyEmail: user.email,
          subject: subject.value,
          classSection: classSection.value,
          yearSem: yearSem.value,
          date: date.value,
          rollNo: row.cells[0].innerText,
          name: row.cells[1].innerText,
          status: row.cells[4].children[0].checked ? "Present" : "Absent"
        });
      });

      batch.commit().then(() => {
        alert("Attendance Saved Successfully");
      });
    });
}
