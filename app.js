(() => {
  "use strict";

  const CONFIG_KEY = "atlas-v81-supabase-config";
  const WORKSPACE_KEY = "atlas-v81-workspace";
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  const BUCKET = "atlas-documents";
  let client = null;
  let session = null;
  let workspace = null;
  let documents = [];
  let authSubscription = null;
  let recoveryMode = false;
  const recoveryLinkDetected = /(?:[?#&])type=recovery(?:[&#]|$)/i.test(window.location.href);

  const $ = (id) => document.getElementById(id);
  const els = {
    cloudBadge: $("cloudBadge"), routeSummary: $("routeSummary"), notice: $("notice"),
    connectionPanel: $("connectionPanel"), authPanel: $("authPanel"), workspacePanel: $("workspacePanel"), filesPanel: $("filesPanel"),
    connectionForm: $("connectionForm"), projectUrl: $("projectUrl"), publishableKey: $("publishableKey"),
    loginForm: $("loginForm"), email: $("email"), password: $("password"), signOutBtn: $("signOutBtn"),
    sessionCard: $("sessionCard"), sessionEmail: $("sessionEmail"), workspaceSelect: $("workspaceSelect"), workspaceInfo: $("workspaceInfo"),
    fileInput: $("fileInput"), chooseFileBtn: $("chooseFileBtn"), uploadProgress: $("uploadProgress"),
    refreshBtn: $("refreshBtn"), fileCount: $("fileCount"), filesSubtitle: $("filesSubtitle"), fileList: $("fileList"),
    renameDialog: $("renameDialog"), renameForm: $("renameForm"), renameInput: $("renameInput"), renameDocumentId: $("renameDocumentId"),
    forgotPasswordBtn: $("forgotPasswordBtn"), recoveryDialog: $("recoveryDialog"), recoveryForm: $("recoveryForm"),
    recoveryRequest: $("recoveryRequest"), recoveryUpdate: $("recoveryUpdate"), recoveryEmail: $("recoveryEmail"),
    newPassword: $("newPassword"), confirmPassword: $("confirmPassword"), recoverySubmitBtn: $("recoverySubmitBtn"),
    recoveryCancelBtn: $("recoveryCancelBtn"), closeRecoveryBtn: $("closeRecoveryBtn"),
    steps: [$("stepConnect"), $("stepAuth"), $("stepWorkspace"), $("stepFiles")]
  };

  function showNotice(message, type = "ok") {
    els.notice.textContent = message;
    els.notice.className = `notice${type === "error" ? " error" : ""}`;
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => els.notice.classList.add("hidden"), 6000);
  }

  function errorMessage(error) {
    const raw = error?.message || String(error || "Bilinmeyen hata");
    if (/Invalid API key/i.test(raw)) return "Publishable key geçersiz görünüyor.";
    if (/Failed to fetch|NetworkError/i.test(raw)) return "Atlas Cloud’a ulaşılamadı. Project URL ve internet bağlantısını kontrol edin.";
    if (/Invalid login credentials/i.test(raw)) return "E-posta veya şifre hatalı.";
    if (/row-level security/i.test(raw)) return "Bu işlem için workspace yetkiniz yok veya dosya yolu güvenlik kuralına uymuyor.";
    if (/duplicate key/i.test(raw)) return "Aynı isimli bir dosya zaten mevcut.";
    return raw;
  }

  function config() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); } catch { return null; }
  }

  function normalizeUrl(value) {
    return value.trim().replace(/\/+$/, "");
  }

  function makeClient(saved) {
    if (!window.supabase?.createClient) throw new Error("Supabase bağlantı kütüphanesi yüklenemedi.");
    if (authSubscription) authSubscription.unsubscribe();
    client = window.supabase.createClient(saved.url, saved.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession;
      if (event === "PASSWORD_RECOVERY") openRecoveryDialog(true);
    });
    authSubscription = data.subscription;
  }

  function recoveryRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function openRecoveryDialog(updatePassword = false) {
    recoveryMode = updatePassword;
    els.recoveryRequest.classList.toggle("hidden", updatePassword);
    els.recoveryUpdate.classList.toggle("hidden", !updatePassword);
    els.recoverySubmitBtn.textContent = updatePassword ? "Yeni şifreyi kaydet" : "Kurtarma e-postası gönder";
    els.recoveryEmail.required = !updatePassword;
    els.newPassword.required = updatePassword;
    els.confirmPassword.required = updatePassword;
    if (!updatePassword) els.recoveryEmail.value = els.email.value.trim();
    if (!els.recoveryDialog.open) els.recoveryDialog.showModal();
    setTimeout(() => (updatePassword ? els.newPassword : els.recoveryEmail).focus(), 50);
  }

  function setStep(index) {
    els.steps.forEach((step, i) => {
      step.classList.toggle("done", i < index);
      step.classList.toggle("active", i === index);
    });
    els.authPanel.classList.toggle("disabled", index < 1);
    els.workspacePanel.classList.toggle("disabled", index < 2);
    els.filesPanel.classList.toggle("disabled", index < 3);
  }

  function updateStatus() {
    const ready = Boolean(client && session && workspace);
    els.cloudBadge.classList.toggle("online", ready);
    els.cloudBadge.querySelector("span").textContent = ready ? "Atlas Cloud ready" : client ? (session ? "Workspace required" : "Sign in required") : "Cloud not configured";
    els.routeSummary.textContent = ready ? `${workspace.name} workspace’i güvenli bulut kasasına bağlı.` : client ? (session ? "Yetkili workspace’inizi seçin." : "Atlas Cloud hesabınızla oturum açın.") : "Bağlantı bilgilerini girerek başlayın.";
    els.signOutBtn.classList.toggle("hidden", !session);
    setStep(!client ? 0 : !session ? 1 : !workspace ? 2 : 3);
  }

  async function initialize() {
    const saved = config();
    if (!saved) return updateStatus();
    els.projectUrl.value = saved.url;
    els.publishableKey.value = saved.key;
    try {
      makeClient(saved);
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      session = data.session;
      if (session) {
        await onSignedIn();
        if (recoveryLinkDetected) openRecoveryDialog(true);
      }
    } catch (error) {
      client = null;
      showNotice(errorMessage(error), "error");
    }
    updateStatus();
  }

  async function onSignedIn() {
    els.loginForm.classList.add("hidden");
    els.sessionCard.classList.remove("hidden");
    els.sessionEmail.textContent = session.user.email || "Atlas Cloud user";
    await loadWorkspaces();
  }

  async function loadWorkspaces() {
    const { data, error } = await client
      .from("workspace_members")
      .select("workspace_id, role, is_active, workspaces(id,name,slug)")
      .eq("user_id", session.user.id)
      .eq("is_active", true);
    if (error) throw error;
    const memberships = (data || []).filter((item) => item.workspaces);
    els.workspaceSelect.innerHTML = `<option value="">Workspace seçin</option>${memberships.map((m) => `<option value="${escapeHtml(m.workspace_id)}" data-role="${escapeHtml(m.role)}">${escapeHtml(m.workspaces.name)}</option>`).join("")}`;
    const remembered = localStorage.getItem(WORKSPACE_KEY);
    const selected = memberships.find((m) => m.workspace_id === remembered) || (memberships.length === 1 ? memberships[0] : null);
    if (selected) {
      els.workspaceSelect.value = selected.workspace_id;
      await selectWorkspace(selected.workspace_id, memberships);
    } else if (!memberships.length) {
      showNotice("Bu kullanıcı için aktif workspace üyeliği bulunamadı.", "error");
    }
  }

  async function selectWorkspace(id, memberships = null) {
    if (!id) {
      workspace = null;
      localStorage.removeItem(WORKSPACE_KEY);
      els.workspaceInfo.innerHTML = "<span>Rol</span><strong>—</strong>";
      renderDocuments([]);
      return updateStatus();
    }
    if (!memberships) {
      const option = els.workspaceSelect.selectedOptions[0];
      workspace = { id, name: option.textContent, role: option.dataset.role };
    } else {
      const item = memberships.find((m) => m.workspace_id === id);
      workspace = { id, name: item.workspaces.name, role: item.role };
    }
    localStorage.setItem(WORKSPACE_KEY, id);
    els.workspaceInfo.innerHTML = `<span>Rol</span><strong>${escapeHtml(workspace.role)}</strong>`;
    updateStatus();
    await loadDocuments();
  }

  async function loadDocuments() {
    if (!workspace) return;
    els.refreshBtn.disabled = true;
    const { data, error } = await client
      .from("documents")
      .select("id,original_filename,title,bucket_id,object_path,mime_type,file_size_bytes,created_at")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    els.refreshBtn.disabled = false;
    if (error) throw error;
    documents = data || [];
    renderDocuments(documents);
  }

  function renderDocuments(items) {
    els.fileCount.textContent = String(items.length);
    els.filesSubtitle.textContent = workspace ? `${workspace.name} · private storage` : "Workspace seçildiğinde listelenecek.";
    if (!items.length) {
      els.fileList.innerHTML = `<div class="empty"><span>□</span><strong>Henüz dosya yok</strong><p>İlk PDF’inizi Atlas Cloud’a yükleyin.</p></div>`;
      return;
    }
    els.fileList.innerHTML = items.map((doc) => `
      <article class="file-row" data-id="${escapeHtml(doc.id)}">
        <div class="file-main"><span class="pdf-icon">PDF</span><div class="file-meta"><strong>${escapeHtml(doc.original_filename)}</strong><small>${formatBytes(doc.file_size_bytes)} · ${formatDate(doc.created_at)}</small></div></div>
        <div class="file-actions">
          <button class="button ghost" data-action="open">Aç</button>
          <button class="button ghost" data-action="download">İndir</button>
          <button class="button ghost" data-action="rename">Adlandır</button>
          <button class="button ghost danger" data-action="delete">Sil</button>
        </div>
      </article>`).join("");
  }

  async function uploadPdf(file) {
    if (!workspace || !session) throw new Error("Önce oturum açın ve workspace seçin.");
    if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) throw new Error("Yalnızca PDF dosyası yükleyebilirsiniz.");
    if (file.size > MAX_PDF_BYTES) throw new Error("Test sürümünde PDF boyutu en fazla 10 MB olabilir.");
    const safeName = sanitizeFilename(file.name);
    const objectPath = `${workspace.id}/documents/${crypto.randomUUID()}/${safeName}`;
    els.uploadProgress.classList.remove("hidden");
    els.fileInput.disabled = true;
    try {
      const { error: uploadError } = await client.storage.from(BUCKET).upload(objectPath, file, { contentType: "application/pdf", upsert: false, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { error: metaError } = await client.from("documents").insert({
        workspace_id: workspace.id, bucket_id: BUCKET, object_path: objectPath,
        original_filename: safeName, title: stripPdf(safeName), document_type: "pdf",
        mime_type: "application/pdf", file_size_bytes: file.size, status: "active",
        classification: "standard", created_by: session.user.id
      });
      if (metaError) {
        await client.storage.from(BUCKET).remove([objectPath]);
        throw metaError;
      }
      showNotice(`${safeName} Atlas Cloud’a yüklendi.`);
      await loadDocuments();
    } finally {
      els.uploadProgress.classList.add("hidden");
      els.fileInput.disabled = false;
      els.fileInput.value = "";
    }
  }

  async function signedUrl(doc, download = false) {
    const options = download ? { download: doc.original_filename } : undefined;
    const { data, error } = await client.storage.from(doc.bucket_id).createSignedUrl(doc.object_path, 60, options);
    if (error) throw error;
    return data.signedUrl;
  }

  async function openDocument(doc, download = false) {
    const url = await signedUrl(doc, download);
    const link = document.createElement("a");
    link.href = url;
    link.target = download ? "_self" : "_blank";
    link.rel = "noopener";
    if (download) link.download = doc.original_filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function renameDocument(doc, newName) {
    const safeName = sanitizeFilename(newName.toLowerCase().endsWith(".pdf") ? newName : `${newName}.pdf`);
    const prefix = doc.object_path.substring(0, doc.object_path.lastIndexOf("/") + 1);
    const newPath = `${prefix}${safeName}`;
    if (newPath !== doc.object_path) {
      const { error: moveError } = await client.storage.from(doc.bucket_id).move(doc.object_path, newPath);
      if (moveError) throw moveError;
    }
    const { error } = await client.from("documents").update({ original_filename: safeName, title: stripPdf(safeName), object_path: newPath }).eq("id", doc.id).eq("workspace_id", workspace.id);
    if (error) {
      if (newPath !== doc.object_path) await client.storage.from(doc.bucket_id).move(newPath, doc.object_path);
      throw error;
    }
    showNotice("Dosya yeniden adlandırıldı.");
    await loadDocuments();
  }

  async function deleteDocument(doc) {
    if (!window.confirm(`“${doc.original_filename}” kalıcı olarak silinsin mi?`)) return;
    const { error: storageError } = await client.storage.from(doc.bucket_id).remove([doc.object_path]);
    if (storageError) throw storageError;
    const { error } = await client.from("documents").delete().eq("id", doc.id).eq("workspace_id", workspace.id);
    if (error) throw error;
    showNotice("Dosya silindi.");
    await loadDocuments();
  }

  function sanitizeFilename(name) {
    const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "").slice(0, 140);
    return cleaned || `atlas-document-${Date.now()}.pdf`;
  }
  function stripPdf(name) { return name.replace(/\.pdf$/i, ""); }
  function formatBytes(bytes) { if (!Number.isFinite(Number(bytes))) return "—"; return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
  function formatDate(value) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); }

  els.connectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saved = { url: normalizeUrl(els.projectUrl.value), key: els.publishableKey.value.trim() };
    const submit = event.submitter;
    submit.disabled = true;
    try {
      makeClient(saved);
      const { error } = await client.auth.getSession();
      if (error) throw error;
      localStorage.setItem(CONFIG_KEY, JSON.stringify(saved));
      session = null; workspace = null;
      showNotice("Atlas Cloud bağlantısı kaydedildi.");
      updateStatus();
    } catch (error) {
      client = null;
      showNotice(errorMessage(error), "error");
      updateStatus();
    } finally { submit.disabled = false; }
  });

  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: els.email.value.trim(), password: els.password.value });
      if (error) throw error;
      session = data.session;
      await onSignedIn();
      showNotice("Atlas Cloud oturumu açıldı.");
    } catch (error) { showNotice(errorMessage(error), "error"); }
    finally { submit.disabled = false; updateStatus(); }
  });

  els.forgotPasswordBtn.addEventListener("click", () => {
    if (!client) return showNotice("Önce Atlas Cloud bağlantısını kaydedin.", "error");
    openRecoveryDialog(false);
  });

  els.recoveryCancelBtn.addEventListener("click", () => {
    if (!recoveryMode) els.recoveryDialog.close();
  });
  els.closeRecoveryBtn.addEventListener("click", () => {
    if (!recoveryMode) els.recoveryDialog.close();
  });

  els.recoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.recoverySubmitBtn.disabled = true;
    try {
      if (!client) throw new Error("Önce Atlas Cloud bağlantısını kaydedin.");
      if (!recoveryMode) {
        const email = els.recoveryEmail.value.trim();
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirectUrl() });
        if (error) throw error;
        els.recoveryDialog.close();
        showNotice("Kurtarma e-postası gönderildi. Gelen kutunuzu ve Spam klasörünü kontrol edin.");
      } else {
        if (els.newPassword.value.length < 10) throw new Error("Yeni şifre en az 10 karakter olmalıdır.");
        if (els.newPassword.value !== els.confirmPassword.value) throw new Error("Yeni şifreler birbiriyle eşleşmiyor.");
        const { error } = await client.auth.updateUser({ password: els.newPassword.value });
        if (error) throw error;
        await client.auth.signOut();
        session = null;
        workspace = null;
        recoveryMode = false;
        els.recoveryDialog.close();
        els.recoveryForm.reset();
        els.loginForm.classList.remove("hidden");
        els.sessionCard.classList.add("hidden");
        showNotice("Şifreniz yenilendi. Şimdi yeni şifrenizle oturum açın.");
        updateStatus();
        if (window.location.hash || window.location.search) {
          history.replaceState({}, document.title, recoveryRedirectUrl());
        }
      }
    } catch (error) {
      showNotice(errorMessage(error), "error");
    } finally {
      els.recoverySubmitBtn.disabled = false;
    }
  });

  els.signOutBtn.addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    session = null; workspace = null; documents = [];
    localStorage.removeItem(WORKSPACE_KEY);
    els.loginForm.classList.remove("hidden"); els.sessionCard.classList.add("hidden");
    els.workspaceSelect.innerHTML = `<option value="">Önce oturum açın</option>`;
    renderDocuments([]);
    showNotice("Oturum kapatıldı.");
    updateStatus();
  });

  els.workspaceSelect.addEventListener("change", async () => {
    try { await selectWorkspace(els.workspaceSelect.value); } catch (error) { showNotice(errorMessage(error), "error"); }
  });
  els.chooseFileBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", async () => {
    try { await uploadPdf(els.fileInput.files[0]); } catch (error) { showNotice(errorMessage(error), "error"); els.uploadProgress.classList.add("hidden"); els.fileInput.disabled = false; }
  });
  els.refreshBtn.addEventListener("click", async () => {
    try { await loadDocuments(); showNotice("Dosya listesi yenilendi."); } catch (error) { showNotice(errorMessage(error), "error"); }
  });
  els.fileList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const doc = documents.find((item) => item.id === button.closest(".file-row").dataset.id);
    if (!doc) return;
    button.disabled = true;
    try {
      if (button.dataset.action === "open") await openDocument(doc);
      if (button.dataset.action === "download") await openDocument(doc, true);
      if (button.dataset.action === "delete") await deleteDocument(doc);
      if (button.dataset.action === "rename") {
        els.renameDocumentId.value = doc.id;
        els.renameInput.value = doc.original_filename;
        els.renameDialog.showModal();
        setTimeout(() => els.renameInput.select(), 50);
      }
    } catch (error) { showNotice(errorMessage(error), "error"); }
    finally { button.disabled = false; }
  });
  els.renameForm.addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const doc = documents.find((item) => item.id === els.renameDocumentId.value);
    if (!doc) return;
    event.submitter.disabled = true;
    try { await renameDocument(doc, els.renameInput.value.trim()); els.renameDialog.close(); }
    catch (error) { showNotice(errorMessage(error), "error"); }
    finally { event.submitter.disabled = false; }
  });

  window.addEventListener("online", () => showNotice("İnternet bağlantısı yeniden kuruldu."));
  window.addEventListener("offline", () => showNotice("Çevrimdışısınız; bulut işlemleri geçici olarak kullanılamaz.", "error"));
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
  initialize();
})();
