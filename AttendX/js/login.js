// Non-intrusive UI-only JS
// Does NOT interfere with backend authentication

document.addEventListener("DOMContentLoaded", () => {
  const toast = document.querySelector(".toast");
  if (toast) {
    setTimeout(() => {
      toast.style.opacity = "0";
    }, 1800);
  }
});

function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.className = `toast ${type}`;
  t.innerText = msg;
  t.style.display = "block";
  t.style.opacity = "1";
  setTimeout(() => t.style.opacity = "0", 2500);
}

// Hook into auth.js to display professional notifications
window.addEventListener("login-success", () => {
  showToast("Login successful", "success");
});
window.addEventListener("reset-requested", () => {
  showToast("Request sent to Admin. You will be reset to default.", "success");
});