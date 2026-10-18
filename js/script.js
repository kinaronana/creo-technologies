// Mobile menu
const btn = document.querySelector('.menu-btn');
const menu = document.getElementById('menu');
btn.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
});
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Sign-up / enquiry form
// 1) Create a free form at https://formspree.io using creotechnologieslimited@gmail.com
// 2) Paste your form link below (looks like https://formspree.io/f/abcdwxyz)
const FORM_ENDPOINT = 'https://formspree.io/f/mgaoqebd';

const form = document.getElementById('signup-form');
const statusEl = document.getElementById('form-status');

function say(msg, type) { statusEl.textContent = msg; statusEl.className = 'status ' + type; }

form.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData(form);
  if (data.get('_gotcha')) return; // spam trap
  if (!data.getAll('services').length) { say('Please choose at least one service.', 'err'); return; }
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const services = data.getAll('services').join(', ');

  // Fallback until the Formspree link is added: open the visitor's email app
  if (FORM_ENDPOINT.includes('YOUR_FORM_ID')) {
    const body = ['Name: ' + data.get('name'), 'Phone: ' + data.get('phone'), 'Email: ' + data.get('email'),
      'Business: ' + data.get('business'), 'Business type: ' + data.get('business_type'),
      'Services: ' + services, 'Preferred contact: ' + data.get('contact_method'), '', data.get('message')].join('\n');
    window.location.href = 'mailto:creotechnologieslimited@gmail.com?subject=' +
      encodeURIComponent('New sign-up from ' + data.get('name')) + '&body=' + encodeURIComponent(body);
    return;
  }

  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; say('Sending...', '');
  data.delete('services'); data.append('services', services);
  try {
    const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error();
    form.reset();
    say('Thank you! We have received your details and will contact you soon.', 'ok');
  } catch {
    say('Something went wrong. Please call 0792 645 771 or email creotechnologieslimited@gmail.com.', 'err');
  } finally { btn.disabled = false; }
});