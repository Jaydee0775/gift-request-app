# Gift Request App V1

A starter app using GitHub Pages for the user/admin interfaces, Google Apps Script as the backend, and Google Sheets as the database.

## Data structure
- **Accounts**: `accountId`, `name`, `tokenHash`, `status`, `createdAt`
- **Gifts**: `giftId`, `accountId`, `name`, `productLink`, `notes`, `priority`, `price`, `createdAt`, `updatedAt`

## Backend setup
1. Create a new Google Sheet.
2. Open **Extensions → Apps Script** and paste the contents of `Code.gs`.
3. In Apps Script, open **Project Settings → Script properties** and add `ADMIN_KEY` with a long random secret. Do not reuse another password.
4. Save, select `setup` in the function dropdown, and Run it. Approve the permissions. This creates the `Accounts` and `Gifts` tabs.
5. Deploy → **New deployment** → **Web app**. Execute as **Me**. Access: **Anyone**. Deploy and copy the URL ending in `/exec`.
6. Keep the spreadsheet private.

## GitHub Pages setup
1. Upload `index.html`, `admin.html`, `app.js`, and `style.css` to the root of your GitHub Pages repository.
2. Open `app.js` and replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with your deployed `/exec` URL.
3. Commit the files. Open `admin.html` on your published GitHub Pages site.
4. Enter the `ADMIN_KEY` you set in Script Properties. Create an account and copy its generated link immediately; the backend stores only the token hash, not the original link.

## Current API actions
- `health`
- User: `userGet`, `giftAdd`, `giftUpdate`, `giftDelete`
- Admin: `adminList`, `adminCreate`, `adminToggle`, `adminDelete`, `adminGifts`

## Important security note
This first prototype uses JSONP (`doGet`) so a static GitHub Pages site can call Apps Script without a server-side proxy. That means request values travel in URL query parameters, and state-changing actions use GET requests. This is convenient for testing but is **not the recommended design for a public production app**. Do not put highly sensitive information in it. Before sharing widely, upgrade writes to a POST-capable API/proxy and add stronger admin authentication and rate limiting. The original access link cannot be recovered later because only token hashes are stored; always save each link when you create it. A later version can support token rotation/replacement.
