firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();

  // DOM
  const subject = document.getElementById("subject");
  const classSection = document.getElementById("classSection");
  const yearSem = document.getElementById("yearSem");
  const date = document.getElementById("date");
  const tableBody = document.getElementById("studentTableBody");

  date.value = new Date().toISOString().split("T")[0];

  // Load faculty subjects
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

  // Load class & year
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

  window.loadStudents = function () {
    tableBody.innerHTML = "";

    db.collection("students")
      .where("classSection", "==", classSection.value)
      .where("yearSem", "==", yearSem.value)
      .get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          const s = doc.data();
          tableBody.innerHTML += `
            <tr>
              <td>${s.rollNo}</td>
              <td>${s.name}</td>
              <td>${s.classSection}</td>
              <td>${s.yearSem}</td>
              <td><input type="checkbox" checked></td>
            </tr>`;
        });
      });
  };

  window.saveAttendance = function () {
    const batch = db.batch();

    document.querySelectorAll("#studentTableBody tr").forEach(row => {
      batch.set(db.collection("attendance").doc(), {
        subject: subject.value,
        classSection: classSection.value,
        yearSem: yearSem.value,
        date: date.value,
        rollNo: row.cells[0].innerText,
        name: row.cells[1].innerText,
        status: row.cells[4].children[0].checked ? "Present" : "Absent",
        faculty: user.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    batch.commit().then(() => alert("Attendance Saved"));
  };
});
