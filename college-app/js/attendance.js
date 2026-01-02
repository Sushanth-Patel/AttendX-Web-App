const db = firebase.firestore();

firebase.auth().onAuthStateChanged(user => {
  if (!user) return;
  loadFilters();
});

function loadFilters() {
  db.collection("students").get().then(snapshot => {
    const classSet = new Set();
    const yearSet = new Set();

    snapshot.forEach(doc => {
      const s = doc.data();
      classSet.add(s.classSection);
      yearSet.add(s.yearSem);
    });

    classSet.forEach(c =>
      classSelect.innerHTML += `<option value="${c}">${c}</option>`
    );

    yearSet.forEach(y =>
      yearSelect.innerHTML += `<option value="${y}">${y}</option>`
    );
  });

  date.value = new Date().toISOString().split("T")[0];
}

function searchAttendance() {
  const cls = classSelect.value;
  const year = yearSelect.value;
  const selectedDate = date.value;

  if (!cls || !year || !selectedDate) {
    alert("Select all fields");
    return;
  }

  attendanceTableBody.innerHTML = "";
  attendanceTable.style.display = "table";

  db.collection("students")
    .where("classSection", "==", cls)
    .where("yearSem", "==", year)
    .get()
    .then(studentSnap => {
      const students = [];
      studentSnap.forEach(doc => students.push(doc.data()));

      db.collection("attendance")
        .where("classSection", "==", cls)
        .where("yearSem", "==", year)
        .where("date", "==", selectedDate)
        .get()
        .then(attSnap => {
          const presentMap = {};
          attSnap.forEach(doc => {
            const a = doc.data();
            presentMap[a.rollNo] = a.subject;
          });

          students.forEach(s => {
            const isPresent = presentMap[s.rollNo];

            attendanceTableBody.innerHTML += `
              <tr>
                <td>${s.rollNo}</td>
                <td>${s.name}</td>
                <td>${s.classSection}</td>
                <td>${s.yearSem}</td>
                <td>${isPresent || "-"}</td>
                <td>${selectedDate}</td>
                <td style="font-weight:bold;color:${isPresent ? "green" : "red"}">
                  ${isPresent ? "Present" : "Absent"}
                </td>
              </tr>
            `;
          });
        });
    });
}
