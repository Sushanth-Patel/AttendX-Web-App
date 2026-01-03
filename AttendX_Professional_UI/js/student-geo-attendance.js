firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();

  const subject = document.getElementById("subject");
  const classSection = document.getElementById("classSection");
  const yearSem = document.getElementById("yearSem");

  db.collection("geoAttendance")
    .where("active", "==", true)
    .get()
    .then(snapshot => {
      const subjects = new Set();
      snapshot.forEach(doc => subjects.add(doc.data().subject));

      subject.innerHTML = `<option value="">Select Subject</option>`;
      subjects.forEach(s =>
        subject.innerHTML += `<option value="${s}">${s}</option>`
      );
    });

  db.collection("students")
    .where("email", "==", user.email)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        classSection.innerHTML =
          `<option value="${doc.data().classSection}">
            ${doc.data().classSection}
          </option>`;
        yearSem.innerHTML =
          `<option value="${doc.data().yearSem}">
            ${doc.data().yearSem}
          </option>`;
      });
    });

  window.submitGeoAttendance = function () {
    navigator.geolocation.getCurrentPosition(pos => {
      db.collection("geoAttendance")
        .where("subject", "==", subject.value)
        .where("classSection", "==", classSection.value)
        .where("yearSem", "==", yearSem.value)
        .where("active", "==", true)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            db.collection("geoAttendance")
              .doc(doc.id)
              .collection("responses")
              .add({
                studentEmail: user.email,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
              });
          });
          alert("Attendance Submitted");
        });
    });
  };
});
