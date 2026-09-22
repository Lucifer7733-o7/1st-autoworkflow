# Long Drive Radio

A one-page website where your YouTube playlist plays while you drive an endless country road.

- The road, hills, trees, clouds, sun, moon and birds are all drawn in code. There are no image files.
- The sky follows the visitor's local time: morning, sunny day, golden hour or night. The chip at the top right switches it.
- The car cruises while music plays and slows down when you pause.
- Songs play through YouTube's official embedded player. The playlist panel has search.
- Works on phones and desktops. It respects "reduce motion" settings.

## Make it yours

Edit **`config.js`**:

| Setting | What it does |
|---|---|
| `siteName`, `tagline` | Name in the top-left corner and the big headline |
| `playlist` | Your YouTube or YouTube Music playlist link. It must be **Public** or **Unlisted** |
| `youtubeApiKey` | Optional, see below |
| `timeOfDay` | `'auto'`, or pin it to `'morning'`, `'day'`, `'golden'` or `'night'` |
| `links` | Footer links (YouTube, Instagram…). Leave empty to hide |

## How the playlist stays in sync

The site picks the first of these that works:

1. **`youtubeApiKey` in `config.js`**: loads the playlist live on every visit, with titles and durations.
2. **`playlist.json`**: written by the GitHub Action every 6 hours when you add a `YT_API_KEY` secret (see below). This keeps your key private.
3. **No key at all**: the site asks YouTube's player for the list and fills in titles as it goes. Nothing to set up.

Add, remove or reorder songs in the YouTube playlist and the site follows. No code changes needed.

### Getting a YouTube API key (optional)

1. Go to <https://console.cloud.google.com/>, create a project, and enable **YouTube Data API v3**.
2. Under **Credentials**, create an **API key**.
3. Either:
   - (recommended) add it as a repository secret named `YT_API_KEY` (*Settings → Secrets and variables → Actions*), or
   - paste it into `config.js`. Then restrict the key to your site's address under *Application restrictions → Websites*, because anyone can read it there.

## Put it online for free (GitHub Pages)

1. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Merge this into `main`. The **Website** workflow publishes the `website/` folder.
3. The site appears at `https://<your-username>.github.io/<repo-name>/`.

The workflow also runs every 6 hours to pick up playlist changes. You can run it by hand from the **Actions** tab too.

## Try it on your computer

```bash
cd website
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly from disk won't work. It needs to be served like this.)

## Notes

- Some videos don't allow playing on other websites. The site marks those as unavailable and skips them.
- YouTube requires its video player to stay visible, which is why the "dashboard screen" shows the video.
