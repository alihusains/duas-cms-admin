/**
 * DUAS CMS FRONTEND - PRODUCTION READY (V3 - Unified Tree View)
 */
const DEPLOYMENT_ID = "AKfycbw-x3ZLNeU8Oyg54TZFdf_YmtIsRTiLLcXCmTcP--6O3QAY_5T2FLMvwqtSFMlFH3r5Uw";

const API_URL = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`;

let DB = { categories: [], items: [], media: [] };
let currentEditingId = null;

async function refresh() {
  showToast("Fetching data...");
  try {
    const res = await fetch(API_URL + "?action=data");
    const data = await res.json();
    if (data.error) {
      showToast(data.error, "error");
      return;
    }
    DB = data;
    renderCategories();
    updateStats();
    showToast("Data synced", "success");
  } catch (err) {
    console.error("Refresh failed:", err);
    showToast("Connection error. Check Apps Script deployment.", "error");
  }
}

function updateStats() {
  const statsEl = document.getElementById("stats");
  if (!statsEl) return;
  const catCount = (DB.categories || []).length;
  const itemCount = (DB.items || []).length;
  const mediaCount = (DB.media || []).length;
  statsEl.innerText = `${catCount} Categories | ${itemCount} Items | ${mediaCount} Media`;
}

function renderCategories() {
  const container = document.getElementById("categoryTree");
  container.innerHTML = "";

  const roots = (DB.categories || [])
    .filter(c => !c.parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (roots.length === 0 && (!DB.items || DB.items.length === 0)) {
    container.innerHTML = '<div style="color: #64748b; padding: 20px; text-align: center;">No content found. Click "+ New Category" to start.</div>';
    return;
  }

  roots.forEach(root => {
    container.appendChild(buildNode(root));
  });

  // Handle Unassigned Items
  const allCategoryIds = (DB.categories || []).map(c => String(c.id));
  const unassignedItems = (DB.items || []).filter(item => {
    if (!item.categoryIds) return true;
    const cats = String(item.categoryIds).split(',').filter(id => id && allCategoryIds.includes(String(id)));
    return cats.length === 0;
  });

  if (unassignedItems.length > 0) {
    const orphanSection = document.createElement("div");
    orphanSection.className = "orphan-section";
    orphanSection.innerHTML = `<h4 style="color: #ef4444; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <span class="icon">⚠️</span> Unassigned Items
      </h4>`;

    const orphanContainer = document.createElement("div");
    orphanContainer.className = "child-container orphan-container";
    unassignedItems.forEach(item => orphanContainer.appendChild(buildItemNode(item)));
    orphanSection.appendChild(orphanContainer);
    container.appendChild(orphanSection);

    new Sortable(orphanContainer, {
      animation: 150,
      handle: ".drag-handle",
      onEnd: () => {
        const ids = Array.from(orphanContainer.children).map(el => el.dataset.id);
        updateOrder("Items", ids);
      }
    });
  }

  new Sortable(container, {
    animation: 150,
    handle: ".card-header",
    onEnd: () => {
      const ids = Array.from(container.children)
        .filter(el => el.dataset.type === 'category')
        .map(el => el.dataset.id);
      updateOrder("Categories", ids);
    }
  });
}

function buildNode(cat) {
  const div = document.createElement("div");
  div.className = "card category-node";
  div.id = `cat-${cat.id}`;
  div.dataset.id = cat.id;
  div.dataset.type = "category";

  const hasChildren = (DB.categories || []).some(c => String(c.parentId) === String(cat.id)) ||
    (DB.items || []).some(i => String(i.categoryIds || '').split(',').includes(String(cat.id)));

  div.innerHTML = `
    <div class="card-header" style="border-left: 4px solid ${cat.color || '#3b82f6'}">
      <div class="title-area">
        ${hasChildren ? `<span class="toggle-btn" onclick="toggleCollapse('${cat.id}')">▼</span>` : '<span class="toggle-btn" style="visibility:hidden">▼</span>'}
        <span class="drag-handle">☰</span>
        <span class="icon">${cat.icon ? '🖼️' : '📁'}</span>
        <div class="item-info">
            <b data-orig="${cat.name}">${cat.name}</b>
            <div style="display:flex; gap: 8px; align-items:center;">
                ${cat.slug ? `<small class="slug-badge">${cat.slug}</small>` : ''}
                ${cat.order ? `<small style="color:#64748b">Order: ${cat.order}</small>` : ''}
            </div>
        </div>
      </div>
      <div class="actions">
        <button onclick="editCategory('${cat.id}')">Edit</button>
        <button onclick="deleteCategory('${cat.id}')" class="btn-danger">Delete</button>
      </div>
    </div>
  `;

  const childContainer = document.createElement("div");
  childContainer.className = "child-container";
  childContainer.id = `children-${cat.id}`;

  // Render Sub-categories
  (DB.categories || [])
    .filter(c => String(c.parentId) === String(cat.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(ch => childContainer.appendChild(buildNode(ch)));

  // Render Items under this category
  (DB.items || [])
    .filter(item => String(item.categoryIds || '').split(',').includes(String(cat.id)))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(item => childContainer.appendChild(buildItemNode(item)));

  div.appendChild(childContainer);

  new Sortable(childContainer, {
    animation: 150,
    handle: ".drag-handle",
    onEnd: (evt) => {
      const container = evt.to;
      const catIds = Array.from(container.children)
        .filter(el => el.dataset.type === 'category')
        .map(el => el.dataset.id);
      const itemIds = Array.from(container.children)
        .filter(el => el.dataset.type === 'item')
        .map(el => el.dataset.id);

      if (catIds.length > 1) updateOrder("Categories", catIds);
      if (itemIds.length > 1) updateOrder("Items", itemIds);
    }
  });

  return div;
}

function buildItemNode(item) {
  const div = document.createElement("div");
  div.className = "card item-node";
  div.dataset.id = item.id;
  div.dataset.type = "item";

  const media = (DB.media || []).filter(m => String(m.itemId) === String(item.id));
  const mediaHtml = media.map(m => `<span class="media-tag ${m.format}">${m.label}</span>`).join('');

  div.innerHTML = `
    <div class="card-header">
      <div class="title-area">
        <span class="drag-handle">⠿</span>
        ${item.thumbnail ? `<img src="${item.thumbnail}" class="mini-thumb" onerror="this.src='https://via.placeholder.com/32?text=?'">` : '<span class="icon">📄</span>'}
        <div class="item-info">
          <b data-orig="${item.title}">${item.title}</b>
          <div class="item-meta">
            <span class="type-label">${item.type}</span>
            ${item.slug ? `<span class="slug-badge">${item.slug}</span>` : ''}
          </div>
          <div class="media-preview">${mediaHtml}</div>
        </div>
      </div>
      <div class="actions">
        <button onclick="toggleQuickPreview('${item.id}')" title="Quick Preview">👁️</button>
        <button onclick="editItem('${item.id}')">Edit</button>
        <button onclick="manageMedia('${item.id}')">Media</button>
        <button onclick="deleteItem('${item.id}')" class="btn-danger">Delete</button>
      </div>
    </div>
    <div id="quick-preview-${item.id}" class="hidden" style="margin-top: 12px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #334155;"></div>
  `;
  return div;
}

function toggleQuickPreview(itemId) {
  const container = document.getElementById(`quick-preview-${itemId}`);
  if (!container.classList.contains('hidden')) {
    container.classList.add('hidden');
    container.innerHTML = "";
    return;
  }

  const item = DB.items.find(i => String(i.id) === String(itemId));
  container.classList.remove('hidden');
  container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <small style="color:#94a3b8">Content Preview</small>
            <button onclick="this.parentElement.parentElement.classList.add('hidden')" class="btn-secondary small" style="padding:2px 6px; width:auto; font-size:0.7rem; margin:0">Close</button>
        </div>
        ${getMediaPreviewHtml(item.content)}
    `;
}

