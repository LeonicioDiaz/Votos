import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp
};

export async function isAdmin(user = auth.currentUser) {
  if (!user || user.isAnonymous) return false;
  const adminRef = doc(db, "admins", user.uid);
  const snapshot = await getDoc(adminRef);
  return snapshot.exists() && snapshot.data().active === true;
}

export function slugifyImageName(title) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_") + ".png";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function getCategoriesWithProjects() {
  const catQuery = query(collection(db, "categorias"), orderBy("order", "asc"));
  const catSnapshot = await getDocs(catQuery);

  const categories = [];
  for (const catDoc of catSnapshot.docs) {
    const cat = { id: catDoc.id, ...catDoc.data(), projects: [] };
    const projectsQuery = query(
      collection(db, "proyectos"),
      where("categoryId", "==", catDoc.id)
    );
    const projectSnapshot = await getDocs(projectsQuery);
    cat.projects = projectSnapshot.docs
      .map((p) => ({ id: p.id, ...p.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    categories.push(cat);
  }
  return categories;
}

/*
 * Los votantes NO usan Firebase Authentication.
 * El código funciona como credencial de un solo uso.
 *
 * El batch actualiza el código y crea el voto en una sola operación.
 * Las reglas de Firestore comprueban que ambas operaciones ocurran juntas.
 */
export async function submitVotes(voterCode, selectedVotes, categories) {
  const code = voterCode.trim().toUpperCase();

  if (!code) throw new Error("Ingresa tu código de votación.");

  const voterRef = doc(db, "votantes", code);
  const voterSnapshot = await getDoc(voterRef);

  if (!voterSnapshot.exists()) {
    throw new Error("El código de votación no existe.");
  }

  const voterData = voterSnapshot.data();
  if (voterData.used === true) {
    throw new Error("Este código ya fue utilizado para votar.");
  }

  if (categories.length !== Object.keys(selectedVotes).length) {
    throw new Error("Debes seleccionar un proyecto en todas las categorías.");
  }

  const validProjectIds = new Set(
    categories.flatMap((category) =>
      category.projects.map((project) => `${category.id}:${project.id}`)
    )
  );

  for (const [categoryId, projectId] of Object.entries(selectedVotes)) {
    if (!validProjectIds.has(`${categoryId}:${projectId}`)) {
      throw new Error("Se detectó una selección no válida.");
    }
  }

  const voteRef = doc(db, "votos", code);

  const voteData = {
    voterId: code,
    selections: selectedVotes,
    createdAt: serverTimestamp()
  };

  const batch = writeBatch(db);

  // No guardamos uid ni claimedBy porque el votante no se autentica.
  batch.update(voterRef, {
    used: true,
    usedAt: serverTimestamp()
  });

  batch.set(voteRef, voteData);

  try {
    await batch.commit();
  } catch (error) {
    if (error?.code === "permission-denied") {
      throw new Error("El código ya fue utilizado o no está disponible para votar.");
    }
    throw error;
  }
}

export async function getVotes() {
  const snapshot = await getDocs(collection(db, "votos"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function resetVotes() {
  const [votesSnapshot, votersSnapshot] = await Promise.all([
    getDocs(collection(db, "votos")),
    getDocs(collection(db, "votantes"))
  ]);

  const refs = [
    ...votesSnapshot.docs.map((d) => d.ref),
    ...votersSnapshot.docs.map((d) => d.ref)
  ];

  // Firestore permite máximo 500 operaciones por batch.
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = refs.slice(i, i + 450);

    chunk.forEach((ref) => {
      if (ref.parent.id === "votos") {
        batch.delete(ref);
      } else {
        batch.update(ref, {
          used: false,
          claimedBy: null,
          usedAt: null
        });
      }
    });

    await batch.commit();
  }
}

export async function createCategory(title) {
  const snapshot = await getDocs(collection(db, "categorias"));
  const order = snapshot.size + 1;
  const ref = await addDoc(collection(db, "categorias"), {
    title: title.trim(),
    order,
    active: true,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function deleteCategory(categoryId) {
  const projectSnapshot = await getDocs(
    query(collection(db, "proyectos"), where("categoryId", "==", categoryId))
  );

  const batch = writeBatch(db);
  projectSnapshot.docs.forEach((project) => batch.delete(project.ref));
  batch.delete(doc(db, "categorias", categoryId));
  await batch.commit();
}

/*
 * Convierte una imagen elegida por el administrador en un data URL comprimido.
 * Se redimensiona (lado mayor = maxSize) para que quepa de sobra en un documento
 * de Firestore (límite 1 MiB) y cargue rápido en la boleta.
 */
export async function fileToCompressedDataUrl(file, maxSize = 800, quality = 0.82) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("El archivo seleccionado no es una imagen.");
  }

  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
    el.src = url;
  });

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // WebP conserva transparencia y pesa poco. Si el navegador no lo soporta,
  // cae a JPEG con fondo blanco.
  let dataUrl = canvas.toDataURL("image/webp", quality);
  if (!dataUrl.startsWith("data:image/webp")) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrl.length > 900000) {
    throw new Error("La imagen es demasiado pesada incluso después de comprimirla. Usa una más pequeña.");
  }
  return dataUrl;
}

export async function createProject(categoryId, title, imageFile = null) {
  // Con archivo: la imagen se guarda en Firestore. Sin archivo: se conserva
  // el comportamiento anterior (./img/nombre_del_proyecto.png).
  const image = imageFile
    ? await fileToCompressedDataUrl(imageFile)
    : `./img/${slugifyImageName(title)}`;

  const projectSnapshot = await getDocs(
    query(collection(db, "proyectos"), where("categoryId", "==", categoryId))
  );

  const duplicate = projectSnapshot.docs.some(
    (d) => String(d.data().title).trim().toLowerCase() === title.trim().toLowerCase()
  );

  if (duplicate) {
    throw new Error(`Ya existe un proyecto con el título "${title}" en esta categoría.`);
  }

  const ref = await addDoc(collection(db, "proyectos"), {
    categoryId,
    title: title.trim(),
    image,
    order: projectSnapshot.size + 1,
    active: true,
    createdAt: serverTimestamp()
  });

  return { id: ref.id, image };
}

export async function updateProjectImage(projectId, imageFile) {
  const image = await fileToCompressedDataUrl(imageFile);
  await updateDoc(doc(db, "proyectos", projectId), { image });
  return image;
}

export async function deleteProject(projectId) {
  await deleteDoc(doc(db, "proyectos", projectId));
}

export async function createVoters(codes) {
  const normalized = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  for (let i = 0; i < normalized.length; i += 450) {
    const batch = writeBatch(db);
    normalized.slice(i, i + 450).forEach((code) => {
      batch.set(doc(db, "votantes", code), {
        used: false,
        claimedBy: null,
        usedAt: null,
        createdAt: serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }
  return normalized.length;
}
