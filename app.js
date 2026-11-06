import {
  getCategoriesWithProjects,
  submitVotes,
  escapeHtml
} from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const categoriesContainer = document.getElementById("categories");
  const confirmBtn = document.getElementById("confirm-votes");
  const successModal = document.getElementById("success-modal");
  const codeModal = document.getElementById("code-modal");
  const codeInput = document.getElementById("voter-code");
  const codeError = document.getElementById("code-error");
  const submitCodeBtn = document.getElementById("submit-code");
  const cancelCodeBtn = document.getElementById("cancel-code");
  //const loader = document.getElementById("loader");

  if (!categoriesContainer) return;

  let categories = [];
  const selectedVotes = {};
  let isSubmitting = false;

  try {
    categories = await getCategoriesWithProjects();
    renderCategories();
  } catch (error) {
    console.error(error);
    categoriesContainer.innerHTML = `
      <p class="text-center text-red-300 text-lg py-10">
        No fue posible conectar con el sistema de votación.<br>
        <span class="text-sm text-gray-400">${escapeHtml(error.message)}</span>
      </p>`;
    if (confirmBtn) confirmBtn.disabled = true;
  } //finally {
  //   if (loader) loader.style.display = "none";
  // }

  function renderCategories() {
    categoriesContainer.innerHTML = "";

    if (categories.length === 0) {
      categoriesContainer.innerHTML = `
        <p class="text-center text-gray-300 text-lg py-10">
          No hay categorías registradas.<br>
          Ingresa al panel de administración para crear algunas.
        </p>`;
      confirmBtn.disabled = true;
      return;
    }

    categories.forEach((cat) => {
      const categoryDiv = document.createElement("div");
      categoryDiv.className =
        "p-6 rounded-xl bg-gray-900 bg-opacity-50 border border-gray-700 shadow-lg";

      const title = document.createElement("h2");
      title.className = "text-2xl font-bold text-white mb-4";
      title.textContent = cat.title;

      const projectList = document.createElement("div");
      projectList.className = "grid lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2 gap-6";

      cat.projects.forEach((proj) => {
        const card = document.createElement("div");
        card.className =
          "project-card p-3 bg-gray-800 bg-opacity-70 rounded-lg shadow hover:shadow-lg transition transform hover:scale-105 cursor-pointer border border-transparent hover:border-blue-400";
        card.dataset.categoryId = cat.id;
        card.dataset.projectId = proj.id;

        const image = document.createElement("img");
        image.src = proj.image;
        image.alt = proj.title;
        image.className = "w-full max-h-48 object-cover rounded mb-3";
        image.onerror = () => {
          image.src = "./img/logo-feria.png";
          image.alt = "Imagen no disponible";
        };

        const projectTitle = document.createElement("h3");
        projectTitle.className = "text-lg font-semibold text-white";
        projectTitle.textContent = proj.title;

        card.append(image, projectTitle);
        card.addEventListener("click", () => handleVoteSelection(card, cat.id, proj.id));
        projectList.appendChild(card);
      });

      categoryDiv.append(title, projectList);
      categoriesContainer.appendChild(categoryDiv);
    });
  }

  function handleVoteSelection(card, categoryId, projectId) {
    const categoryCards = document.querySelectorAll(`[data-category-id="${CSS.escape(categoryId)}"]`);
    categoryCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    selectedVotes[categoryId] = projectId;

    confirmBtn.disabled = Object.keys(selectedVotes).length !== categories.length;
  }

  confirmBtn.addEventListener("click", () => {
    if (Object.keys(selectedVotes).length !== categories.length) {
      alert("Selecciona un proyecto en todas las categorías antes de enviar.");
      return;
    }
    openCodeModal();
  });

  // El modal de código debe existir en index.html. Se protegen los listeners
  // para evitar que un elemento faltante detenga toda la aplicación.
  if (submitCodeBtn && codeInput && codeModal && codeError) {
    submitCodeBtn.addEventListener("click", confirmVotes);
    codeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") confirmVotes();
    });
  }

  if (cancelCodeBtn) cancelCodeBtn.addEventListener("click", closeCodeModal);

  async function confirmVotes() {
    if (isSubmitting) return;
    const code = codeInput.value.trim().toUpperCase();

    if (!code) {
      showCodeError("Ingresa tu código de votación.");
      return;
    }

    isSubmitting = true;
    submitCodeBtn.disabled = true;
    confirmBtn.disabled = true;
    codeError.classList.add("hidden");

    try {
      await submitVotes(code, selectedVotes, categories);
      closeCodeModal();
      showSuccessModal();

      Object.keys(selectedVotes).forEach((key) => delete selectedVotes[key]);
      document.querySelectorAll(".project-card.selected").forEach((card) => card.classList.remove("selected"));

      //setTimeout(() => window.location.reload(), 3000);
    } catch (error) {
      console.error(error);
      showCodeError(error.message || "No fue posible registrar tu voto.");
      confirmBtn.disabled = false;
    } finally {
      isSubmitting = false;
      submitCodeBtn.disabled = false;
    }
  }

  function openCodeModal() {
    if (!codeInput || !codeError || !codeModal) {
      console.error("Falta el modal de código de votación en index.html");
      alert("No se pudo abrir el formulario de código de votación. Verifica que index.html esté actualizado.");
      return;
    }
    codeInput.value = "";
    codeError.classList.add("hidden");
    codeModal.classList.remove("hidden");
    codeModal.classList.add("flex");
    setTimeout(() => codeInput.focus(), 50);
  }

  function closeCodeModal() {
    codeModal.classList.add("hidden");
    codeModal.classList.remove("flex");
  }

  function showCodeError(message) {
    codeError.textContent = message;
    codeError.classList.remove("hidden");
    codeInput.classList.add("ring-2", "ring-red-500");
    setTimeout(() => codeInput.classList.remove("ring-2", "ring-red-500"), 1000);
  }

  function showSuccessModal() {
    successModal.classList.remove("hidden", "fade-out");
    successModal.classList.add("fade-in");
    document.getElementById("voteSound")?.play().catch(() => {});

    const logo = document.getElementById("logo");
    setTimeout(() => {
      if (logo) logo.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);

    setTimeout(() => {
      successModal.classList.remove("fade-in");
      successModal.classList.add("fade-out");
      setTimeout(() => successModal.classList.add("hidden"), 600);
    }, 2200);
  }
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => console.warn(err));
  } else {
    document.exitFullscreen();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  if (!fullscreenBtn) return;

  fullscreenBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleFullscreen();
  });

  document.addEventListener("fullscreenchange", () => {
    fullscreenBtn.title = document.fullscreenElement ? "Salir de pantalla completa" : "Pantalla completa";
  });
});

// Acceso al panel administrativo. La autenticación real se realiza en admin.html con Firebase Authentication.
document.addEventListener("DOMContentLoaded", () => {
  const adminBtn = document.getElementById("admin-btn");
  if (adminBtn) {
    adminBtn.addEventListener("click", () => {
      window.location.href = "admin.html";
    });
  }
});
