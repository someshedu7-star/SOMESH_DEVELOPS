```javascript
const signupForm = document.querySelector('#signup-form');
const loginForm = document.querySelector('#login-form');
const adminStatus = document.querySelector('#admin-status');
const adminHeading = document.querySelector('#admin-heading');
const adminDescription = document.querySelector('#admin-description');
const adminActions = document.querySelector('#admin-actions');
const adminWelcome = document.querySelector('#admin-welcome');
const adminReviewList = document.querySelector('#admin-review-list');
const logoutButton = document.querySelector('#logout-button');

const experiencePanel = document.querySelector('#experience-panel');
const experienceForm = document.querySelector('#experience-form');
const experienceStatus = document.querySelector('#experience-status');
const openExperienceBtn = document.querySelector('#open-experience');

const API_BASE = 'https://somesh-develops.onrender.com';

const storageKeys = {
  reviews: 'somesh-blog-reviews',
  admin: 'somesh-blog-admin',
  session: 'somesh-blog-admin-session',
  experiences: 'somesh-experiences'
};

let useLocalMode = window.location.protocol === 'file:';

// ---------------- UTIL ----------------
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------- STORAGE ----------------
function getStoredAdmin() {
  return readJson(storageKeys.admin, null);
}

function getStoredReviews() {
  return readJson(storageKeys.reviews, []);
}

function saveStoredReviews(reviews) {
  writeJson(storageKeys.reviews, reviews);
}

function getStoredExperiences() {
  return readJson(storageKeys.experiences, []);
}

function saveStoredExperiences(data) {
  writeJson(storageKeys.experiences, data);
}

// ---------------- SESSION ----------------
function getSession() {
  return sessionStorage.getItem(storageKeys.session) || '';
}

function setSession(username) {
  sessionStorage.setItem(storageKeys.session, username);
}

function clearSession() {
  sessionStorage.removeItem(storageKeys.session);
}

// ---------------- UI STATES ----------------
function setLoggedInState(username) {
  signupForm.classList.add('hidden-block');
  loginForm.classList.add('hidden-block');
  adminActions.classList.remove('hidden-block');

  // ✅ show button
  openExperienceBtn.classList.remove('hidden-block');

  // ✅ hide panel initially
  experiencePanel.classList.add('hidden-block');

  adminHeading.textContent = 'Admin dashboard';
  adminDescription.textContent = 'Manage reviews and post experiences.';
  adminWelcome.textContent = `Logged in as ${username}`;
}

function setSignupState() {
  signupForm.classList.remove('hidden-block');
  loginForm.classList.add('hidden-block');
  adminActions.classList.add('hidden-block');

  openExperienceBtn.classList.add('hidden-block');
  experiencePanel.classList.add('hidden-block');
}

function setLoginState() {
  signupForm.classList.add('hidden-block');
  loginForm.classList.remove('hidden-block');
  adminActions.classList.add('hidden-block');

  openExperienceBtn.classList.add('hidden-block');
  experiencePanel.classList.add('hidden-block');
}

// ---------------- REVIEWS ----------------
function renderAdminReviews(reviews) {
  if (!reviews.length) {
    adminReviewList.innerHTML = `<p>No reviews yet</p>`;
    return;
  }

  adminReviewList.innerHTML = reviews.map(r => `
    <div class="review-card">
      <strong>${escapeHtml(r.name)}</strong>
      <p>${escapeHtml(r.message)}</p>
    </div>
  `).join('');
}

// ---------------- EXPERIENCE ----------------

// Toggle panel
openExperienceBtn?.addEventListener('click', () => {
  experiencePanel.classList.toggle('hidden-block');
});

// Submit
experienceForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  experienceStatus.textContent = 'Posting...';

  const formData = new FormData(experienceForm);
  const text = formData.get('experience');
  const image = formData.get('image');

  if (!text || !image) {
    experienceStatus.textContent = 'Add text & image';
    return;
  }

  // LOCAL MODE
  const reader = new FileReader();
  reader.onload = () => {
    const data = getStoredExperiences();

    data.push({
      id: Date.now(),
      text,
      image: reader.result
    });

    saveStoredExperiences(data);
    experienceStatus.textContent = 'Saved ✅';
    experienceForm.reset();
  };

  reader.readAsDataURL(image);
});

// ---------------- AUTH ----------------
signupForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const u = signupForm.username.value;
  const p = signupForm.password.value;

  writeJson(storageKeys.admin, { username: u, password: p });
  setSession(u);

  setLoggedInState(u);
});

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const admin = getStoredAdmin();

  if (admin &&
      admin.username === loginForm.username.value &&
      admin.password === loginForm.password.value) {

    setSession(admin.username);
    setLoggedInState(admin.username);
  } else {
    adminStatus.textContent = 'Wrong login';
  }
});

logoutButton.addEventListener('click', () => {
  clearSession();
  location.reload();
});

// ---------------- INIT ----------------
function checkAdminStatus() {
  const admin = getStoredAdmin();
  const session = getSession();

  if (admin && session === admin.username) {
    setLoggedInState(session);
    renderAdminReviews(getStoredReviews());
  } else {
    if (admin) setLoginState();
    else setSignupState();
  }
}

checkAdminStatus();
```
