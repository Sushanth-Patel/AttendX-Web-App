firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();

  const subject = document.getElementById("subject");
  const classSection = document.getElementById("classSection");
  const yearSem = document.getElementById("yearSem");
  const radius = document.getElementById("radius");

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

  window.startGeoAttendance = function () {
    if (!subject.value || !classSection.value || !yearSem.value) {
      alert("Select all fields");
      return;
    }

    navigator.geolocation.getCurrentPosition(pos => {
      db.collection("geoAttendance").add({
        subject: subject.value,
        classSection: classSection.value,
        yearSem: yearSem.value,
        facultyEmail: user.email,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        radius: Number(radius.value || 50),
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => alert("Geo Attendance Started"));
    });
  };
});
