(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    client: null,
    session: null,
    workspaceId: localStorage.getItem("atlas.workspace") || "",
    files: []
  };

  const CONFIG_URL = "atlas.supabase.url";
  const CONFIG_KEY = "atlas.supabase.publishable";

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function setMessage(id, message, type = "") {
    const element = $(id);
    element.textContent = message;
    element.className = `inline-message ${type}`.trim();
  }

  function formatBytes(bytes = 0) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  function sanitizePart(value, fallback = "general") {
    const safe = String(value || fallback)
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^a-zA-Z0-9._/-]+/g, "-")
      .replace(/-+/g, "-");
    return safe || fallback;
  }

  function navigate(viewName) {
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("active", view.id === `view-${viewName}`);
    });
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === viewName);
    });
    $("sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (viewName === "documents") loadFiles();
  }

  function readConfig() {
    return {
      url: localStorage.getItem(CONFIG_URL) || "",
      key: localStorage.getItem(CONFIG_KEY) || ""
    };
  }

  function initializeClient() {
    const { url, key } = readConfig();
    if (!url || !key || !window.supabase) {
      state.client = null;
      updateStatus();
      return;
    }
    try {
      state.client = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (error) {
      state.client = null;
      setMessage("connectionMessage", error.message, "error");
    }
    updateStatus();
  }

  async function restoreSession() {
    if (!state.client) return;
    const { data, error } = await state.client.auth.getSession();
    if (error) {
      setMessage("authMessage", error.message, "error");
      return;
    }
    state.session = data.session;
    updateStatus();
    if (state.session) await loadWorkspaces();
  }

  function updateStatus() {
    const connected = Boolean(state.client);
    const signedIn = Boolean(state.session?.user);
    const workspaceReady = Boolean(state.workspaceId);
    const ready = connected && signedIn && workspaceReady;

    $("connectionPill").classList.toggle("online", ready);
    $("connectionPill").querySelector("b").textContent = ready ? "Atlas Cloud Ready" : "Cloud Offline";
    $("stepConnect").classList.toggle("done", connected);
    $("stepLogin").classList.toggle("done", signedIn);
    $("stepWorkspace").classList.toggle("done", workspaceReady);
    $("stepReady").classList.toggle("done", ready);

    $("documentGuard").classList.toggle("ready", ready);
    $("documentGuard").textContent = ready
      ? "✓ Atlas Cloud is ready. Uploads will be stored privately in the selected workspace."
      : "Connect, sign in and select a workspace to continue.";

    if (!ready) {
      ["metricFiles", "metricPublications", "metricCharts", "metricStorage"].forEach((id) => {
        $(id).textContent = "—";
      });
    }
  }

  async function saveConnection() {
    const url = $("projectUrl").value.trim().replace(/\/$/, "");
    const key = $("publishableKey").value.trim();

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
      setMessage("connectionMessage", "Enter a valid Supabase Project URL.", "error");
      return;
    }
    if (!key) {
      setMessage("connectionMessage", "Enter the publishable key.", "error");
      return;
    }
    if (/service_role|secret/i.test(key)) {
      setMessage("connectionMessage", "Do not enter a secret or service-role key.", "error");
      return;
    }

    localStorage.setItem(CONFIG_URL, url);
    localStorage.setItem(CONFIG_KEY, key);
    initializeClient();

    if (!state.client) {
      setMessage("connectionMessage", "The Supabase client could not be initialized.", "error");
      return;
    }

    const { error } = await state.client.auth.getSession();
    if (error) {
      setMessage("connectionMessage", error.message, "error");
      return;
    }
    setMessage("connectionMessage", "Project connection saved and Supabase reached.", "success");
    showToast("Atlas Cloud connection saved");
    await restoreSession();
  }

  function clearConnection() {
    localStorage.removeItem(CONFIG_URL);
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem("atlas.workspace");
    state.client = null;
    state.session = null;
    state.workspaceId = "";
    $("projectUrl").value = "";
    $("publishableKey").value = "";
    $("workspaceSelect").innerHTML = '<option value="">No workspace selected</option>';
    setMessage("connectionMessage", "No cloud configuration saved.");
    setMessage("authMessage", "Signed out.");
    setMessage("workspaceMessage", "Connect and sign in first.");
    updateStatus();
  }

  async function signIn() {
    if (!state.client) {
      setMessage("authMessage", "Connect the project first.", "error");
      return;
    }
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    if (!email || !password) {
      setMessage("authMessage", "Enter email and password.", "error");
      return;
    }
    setMessage("authMessage", "Signing in…");
    const { data, error } = await state.client.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage("authMessage", error.message, "error");
      return;
    }
    state.session = data.session;
    setMessage("authMessage", `Signed in as ${data.user.email}.`, "success");
    updateStatus();
    await loadWorkspaces();
    showToast("Welcome aboard");
  }

  async function signOut() {
    if (state.client) await state.client.auth.signOut();
    state.session = null;
    state.workspaceId = "";
    localStorage.removeItem("atlas.workspace");
    $("workspaceSelect").innerHTML = '<option value="">No workspace selected</option>';
    setMessage("authMessage", "Signed out.");
    setMessage("workspaceMessage", "Sign in to load workspaces.");
    updateStatus();
  }

  async function loadWorkspaces() {
    if (!state.client || !state.session?.user) {
      setMessage("workspaceMessage", "Connect and sign in first.", "error");
      return;
    }
    setMessage("workspaceMessage", "Loading authorized workspaces…");
    const { data, error } = await state.client
      .from("workspaces")
      .select("id,name,slug,created_at")
      .order("name");

    if (error) {
      setMessage("workspaceMessage", error.message, "error");
      return;
    }

    const select = $("workspaceSelect");
    select.innerHTML = '<option value="">Select workspace</option>' +
      (data || []).map((workspace) =>
        `<option value="${escapeHtml(workspace.id)}">${escapeHtml(workspace.name)}</option>`
      ).join("");

    if (state.workspaceId && (data || []).some((item) => item.id === state.workspaceId)) {
      select.value = state.workspaceId;
    } else if (data?.length === 1) {
      state.workspaceId = data[0].id;
      select.value = state.workspaceId;
      localStorage.setItem("atlas.workspace", state.workspaceId);
    }

    const selected = (data || []).find((item) => item.id === state.workspaceId);
    setMessage(
      "workspaceMessage",
      selected ? `${selected.name} • ${selected.id}` : `${data?.length || 0} authorized workspace(s) found.`,
      selected ? "success" : ""
    );
    updateStatus();
    if (state.workspaceId) await refreshMetrics();
  }

  async function selectWorkspace() {
    state.workspaceId = $("workspaceSelect").value;
    if (state.workspaceId) {
      localStorage.setItem("atlas.workspace", state.workspaceId);
      const name = $("workspaceSelect").selectedOptions[0]?.textContent || "Workspace";
      setMessage("workspaceMessage", `${name} selected.`, "success");
      await refreshMetrics();
    } else {
      localStorage.removeItem("atlas.workspace");
      setMessage("workspaceMessage", "No workspace selected.");
    }
    updateStatus();
  }

  function isCloudReady() {
    return Boolean(state.client && state.session?.user && state.workspaceId);
  }

  async function refreshMetrics() {
    if (!isCloudReady()) {
      updateStatus();
      return;
    }
    const { data, error } = await state.client
      .from("documents")
      .select("bucket_id,file_size_bytes")
      .eq("workspace_id", state.workspaceId)
      .is("deleted_at", null);

    if (error) {
      showToast(`Metrics: ${error.message}`);
      return;
    }
    const rows = data || [];
    $("metricFiles").textContent = rows.length;
    $("metricPublications").textContent = rows.filter((row) => row.bucket_id === "nautical-publications").length;
    $("metricCharts").textContent = rows.filter((row) => row.bucket_id === "nautical-charts").length;
    $("metricStorage").textContent = formatBytes(rows.reduce((sum, row) => sum + (Number(row.file_size_bytes) || 0), 0));
  }

  async function uploadFiles() {
    if (!isCloudReady()) {
      setMessage("uploadMessage", "Connect, sign in and select a workspace first.", "error");
      return;
    }

    const files = Array.from($("cloudFiles").files || []);
    if (!files.length) {
      setMessage("uploadMessage", "Choose one or more files first.", "error");
      return;
    }

    const bucket = $("bucketSelect").value;
    const folder = sanitizePart($("folderPath").value);
    const button = $("uploadFilesButton");
    button.disabled = true;

    let uploaded = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const safeName = sanitizePart(file.name, "file");
        const objectPath = `${state.workspaceId}/${folder}/${crypto.randomUUID()}-${safeName}`;

        setMessage("uploadMessage", `Uploading ${index + 1}/${files.length}: ${file.name}`);

        const { error: storageError } = await state.client.storage
          .from(bucket)
          .upload(objectPath, file, {
            cacheControl: "3600",
            contentType: file.type || "application/octet-stream",
            upsert: false
          });

        if (storageError) throw new Error(`Storage: ${storageError.message}`);

        const { error: metadataError } = await state.client
          .from("documents")
          .insert({
            workspace_id: state.workspaceId,
            bucket_id: bucket,
            object_path: objectPath,
            original_filename: file.name,
            title: file.name,
            mime_type: file.type || null,
            file_size_bytes: file.size,
            status: "active",
            classification: bucket === "crew-confidential" ? "confidential" : "standard",
            created_by: state.session.user.id
          });

        if (metadataError) {
          await state.client.storage.from(bucket).remove([objectPath]);
          throw new Error(`Metadata: ${metadataError.message}`);
        }
        uploaded += 1;
      }

      $("cloudFiles").value = "";
      setMessage("uploadMessage", `✓ ${uploaded} file(s) uploaded successfully.`, "success");
      showToast("Cloud upload completed");
      await Promise.all([loadFiles(), refreshMetrics()]);
    } catch (error) {
      setMessage("uploadMessage", error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function loadFiles() {
    if (!isCloudReady()) {
      $("fileGrid").innerHTML = '<div class="empty-state">Connect Atlas Cloud to load files.</div>';
      updateStatus();
      return;
    }

    const bucket = $("bucketSelect").value;
    $("fileGrid").innerHTML = '<div class="empty-state">Loading files…</div>';

    const { data, error } = await state.client
      .from("documents")
      .select("id,title,original_filename,bucket_id,object_path,mime_type,file_size_bytes,status,classification,created_at")
      .eq("workspace_id", state.workspaceId)
      .eq("bucket_id", bucket)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      $("fileGrid").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      return;
    }

    state.files = data || [];
    if (!state.files.length) {
      $("fileGrid").innerHTML = '<div class="empty-state">No files in this cloud category.</div>';
      return;
    }

    $("fileGrid").innerHTML = state.files.map((file) => `
      <article class="file-card">
        <h3>${escapeHtml(file.title || file.original_filename)}</h3>
        <p>${escapeHtml(file.bucket_id)}<br>${formatBytes(file.file_size_bytes)} • ${escapeHtml(file.classification)}<br>${new Date(file.created_at).toLocaleString("tr-TR")}</p>
        <div class="file-actions">
          <button class="button ghost" data-action="open" data-id="${file.id}">Open</button>
          <button class="button ghost" data-action="download" data-id="${file.id}">Download</button>
          <button class="button ghost" data-action="rename" data-id="${file.id}">Rename</button>
          <button class="button danger" data-action="delete" data-id="${file.id}">Delete</button>
        </div>
      </article>
    `).join("");
  }

  function getFileRecord(id) {
    return state.files.find((file) => file.id === id);
  }

  async function openFile(file) {
    const { data, error } = await state.client.storage
      .from(file.bucket_id)
      .createSignedUrl(file.object_path, 300);
    if (error) {
      showToast(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function downloadFile(file) {
    const { data, error } = await state.client.storage
      .from(file.bucket_id)
      .download(file.object_path);
    if (error) {
      showToast(error.message);
      return;
    }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.original_filename || "atlas-file";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function renameFile(file) {
    const newName = prompt("New file name:", file.original_filename);
    if (!newName || newName === file.original_filename) return;

    const parts = file.object_path.split("/");
    parts[parts.length - 1] = `${crypto.randomUUID()}-${sanitizePart(newName, "file")}`;
    const newPath = parts.join("/");

    const { error: moveError } = await state.client.storage
      .from(file.bucket_id)
      .move(file.object_path, newPath);

    if (moveError) {
      showToast(moveError.message);
      return;
    }

    const { error: metadataError } = await state.client
      .from("documents")
      .update({
        original_filename: newName,
        title: newName,
        object_path: newPath
      })
      .eq("id", file.id);

    if (metadataError) {
      showToast(`Metadata: ${metadataError.message}`);
      return;
    }
    showToast("File renamed");
    await loadFiles();
  }

  async function deleteFile(file) {
    if (!confirm(`Delete "${file.original_filename}" from Atlas Cloud?`)) return;

    const { error: storageError } = await state.client.storage
      .from(file.bucket_id)
      .remove([file.object_path]);

    if (storageError) {
      showToast(storageError.message);
      return;
    }

    const { error: metadataError } = await state.client
      .from("documents")
      .delete()
      .eq("id", file.id);

    if (metadataError) {
      showToast(`Metadata: ${metadataError.message}`);
      return;
    }

    showToast("File deleted");
    await Promise.all([loadFiles(), refreshMetrics()]);
  }

  function renderRoutes() {
    const routes = window.ATLAS_ROUTES || [];
    $("routeCards").innerHTML = routes.map((route) => `
      <article class="route-card">
        <h3>${escapeHtml(route.title)}</h3>
        <p>${escapeHtml(route.type)} • ${escapeHtml(route.status)}</p>
        <p>${route.stops.map(escapeHtml).join(" → ")}</p>
      </article>
    `).join("");
  }

  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.view));
    });
    document.querySelectorAll("[data-go]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.go));
    });
    document.querySelectorAll(".open-bucket").forEach((button) => {
      button.addEventListener("click", () => {
        $("bucketSelect").value = button.dataset.bucket;
        navigate("documents");
      });
    });

    $("menuButton").addEventListener("click", () => $("sidebar").classList.toggle("open"));
    $("saveConnection").addEventListener("click", saveConnection);
    $("clearConnection").addEventListener("click", clearConnection);
    $("signInButton").addEventListener("click", signIn);
    $("signOutButton").addEventListener("click", signOut);
    $("refreshWorkspaces").addEventListener("click", loadWorkspaces);
    $("workspaceSelect").addEventListener("change", selectWorkspace);
    $("uploadFilesButton").addEventListener("click", uploadFiles);
    $("refreshFilesButton").addEventListener("click", loadFiles);
    $("bucketSelect").addEventListener("change", loadFiles);

    $("fileGrid").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const file = getFileRecord(button.dataset.id);
      if (!file) return;
      if (button.dataset.action === "open") await openFile(file);
      if (button.dataset.action === "download") await downloadFile(file);
      if (button.dataset.action === "rename") await renameFile(file);
      if (button.dataset.action === "delete") await deleteFile(file);
    });
  }

  async function boot() {
    bindEvents();
    renderRoutes();

    const config = readConfig();
    $("projectUrl").value = config.url;
    $("publishableKey").value = config.key;

    initializeClient();
    await restoreSession();
    updateStatus();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      });
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();