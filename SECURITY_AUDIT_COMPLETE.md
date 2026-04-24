# 🔐 SECURITY AUDIT - Creator Studio
**Datum:** April 2026  
**Auditor:** Senior Fullstack Engineer + Security Auditor  
**Status:** ⚠️ KRITISCHE SICHERHEITSLÜCKEN GEFUNDEN

---

## 🚨 EXECUTIVE SUMMARY

### ❌ PROJEKTSTATUS: **NICHT PRODUCTION-READY**

**Die App hat mehrere kritische Sicherheitslücken und Logikfehler, die SOFORT behoben werden müssen bevor echte Zahlungen verarbeitet werden.**

---

## 1. 🔐 SECURITY ISSUES

### ❌ KRITISCH (Muss SOFORT gefixt werden)

#### 1.1 **Kein Rate Limiting** 
**Risiko:** DDoS, Brute Force, API Abuse  
**Ort:** `backend/server.js` - Kein Rate Limiting implementiert

```javascript
// PROBLEM: Jeder kann unbegrenzt Requests machen
app.post('/api/use-coins', async (req, res) => { ... })
```

**Fix:**
```javascript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Limit pro IP
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter für Coin-Operationen
const coinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 10, // Max 10 Coin-Operationen pro Minute
  message: { error: 'Coin operations limited' }
});

app.use('/api/', apiLimiter);
app.use('/api/use-coins', coinLimiter);
app.use('/api/create-checkout-session', coinLimiter);
```

---

#### 1.2 **Race Condition bei Coin-Abzug** 
**Risiko:** Negative Coins, doppelte Abzüge  
**Ort:** `backend/server.js` - `/api/use-coins`

```javascript
// PROBLEM: Keine Firestore Transaction!
const userRef = db.collection('users').doc(uid);
const doc = await userRef.get();  // <- Zeitfenster für Race Condition
const currentCoins = doc.data().coins || 0;

if (currentCoins < amount) { ... }

await userRef.update({ coins: currentCoins - amount });  // <- Race Condition!
```

**Fix:**
```javascript
app.post('/api/use-coins', authenticateUser, async (req, res) => {
  try {
    const { amount } = req.body;
    const uid = req.user.uid;
    
    // Validation
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
      return res.status(400).json({ error: 'Invalid amount (1-1000)' });
    }
    
    const userRef = db.collection('users').doc(uid);
    
    // ✅ TRANSACTION - Atomic operation
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      
      if (!doc.exists) {
        throw new Error('User not found');
      }
      
      const currentCoins = doc.data().coins || 0;
      
      if (currentCoins < amount) {
        throw new Error('Insufficient coins');
      }
      
      // Update within transaction
      transaction.update(userRef, { 
        coins: currentCoins - amount,
        lastCoinUpdate: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Audit log
      const auditRef = db.collection('coinTransactions').doc();
      transaction.set(auditRef, {
        uid,
        type: 'DEBIT',
        amount,
        balanceBefore: currentCoins,
        balanceAfter: currentCoins - amount,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Use coins error:', error);
    res.status(400).json({ error: error.message });
  }
});
```

---

#### 1.3 **Keine Input Validation** 
**Risiko:** Type Confusion, negative Coins, Injection  
**Ort:** Mehrere Endpoints

```javascript
// PROBLEM: Keine Validierung!
const { amount } = req.body;  // <- Könnte String, Object, -999999 sein
```

**Fix für alle Endpoints:**
```javascript
// Validation helper
const validateCoins = (amount) => {
  if (!Number.isInteger(amount)) return 'Amount must be integer';
  if (amount < 1) return 'Amount must be positive';
  if (amount > 1000) return 'Amount too large (max 1000)';
  return null;
};

const validateString = (str, maxLen = 100) => {
  if (typeof str !== 'string') return 'Must be string';
  if (str.length > maxLen) return `Max ${maxLen} characters`;
  if (/[<>\"']/.test(str)) return 'Invalid characters';
  return null;
};

// Usage
app.post('/api/use-coins', authenticateUser, (req, res, next) => {
  const error = validateCoins(req.body.amount);
  if (error) return res.status(400).json({ error });
  next();
});
```

---

#### 1.4 **Webhook ohne Duplicate Protection** 
**Risiko:** Doppelte Coin-Gutschrift  
**Ort:** `backend/server.js` - `/webhook`

