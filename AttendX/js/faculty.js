const facultyDetails = document.getElementById("facultyDetails");
const logoutBtn = document.getElementById("logoutBtn");
const facultyNameEl = document.getElementById("facultyName");
const facultyEmailText = document.getElementById("facultyEmailText");
const facultyPhoto = document.getElementById("facultyPhoto");
let facultyDocId = null;
let facultyUser = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  facultyUser = user;
  attachSidebarToggle();
  await loadFacultyProfile(user);
});

function attachSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("sidebarToggle");
  if (!sidebar || !toggle) return;
  toggle.onclick = () => sidebar.classList.toggle("collapsed");
}

async function loadFacultyProfile(user) {
  const snapshot = await db
    .collection("faculty")
    .where("email", "==", user.email)
    .get();

  if (snapshot.empty) {
    if (facultyDetails) facultyDetails.innerHTML = "Faculty record not found.";
    return;
  }

  const doc = snapshot.docs[0];
  facultyDocId = doc.id;
  const f = doc.data();

  if (facultyDetails) {
    facultyDetails.innerHTML = `
      <p><b>Name:</b> ${f.name}</p>
      <p><b>Email:</b> ${f.email}</p>
      <p><b>Role:</b> Faculty</p>
      <p><b>Department:</b> ${f.department}</p>
      <p><b>Subjects:</b> ${(f.subjects || []).join(", ")}</p>
    `;
  }
  if (document.getElementById("facultyEmail")) document.getElementById("facultyEmail").innerText = f.name || user.email;

  const profileSnap = await db.collection("profiles").doc(user.uid).get();
  if (profileSnap.exists && facultyPhoto) {
    facultyPhoto.src = profileSnap.data().photo || "attend1.jpeg";
  }

  const actions = document.getElementById("facultyPhotoActions");
  if (facultyPhoto && actions) {
    facultyPhoto.onclick = () => actions.classList.toggle("show");
  }
}

async function saveFacultyPhoto() {
  const input = document.getElementById("facultyPhotoInput");
  if (!input || !input.files?.length || !facultyUser) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const base64 = e.target.result;
    await db.collection("profiles").doc(facultyUser.uid).set({
      email: facultyUser.email,
      name: facultyNameEl?.innerText || facultyUser.email,
      photo: base64
    }, { merge: true });
    if (facultyPhoto) facultyPhoto.src = base64;
    alert("Photo updated");
  };
  reader.readAsDataURL(input.files[0]);
}

logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});
