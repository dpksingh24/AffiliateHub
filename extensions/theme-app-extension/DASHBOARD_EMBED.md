# Practitioner Dashboard – single script on any Liquid file

You can show the full Practitioner Dashboard (tabs, recent orders, quick links, wishlist, affiliate, etc.) on **any** Liquid template with one container and the app embed.

## 1. Enable the Dashboard app embed (required)

- In your store: **Online Store → Themes → Customize** (or **Theme → Customize**).
- In the left sidebar, click **App embeds**.
- Find **Dashboard** (kiscience) and turn the toggle **ON**.
- Click **Save**.

If this is off, the dashboard will never load and `#ks-dashboard-root` will stay empty.

## 2. Add the dashboard to any Liquid file

In the theme file where you want the dashboard (e.g. the account section or page template), add **one** empty div:

```liquid
<div id="ks-dashboard-root"></div>
```

That’s it. When the page loads, the bootstrap script (from the app embed) finds `#ks-dashboard-root`, injects the full dashboard HTML, loads the dashboard CSS and main JS, and the Practitioner Dashboard runs there.

### Optional: show a message when the embed is off

If the div stays empty and you want to see why, paste this **immediately after** the div in your theme (same file):

```liquid
<div id="ks-dashboard-root"></div>
<script>
(function(){
  setTimeout(function(){
    var root = document.getElementById('ks-dashboard-root');
    var config = document.getElementById('ks-dashboard-embed-config');
    if (root && root.children.length === 0 && !config) {
      root.innerHTML = '<div style="padding:20px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;max-width:520px;margin:0 auto;text-align:center;"><p style="margin:0 0 8px;font-weight:600;">Practitioner Dashboard</p><p style="margin:0;color:#856404;font-size:14px;">Turn on the <strong>Dashboard</strong> app embed: <strong>Theme → Customize → App embeds</strong> → set <strong>Dashboard (kiscience)</strong> to ON, then save and refresh this page.</p></div>';
    }
  }, 2000);
})();
</script>
```

After 2 seconds, if the dashboard still hasn’t loaded and the embed config isn’t on the page, this message will appear in the div.

## Example

**Page template** (e.g. `templates/page.affiliate-dashboard.liquid` or your custom page template):

```liquid
{% layout 'theme' %}
<div class="page-width">
  <h1>{{ page.title }}</h1>
  <div id="ks-dashboard-root"></div>
</div>
```

Or in a **section** or **snippet**:

```liquid
<div id="ks-dashboard-root"></div>
```

## Requirements

- The **Dashboard** app embed must be enabled (step 1).
- The page must have **exactly one** `<div id="ks-dashboard-root"></div>` where the dashboard should appear (do not duplicate the div).
- Customer must be **logged in** for the dashboard to show (otherwise access denied).

No other scripts or CSS need to be added in the theme; the bootstrap script handles everything.

### Do I need to update dashboard-embed.js when I change affiliate-dashboard.js?

**Only when the DOM structure changes.**  
- **No update needed:** Changes to logic, API calls, rendering, or styling inside `affiliate-dashboard.js`.  
- **Update needed:** Changes to the dashboard structure that the main script expects — e.g. new tab, new section, new element IDs, or edits to `affiliate-dashboard.liquid` (tabs, section IDs, container IDs). In those cases, sync the HTML template in `dashboard-embed.js` with the structure expected by `affiliate-dashboard.js` (and/or `affiliate-dashboard.liquid`).

---

## Troubleshooting: dashboard not showing on account page

**If `#ks-dashboard-root` is in the DOM but stays empty:** the Dashboard app embed is not loading on the page. Turn it on in App embeds (step 1 above).

1. **Enable the Dashboard app embed**  
   The div alone is not enough. The dashboard loads only when the **Dashboard** app embed is on.  
   - Go to **Theme → Customize → App embeds**.  
   - Find **Dashboard** (kiscience) and turn it **ON**.  
   - Save.  
   If the embed is off, the page will show a short message in the div telling you to enable it.

2. **Use only one div**  
   Use a single `<div id="ks-dashboard-root"></div>` on the page. Two or more elements with the same ID are invalid and can break behavior. Remove any duplicate.

3. **Place the div in the right template**  
   For the **account** page (`/account`), the div must be in the template/section that actually renders that page (e.g. the section used by the account template). Do not put `{% layout 'theme' %}` in the middle of the section; layouts belong at the top of the template.

4. **Redeploy the app extension**  
   After changing the app extension (e.g. dashboard-embed.liquid or dashboard-embed.js), push/deploy the app so the store gets the updated embed and script. The theme (with the div) and the app embed (Dashboard ON) must both be live.

5. **Check in the browser**  
   On the account page, open DevTools (F12) → Elements. Search for `ks-dashboard-embed-config`. If that element is **not** in the page, the Dashboard app embed is not loading (enable it in App embeds and save).
