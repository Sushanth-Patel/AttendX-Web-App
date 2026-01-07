let map = null;
let studentMarker = null;
let notificationPermissionRequested = false;

// Request notification permission once
function requestNotificationPermission() {
  if (notificationPermissionRequested) return;
  notificationPermissionRequested = true;
  
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then(permission => {
      console.log("Notification permission:", permission);
    });
  }
}

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();
  attachSidebarToggle();
  requestNotificationPermission();
  
  const chip = document.getElementById("studentEmail");
  if (chip) chip.innerText = user.email.split("@")[0];

  const subject = document.getElementById("subject");
  const classSection = document.getElementById("classSection");
  const yearSem = document.getElementById("yearSem");

  // Initialize map
  if (!map) {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  }

  // Request location permission and update map
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        map.setView([lat, lng], 15);
        
        if (studentMarker) {
          map.removeLayer(studentMarker);
        }
        
        studentMarker = L.marker([lat, lng]).addTo(map)
          .bindPopup('Your Location')
          .openPopup();
      },
      error => {
        console.error("Geolocation error:", error);
      }
    );
  }

  // Listen for attendance sessions starting (real-time)
  db.collection("geoAttendance")
    .where("active", "==", true)
    .onSnapshot(snapshot => {
      const subjects = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        subjects.add(data.subject);
      });

      subject.innerHTML = `<option value="">Select Subject</option>`;
      subjects.forEach(s =>
        subject.innerHTML += `<option value="${s}">${s}</option>`
      );
      
      // Notify on new sessions
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const data = change.doc.data();
          db.collection("students")
            .where("email", "==", user.email)
            .get()
            .then(studentSnap => {
              if (!studentSnap.empty) {
                const student = studentSnap.docs[0].data();
                if (data.classSection === student.classSection && 
                    data.yearSem === student.yearSem &&
                    Notification.permission === "granted") {
                  new Notification("Attendance Started", {
                    body: `${data.subject} attendance session is now active`
                  });
                }
              }
            });
        }
      });
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

  // Real-time monitoring of attendance percentage using onSnapshot
  db.collection("students")
    .where("email", "==", user.email)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "modified" || change.type === "added") {
          const student = change.doc.data();
          const total = Number(student.totalClasses || 0);
          const attended = Number(student.attendedClasses || 0);
          const percentage = total > 0 ? (attended / total) * 100 : 0;
          
          if (percentage < 65 && total > 0 && Notification.permission === "granted") {
            new Notification("Low Attendance Alert", {
              body: `Your attendance is ${percentage.toFixed(1)}%, which is below 65%`
            });
          }
        }
      });
    });

  window.submitGeoAttendance = function () {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(async pos => {
      const studentLat = pos.coords.latitude;
      const studentLng = pos.coords.longitude;
      
      // Update map with student location
      map.setView([studentLat, studentLng], 15);
      if (studentMarker) {
        map.removeLayer(studentMarker);
      }
      studentMarker = L.marker([studentLat, studentLng]).addTo(map)
        .bindPopup('Your Location')
        .openPopup();
      
      const snapshot = await db.collection("geoAttendance")
        .where("subject", "==", subject.value)
        .where("classSection", "==", classSection.value)
        .where("yearSem", "==", yearSem.value)
        .where("active", "==", true)
        .get();
        
      if (snapshot.empty) {
        alert("No active session found");
        return;
      }
      
      snapshot.forEach(async doc => {
        const data = doc.data();
        const dist = distanceInMeters(
          studentLat,
          studentLng,
          data.latitude,
          data.longitude
        );
        
        if (dist > (data.radius || 50)) {
          alert("You are outside the allowed geofence.");
          return;
        }
        
        // Add class location marker
        L.marker([data.latitude, data.longitude], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(map)
          .bindPopup('Class Location');
        
        // Add circle for geofence
        L.circle([data.latitude, data.longitude], {
          radius: data.radius || 50,
          color: '#1d4ed8',
          fillColor: '#3b82f6',
          fillOpacity: 0.2
        }).addTo(map);
        
        await db.collection("geoAttendance")
          .doc(doc.id)
          .collection("responses")
          .add({
            studentEmail: user.email,
            latitude: studentLat,
            longitude: studentLng,
            distance: dist,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        
        // Log audit
        await logAudit("attendance_mark", "attendance", doc.id, user.uid);
        
        // Notify student
        if (Notification.permission === "granted") {
          new Notification("Attendance Marked Successfully", {
            body: `Your attendance for ${subject.value} has been marked`
          });
        }
        
        alert("Attendance Submitted");
      });
    });
  };
  
  // Audit logging function
  async function logAudit(actionType, entityType, entityId, performedBy) {
    try {
      await db.collection("auditLogs").add({
        actionType: actionType,
        entityType: entityType,
        entityId: entityId,
        performedBy: performedBy,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error("Audit log error:", err);
    }
  }
  
  // Make logAudit available globally for this page
  window.logAudit = logAudit;
});

function distanceInMeters(lat1, lon1, lat2, lon2) {
  function toRad(deg) { return deg * Math.PI / 180; }
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function attachSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("sidebarToggle");
  if (!sidebar || !toggle) return;
  toggle.onclick = () => sidebar.classList.toggle("collapsed");
}
