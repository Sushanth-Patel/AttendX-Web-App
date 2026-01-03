firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();

  const subjectSelect = document.getElementById("subjectSelect");
  const classSelect = document.getElementById("classSelect");
  const yearSelect = document.getElementById("yearSelect");
  const date = document.getElementById("date");
  const tableBody = document.getElementById("attendanceTableBody");

  date.value = new Date().toISOString().split("T")[0];

  db.collection("faculty")
    .where("email", "==", user.email)
    .get()
    .then(snapshot => {
      subjectSelect.innerHTML = `<option value="">Select Subject</option>`;
      snapshot.forEach(doc => {
        (doc.data().subjects || []).forEach(sub => {
          subjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
      });
    });

  db.collection("students").get().then(snapshot => {
    const classSet = new Set();
    const yearSet = new Set();

    snapshot.forEach(doc => {
      classSet.add(doc.data().classSection);
      yearSet.add(doc.data().yearSem);
    });

    classSelect.innerHTML = `<option value="">Select Class</option>`;
    yearSelect.innerHTML = `<option value="">Select Year/Sem</option>`;

    classSet.forEach(c =>
      classSelect.innerHTML += `<option value="${c}">${c}</option>`
    );
    yearSet.forEach(y =>
      yearSelect.innerHTML += `<option value="${y}">${y}</option>`
    );
  });

  window.viewAttendance = function () {
    tableBody.innerHTML = "";

    db.collection("attendance")
      .where("subject", "==", subjectSelect.value)
      .where("classSection", "==", classSelect.value)
      .where("yearSem", "==", yearSelect.value)
      .where("date", "==", date.value)
      .get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          const a = doc.data();
          tableBody.innerHTML += `
            <tr>
              <td>${a.rollNo}</td>
              <td>${a.name}</td>
              <td>${a.classSection}</td>
              <td>${a.yearSem}</td>
              <td style="color:${a.status === "Present" ? "green" : "red"}">
                ${a.status}
              </td>
            </tr>`;
        });
      });
  };
});
