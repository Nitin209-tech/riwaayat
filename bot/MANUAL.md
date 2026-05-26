# 📖 RIWAAYAT BOT — COMPLETE STAFF & ADMIN MANUAL

Aapke upgraded modular **Riwaayat Bot** ka complete configuration aur usage guide! Is manual me saare features, unki commands aur step-by-step setup procedure ko aasan Hinglish me explain kiya gaya hai.

---

## 1. 🎟️ Ticket & Claim System (Naya Behavior)
Ab Ticket system completely clean, premium aur automated hai.

### 🌟 Kaam Kaise Karta Hai:
1. **Ticket Opening**: Jab koi user ticket open karega to usse **V2 Claim Dashboard** show hoga. Purana welcome message (`👋 Welcome to your ticket channel...`) aur `🛑 Stop Close` buttons ab completely hat chuke hain.
2. **Post-Claim Vouching**: Payout successful hone ke baad bot channel me `## ARE WE LEGIT??` prompt bhejeg.
   * **Vouch (legit/working/thanks etc.) milne par**: Bot automatic static layout + vouch text + `proof.png` screenshot ko aapke payment-proof logs channel me upload kar dega, aur **5 seconds ke andar ticket delete** ho jayegi.
   * **Negative response (not working/fake/problem etc.) milne par**: Bot ticket channel ko rename karke `escalated-` prefix de dega (e.g. `escalated-membername`) taaki staff manually access kar sake. Bot channel me koi extra chat spam nahi karega.
   * **DM warning timeout system (`startLegitTimeout`) ab switch off hai**, to users ko koi backup/warning DMs nahi jayenge.

---

## 2. ⭐ Permanent Whitelist & Extra Owner
Security commands (sensitive commands aur password bypass) ko manage karne ke liye 3 level ka system hai:

### Master Controller Configured ID: `1490694641975164999` (Aapka ID)

| Command | Permission Required | Description |
| :--- | :--- | :--- |
| `/permanentwhitelist add @user` | **Master Controller Only** | User ko Permanent Whitelist me add karega. Ye user **SENSITIVE locks** bypass kar sakega. |
| `/permanentwhitelist remove @user` | **Master Controller Only** | User ko Permanent Whitelist se remove karega. |
| `/permanentwhitelist list` | **Master Controller Only** | Saare Permanent Whitelist users ki list display karega. |
| `/extraowner add @user` | **Master Controller Only** | User ko second-tier ownership (Extra Owner) assign karega. |
| `/extraowner remove @user` | **Master Controller Only** | Extra Owner se remove karega. |
| `/extraowner list` | **Master Controller Only** | Saare Extra Owners ki list display karega. |
| `/whitelistall <on/off>` | **Admin / Whitelist Bypass** | Puray server ke liye whitelist requirement bypass ko turn on/off karega. |

---

## 3. 🛡️ Olympus-Style Anti-Nuke
Server ko unauthorized modifications, mass bans aur channel deletes se safe rakhne ke liye rolling 10-second window tracker.

### ⚙️ Setup Commands (Admin Only):
* `/antinuke setup <#log-channel>`: Anti-Nuke system ko enable karke active logs channel set karta hai.
* `/antinuke toggle <action> <on/off>`: Kisi specific event (jaise channel updates or kicks) par protection on ya off karega.
* `/antinuke threshold <limit>`: Limit set karta hai (Default limit **3** actions hai rolling 10s window ke liye).
* `/antinuke punishment <stripAndBan | strip | ban | kick>`: Limit cross hone par user par action set karega (Default: Default role stripping aur temporary ban).
* `/antinuke status`: Poore status aur toggle settings ko preview karne ke liye.

### ⚡ Protected Actions Categories:
1. `channelCreate` & `channelDelete` (Naye channels banana ya delete karna)
2. `roleCreate` & `roleDelete` (Roles banana ya delete karna)
3. `webhookCreate` (Webhooks banana ya modify karna)
4. `emojiCreate` & `emojiDelete` (Custom emojis add/delete)
5. `ban` & `kick` (Mass ban ya kick limits)
6. `botAdd` (Unauthorized bots add karne par unhe ban + bot kick karna)
7. `timeout` (Mass timeout limit protection)
8. `massMention` (Mass mentions blocking)
9. `permissionEdit` (Dangerous admin permissions grant blocking)
10. `vanityEdit` (Server custom URL modification monitoring)
11. `serverUpdate` (Server settings change logging)

---

## 4. 🔗 Anti-Betray System
Whitelisted aur trusted staff members par focus karta hai. Agar koi trusted user achanak dangerous permissions (jaise Admin, Manage Guild) gain karta hai, toh bot alert bhejta hai aur revert option deta hai.

### ⚙️ Commands (Admin Only):
* `/antibetray toggle <on/off>`: Active or inactive karne ke liye.
* `/antibetray logchannel <#channel>`: Betray alerts logs channel configuration.
* `/antibetray status`: Pure status display ke liye.

---

## 5. 🤖 AutoMod System
Active server policing filters standard rules setup ke liye:

### ⚙️ Commands (Admin Only):
* `/automod toggle <module> <on/off>`: AutoMod filters trigger toggle.
* `/automod punishment <module> <delete | warn | timeout | kick>`: Module violations punishment selection.
* `/automod badwords add/remove/list`: Add custom badwords lists (e.g. `badword`).
* `/automod spamthreshold <limit> <window>`: Configures Spam detection (e.g. `5` messages in `3` seconds).
* `/automod exemptchannel <add/remove/view> <#channel>`: Set bypass channels.
* `/automod status`: Pure configurations panel monitoring.

### 📝 AutoMod Modules:
1. `antilink` - Block all external web links (Configurable domain whitelist).
2. `antispam` - Limit fast consecutive messages rate.
3. `antiupload` - Block specific file attachments (Block executable downloads).
4. `antimassmention` - Prevent mass mention abuse.
5. `antibadwords` - Filter bad words list.
6. `antiinvite` - Blocks other Discord server invite links.

---

## 6. ✨ NQN (Not Quite Nitro) Emoji System
Users bina Discord Nitro ke cross-server aur animated emojis use kar sakte hain!

### How to use:
* `/nqn toggle <on/off>`: Server me NQN mirror support toggle.
* **Usage**: Koi bhi standard user agar message me `:emojiname:` send karega toh bot automatic check karega, original text message ko delete karega, aur unhi ki avatar/displayname ke sath exact same animated custom emoji webhook ke through trigger kar dega.
* `/nqn status`: System status check.

---

## 🚀 Bot Chalane Ka Tareeqa
Aap is bot ko command shell me locally start kar sakte hain:
```bash
# Setup check krne k baad bot start krein
npm run start

# Ya dev model auto-restart node use krne k liye
npm run dev
```

Aapki modular architecture complete aur updated hai. Kisi bhi security alert or bypass query ke liye aap Master Controller Commands se direct control rkh sakte hain! 🛡️✨
