import { renderOverviewPage } from './pages/overview.js';
import { renderRunsPage } from './pages/runs.js';
import { renderJobsPage } from './pages/jobs.js';
import { renderPlaygroundPage } from './pages/playground.js';
import { showToast } from './components/modal.js';

const routes = {
  overview: renderOverviewPage,
  runs: renderRunsPage,
  jobs: renderJobsPage,
  playground: renderPlaygroundPage,
};

let currentTab = 'overview';

function navigate(tabName) {
  if (!routes[tabName]) return;
  currentTab = tabName;

  // Update sidebar active states
  document.querySelectorAll('.side a').forEach(a => {
    if (a.dataset.nav === tabName) {
      a.classList.add('on');
    } else {
      a.classList.remove('on');
    }
  });

  // Render target view
  const main = document.getElementById('main');
  main.innerHTML = '';
  routes[tabName](main);
}

function initApp() {
  // Login flow handling
  const loginSection = document.getElementById('login');
  const appSection = document.getElementById('app');
  const btnSignIn = document.getElementById('btnSignIn');
  const btnGithub = document.getElementById('btnOAuthGithub');
  const emailInput = document.getElementById('loginEmail');
  const avatar = document.getElementById('userAvatar');

  const doSignIn = () => {
    const email = emailInput.value.trim() || 'dana@northwind.co';
    localStorage.setItem('userEmail', email);

    // Update avatar initials
    const initials = email.slice(0, 2).toUpperCase();
    if (avatar) {
      avatar.textContent = initials;
      avatar.title = email;
    }

    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    navigate('overview');
  };

  btnSignIn?.addEventListener('click', doSignIn);
  btnGithub?.addEventListener('click', doSignIn);

  // Setup sidebar navigation links
  document.querySelectorAll('.side a[data-nav]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(a.dataset.nav);
    });
  });

  // Docs button
  document.getElementById('btnDocs')?.addEventListener('click', () => {
    showToast('API Documentation: See README.md');
  });
}

document.addEventListener('DOMContentLoaded', initApp);