function renderItems() {
  const query = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const allCards = document.querySelectorAll(".card");

  allCards.forEach(card => {
    // Reset highlights
    const bTags = card.querySelectorAll("b");
    bTags.forEach(b => {
      const originalText = b.getAttribute("data-orig") || b.innerText;
      if (!b.getAttribute("data-orig")) b.setAttribute("data-orig", originalText);

      if (!query) {
        b.innerText = originalText;
      } else if (originalText.toLowerCase().includes(query)) {
        const regex = new RegExp(`(${query})`, 'gi');
        b.innerHTML = originalText.replace(regex, '<span class="search-highlight">$1</span>');
      }
    });

    if (!query) {
      card.style.display = "";
      card.style.opacity = "";
      return;
    }

    const text = card.innerText.toLowerCase();
    if (text.includes(query)) {
      card.style.display = "";
      card.style.opacity = "1";
      // Ensure parents are visible and expanded
      let parent = card.parentElement.closest(".category-node");
      while (parent) {
        parent.style.display = "";
        parent.style.opacity = "1";
        parent.classList.remove("collapsed");
        const toggle = parent.querySelector(".toggle-btn");
        if (toggle) toggle.innerText = "▼";
        parent = parent.parentElement.closest(".category-node");
      }
    } else {
      card.style.opacity = "0.3";
    }
  });
}

