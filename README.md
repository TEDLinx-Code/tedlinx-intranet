# Company Intranet — Phase 2

React + Express + MongoDB intranet with Odoo integration.
**Hosting: Vercel (frontend) + Railway (backend) + MongoDB Atlas — all free for up to 20 users.**

## Modules
- Leave management (submit, track, approve/refuse + email notification)
- Expense management (submit with receipt, approve/refuse + email notification)
- Employee directory (live from Odoo HR)
- Documents hub (live from Odoo Documents module)
- Manager approvals dashboard

---

## Project structure

```
intranet/
├── backend/               Express.js API
│   ├── routes/            auth, leave, expense, directory, documents, users
│   ├── models/User.js     Employee login accounts (MongoDB)
│   ├── middleware/auth.js JWT authentication
│   ├── services/
│   │   ├── odoo.service.js    All Odoo JSON-RPC calls
│   │   └── email.service.js   Nodemailer notifications
│   ├── server.js
│   ├── railway.toml       Railway deploy config
│   └── .env.example
└── frontend/              React (Vite) app
    ├── src/pages/         Home, Leave, Expense, Directory, Documents, Approvals
    ├── src/components/    Sidebar, layout
    ├── src/context/       Auth state
    ├── src/services/api.js  Axios (auto-switches dev/prod URL)
    └── vercel.json        Vercel SPA routing config
```

---

## Step 1 — Set up MongoDB Atlas (free)

1. Go to **mongodb.com/atlas** and create a free account
2. Create a free cluster (M0 — always free)
3. Under **Database Access** → add a user with password
4. Under **Network Access** → Allow access from anywhere (`0.0.0.0/0`)
5. Click **Connect** → **Drivers** → copy the connection string
   It looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/intranet`
6. Save this — you'll paste it into Railway in Step 3

---

## Step 2 — Deploy backend to Railway

1. Push the `intranet` folder to a **GitHub repository**
2. Go to **railway.app** → sign up with GitHub → **New Project** → **Deploy from GitHub**
3. Select your repo → select the **`backend`** folder as the root
4. Railway will auto-detect Node.js and deploy

### Set environment variables in Railway dashboard

Go to your service → **Variables** tab → add these one by one:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | Any long random string e.g. `xK9mP2qR8vL5nT1wY4uA7cB3` |
| `JWT_EXPIRES_IN` | `7d` |
| `ODOO_URL` | `https://yourcompany.odoo.com` |
| `ODOO_DB` | Your Odoo database name |
| `ODOO_USERNAME` | Service account email in Odoo |
| `ODOO_PASSWORD` | Service account password |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Your Gmail App Password (not your login password) |
| `EMAIL_FROM` | `MyCompany Intranet <noreply@yourcompany.com>` |
| `FRONTEND_URL` | Leave blank for now — fill in after Step 3 |

5. After deploy, copy your Railway backend URL — looks like `https://intranet-backend.up.railway.app`

---

## Step 3 — Deploy frontend to Vercel

1. Go to **vercel.com** → sign up with GitHub → **Add New Project**
2. Select your GitHub repo → set **Root Directory** to `frontend`
3. Under **Environment Variables** add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | Your Railway backend URL e.g. `https://intranet-backend.up.railway.app` |

4. Click **Deploy** — Vercel builds and gives you a URL like `https://intranet.vercel.app`
5. (Optional) Under **Domains** → add your own domain e.g. `intranet.yourcompany.com`

### Go back to Railway and set FRONTEND_URL

Update the `FRONTEND_URL` variable to your Vercel URL so CORS and email links work correctly.

---

## Step 4 — Create your admin account (once only)

Call this endpoint once after deploying:

```
POST https://your-railway-url.up.railway.app/api/auth/seed-admin
Content-Type: application/json

{"email": "admin@yourcompany.com", "password": "StrongPass@123"}
```

You can do this from your browser using a tool like **Hoppscotch** (hoppscotch.io) or just ask your developer.

Then log in at your Vercel URL with those credentials.

---

## Step 5 — Create employee accounts

For each employee, POST to `/api/users` with your admin token:

```json
{
  "name": "Rajan Kumar",
  "email": "rajan@yourcompany.com",
  "password": "Welcome@123",
  "role": "employee",
  "department": "Engineering",
  "odooEmployeeId": 42
}
```

`odooEmployeeId` = the numeric ID from Odoo. Find it by opening an employee in Odoo and checking the URL: `/odoo/employees/42` → ID is `42`.

For managers, use `"role": "manager"` — they get the Approvals section in the sidebar.

---

## Step 6 — Odoo configuration checklist

- [ ] Create a **service account** user in Odoo (Settings → Users)
- [ ] Give it access to: Employees, Leaves, Expenses, Documents (read/write)
- [ ] Ensure **Leave Types** are active (Leaves → Configuration → Leave Types)
- [ ] Ensure expense products have **Can be Expensed** checked
- [ ] Ensure each employee has a **Manager** set in their Odoo profile (needed for team queries)
- [ ] Ensure the **Documents** module is installed in Odoo

---

## Gmail App Password setup (for email notifications)

1. Go to your Google Account → **Security** → **2-Step Verification** (must be enabled)
2. Search for **App passwords** → create one for "Mail"
3. Use the 16-character password as `SMTP_PASS` in Railway

---

## Local development

```bash
# Backend
cd backend
cp .env.example .env
# Fill in .env with your values
npm install
npm run dev        # runs on http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev        # runs on http://localhost:3000
```

---

## Adding WhatsApp notifications later (Phase 3)

When you're ready, add `backend/services/whatsapp.service.js`:

```js
const axios = require('axios');

async function sendWhatsApp({ to, message }) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: message },
    },
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
  );
}

module.exports = { sendWhatsApp };
```

Then call it alongside `email.notifyManagerLeaveRequest(...)` in the leave and expense routes.
You'll need a Meta Business account and WhatsApp Business API access.

---

## Cost summary

| Service | Plan | Cost |
|---|---|---|
| Vercel | Hobby (free) | $0 |
| Railway | Starter ($5 free credit/month) | $0 |
| MongoDB Atlas | M0 free cluster | $0 |
| Gmail SMTP | Free | $0 |
| Odoo.sh | Already paying | — |
| **Total** | | **$0/month** |
