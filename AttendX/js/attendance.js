firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();
  attachSidebarToggle();

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
        const data = doc.data();
        const chip = document.getElementById("facultyChipName");
        if (chip) chip.innerText = data.name || user.email;
        (data.subjects || []).forEach(sub => {
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

  window.searchAttendance = async function () {
    tableBody.innerHTML = "";
    const table = document.getElementById("attendanceTable");
    
    if (!subjectSelect.value || !classSelect.value || !yearSelect.value || !date.value) {
      alert("Please select all filters");
      return;
    }

    try {
      // Get all attendance records for the selected filters
      const snapshot = await db.collection("attendance")
        .where("subject", "==", subjectSelect.value)
        .where("classSection", "==", classSelect.value)
        .where("yearSem", "==", yearSelect.value)
        .where("date", "==", date.value)
        .get();
        
      if (snapshot.empty) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No attendance found</td></tr>';
        table.style.display = "table";
        return;
      }
      
      // Use Map to track unique rollNo entries (to avoid duplicates)
      const attendanceMap = new Map();
      
      snapshot.docs.forEach(doc => {
        const a = doc.data();
        const rollNo = a.rollNo;
        
        // If rollNo already exists, keep the one with latest timestamp
        if (attendanceMap.has(rollNo)) {
          const existing = attendanceMap.get(rollNo);
          const existingTime = existing.timestamp?.seconds || 0;
          const currentTime = a.timestamp?.seconds || 0;
          
          if (currentTime > existingTime) {
            attendanceMap.set(rollNo, a);
          }
        } else {
          attendanceMap.set(rollNo, a);
        }
      });
      
      // Convert map to array and sort by timestamp
      const uniqueAttendance = Array.from(attendanceMap.values()).sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA; // Descending order
      });
      
      uniqueAttendance.forEach(a => {
        let markedTime = "";
        if (a.timestamp?.seconds) {
          markedTime = new Date(a.timestamp.seconds * 1000).toLocaleTimeString();
        }
        
        tableBody.innerHTML += `
          <tr>
            <td>${a.date || date.value}</td>
            <td>${a.subject}</td>
            <td style="color:${a.status === "Present" ? "green" : "red"}">
              ${a.status}
            </td>
            <td>${markedTime || "-"}</td>
          </tr>`;
      });
      
      table.style.display = "table";
    } catch (err) {
      console.error("Error loading attendance:", err);
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Error loading attendance</td></tr>';
      table.style.display = "table";
    }
  };
});

function attachSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("sidebarToggle");
  if (!sidebar || !toggle) return;
  toggle.onclick = () => sidebar.classList.toggle("collapsed");
}