function toggleCollapse(catId) {
  const node = document.getElementById(`cat-${catId}`);
  const toggle = node.querySelector(".toggle-btn");
  const isCollapsed = node.classList.toggle("collapsed");
  toggle.innerText = isCollapsed ? "▶" : "▼";
}

function updatePreview(val, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!val || val.length < 5) {
    container.innerHTML = '<small style="color:#64748b">No preview available</small>';
    return;
  }

  let url = val.trim();
  const lowVal = url.toLowerCase();

  // Support Google Drive links
  if (lowVal.includes('drive.google.com')) {
    let fileId = "";
    const parts = url.split('/');
    const dIndex = parts.indexOf('d');
    if (dIndex !== -1 && parts[dIndex + 1]) {
      fileId = parts[dIndex + 1];
    } else {
      const idMatch = url.match(/id=([^&]+)/);
      if (idMatch) fileId = idMatch[1];
    }

    if (fileId) {
      if (containerId.toLowerCase().includes('thumb') || containerId.toLowerCase().includes('icon') || containerId.toLowerCase().includes('banner')) {
        url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
      } else {
        url = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }
  }

  const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)$/i) ||
    url.includes('images.unsplash.com') ||
    url.includes('img.icons8.com') ||
    url.includes('drive.google.com/thumbnail') ||
    url.startsWith('data:image');

  const isAudio = url.match(/\.(mp3|wav|ogg|m4a|aac)$/i) || url.includes('/uc?export=download');
  const isVideo = url.match(/\.(mp4|webm|ogv|mov)$/i);
  const isYoutube = lowVal.includes('youtube.com') || lowVal.includes('youtu.be');

  if (isYoutube) {
    let videoId = "";
    if (lowVal.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (lowVal.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];

    if (videoId) {
      container.innerHTML = `<iframe width="100%" height="180" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius:8px"></iframe>`;
    } else {
      container.innerHTML = '<small style="color:#38bdf8">YouTube Link detected</small>';
    }
  } else if (isImage) {
    container.innerHTML = `<img src="${url}" onerror="this.parentElement.innerHTML='<small style="color:#ef4444">Invalid Image URL</small>'">`;
  } else if (isAudio && !isImage) {
    container.innerHTML = `<audio controls src="${url}" style="width:100%"></audio>`;
  } else if (isVideo && !isImage) {
    container.innerHTML = `<video controls src="${url}" style="max-width:100%; max-height:200px;"></video>`;
  } else {
    if (val.length > 100) {
      container.innerHTML = `<div style="font-size:0.8rem; color:#94a3b8; text-align:left;"><b>Text Preview:</b><br>${val.substring(0, 150)}...</div>`;
    } else {
      container.innerHTML = '<small style="color:#64748b; word-break:break-all;">No visual preview for this content</small>';
    }
  }
}

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function handleAutoSlug(sourceId, targetId) {
  const sourceEl = document.getElementById(sourceId);
  const targetEl = document.getElementById(targetId);
  if (!sourceEl || !targetEl) return;

  sourceEl.addEventListener('input', () => {
    if (!currentEditingId || !targetEl.value) {
      targetEl.value = slugify(sourceEl.value);
    }
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("URL copied to clipboard", "success");
  }).catch(err => {
    showToast("Failed to copy", "error");
  });
}

