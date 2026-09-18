# The Bikers Bandits — Website

A high-energy, animated landing page for The Bikers Bandits motorcycle riding group,
built to collect member sign-ups straight into a Google Sheet. No backend server or
build step required — it's plain HTML/CSS/JS plus a small Google Apps Script.

## What's inside

```
index.html            the whole site (hero, about, ride types, gallery, join form, FAQ)
css/style.css          all styling + animations (dark theme, parallax hero, scroll reveals)
js/main.js             preloader, cursor, nav, particle background, counters, form logic
js/config.js            <-- put your Google Sheet form URL here
apps-script/Code.gs     Google Apps Script that writes submissions into your Sheet
```

Graphics are fully self-contained (CSS gradients, SVG line-art, canvas particles) —
nothing hotlinked to a third-party image host, so nothing ever shows up broken. Swap in
real ride photos in the gallery section whenever you have them.

## 1. Preview it locally

No build tools needed. Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## 2. Connect the join form to Google Sheets

**a. Create the Sheet**
1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
   (e.g. "The Bikers Bandits — Members").

**b. Add the Apps Script**
2. In the Sheet, open **Extensions → Apps Script**.
3. Delete any starter code and paste in the contents of `apps-script/Code.gs` from this repo.
4. Click **Save**, then **Deploy → New deployment**.
5. Click the gear icon next to "Select type" and choose **Web app**.
6. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
7. Click **Deploy**, then **Authorize access** and approve the permissions (it's your own script).
8. Copy the **Web app URL** you're given (looks like `https://script.google.com/macros/s/XXXX/exec`).

**c. Wire it into the site**
9. Open `js/config.js` and paste the URL:

   ```js
   window.SITE_CONFIG = {
     GOOGLE_SHEET_WEB_APP_URL: "https://script.google.com/macros/s/XXXX/exec",
   };
   ```
10. Save, reload the site, and submit a test entry through the "Join The Crew" form.
    A new row should appear in a `Riders` tab in your Sheet within a couple of seconds.

**If you ever change the form fields**, update both `index.html` (the `name="..."`
attributes) and the `row` array in `apps-script/Code.gs` so columns keep lining up.

### Re-deploying after edits to Code.gs

Apps Script Web Apps don't auto-update. After changing `Code.gs` in the Apps Script
editor, use **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**
to push the change live at the same URL.

## 3. What the form captures

| Field | Required | Notes |
|---|---|---|
| Full name | Yes | |
| Email | Yes | |
| Mobile | No | |
| Permanent member / Casual rider | Yes | |
| Bike make & model | No | |
| Riding experience | Defaults to Intermediate | Beginner / Intermediate / Expert |
| Preferred ride types | No, multi-select | Highway, off-road, track days, night rides, tours, charity |
| How they heard about the club | No | |
| Safety-guidelines agreement | Yes | Checkbox |

## 4. Deploying the site

Any static host works — GitHub Pages, Netlify, Vercel, Cloudflare Pages. There's no
server-side code to run; only the Apps Script (already hosted by Google) is needed
behind the scenes.

## Design inspiration

The tone borrows from the world's well-known riding communities — the brotherhood and
patch culture of classic motorcycle clubs, the community touring spirit of large owners'
groups (like HOG), the endurance ethos of long-distance riders, and the charity-ride
polish of events like the Distinguished Gentleman's Ride.
