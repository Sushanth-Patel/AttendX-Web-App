firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();
  attachSidebarToggle();

  // DOM
  const subject = document.getElementById("subject");
  const classSection = document.getElementById("classSection");
  const yearSem = document.getElementById("yearSem");
  const date = document.getElementById("date");
  const tableBody = document.getElementById("studentTable");

  date.value = new Date().toISOString().split("T")[0];
  date.max = new Date().toISOString().split("T")[0]; // Prevent future dates

  // Load faculty subjects
  db.collection("faculty")
    .where("email", "==", user.email)
    .get()
    .then(snapshot => {
      subject.innerHTML = `<option value="">Select Subject</option>`;
      snapshot.forEach(doc => {
        const data = doc.data();
        const chip = document.getElementById("facultyChipName");
        if (chip) chip.innerText = data.name || user.email;
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

  window.loadStudents = async function () {
    const today = new Date().toISOString().split("T")[0];
    const selectedDate = date.value;
    
    // Check if date is today - only allow editing on same day
    if (selectedDate !== today) {
      alert("You can only mark attendance for today's date.");
      date.value = today;
      return;
    }
    
    tableBody.innerHTML = "";

    // Check if attendance already exists for this date/subject/class
    const existingSnap = await db.collection("attendance")
      .where("subject", "==", subject.value)
      .where("classSection", "==", classSection.value)
      .where("yearSem", "==", yearSem.value)
      .where("date", "==", selectedDate)
      .get();
    
    const existingAttendance = {};
    existingSnap.forEach(doc => {
      const data = doc.data();
      existingAttendance[data.rollNo] = { id: doc.id, status: data.status };
    });

    const snapshot = await db.collection("students")
      .where("classSection", "==", classSection.value)
      .where("yearSem", "==", yearSem.value)
      .get();
      
    snapshot.forEach(doc => {
      const s = doc.data();
      const existing = existingAttendance[s.rollNo];
      const isPresent = existing ? existing.status === "Present" : true;
      const canEdit = selectedDate === today;
      
      tableBody.innerHTML += `
        <tr>
          <td>${s.rollNo}</td>
          <td>${s.name}</td>
          <td>${s.classSection}</td>
          <td>${s.yearSem}</td>
          <td>
            <input type="checkbox" ${isPresent ? "checked" : ""} ${canEdit ? "" : "disabled"}>
            ${!canEdit ? '<span style="color:gray;font-size:12px;">(Past date)</span>' : ""}
          </td>
        </tr>`;
    });
    
    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No students found</td></tr>';
    } else {
      document.getElementById("attendanceTable").style.display = "table";
    }
  };

  window.saveAttendance = async function () {
    const today = new Date().toISOString().split("T")[0];
    const selectedDate = date.value;
    
    // Check if date is today - only allow editing on same day
    if (selectedDate !== today) {
      alert("You can only mark attendance for today's date.");
      return;
    }
    
    const batch = db.batch();
    const attendanceDocs = [];

    const rows = document.querySelectorAll("#studentTable tr");
    rows.forEach(row => {
      const attendanceRef = db.collection("attendance").doc();
      const attendanceData = {
        subject: subject.value,
        classSection: classSection.value,
        yearSem: yearSem.value,
        date: date.value,
        rollNo: row.cells[0].innerText,
        name: row.cells[1].innerText,
        status: row.cells[4].children[0].checked ? "Present" : "Absent",
        faculty: user.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      batch.set(attendanceRef, attendanceData);
      attendanceDocs.push({ id: attendanceRef.id, data: attendanceData });
    });

    await batch.commit();
    
    // Log audit for each attendance mark
    for (const doc of attendanceDocs) {
      await logAudit("attendance_mark", "attendance", doc.id, user.uid);
    }
    
    // Update student attendance counts
    const studentsSnap = await db.collection("students")
      .where("classSection", "==", classSection.value)
      .where("yearSem", "==", yearSem.value)
      .get();
    
    for (const studentDoc of studentsSnap.docs) {
      const studentData = studentDoc.data();
      const rollNo = studentData.rollNo;
      
      // Count attendance for this student
      const attendanceSnap = await db.collection("attendance")
        .where("rollNo", "==", rollNo)
        .get();
      
      let totalClasses = 0;
      let attendedClasses = 0;
      
      attendanceSnap.forEach(attDoc => {
        totalClasses++;
        if (attDoc.data().status === "Present") {
          attendedClasses++;
        }
      });
      
      await studentDoc.ref.update({
        totalClasses: totalClasses,
        attendedClasses: attendedClasses
      });
    }
    
    alert("Attendance Saved");
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

function attachSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("sidebarToggle");
  if (!sidebar || !toggle) return;
  toggle.onclick = () => sidebar.classList.toggle("collapsed");
}