function showCategoryForm(cat) {
  const parents = DB.categories.filter(c => String(c.id) !== String(cat.id));
  let options = `<option value="">None (Root)</option>`;
  parents.forEach(p => {
    options += `<option value="${p.id}" ${String(p.id) === String(cat.parentId) ? 'selected' : ''}>${p.name}</option>`;
  });

  showModal(`
    <h3>${cat.id ? 'Edit' : 'New'} Category</h3>
    <div class="form-grid">
        <div>
            <label>Name</label>
            <input id="name" placeholder="Category Name" value="${cat.name || ''}">
        </div>
        <div>
            <label>Slug</label>
            <input id="slug" placeholder="category-slug" value="${cat.slug || ''}">
        </div>
    </div>
    <label>Parent Category</label>
    <select id="parentId">${options}</select>

    <label>Icon URL</label>
    <input id="icon" placeholder="https://..." value="${cat.icon || ''}" oninput="updatePreview(this.value, 'iconPreview')">
    <div id="iconPreview" class="preview-box"></div>

    <label>Banner URL</label>
    <input id="banner" placeholder="https://..." value="${cat.banner || ''}" oninput="updatePreview(this.value, 'bannerPreview')">
    <div id="bannerPreview" class="preview-box"></div>

    <div style="display: flex; align-items: center; gap: 20px; margin-top: 10px;">
        <div>
            <label>Theme Color</label><br>
            <input id="color" type="color" value="${cat.color || '#3b82f6'}" style="height:40px; width:60px; padding:2px; cursor:pointer; background:transparent; border:none;">
        </div>
        <div style="flex:1">
            <label>Display Order</label>
            <input id="order" type="number" placeholder="0" value="${cat.order || '0'}">
        </div>
    </div>

    <div class="modal-actions">
      <button onclick="submitCategory()" class="btn-primary">Save Category</button>
      <button onclick="closeModal()" class="btn-secondary">Cancel</button>
    </div>
  `);

  handleAutoSlug('name', 'slug');
  updatePreview(cat.icon, 'iconPreview');
  updatePreview(cat.banner, 'bannerPreview');
}

function submitCategory() {
  save("saveCategory", {
    name: value("name"),
    slug: value("slug"),
    parentId: value("parentId"),
    icon: value("icon"),
    banner: value("banner"),
    color: value("color"),
    order: parseInt(value("order") || 0),
    active: true
  });
  closeModal();
}

