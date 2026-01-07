// 🔐 LOGIN FUNCTION
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const toast = document.getElementById("toast");

  if (!email || !password) {
    toast.className = "toast error";
    toast.innerText = "Please enter email and password";
    toast.style.display = "block";
    return;
  }

  toast.style.display = "none";

  if (!auth || !db) {
    toast.className = "toast error";
    toast.innerText = "Firebase not initialized. Please refresh the page.";
    toast.style.display = "block";
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(async cred => {
      const uid = cred.user.uid;
      console.log("Signed in successfully. UID:", uid);

      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        alert("Role not assigned. Contact admin.");
        await auth.signOut();
        return;
      }

      const role = userDoc.data().role;
      console.log("User role:", role);

      toast.className = "toast success";
      toast.innerText = "Login successful";
      toast.style.display = "block";
      window.dispatchEvent(new Event("login-success"));
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
          toast.style.display = "none";
        }, 300);
      }, 3000);

      setTimeout(() => {
        console.log("Redirecting to:", role);
        if (role === "admin") location.href = "admin.html";
        else if (role === "faculty") location.href = "faculty.html";
        else if (role === "student") location.href = "student.html";
        else alert("Role page not created yet");
      }, 800);
    })
    .catch(err => {
      console.error("Login error:", err);
      toast.className = "toast error";
      toast.innerText = err.message;
      toast.style.display = "block";
    });
}

// 🔄 FORGOT PASSWORD REQUEST (logs to admin inbox collection)
async function requestPasswordReset() {
  const toast = document.getElementById("toast");
  const emailInput = document.getElementById("email");
  const email = (emailInput?.value || "").trim();

  if (!email) {
    if (toast) {
      toast.className = "toast error";
      toast.innerText = "Enter your email to request a reset.";
      toast.style.display = "block";
    }
    return;
  }

  try {
    await db.collection("passwordRequests").add({
      email,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (toast) {
      toast.className = "toast success";
      toast.innerText = "Request sent to Admin. You will be reset to default.";
      toast.style.display = "block";
    }
    window.dispatchEvent(new Event("reset-requested"));
  } catch (err) {
    console.error(err);
    if (toast) {
      toast.className = "toast error";
      toast.innerText = "Could not send request. Try again.";
      toast.style.display = "block";
    }
  }
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
