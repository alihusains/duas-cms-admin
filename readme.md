# Duas CMS Admin Panel

A production-ready, lightweight, and modern CMS for managing "Duas" or similar content. Hosted on GitHub Pages with Google Sheets as a database and Google Apps Script as the backend.

## Features
- 🌑 Modern Dark UI (Inter font, Tailwind-like colors)
- 🌳 Nested Category Tree (unlimited depth)
- 🖱️ Drag and Drop Reordering (SortableJS)
- 📝 Full CRUD for Categories, Items, and Media
- 📂 Media Manager (per item)
- 📱 Responsive Design

## 1. Google Sheets Setup
Create a new Google Sheet and add three tabs with the exact headers below:

### Tab: `Categories`
`id | name | slug | parentId | icon | banner | color | order | active | createdAt | updatedAt`

### Tab: `Items`
`id | title | slug | type | description | content | thumbnail | categoryIds | order | active | createdAt | updatedAt`

### Tab: `MediaLinks`
`id | itemId | label | url | format | size | order | active | createdAt | updatedAt`

---

## 2. Google Apps Script Setup
1. In your Google Sheet, go to **Extensions > Apps Script**.
2. Delete any existing code and paste the contents of `code.gs`.
3. Replace `'YOUR_SPREADSHEET_ID_HERE'` at the top with your actual Sheet ID (from the URL).
4. Click **Deploy > New Deployment**.
5. Select type: **Web App**.
6. Set "Execute as": **Me**.
7. Set "Who has access": **Anyone**.
8. Click **Deploy**, authorize permissions, and **copy the Web App URL**.

---

## 3. Frontend Deployment (GitHub)
1. Fork or clone this repository to GitHub.
2. Open `app.js` and replace the `API_URL` at the top with your **Google Apps Script Web App URL**.
3. Go to repository **Settings > Pages**.
4. Set "Branch" to `main` and "Folder" to `/ (root)`.
5. Your admin panel will be live at `https://yourusername.github.io/your-repo-name/`.

---

## 4. Usage Tips
- **Ordering:** Simply drag and drop items/categories to change their sequence. The `order` column in Google Sheets will update automatically.
- **Categories:** You can nest categories by selecting a "Parent" when editing.
- **Items:** Multiple categories can be assigned to a single item via checkboxes.
- **Media:** Use the "Media" button on any item to add multiple download links (Audio, PDF, Video, etc.).

## Development
To run locally, just open `index.html` in your browser. CORS is handled by Google Apps Script's redirection.
