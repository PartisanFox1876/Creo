import { signUp, signIn, signOut, getCurrentProfile, onAuthChange } from "./supabase-client.js";

const authSection = document.getElementById("auth-section");
const welcomeSection = document.getElementById("welcome-section");

// ---------------- Tabs ----------------

const tabBtns = document.querySelectorAll(".tab-btn");
const signinForm = document.getElementById("signin-form");
const signupForm = document.getElementById("signup-form");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const isSignin = btn.dataset.tab === "signin";
    signinForm.hidden = !isSignin;
    signupForm.hidden = isSignin;
  });
});

// ---------------- Sign in ----------------

signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("signin-status");
  status.textContent = "Signing in…";
  status.className = "form-status";
  try {
    await signIn(
      document.getElementById("signin-email").value,
      document.getElementById("signin-password").value
    );
    status.textContent = "";
  } catch (err) {
    status.textContent = err.message || "Couldn't sign in.";
    status.className = "form-status error";
  }
});

// ---------------- Sign up ----------------

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("signup-status");
  status.textContent = "Creating account…";
  status.className = "form-status";
  try {
    await signUp(
      document.getElementById("signup-email").value,
      document.getElementById("signup-password").value,
      document.getElementById("signup-username").value.trim()
    );
    status.textContent = "Account created! Check your email if confirmation is required.";
    status.className = "form-status success";
  } catch (err) {
    status.textContent = err.message || "Couldn't create account.";
    status.className = "form-status error";
  }
});

// ---------------- Sign out ----------------

document.getElementById("signout-btn").addEventListener("click", async () => {
  await signOut();
});

// ---------------- Session-aware view ----------------

async function refreshView() {
  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error("Failed to load profile", err);
  }

  if (profile) {
    authSection.hidden = true;
    welcomeSection.hidden = false;
    document.getElementById("welcome-username").textContent = profile.username;
    document.getElementById("admin-badge").hidden = !profile.is_admin;
    document.getElementById("admin-links").hidden = !profile.is_admin;
  } else {
    authSection.hidden = false;
    welcomeSection.hidden = true;
  }
}

onAuthChange(() => refreshView());
refreshView();
