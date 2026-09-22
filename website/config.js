// ─── Edit this file to make the site yours ───────────────────────────────────
window.SITE_CONFIG = {
  siteName: 'Long Drive Radio',
  tagline: 'Endless roads, good weather, and my playlist on repeat.',

  // Your YouTube / YouTube Music playlist (link or ID). It must be Public or Unlisted.
  playlist: 'https://music.youtube.com/playlist?list=PL2hU9g9l6CtplIcsGkG4vNWNTeJcs9OCH',

  // Optional. With a YouTube Data API key the song list loads instantly with titles and durations,
  // and new songs you add to the playlist show up on the next page load.
  // Without it the site still works: it reads the playlist through YouTube's player.
  // If you add a key here, restrict it to your website's address in Google Cloud Console.
  youtubeApiKey: '',

  // 'auto' follows the visitor's local time. Or pick: 'morning', 'day', 'golden', 'night'.
  timeOfDay: 'auto',

  // Links shown in the footer. Leave empty to hide.
  links: {
    youtube: 'https://music.youtube.com/playlist?list=PL2hU9g9l6CtplIcsGkG4vNWNTeJcs9OCH',
    instagram: '',
  },
};