```javascript
// PROBLEM: Keine Prüfung ob Event schon verarbeitet!
case 'checkout.session.completed':
  await addCoins(uid, packageData.coins);  // <- Wird bei jedem Webhook aufgerufen
```

**Fix:**
```javascript
// Store processed events
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // ✅ Check for duplicate
  const eventRef = db.collection('stripeEvents').doc(event.id);
  const eventDoc = await eventRef.get();
  
  if (eventDoc.exists) {
    console.log(`Event ${event.id} already processed`);
    return res.json({received: true, duplicate: true});
  }
  
  // Mark as processing
  await eventRef.set({
    type: event.type,
    processedAt: null,
    created: admin.firestore.FieldValue.serverTimestamp()
  });
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.metadata.uid;
        const coins = getCoinsFromSession(session);
        
        // Transaction for idempotency
        await db.runTransaction(async (t) => {
          const userRef = db.collection('users').doc(uid);
          const userDoc = await t.get(userRef);
          
          if (!userDoc.exists) {
            throw new Error('User not found');
          }
          
          const currentCoins = userDoc.data().coins || 0;
          
          t.update(userRef, { 
            coins: currentCoins + coins,
            lastPayment: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Payment record
          t.set(db.collection('payments').doc(), {
            uid,
            stripeSessionId: session.id,
            stripeEventId: event.id,
            coins,
            amount: session.amount_total,
            status: 'completed',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        
        break;
      }
    }
    
    // Mark as completed
    await eventRef.update({ processedAt: admin.firestore.FieldValue.serverTimestamp() });
    
  } catch (error) {
    await eventRef.update({ error: error.message });
    throw error;
  }
  
  res.json({received: true});
});
```

---

#### 1.5 **CORS zu offen**
**Risiko:** CSRF, unauthorized access  
**Ort:** `backend/server.js`

```javascript
// PROBLEM: Zu offen
app.use(cors({ origin: true }));  // <- Erlaubt ALLE Origins!
```

**Fix:**
```javascript
const allowedOrigins = [
  'https://logomakergermany-kreativtool.web.app',
  'https://www.logomakergermany-kreativtool.web.app',
  'http://localhost:3000',  // Nur für Development
  'http://localhost:5000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS policy violation'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

---

### ⚠️ MITTEL (Sollte bald gefixt werden)

#### 2.1 **Keine Helmet.js Security Headers**
```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### 2.2 **Keine Request Logging**
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log all requests
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
  next();
});
```

#### 2.3 **Kein HTTPS Redirect**
```javascript
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

## 2. 💸 PAYMENT FLOW ISSUES

### ❌ KRITISCH

#### 2.1 **Coins werden im Frontend berechnet**
**Risiko:** Manipulation der Coin-Pakete  
**Ort:** `frontend/js/coins.js:51-55`

```javascript
// PROBLEM: Frontend bestimmt wie viele Coins man kriegt!
const packages = {
  starter: { name: 'Starter', coins: 50, price: '4,99€' },
  professional: { name: 'Professional', coins: 150, price: '12,99€' },
  enterprise: { name: 'Enterprise', coins: 500, price: '39,99€' }
};
```

**Fix:**
```javascript
// Backend bestimmt Coins - Frontend zeigt nur an
app.post('/api/create-checkout-session', authenticateUser, async (req, res) => {
  const { pack } = req.body;
  
  // Server-side package definition
  const packages = {
    starter: { coins: 50, priceId: 'price_12345' },
    professional: { coins: 150, priceId: 'price_67890' },
    enterprise: { coins: 500, priceId: 'price_abcde' }
  };
  
  const selected = packages[pack];
  if (!selected) {
    return res.status(400).json({ error: 'Invalid package' });
  }
  
  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: selected.priceId, quantity: 1 }],
    metadata: { 
      uid: req.user.uid,
      coins: selected.coins.toString(),  // Backend determines coins!
      package: pack
    }
  });
  
  res.json({ url: session.url });
});
```

---

#### 2.2 **Keine Payment Verification**
**Risiko:** Fake-Zahlungen  
**Ort:** Webhook prüft nicht ob Zahlung wirklich erfolgreich war

```javascript
// PROBLEM: Keine Prüfung auf payment_status
case 'checkout.session.completed':
  // Was wenn Zahlung failed?
```