function showItemForm(item) {
  const catOptions = DB.categories.map(c => `
    <label class="checkbox-label">
        <input type="checkbox" name="cats" value="${c.id}" ${String(item.categoryIds || '').split(',').includes(String(c.id)) ? 'checked' : ''}>
        ${c.name}
    </label>
  `).join('');

  showModal(`
    <h3>${item.id ? 'Edit' : 'New'} Item</h3>
    <div class="form-grid">
      <div><label>Title</label><input id="title" placeholder="Title" value="${item.title || ''}"></div>
      <div><label>Slug</label><input id="slug" placeholder="item-slug" value="${item.slug || ''}"></div>
    </div>
    <div class="form-grid">
      <div>
        <label>Content Type</label>
        <select id="type">
          <option value="text" ${item.type === 'text' ? 'selected' : ''}>Text</option>
          <option value="audio" ${item.type === 'audio' ? 'selected' : ''}>Audio</option>
          <option value="video" ${item.type === 'video' ? 'selected' : ''}>Video</option>
          <option value="book" ${item.type === 'book' ? 'selected' : ''}>Book</option>
        </select>
      </div>
      <div>
        <label>Thumbnail URL</label>
        <input id="thumbnail" placeholder="https://..." value="${item.thumbnail || ''}" oninput="updatePreview(this.value, 'itemThumbPreview')">
      </div>
    </div>
    <div id="itemThumbPreview" class="preview-box"></div>

    <label>Description</label>
    <textarea id="description" placeholder="Short description">${item.description || ''}</textarea>

    <label>Main Content / Body (URL or Text)</label>
    <textarea id="content" placeholder="Full text content or media URL" style="height:100px" oninput="updatePreview(this.value, 'itemContentPreview')">${item.content || ''}</textarea>
    <div id="itemContentPreview" class="preview-box"></div>

    <div class="category-select" style="max-height: 150px; overflow-y: auto; background: #0f172a; padding: 12px; border-radius: 6px; border: 1px solid #334155; margin-bottom: 16px;">
      <strong>Assign to Categories:</strong>
      <div class="checkbox-grid">${catOptions}</div>
    </div>

    <div style="margin-bottom: 16px;">
        <label>Display Order</label>
        <input id="order" type="number" placeholder="0" value="${item.order || '0'}">
    </div>

    <div class="modal-actions">
      <button onclick="submitItem()" class="btn-primary">Save Item</button>
      <button onclick="closeModal()" class="btn-secondary">Cancel</button>
    </div>
  `);

  handleAutoSlug('title', 'slug');
  updatePreview(item.thumbnail, 'itemThumbPreview');
  updatePreview(item.content, 'itemContentPreview');
}

function submitItem() {
  const selectedCats = Array.from(document.querySelectorAll('input[name="cats"]:checked')).map(el => el.value).join(',');
  save("saveItem", {
    title: value("title"),
    slug: value("slug"),
    type: value("type"),
    description: value("description"),
    content: value("content"),
    thumbnail: value("thumbnail"),
    categoryIds: selectedCats,
    order: parseInt(value("order") || 0),
    active: true
  });
  closeModal();
}

async function updateOrder(type, ids) {
  showToast(`Updating order...`);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "updateOrder", type, ids })
    });
    const result = await res.json();
    if (result.success) showToast("Order saved", "success");
    else throw new Error(result.error);
  } catch (err) {
    showToast("Update failed: " + err.message, "error");
  }
}

async function save(action, payload) {
  if (currentEditingId) payload.id = currentEditingId;
  showToast("Saving...");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, payload })
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);

    showToast("Success!", "success");
    currentEditingId = null;
    refresh();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

async function deleteCategory(id) {
  if (!confirm("Delete this category? Items will remain but lose this category association.")) return;
  showToast("Deleting...");
  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "deleteCategory", id }) });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    showToast("Deleted", "success");
    refresh();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteItem(id) {
  if (!confirm("Delete this item?")) return;
  showToast("Deleting...");
  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "deleteItem", id }) });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    showToast("Deleted", "success");
    refresh();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function openCategoryModal() {
  currentEditingId = null;
  showCategoryForm({});
}

function editCategory(id) {
  currentEditingId = id;
  const cat = DB.categories.find(c => String(c.id) === String(id));
  showCategoryForm(cat);
}

function openItemModal() {
  currentEditingId = null;
  showItemForm({});
}

function editItem(id) {
  currentEditingId = id;
  const item = DB.items.find(i => String(i.id) === String(id));
  showItemForm(item);
}

