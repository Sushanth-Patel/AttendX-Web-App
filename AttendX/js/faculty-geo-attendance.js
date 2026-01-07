firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();
  const subject = document.getElementById("subject");
  const classSection = document.getElementById("classSection");
  const yearSem = document.getElementById("yearSem");
  const radius = document.getElementById("radius");
  const chipName = document.getElementById("facultyChipName");

  attachSidebarToggle();

  if (chipName) chipName.innerText = user.email.split("@")[0];

  db.collection("faculty")
    .where("email", "==", user.email)
    .get()
    .then(snapshot => {
      subject.innerHTML = `<option value="">Select Subject</option>`;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (chipName && data.name) chipName.innerText = data.name;
        (data.subjects || []).forEach(sub => {
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

  let map = null;
  let marker = null;

  window.startGeoAttendance = function () {
    if (!subject.value || !classSection.value || !yearSem.value) {
      alert("Select all fields");
      return;
    }

    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      await db.collection("geoAttendance").add({
        subject: subject.value,
        classSection: classSection.value,
        yearSem: yearSem.value,
        facultyEmail: user.email,
        latitude: lat,
        longitude: lng,
        radius: Number(radius?.value || 50),
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Initialize Leaflet map
      if (!map) {
        map = L.map('map').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
      } else {
        map.setView([lat, lng], 15);
      }
      
      // Remove existing marker if any
      if (marker) {
        map.removeLayer(marker);
      }
      
      // Add marker for class location
      marker = L.marker([lat, lng]).addTo(map)
        .bindPopup('Class Location<br>' + subject.value)
        .openPopup();
      
      // Add circle for radius
      const radiusMeters = Number(radius?.value || 50);
      L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#1d4ed8',
        fillColor: '#3b82f6',
        fillOpacity: 0.2
      }).addTo(map);

      if (Notification && Notification.permission !== "granted") {
        Notification.requestPermission();
      }
      if (Notification && Notification.permission === "granted") {
        new Notification("Attendance Started", {
          body: `${subject.value} (${classSection.value}) is now active`
        });
      }
      alert("Geo Attendance Started");
    });
  };
});

function attachSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("sidebarToggle");
  if (!sidebar || !toggle) return;
  toggle.onclick = () => sidebar.classList.toggle("collapsed");
}
