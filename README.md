# MJNM UPDATES 🌙

A tiny password-protected update feed for the team. Pick a name, post a short update (max 280 characters), and it shows up for everyone with a timestamp. No likes, no comments.

Hosted for free on **Cloudflare Pages**, posts stored in **Cloudflare D1**.

## What's in here

| Path | What it is |
| --- | --- |
| `public/index.html` | The whole website: lock screen, post box, feed |
| `functions/api/posts.js` | The API: checks the password, reads and saves posts |
| `package.json` | Only used to run the site locally (`npm run dev`) |
| `.dev.vars` | Local-only password (not committed to Git) |

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:8788. For local testing, the password comes from `.dev.vars`. Create it if it's missing:

```
TEAM_PASSWORD=your-password-here
```

Local posts are stored in `.wrangler/` and never reach the live site.

## Put it online (one-time setup)

1. **Push to GitHub.** In GitHub Desktop: commit, then click *Publish repository*.
2. **Create the database.** Cloudflare dashboard → *Storage & Databases* → *D1 SQL Database* → *Create* → name it `mjnm-updates`.
3. **Create the site.** *Workers & Pages* → *Create application* → *Pages* → *Import an existing Git repository* → pick `mjnmupdates`.
   - Framework preset: **None**
   - Build command: **leave empty**
   - Build output directory: **`public`**
   - Click *Save and Deploy*.
4. **Connect the database.** Open the project → *Settings* → *Bindings* → *Add* → *D1 database*.
   - Variable name: **`DB`**
   - Database: `mjnm-updates`
5. **Set the password.** *Settings* → *Variables and Secrets* → *Add*.
   - Type: **Secret**
   - Name: **`TEAM_PASSWORD`**
   - Value: the team password
6. **Redeploy** so the settings take effect: *Deployments* → latest deployment → *⋯* → *Retry deployment*.
7. Open `https://<project-name>.pages.dev` and share it with the team, together with the password.

After this, every push to `main` updates the site automatically. The posts table is created automatically on first use.

## Changing things later

- **Change the password:** edit `TEAM_PASSWORD` in Cloudflare, then redeploy. Everyone has to enter the new one.
- **Add a custom domain:** project → *Custom domains* → *Set up a domain*.
- **Delete a post:** D1 → `mjnm-updates` → *Console*, then run `DELETE FROM posts WHERE id = 123;`
