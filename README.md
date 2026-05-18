# 🎮 Rewards Portal — Complete Setup Guide

A gaming rewards platform where users earn IQCoins through Discord activity and redeem them for real gaming rewards (Minecraft, Roblox, Xbox Game Pass, Discord Nitro).

The homepage has a live **AI Support Assistant** powered by **Groq** (primary, fast & free) with **Gemini** as automatic fallback.

---

## 📋 What's Included

| File / Folder        | Purpose                                          |
|----------------------|--------------------------------------------------|
| `index.html`         | Homepage with AI chat assistant                  |
| `earn.html`          | Earn IQCoins page                                |
| `redeem.html`        | Redeem with code page                            |
| `coins.html`         | Spend IQCoins directly                           |
| `giveaway.html`      | Live giveaways                                   |
| `shop.html`          | Browse rewards                                   |
| `profile.html`       | User profile and leaderboard                     |
| `track.html`         | Track order status                               |
| `howitworks.html`    | Full how-it-works guide                          |
| `about.html`         | About the platform                               |
| `shared.js`          | All shared logic (auth, coins, nav, etc.)        |
| `shared.css`         | All shared styles                                |
| `api/ai.js`          | Vercel Edge Function — secure AI proxy           |
| `vercel.json`        | Vercel deploy config (clean URLs)                |

---

## 🤖 How the AI Chat Works

```
User types a question on the homepage
        ↓
Browser sends request to /api/ai  ← your own Vercel server
        ↓
api/ai.js tries GROQ first (fast, free tier)
        ↓ if Groq fails or rate-limits ↓
api/ai.js falls back to GEMINI automatically
        ↓
Reply sent back to browser → shown in chat bubble
```

API keys live **only** in Vercel environment variables — never in HTML or JS files.

---

## 🚀 STEP 1 — Get Your Free API Keys

You need **two** API keys. Both are completely free.

### Groq API Key (Primary AI — very fast)

1. Go to **https://console.groq.com**
2. Sign up with Google or email — free, no credit card
3. Click **"API Keys"** in the left sidebar
4. Click **"Create API Key"** → give it any name (e.g. `rewards-portal`)
5. Copy the key — it starts with `gsk_...`
6. Save it somewhere — you will paste it in Step 3

### Gemini API Key (Fallback AI)

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"** → select any project (or create new)
4. Copy the key — it starts with `AIza...`
5. Save it — you will paste it in Step 3

---

## 🚀 STEP 2 — Deploy to Vercel

### Option A — Drag & Drop (Easiest)

1. Go to **https://vercel.com** → sign up free
2. Click **"Add New Project"** → **"Upload"**
3. Drag and drop **all files** from this folder into Vercel
   - ⚠️ Make sure the `api/` folder is included (contains `ai.js`)
   - ⚠️ Make sure `vercel.json` is in the root
4. Click **Deploy** — your site goes live in ~30 seconds

### Option B — GitHub (Best for future updates)

1. Go to **https://github.com** → create a new repository (can be private)
2. Upload all files to the repo — drag & drop works directly on GitHub
   - `api/ai.js` must be inside a folder called `api`
   - `vercel.json` must be in the root alongside `index.html`
3. Go to **https://vercel.com** → **"Add New Project"**
4. Click **"Import Git Repository"** → connect GitHub → select your repo
5. Leave all settings default → click **Deploy**

---

## 🚀 STEP 3 — Add API Keys to Vercel ⚠️ Most Important!

Without this step the AI chat will show "offline" to users.

1. Go to **https://vercel.com/dashboard**
2. Click your project name
3. Click **"Settings"** (top menu)
4. Click **"Environment Variables"** (left sidebar)
5. Add these two variables — click **"Add New"** for each:

**First — Groq key:**
```
Name:   GROQ_API_KEY
Value:  gsk_...   (your Groq key from Step 1)
```

**Second — Gemini key:**
```
Name:   GEMINI_API_KEY
Value:  AIza...   (your Gemini key from Step 1)
```

For each: select **all three** checkboxes — Production, Preview, Development → click **Save**.

6. Go to **"Deployments"** tab → click **⋯** on the latest deployment → **"Redeploy"**

✅ AI chat is now live and working!

---

## 🚀 STEP 4 — Fix Discord Login

1. Go to **https://discord.com/developers/applications**
2. Select your application
3. Click **"OAuth2"** in the left sidebar
4. Under **"Redirects"** add your domain:
   ```
   https://your-project.vercel.app/
   ```
   Replace with your actual Vercel URL (or custom domain). Include the trailing `/`
5. Click **"Save Changes"**

---

## 🚀 STEP 5 — Fix Microsoft / Xbox Login (Optional)

Only needed for Xbox Game Pass redemption via Microsoft login.

1. Go to **https://portal.azure.com**
2. **Microsoft Entra ID** → **App registrations** → select your app
3. Click **"Authentication"** in the left sidebar
4. **Supported account types** → select:
   > ✅ Accounts in any organizational directory AND personal Microsoft accounts
5. **Redirect URIs** → make sure:
   - Type: **Single-page application (SPA)**
   - URI: your domain with trailing slash
6. Click **Save**

---

## ✅ Pre-Launch Checklist

- [ ] `GROQ_API_KEY` added in Vercel → Settings → Environment Variables
- [ ] `GEMINI_API_KEY` added in Vercel → Settings → Environment Variables
- [ ] Redeployed on Vercel after adding both keys
- [ ] AI chat works on homepage — type a question, press Enter, get a reply
- [ ] Discord login works — username appears in the nav bar
- [ ] Support email `mojangstudio908@gmail.com` visible in all page footers
- [ ] Custom domain set in Vercel → Settings → Domains (optional)

---

## ❓ Troubleshooting

**AI chat says "I'm offline right now"**
- Make sure both `GROQ_API_KEY` and `GEMINI_API_KEY` are saved in Vercel
- Make sure you clicked **Redeploy** after saving the keys
- Check logs: Vercel Dashboard → your project → **Functions** tab → click `api/ai`

**Discord login → blank page after redirect**
- Discord Developer Portal → OAuth2 → Redirect URL must exactly match your live domain
- Must include trailing slash: `https://your-site.vercel.app/`

**Microsoft login → "unauthorized_client" error**
- Azure Portal → App registrations → Authentication → change account types to include personal accounts (Step 5)

**Coins reset when changing page**
- Normal behaviour in incognito/private mode (localStorage clears on close)
- Works correctly in normal browser mode

**AI gives wrong info about your platform**
- Edit the `SITE_KNOWLEDGE` variable in `index.html` — that is everything the AI knows

---

## 🔧 Quick Customization

| What to change              | Where                                            |
|-----------------------------|--------------------------------------------------|
| AI knowledge about the site | `SITE_KNOWLEDGE` in `index.html`                 |
| Reward prices               | `PRICES` object in `shared.js`                   |
| Discord Client ID / Server  | `CFG` object in `shared.js`                      |
| Support email               | Search `mojangstudio908@gmail.com` in all files  |
| Member count stats          | Search `12K+` in `index.html` and `about.html`   |
| Switch Groq model           | `model` field in `askGroq()` inside `api/ai.js`  |
| Switch Gemini model         | model name in URL in `askGemini()` in `api/ai.js`|

---

## 📩 Support

**mojangstudio908@gmail.com**
