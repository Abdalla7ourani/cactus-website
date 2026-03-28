# Cactus Website

A static website based on the Avalanche (avax.network) design, reorganized for clean deployment.

---

## Project Structure

```
Cactus Website/
├── index.html              # Homepage
├── 404.html                # Error page
├── favicon.svg             # Browser tab icon
├── touchicon.jpg           # Mobile bookmark icon
├── arrow.svg               # UI arrow asset
├── sitemap-index.xml       # Sitemap for SEO
│
├── _astro/                 # CSS, JS, fonts, SVG icons (bundled assets)
├── _server-islands/        # Pre-rendered HTML fragments
├── images.ctfassets.net/    # Downloaded images from Contentful CDN
│
├── about/                  # About section
│   ├── index.html          # About main page
│   ├── blog/               # Blog articles (each in slug/index.html)
│   └── press/              # Press releases
│
├── build/                  # Build/developer section
├── case-studies/           # Case studies
├── community-hub/          # Community pages
├── defi/                   # DeFi page
├── enterprise/             # Enterprise page
├── gaming/                 # Gaming page
├── infrastructure/         # Infrastructure page
├── institutions/           # Institutions page
├── legal/                  # Legal pages (privacy, terms, etc.)
├── nft/                    # NFT page
├── powered-by-avax/        # Powered by Avalanche page
├── privacy-policy/         # Privacy policy
│
├── app.termly.io/          # Cookie consent script (third-party)
├── js.hs-scripts.com/      # HubSpot analytics (third-party)
└── platform.twitter.com/   # Twitter widget (third-party)
```

---

## How to View Locally

### Option 1: VS Code Live Server (Recommended for beginners)

1. Install the **Live Server** extension in VS Code/Cursor
2. Right-click `index.html` → **Open with Live Server**
3. The site opens in your browser at `http://127.0.0.1:5500`

### Option 2: Python HTTP Server

```bash
# If you have Python installed:
cd "c:\Projects\Cactus Website"
python -m http.server 8080

# Then open http://localhost:8080 in your browser
```

### Option 3: Node.js serve

```bash
npx serve .
```

---

## How to Publish (Deploy)

### Option A: Netlify (Easiest — Free)

1. Go to [netlify.com](https://netlify.com) and sign up
2. Click **"Add new site"** → **"Deploy manually"**
3. Drag and drop the entire `Cactus Website` folder
4. Your site is live instantly with a `.netlify.app` URL
5. To use a custom domain, go to **Domain settings** and follow the instructions

### Option B: Vercel (Free)

1. Go to [vercel.com](https://vercel.com) and sign up
2. Install Vercel CLI: `npm i -g vercel`
3. Run `vercel` in this project folder
4. Follow the prompts — your site is deployed

### Option C: GitHub Pages (Free)

1. Create a GitHub repository
2. Push this project to the repo
3. Go to repo **Settings** → **Pages**
4. Set source to the `main` branch, root folder
5. Your site is live at `https://yourusername.github.io/repo-name`

### Option D: Custom Hosting (Hostinger, GoDaddy, etc.)

1. Purchase hosting and a domain name
2. Use FTP (FileZilla) or the hosting file manager
3. Upload all files to the `public_html` or `www` folder
4. Point your domain's DNS to the hosting provider

---

## Connecting a Custom Domain

1. **Buy a domain** from Namecheap, GoDaddy, Cloudflare, etc.
2. **Point DNS** to your hosting provider:
   - For Netlify/Vercel: Add a CNAME record pointing to their provided URL
   - For traditional hosting: Update nameservers to your host's nameservers
3. **Enable HTTPS**: Most platforms (Netlify, Vercel, Cloudflare) provide free SSL certificates automatically

---

## Important Notes

- **Images**: Most images are stored locally in `images.ctfassets.net/`. Some images may still reference external URLs — if any images appear broken, they may need to be downloaded separately.
- **Fonts**: The site uses Aeonik fonts stored in `_astro/` as `.woff2` files.
- **JavaScript**: Interactive features are powered by Astro-bundled JS in `_astro/`.
- **Third-party scripts**: Cookie consent (Termly), analytics (HubSpot), and social widgets (Twitter) are included but may not function without proper API keys.

---

## Next Steps for Customization

1. **Change branding**: Edit `index.html` to replace Avalanche references with your own brand
2. **Update images**: Replace images in `images.ctfassets.net/` with your own
3. **Edit content**: Each page is a standalone HTML file — edit text directly
4. **Change colors**: The main stylesheet is in `_astro/*.css`
5. **Update favicon**: Replace `favicon.svg` with your own icon
