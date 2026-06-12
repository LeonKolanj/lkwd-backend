/**
 * LKWD Backend — Café Solna Admin API
 * Express 5 · JWT sessions · File-based persistence
 *
 * ERSÄTTER: server.js (i roten av lkwd-backend/)
 */

const express    = require('express');
const crypto     = require('crypto');
const fs         = require('fs');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  const allowed = [
    'https://lkwd.se',
    'https://www.lkwd.se',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'null'
  ];
  const origin = req.headers.origin || 'null';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || hashPassword('cafe2025');
const JWT_SECRET = process.env.JWT_SECRET || 'lkwd-secret-change-me-in-production';
const TOKEN_TTL_HOURS = 8;
const DATA_FILE = path.join(__dirname, 'data', 'cafe.json');

function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain + 'lkwd-salt').digest('hex');
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig    = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

const DEFAULT_DATA = {
  lunch: {
    description: 'Grillad lax med örtcrème fraiche, pressad potatis och sallad',
    price: '125:-'
  },
  reviews: [
    { text: 'Bästa cafét i Solna! Fantastiskt kaffe och otroligt goda bakverk. Personalen är alltid så trevlig.', name: 'Maria, Solna', title: 'Återkommande gäst' },
    { text: 'Älskar deras veckas lunch! God mat till bra pris. Perfekt för en lunchdejt.', name: 'Johan, Stockholm', title: 'Lunchgäst' },
    { text: 'Mysigaste cafét. Bra arbetsplats, god fika och härlig atmosfär. Rekommenderas varmt!', name: 'Anna, Sundbyberg', title: 'Jobbar på distans' }
  ],
  badges: {
    'Bryggkaffe':      { type: 'popular',    id: 'pop1' },
    'Cappuccino':      { type: 'bestseller', id: 'pop2' },
    'Kardemummabulle': { type: 'popular',    id: 'pop3' },
    'Dagens soppa':    { type: 'bestseller', id: 'pop4' }
  }
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Could not read data file, using defaults:', e.message); }
  return structuredClone(DEFAULT_DATA);
}

function saveData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) { console.error('Could not save data:', e.message); return false; }
}

let cafeData = loadData();

app.get('/', (req, res) => res.json({ message: 'LKWD Backend lever! 🚀', version: '2.0' }));

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Lösenord saknas' });
  const hash = hashPassword(password);
  if (hash !== ADMIN_PASSWORD_HASH) {
    setTimeout(() => res.status(401).json({ error: 'Fel lösenord' }), 300);
    return;
  }
  const exp   = Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000;
  const token = signToken({ role: 'admin', exp });
  res.json({ token, expiresIn: TOKEN_TTL_HOURS * 3600 });
});

app.post('/api/auth/verify', requireAuth, (req, res) => res.json({ valid: true }));

app.get('/api/cafe', (req, res) => res.json(cafeData));

app.put('/api/cafe/lunch', requireAuth, (req, res) => {
  const { description, price } = req.body;
  if (!description?.trim() || !price?.trim()) return res.status(400).json({ error: 'description och price krävs' });
  cafeData.lunch = { description: description.trim(), price: price.trim() };
  saveData(cafeData);
  res.json({ success: true, lunch: cafeData.lunch });
});

app.put('/api/cafe/reviews', requireAuth, (req, res) => {
  const { reviews } = req.body;
  if (!Array.isArray(reviews) || reviews.length === 0) return res.status(400).json({ error: 'reviews måste vara en array' });
  cafeData.reviews = reviews.map(r => ({ text: String(r.text||'').trim(), name: String(r.name||'').trim(), title: String(r.title||'').trim() }));
  saveData(cafeData);
  res.json({ success: true, reviews: cafeData.reviews });
});

app.put('/api/cafe/badges', requireAuth, (req, res) => {
  const { badges } = req.body;
  if (typeof badges !== 'object' || Array.isArray(badges)) return res.status(400).json({ error: 'badges måste vara ett objekt' });
  cafeData.badges = badges;
  saveData(cafeData);
  res.json({ success: true, badges: cafeData.badges });
});

app.put('/api/cafe/settings', requireAuth, (req, res) => {
  const { lunch, reviews } = req.body;
  let updated = false;
  if (lunch?.description?.trim() && lunch?.price?.trim()) {
    cafeData.lunch = { description: lunch.description.trim(), price: lunch.price.trim() };
    updated = true;
  }
  if (Array.isArray(reviews) && reviews.length > 0) {
    cafeData.reviews = reviews.map(r => ({ text: String(r.text||'').trim(), name: String(r.name||'').trim(), title: String(r.title||'').trim() }));
    updated = true;
  }
  if (!updated) return res.status(400).json({ error: 'Ingen data att spara' });
  saveData(cafeData);
  res.json({ success: true, data: cafeData });
});

app.listen(PORT, () => {
  console.log(`\n🚀 LKWD Backend körs på http://localhost:${PORT}`);
  console.log(`📁 Data sparas i: ${DATA_FILE}`);
  console.log(`🔐 Admin-token TTL: ${TOKEN_TTL_HOURS} timmar\n`);
});