**Fix:**
```javascript
case 'checkout.session.completed': {
  const session = event.data.object;
  
  // ✅ Verify payment status
  if (session.payment_status !== 'paid') {
    console.log(`Payment not completed: ${session.payment_status}`);
    return res.json({received: true, status: 'unpaid'});
  }
  
  // Verify amount
  const expectedAmount = getExpectedAmount(session.metadata.package);
  if (session.amount_total !== expectedAmount) {
    console.error(`Amount mismatch: ${session.amount_total} vs ${expectedAmount}`);
    return res.status(400).json({error: 'Amount mismatch'});
  }
  
  // ... add coins
}
```

---

## 3. 🪙 COIN SYSTEM ISSUES

### ❌ KRITISCH

#### 3.1 **Kein Coin Cap / Max Limit**
**Risiko:** Integer Overflow, unendlich Coins  
**Fix:**
```javascript
const MAX_COINS = 1000000; // 1 Million Coins Max

if (newBalance > MAX_COINS) {
  throw new Error('Maximum coin limit reached');
}
```

#### 3.2 **Keine Coin History**
**Risiko:** Keine Nachvollziehbarkeit bei Disputes  
**Fix:** Siehe Transaction-Code oben mit Audit-Log

---

## 4. 🌐 FRONTEND ISSUES

### ❌ KRITISCH

#### 4.1 **Token in localStorage**
**Risiko:** XSS kann Token stehlen  
**Status:** ✅ Akzeptabel für Firebase, aber beachten

#### 4.2 **Keine CSRF Protection**
**Risiko:** CSRF Angriffe  
**Fix:**
```javascript
// Add CSRF token to requests
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

fetch('/api/endpoint', {
  headers: {
    'X-CSRF-Token': csrfToken
  }
});
```

---

## 5. 📋 DEPLOYMENT CHECKLIST

### ✅ Muss vor Launch gemacht werden:

- [ ] Rate Limiting aktivieren
- [ ] Firestore Transactions für alle Coin-Operationen
- [ ] Webhook Duplicate Protection
- [ ] Input Validation überall
- [ ] Helmet.js hinzufügen
- [ ] CORS restrictiven
- [ ] HTTPS Redirect
- [ ] Payment Verification
- [ ] Audit Logging
- [ ] Error Monitoring (Sentry)
- [ ] Database Backup einrichten
- [ ] Stripe Live Keys eintragen
- [ ] Webhook Endpoint in Stripe Dashboard konfigurieren
- [ ] AGB + Datenschutz + Impressum

---

## 6. 🔥 IMMEDIATE FIXES (Copy-Paste Ready)

### Fix 1: Middleware für Auth
```javascript
// middleware/auth.js
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Fix 2: Validierungs-Middleware
```javascript
// middleware/validate.js
export const validateCoins = (req, res, next) => {
  const amount = req.body.amount;
  
  if (!Number.isInteger(amount)) {
    return res.status(400).json({ error: 'Amount must be integer' });
  }
  
  if (amount < 1 || amount > 1000) {
    return res.status(400).json({ error: 'Amount must be 1-1000' });
  }
  
  next();
};
```

---

## 7. ✅ FINAL CHECK: Production Ready?

| Kriterium | Status | ❌/⚠️/✅ |
|-----------|--------|----------|
| Rate Limiting | Fehlt | ❌ |
| Auth Protection | Teilweise | ⚠️ |
| Input Validation | Fehlt | ❌ |
| Firestore Transactions | Fehlt | ❌ |
| Webhook Security | Unvollständig | ⚠️ |
| CORS | Zu offen | ⚠️ |
| Security Headers | Fehlen | ⚠️ |
| Audit Logging | Fehlt | ❌ |
| Error Handling | Basis | ⚠️ |
| HTTPS | Nicht erzwungen | ⚠️ |

### 🚨 ENTSCHEIDUNG: **NICHT PRODUCTION-READY**

**Empfohlene Actions:**
1. Sofort alle KRITISCHEN Fixes implementieren
2. Security Review mit Team
3. Penetration Testing
4. Dann Soft Launch mit limitierten Nutzern
5. Monitoring aufbauen
6. Vollständiger Launch

---

## 📞 NEXT STEPS

1. Implementiere alle KRITISCHEN Fixes
2. Teste mit Stripe Test Mode
3. Security Audit wiederholen
4. Deploy auf Staging
5. Penetration Testing
6. Production Deploy

**Geschätzter Aufwand:** 2-3 Tage für alle Fixes
