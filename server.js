import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import cron from "node-cron";
import nodemailer from "nodemailer";
import webpush from "web-push";
import QRCode from "qrcode";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const smtp = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function auth(req, res, next) {
  try {
    const token = req.cookies.fb_token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Não autenticado." });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

function calendarMembership(req, calendarId, roles = ["member", "admin"]) {
  const row = db.prepare(`
    SELECT m.*, c.owner_user_id
    FROM memberships m
    JOIN calendars c ON c.id = m.calendar_id
    WHERE m.calendar_id = ? AND m.user_id = ? AND m.status = 'approved'
  `).get(calendarId, req.user.id);
  if (!row || !roles.includes(row.role)) return null;
  return row;
}

function slug() {
  return crypto.randomBytes(10).toString("base64url");
}

async function sendOtp(email, code) {
  if (!smtp) {
    console.log(`\n[OTP] ${email}: ${code}\n`);
    return;
  }
  await smtp.sendMail({
    from: process.env.SMTP_FROM || "Familia Barroso <no-reply@example.com>",
    to: email,
    subject: "Código de confirmação — Família Barroso",
    text: `O seu código de confirmação é ${code}. Expira em 10 minutos.`
  });
}

function seedAngolaEvents(calendarId, year) {
  const fixed = [
    ["holiday", "Ano Novo", "01-01"],
    ["holiday", "Início da Luta Armada de Libertação Nacional", "02-04"],
    ["holiday", "Dia Internacional da Mulher", "03-08"],
    ["holiday", "Dia da Libertação da África Austral", "03-23"],
    ["holiday", "Dia da Paz e da Reconciliação Nacional", "04-04"],
    ["holiday", "Dia Internacional do Trabalhador", "05-01"],
    ["holiday", "Dia do Fundador da Nação e do Herói Nacional", "09-17"],
    ["holiday", "Dia dos Finados", "11-02"],
    ["holiday", "Dia da Independência Nacional", "11-11"],
    ["holiday", "Dia de Natal e da Família", "12-25"],
    ["point", "Dia dos Mártires da Repressão Colonial", "01-04"],
    ["point", "Dia do Antigo Combatente e Veterano da Pátria", "01-15"],
    ["point", "Dia da Mulher Angolana", "03-02"],
    ["point", "Dia da Expansão da Luta Armada de Libertação Nacional", "03-15"],
    ["point", "Dia da Juventude Angolana", "04-14"],
    ["point", "Dia de África", "05-25"],
    ["point", "Dia Internacional da Criança", "06-01"],
    ["point", "Dia Internacional dos Direitos Humanos", "12-10"]
  ];

  const easter = (() => {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  })();

  const fmt = d => `${year}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
  const goodFriday = new Date(easter); goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  const carnival = new Date(easter); carnival.setUTCDate(carnival.getUTCDate() - 47);

  fixed.push(["holiday", "Sexta-Feira Santa", fmt(goodFriday).slice(5)]);
  fixed.push(["holiday", "Carnaval", fmt(carnival).slice(5)]);

  const insert = db.prepare(`
    INSERT INTO events(calendar_id,type,title,event_date,is_default)
    VALUES(?,?,?,?,1)
  `);

  const tx = db.transaction(() => {
    for (const [type, title, mmdd] of fixed) {
      const date = `${year}-${mmdd}`;
      const exists = db.prepare(`
        SELECT id FROM events WHERE calendar_id=? AND event_date=? AND title=?
      `).get(calendarId, date, title);
      if (!exists) insert.run(calendarId, type, title, date);
    }
  });
  tx();
}

function generateNotifications() {
  const calendars = db.prepare("SELECT * FROM calendars").all();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()).padStart(2,"0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  for (const cal of calendars) {
    const members = db.prepare(`
      SELECT user_id FROM memberships
      WHERE calendar_id=? AND status='approved'
    `).all(cal.id);

    const events = db.prepare(`
      SELECT * FROM events WHERE calendar_id=? AND substr(event_date,6,5) = ?
    `).all(cal.id, `${mm}-${dd}`);

    const monthEvents = db.prepare(`
      SELECT * FROM events WHERE calendar_id=? AND substr(event_date,1,7)=?
    `).all(cal.id, `${yyyy}-${mm}`);

    for (const event of events) {
      for (const member of members) {
        const daysUntil = 0;
        db.prepare(`
          INSERT OR IGNORE INTO notifications
          (calendar_id,user_id,event_id,kind,title,body,scheduled_for)
          VALUES(?,?,?,?,?,?,?)
        `).run(
          cal.id, member.user_id, event.id, "today",
          event.title,
          `${event.title} é hoje. Abra o calendário para participar.`,
          todayStr
        );
      }
    }

    for (const event of monthEvents) {
      const eventDate = new Date(`${event.event_date}T00:00:00`);
      const firstOfMonth = `${yyyy}-${mm}-01`;
      if (eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === yyyy) {
        for (const member of members) {
          db.prepare(`
            INSERT OR IGNORE INTO notifications
            (calendar_id,user_id,event_id,kind,title,body,scheduled_for)
            VALUES(?,?,?,?,?,?,?)
          `).run(
            cal.id, member.user_id, event.id, "month-start",
            "Datas marcadas este mês",
            `${event.title} está marcado para ${event.event_date}.`,
            firstOfMonth
          );
        }
      }
    }

    const eventRows = db.prepare(`
      SELECT * FROM events
      WHERE calendar_id=? AND event_date BETWEEN date(?) AND date(?, '+7 day')
    `).all(cal.id, todayStr, todayStr);

    for (const event of eventRows) {
      const eventDate = new Date(`${event.event_date}T00:00:00`);
      const diff = Math.ceil((eventDate - new Date(`${todayStr}T00:00:00`)) / 86400000);
      if (diff === 7) {
        for (const member of members) {
          db.prepare(`
            INSERT OR IGNORE INTO notifications
            (calendar_id,user_id,event_id,kind,title,body,scheduled_for)
            VALUES(?,?,?,?,?,?,?)
          `).run(
            cal.id, member.user_id, event.id, "week-before",
            "Uma data especial aproxima-se",
            `${event.title} acontece dentro de uma semana.`,
            todayStr
          );
        }
      }
      if (diff === 1) {
        for (const member of members) {
          db.prepare(`
            INSERT OR IGNORE INTO notifications
            (calendar_id,user_id,event_id,kind,title,body,scheduled_for)
            VALUES(?,?,?,?,?,?,?)
          `).run(
            cal.id, member.user_id, event.id, "day-before",
            "É amanhã",
            `${event.title} acontece amanhã.`,
            todayStr
          );
        }
      }
    }
  }
}

async function dispatchNotifications() {
  generateNotifications();
  const pending = db.prepare(`
    SELECT n.*, u.email, u.name
    FROM notifications n
    JOIN users u ON u.id=n.user_id
    WHERE n.sent_at IS NULL AND n.scheduled_for <= date('now')
    LIMIT 200
  `).all();

  for (const n of pending) {
    let sent = false;

    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const subs = db.prepare("SELECT subscription_json FROM push_subscriptions WHERE user_id=?").all(n.user_id);
      for (const sub of subs) {
        try {
          await webpush.sendNotification(JSON.parse(sub.subscription_json), JSON.stringify({
            title: n.title,
            body: n.body,
            url: `${BASE_URL}/calendar/${n.calendar_id}`
          }));
          sent = true;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            db.prepare("DELETE FROM push_subscriptions WHERE subscription_json=?").run(sub.subscription_json);
          }
        }
      }
    }

    if (smtp) {
      try {
        await smtp.sendMail({
          from: process.env.SMTP_FROM || "Familia Barroso <no-reply@example.com>",
          to: n.email,
          subject: n.title,
          text: n.body
        });
        sent = true;
      } catch {}
    }

    // Mesmo sem provider externo, marcamos como processada para não duplicar.
    db.prepare("UPDATE notifications SET sent_at=CURRENT_TIMESTAMP WHERE id=?").run(n.id);
    console.log(`[NOTIF] ${n.email}: ${n.title} ${sent ? "(enviada)" : "(registada; configure SMTP/Web Push para entrega)"}`);
  }
}

cron.schedule("0 8 * * *", () => dispatchNotifications());

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "Familia Barroso Calendar API" });
});

app.get("/api/templates", (_, res) => {
  res.json({
    templates: [
      { id: "barroso", name: "Família Barroso", description: "Azul, branco e dourado, inspirado no cartaz enviado." },
      { id: "royal", name: "Royal Azul & Ouro", description: "Visual premium com destaque para aniversários." },
      { id: "memory", name: "Memórias da Família", description: "Verde e azul para datas e memórias." }
    ],
    paper: { size: "A3", widthMm: 420, heightMm: 297, orientation: "landscape" }
  });
});

app.post("/api/calendars", async (req, res) => {
  const { name, year = 2027, template = "barroso", adminName, email, password } = req.body;
  if (!name || !adminName || !email || !password) {
    return res.status(400).json({ error: "Nome do calendário, nome do administrador, email e senha são obrigatórios." });
  }

  const emailNorm = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email=?").get(emailNorm);
  if (existing) return res.status(409).json({ error: "Este email já está registado." });

  const passwordHash = await bcrypt.hash(password, 12);
  const tx = db.transaction(() => {
    const user = db.prepare(`
      INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')
    `).run(adminName.trim(), emailNorm, passwordHash);

    const publicId = slug();
    const cal = db.prepare(`
      INSERT INTO calendars(public_id,name,year,template,owner_user_id)
      VALUES(?,?,?,?,?)
    `).run(publicId, name.trim(), Number(year), template, user.lastInsertRowid);

    db.prepare(`
      INSERT INTO memberships(calendar_id,user_id,role,status)
      VALUES(?,?, 'admin','approved')
    `).run(cal.lastInsertRowid, user.lastInsertRowid);

    seedAngolaEvents(cal.lastInsertRowid, Number(year));
    return { userId: user.lastInsertRowid, calendarId: cal.lastInsertRowid, publicId };
  });

  const result = tx();
  const token = sign({ id: result.userId, email: emailNorm, name: adminName.trim(), role: "admin" });
  res.cookie("fb_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30*86400000 });
  res.json({
    ok: true,
    calendarId: result.calendarId,
    publicId: result.publicId,
    url: `${BASE_URL}/calendar/${result.publicId}`
  });
});

app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Email ou senha inválidos." });
  }
  const token = sign(user);
  res.cookie("fb_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30*86400000 });
  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("fb_token");
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/access/request", async (req, res) => {
  const { publicId, name, email, phone } = req.body;
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(publicId);
  if (!cal) return res.status(404).json({ error: "Calendário não encontrado." });
  if (!name || !email) return res.status(400).json({ error: "Nome e email são obrigatórios." });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await bcrypt.hash(code, 10);
  db.prepare(`
    INSERT INTO otp_codes(email,code_hash,purpose,calendar_id,expires_at)
    VALUES(?,?,?,?,datetime('now','+10 minutes'))
  `).run(email.trim().toLowerCase(), hash, "access", cal.id);

  await sendOtp(email.trim().toLowerCase(), code);

  res.json({ ok: true, message: "Código enviado. Confirme o OTP para criar o pedido de acesso." });
});

app.post("/api/access/verify", async (req, res) => {
  const { publicId, name, email, phone, code } = req.body;
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(publicId);
  if (!cal) return res.status(404).json({ error: "Calendário não encontrado." });

  const otp = db.prepare(`
    SELECT * FROM otp_codes
    WHERE email=? AND calendar_id=? AND purpose='access' AND used=0 AND expires_at > datetime('now')
    ORDER BY id DESC LIMIT 1
  `).get(email.trim().toLowerCase(), cal.id);

  if (!otp || !(await bcrypt.compare(String(code), otp.code_hash))) {
    return res.status(400).json({ error: "Código OTP inválido ou expirado." });
  }

  db.prepare("UPDATE otp_codes SET used=1 WHERE id=?").run(otp.id);

  let user = db.prepare("SELECT * FROM users WHERE email=?").get(email.trim().toLowerCase());
  if (!user) {
    const tmpPassword = crypto.randomBytes(18).toString("hex");
    const passwordHash = await bcrypt.hash(tmpPassword, 10);
    const r = db.prepare(`
      INSERT INTO users(name,email,password_hash,phone,role)
      VALUES(?,?,?,?, 'member')
    `).run(name.trim(), email.trim().toLowerCase(), passwordHash, phone || null);
    user = db.prepare("SELECT * FROM users WHERE id=?").get(r.lastInsertRowid);
  }

  const membership = db.prepare(`
    SELECT * FROM memberships WHERE calendar_id=? AND user_id=?
  `).get(cal.id, user.id);

  if (membership?.status === "approved") {
    const token = sign(user);
    res.cookie("fb_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30*86400000
    });
    return res.json({
      ok: true,
      authenticated: true,
      message: "Acesso autorizado. Sessão iniciada."
    });
  }

  db.prepare(`
    INSERT INTO memberships(calendar_id,user_id,role,status)
    VALUES(?,?,'member','pending')
    ON CONFLICT(calendar_id,user_id) DO UPDATE SET status='pending'
  `).run(cal.id, user.id);

  res.json({
    ok: true,
    authenticated: false,
    message: "Identidade confirmada. Aguarde aprovação do administrador."
  });
});

app.get("/api/calendars/:publicId", (req, res) => {
  const cal = db.prepare(`
    SELECT id,public_id,name,year,template,created_at FROM calendars WHERE public_id=?
  `).get(req.params.publicId);
  if (!cal) return res.status(404).json({ error: "Calendário não encontrado." });

  const people = db.prepare(`
    SELECT id,name,birth_date,relationship,photo,bio FROM people WHERE calendar_id=? ORDER BY birth_date
  `).all(cal.id);

  const events = db.prepare(`
    SELECT id,type,title,event_date,relationship,person_id,description,is_default
    FROM events WHERE calendar_id=? ORDER BY event_date
  `).all(cal.id);

  const messages = db.prepare(`
    SELECT m.id,m.message,m.created_at,p.name AS recipient_name,u.name AS sender_name
    FROM messages m
    JOIN people p ON p.id=m.recipient_person_id
    JOIN users u ON u.id=m.sender_user_id
    WHERE m.calendar_id=?
    ORDER BY m.created_at DESC
  `).all(cal.id);

  res.json({ calendar: cal, people, events, messages });
});

app.get("/api/calendars/:publicId/admin", auth, (req, res) => {
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(req.params.publicId);
  if (!cal) return res.status(404).json({ error: "Calendário não encontrado." });
  const membership = calendarMembership(req, cal.id, ["admin"]);
  if (!membership) return res.status(403).json({ error: "Apenas o administrador pode acessar." });

  const members = db.prepare(`
    SELECT m.id,m.user_id,m.role,m.status,u.name,u.email,u.phone
    FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE m.calendar_id=? ORDER BY m.status,m.created_at
  `).all(cal.id);

  res.json({ calendar: cal, members });
});

app.post("/api/calendars/:publicId/people", auth, (req, res) => {
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(req.params.publicId);
  if (!cal || !calendarMembership(req, cal.id, ["admin","member"])) return res.status(403).json({ error: "Sem permissão." });

  const { name, birthDate, relationship, bio = "" } = req.body;
  if (!name || !birthDate || !relationship) return res.status(400).json({ error: "Nome, data e parentesco são obrigatórios." });

  const result = db.prepare(`
    INSERT INTO people(calendar_id,name,birth_date,relationship,bio)
    VALUES(?,?,?,?,?)
  `).run(cal.id, name, birthDate, relationship, bio);

  db.prepare(`
    INSERT INTO events(calendar_id,type,title,event_date,relationship,person_id,description)
    VALUES(?,?,?,?,?,?,?)
  `).run(cal.id, "birthday", `Aniversário de ${name}`, birthDate, relationship, result.lastInsertRowid, bio);

  res.json({ ok: true, id: result.lastInsertRowid });
});

app.post("/api/calendars/:publicId/events", auth, (req, res) => {
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(req.params.publicId);
  if (!cal || !calendarMembership(req, cal.id, ["admin","member"])) return res.status(403).json({ error: "Sem permissão." });

  const { title, date, type = "family", description = "" } = req.body;
  if (!title || !date) return res.status(400).json({ error: "Título e data são obrigatórios." });

  const result = db.prepare(`
    INSERT INTO events(calendar_id,type,title,event_date,description)
    VALUES(?,?,?,?,?)
  `).run(cal.id, type, title, date, description);

  res.json({ ok: true, id: result.lastInsertRowid });
});

app.delete("/api/calendars/:publicId/events/:id", auth, (req, res) => {
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(req.params.publicId);
  if (!cal || !calendarMembership(req, cal.id, ["admin"])) return res.status(403).json({ error: "Apenas o administrador pode apagar datas." });
  db.prepare("DELETE FROM events WHERE id=? AND calendar_id=? AND is_default=0").run(req.params.id, cal.id);
  res.json({ ok: true });
});

app.post("/api/calendars/:publicId/members/:membershipId/approve", auth, (req, res) => {
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(req.params.publicId);
  if (!cal || !calendarMembership(req, cal.id, ["admin"])) return res.status(403).json({ error: "Sem permissão." });
  db.prepare("UPDATE memberships SET status='approved' WHERE id=? AND calendar_id=?").run(req.params.membershipId, cal.id);
  res.json({ ok: true });
});

app.post("/api/calendars/:publicId/members/:membershipId/reject", auth, (req, res) => {
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(req.params.publicId);
  if (!cal || !calendarMembership(req, cal.id, ["admin"])) return res.status(403).json({ error: "Sem permissão." });
  db.prepare("UPDATE memberships SET status='rejected' WHERE id=? AND calendar_id=?").run(req.params.membershipId, cal.id);
  res.json({ ok: true });
});

app.post("/api/calendars/:publicId/messages", auth, (req, res) => {
  const cal = db.prepare("SELECT * FROM calendars WHERE public_id=?").get(req.params.publicId);
  if (!cal || !calendarMembership(req, cal.id, ["admin","member"])) return res.status(403).json({ error: "Apenas membros autorizados podem enviar mensagens." });

  const { personId, message } = req.body;
  const person = db.prepare("SELECT id FROM people WHERE id=? AND calendar_id=?").get(personId, cal.id);
  if (!person || !message?.trim()) return res.status(400).json({ error: "Destinatário ou mensagem inválidos." });

  db.prepare(`
    INSERT INTO messages(calendar_id,recipient_person_id,sender_user_id,message)
    VALUES(?,?,?,?)
  `).run(cal.id, person.id, req.user.id, message.trim());

  res.json({ ok: true });
});

app.get("/api/notifications", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id=? ORDER BY scheduled_for DESC, id DESC LIMIT 100
  `).all(req.user.id);
  res.json({ notifications: rows });
});

app.get("/api/push/public-key", (_, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

app.post("/api/push/subscribe", auth, (req, res) => {
  if (!req.body?.endpoint) return res.status(400).json({ error: "Subscription inválida." });
  db.prepare(`
    INSERT INTO push_subscriptions(user_id,endpoint,subscription_json)
    VALUES(?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,subscription_json=excluded.subscription_json
  `).run(req.user.id, req.body.endpoint, JSON.stringify(req.body));
  res.json({ ok: true });
});

app.get("/api/calendars/:publicId/qr.png", async (req, res) => {
  const cal = db.prepare("SELECT public_id FROM calendars WHERE public_id=?").get(req.params.publicId);
  if (!cal) return res.status(404).end();
  const buffer = await QRCode.toBuffer(`${BASE_URL}/calendar/${cal.public_id}`, {
    width: 800,
    margin: 2,
    color: { dark: "#063b91", light: "#ffffff" }
  });
  res.type("png").send(buffer);
});

app.get("/calendar/:publicId", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\nFamília Barroso Calendar`);
  console.log(`Local: ${BASE_URL}`);
  console.log(`API:   ${BASE_URL}/api/health\n`);
  dispatchNotifications().catch(console.error);
});