function getMediaPreviewHtml(val) {
  if (!val || val.length < 5) return "";
  let url = val.trim();
  const lowVal = url.toLowerCase();

  if (lowVal.includes('drive.google.com')) {
    let fileId = "";
    const parts = url.split('/');
    const dIndex = parts.indexOf('d');
    if (dIndex !== -1 && parts[dIndex + 1]) {
      fileId = parts[dIndex + 1];
    } else {
      const idMatch = url.match(/id=([^&]+)/);
      if (idMatch) fileId = idMatch[1];
    }
    if (fileId) {
      url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
    }
  }

  const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)$/i) ||
    url.includes('images.unsplash.com') ||
    url.includes('img.icons8.com') ||
    url.includes('drive.google.com/thumbnail');

  const isAudio = url.match(/\.(mp3|wav|ogg|m4a|aac)$/i) || (lowVal.includes('drive.google.com') && !isImage);
  const isVideo = url.match(/\.(mp4|webm|ogv|mov)$/i);
  const isYoutube = lowVal.includes('youtube.com') || lowVal.includes('youtu.be');

  if (isYoutube) {
    let videoId = "";
    if (lowVal.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (lowVal.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
    if (videoId) return `<iframe width="100%" height="120" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius:4px;"></iframe>`;
    return '<small style="color:#38bdf8">YouTube Link</small>';
  } else if (isImage) {
    return `<img src="${url}" style="max-height:80px; border-radius:4px; display:block; margin: 0 auto;" onerror="this.style.display='none'">`;
  } else if (isAudio) {
    let audioUrl = url;
    if (lowVal.includes('drive.google.com') && !url.includes('thumbnail')) {
      const fileId = url.split('id=')[1] || url.split('/d/')[1].split('/')[0];
      audioUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return `<audio controls src="${audioUrl}" style="height:32px; width:100%;"></audio>`;
  } else if (isVideo) {
    return `<video controls src="${url}" style="max-height:120px; width:100%; border-radius:4px;"></video>`;
  }

  if (val.length > 50) {
    return `<div style="font-size:0.75rem; color:#94a3b8; word-break:break-all;">${val.substring(0, 80)}...</div>`;
  }
  return `<small style="color:#64748b; word-break:break-all;">${val}</small>`;
}

function manageMedia(itemId) {
  const media = DB.media.filter(m => String(m.itemId) === String(itemId));
  let list = media.map(m => `
    <div class="media-item" style="display:flex; flex-direction:column; background:#334155; padding:12px; border-radius:4px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span><b>${m.label}</b> (${m.format})</span>
        <div style="display:flex; gap:8px;">
            <button onclick="copyToClipboard('${m.url}')" class="btn-secondary small" style="width:auto; margin:0; padding: 4px 8px;">Copy URL</button>
            <button onclick="deleteMedia('${m.id}', '${itemId}')" class="btn-danger small" style="width:auto; margin:0; padding: 4px 8px;">Delete</button>
        </div>
      </div>
      <div class="media-item-preview">
        ${getMediaPreviewHtml(m.url)}
      </div>
    </div>
  `).join("");

  showModal(`
    <div class="media-manager-header">
      <h3>Media Manager</h3>
      <button onclick="closeModal()" class="btn-secondary small" style="width:auto; margin-bottom:0">Close</button>
    </div>
    <div class="media-list" style="margin-top:16px">${list || '<p style="color:#64748b">No media links.</p>'}</div>
    <hr style="border:0; border-top:1px solid #334155; margin:16px 0;">
    <h4>Add New Link</h4>
    <label>Label</label>
    <input id="m_label" placeholder="e.g. High Quality">
    <label>URL</label>
    <input id="m_url" placeholder="https://..." oninput="updatePreview(this.value, 'mediaAddPreview')">
    <div id="mediaAddPreview" class="preview-box"></div>
    <label>Format</label>
    <select id="m_format">
      <option value="audio">Audio</option>
      <option value="video">Video</option>
      <option value="pdf">PDF</option>
      <option value="book">Book</option>
      <option value="text">Text</option>
    </select>
    <div class="modal-actions">
      <button onclick="submitMedia('${itemId}')" class="btn-primary">Add Link</button>
    </div>
  `);
}

async function submitMedia(itemId) {
  const payload = {
    itemId,
    label: value("m_label"),
    url: value("m_url"),
    format: value("m_format"),
    active: true
  };
  if (!payload.label || !payload.url) {
    showToast("Label and URL are required", "error");
    return;
  }
  await save("saveMedia", payload);
  manageMedia(itemId);
}

async function deleteMedia(id, itemId) {
  if (!confirm("Delete link?")) return;
  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "deleteMedia", id }) });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    showToast("Deleted", "success");
    manageMedia(itemId);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function showModal(html) {
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("modalBody").innerHTML = "";
}

function value(id) { return document.getElementById(id).value; }

function showToast(message, type = "") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

refresh();
