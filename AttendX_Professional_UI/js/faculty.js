const facultyDetails = document.getElementById("facultyDetails");
const logoutBtn = document.getElementById("logoutBtn");

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const snapshot = await db
    .collection("faculty")
    .where("email", "==", user.email)
    .get();

  if (snapshot.empty) {
    facultyDetails.innerHTML = "Faculty record not found.";
    return;
  }

  const f = snapshot.docs[0].data();

  facultyDetails.innerHTML = `
    <p><b>Name:</b> ${f.name}</p>
    <p><b>Email:</b> ${f.email}</p>
    <p><b>Department:</b> ${f.department}</p>
    <p><b>Subjects:</b> ${(f.subjects || []).join(", ")}</p>
  `;
});

logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});
