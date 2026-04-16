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

// 🔥 NEW (Experience सिस्टम)
const experiencePanel = document.querySelector('#experience-panel');
const experienceForm = document.querySelector('#experience-form');
const experienceStatus = document.querySelector('#experience-status');
const openExperienceBtn = document.querySelector('#open-experience');

const API_BASE = 'https://somesh-develops.onrender.com';

const storageKeys = {
  reviews: 'somesh-blog-reviews',
  admin: 'somesh-blog-admin',
  session: 'somesh-blog-admin-session',
  experiences: 'somesh-experiences' // 🔥 NEW
};

let useLocalMode = window.location.protocol === 'file:';

// ---------------- UTIL ----------------
function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
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

// 🔥 NEW
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

  adminHeading.textContent = 'Admin dashboard';
  adminDescription.textContent = useLocalMode
    ? 'Render backend unavailable. Local mode active.'
    : 'Manage reviews and post experiences.';

  adminWelcome.textContent = `Logged in as ${username}`;
}

function setSignupState() {
  signupForm.classList.remove('hidden-block');
  loginForm.classList.add('hidden-block');
  adminActions.classList.add('hidden-block');

  if (openExperienceBtn) openExperienceBtn.classList.add('hidden-block');
}
function setLoginState() {
  signupForm.classList.add('hidden-block');
  loginForm.classList.remove('hidden-block');
  adminActions.classList.add('hidden-block');

  if (openExperienceBtn) openExperienceBtn.classList.add('hidden-block');
}

function setLoggedInState(username) {
  signupForm.classList.add('hidden-block');
  loginForm.classList.add('hidden-block');
  adminActions.classList.remove('hidden-block');

  // 🔥 SHOW experience button ONLY after login
  if (openExperienceBtn) openExperienceBtn.classList.remove('hidden-block');

  adminHeading.textContent = 'Admin dashboard';
  adminDescription.textContent = useLocalMode
    ? 'Render backend unavailable. Local mode active.'
    : 'Manage reviews and post experiences.';

  adminWelcome.textContent = `Logged in as ${username}`;
}

// ---------------- REVIEWS ----------------
function renderAdminReviews(reviews, loggedIn = false) {
  if (!reviews.length) {
    adminReviewList.innerHTML = `<p>No reviews yet</p>`;
    return;
  }

  adminReviewList.innerHTML = reviews.map(review => `
    <article class="review-card" data-review-id="${review.id}">
      <strong>${escapeHtml(review.name)}</strong>
      <p>${escapeHtml(review.message)}</p>

      <form class="reply-form">
        <textarea name="reply">${review.reply ? escapeHtml(review.reply.text) : ''}</textarea>
        <button type="submit">Reply</button>
        <button type="button" class="delete-review">Delete</button>
      </form>
    </article>
  `).join('');
}

// ---------------- FETCH ----------------
async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include'
  });

  if (!response.ok) throw new Error();
  return await response.json();
}

// ---------------- EXPERIENCE UI ----------------

// 🔥 Toggle panel
if (openExperienceBtn) {
  openExperienceBtn.addEventListener('click', () => {
    experiencePanel.classList.toggle('hidden-block');
  });
}

// 🔥 Submit experience
experienceForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  experienceStatus.textContent = 'Posting...';

  const formData = new FormData(experienceForm);
  const text = formData.get('experience');
  const image = formData.get('image');

  if (!text || !image) {
    experienceStatus.textContent = 'Add text & image';
    return;
  }

  // LOCAL MODE
  if (useLocalMode) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = getStoredExperiences();
      data.push({
        id: Date.now(),
        text,
        image: reader.result
      });
      saveStoredExperiences(data);

      experienceStatus.textContent = 'Saved locally';
      experienceForm.reset();
    };
    reader.readAsDataURL(image);
    return;
  }

  // BACKEND
  try {
    const upload = new FormData();
    upload.append('text', text);
    upload.append('image', image);

    await fetch(`${API_BASE}/api/admin/experience`, {
      method: 'POST',
      body: upload,
      credentials: 'include'
    });

    experienceStatus.textContent = 'Posted 🚀';
    experienceForm.reset();
  } catch {
    useLocalMode = true;
    experienceStatus.textContent = 'Saved locally (fallback)';
  }
});

// ---------------- INIT ----------------
async function checkAdminStatus() {
  if (useLocalMode) {
    const admin = getStoredAdmin();
    if (admin && getSession() === admin.username) {
      setLoggedInState(admin.username);
      renderAdminReviews(getStoredReviews(), true);
      return;
    }
    if (admin) setLoginState(); else setSignupState();
    return;
  }

  try {
    const data = await fetchJson('/api/admin/status');
    if (data.authenticated) {
      setLoggedInState(data.username);
      renderAdminReviews(data.reviews, true);
    } else {
      setLoginState();
    }
  } catch {
    useLocalMode = true;
    checkAdminStatus();
  }
}

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

// ---------------- START ----------------
checkAdminStatus();
```
