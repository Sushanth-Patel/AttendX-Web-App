// 🔐 LOGIN FUNCTION
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const toast = document.getElementById("toast");

  toast.style.display = "none";

  auth.signInWithEmailAndPassword(email, password)
    .then(async cred => {
      const uid = cred.user.uid;

      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        alert("Role not assigned. Contact admin.");
        await auth.signOut();
        return;
      }

      const role = userDoc.data().role;

      toast.className = "toast success";
      toast.innerText = "Login successful";
      toast.style.display = "block";

      setTimeout(() => {
        if (role === "admin") location.href = "admin.html";
        else if (role === "faculty") location.href = "faculty.html";
        else if (role === "student") location.href = "student.html";
        else alert("Role page not created yet");
      }, 800);
    })
    .catch(err => {
      toast.className = "toast error";
      toast.innerText = err.message;
      toast.style.display = "block";
    });
}

// 🔐 PAGE PROTECTION (ROLE BASED)
function protect(role) {
  auth.onAuthStateChanged(async user => {
    if (!user) return location.href = "index.html";

    const doc = await db.collection("users").doc(user.uid).get();
    if (!doc.exists || doc.data().role !== role) {
      alert("Access denied");
      location.href = "index.html";
    }
  });
}

// 🚪 LOGOUT
function logout() {
  auth.signOut().then(() => location.href = "index.html");
}
