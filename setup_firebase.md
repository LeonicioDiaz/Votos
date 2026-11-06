# Configuración de Firebase para Vota 2025

Esta versión ya no utiliza `localStorage` para categorías, proyectos ni votos. La página continúa siendo solamente HTML/CSS/JS y usa Firebase como servicio de datos y autenticación.

## 1. Crear proyecto

1. Entra a Firebase Console: https://console.firebase.google.com/
2. Crea un proyecto, por ejemplo `vota-2025`.
3. No es necesario activar Google Analytics para este proyecto.

## 2. Crear la aplicación web

En Firebase Console:

Proyecto > Configuración del proyecto > Tus aplicaciones > Agregar aplicación > Web.

Firebase mostrará un objeto parecido a:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Copia esos valores en `firebase-config.js`.

## 3. Activar Authentication

Firebase Console > Authentication > Sign-in method.

Activa:

- Anonymous
- Email/Password

Anonymous se utiliza para los votantes.
Email/Password se utiliza exclusivamente para el administrador.

## 4. Crear el administrador

En Authentication > Users > Add user, crea el correo y contraseña que utilizarás para administrar la votación.

Después copia el **UID** de ese usuario.

En Firestore crea manualmente:

Colección: `admins`

Documento: `<UID_DEL_ADMIN>`

Campos:

```text
active    boolean    true
```

No utilices como ID del documento el correo. Debe ser el UID.

## 5. Crear Firestore

Firebase Console > Firestore Database > Create database.

Puedes iniciar en modo producción y después colocar las reglas del archivo `firestore.rules`.

Firestore tendrá estas colecciones:

```text
admins
categorias
proyectos
votantes
votos
```

No es necesario crearlas manualmente; `categorias`, `proyectos`, `votantes` y `votos` aparecerán al utilizar el sistema.

## 6. Reglas de seguridad

Copia el contenido de `firestore.rules` en:

Firestore Database > Rules

y pulsa Publish.

Estas reglas permiten:

- Cualquier visitante puede leer categorías y proyectos.
- Un visitante puede votar solamente mediante un código válido.
- Un código solo puede consumirse una vez.
- El código queda ligado al usuario anónimo que lo utilizó.
- Los votos no pueden ser borrados por los votantes.
- Solamente el administrador puede modificar categorías, proyectos, códigos y resultados.

## 7. Subir los archivos

El hosting que ya utilizas puede continuar siendo el mismo.

Sube los archivos:

```text
index.html
admin.html
categorias.html
app.js
firebase.js
firebase-config.js
styles.css
tailwind.js
firestore.rules
img/
sounds/
```

`firestore.rules` y este archivo de instrucciones no necesitan estar publicados para que la aplicación funcione; son para administración/documentación.

## 8. Primera prueba

1. Abre `admin.html`.
2. Inicia sesión con el usuario administrador.
3. Entra a `Categorías`.
4. Crea una categoría.
5. Agrega proyectos.
6. Para cada proyecto, el sistema genera automáticamente el nombre de imagen.
7. Coloca la imagen PNG correspondiente en `img/`.

Ejemplo:

```text
Título: Mi Proyecto Solar
Imagen esperada:
./img/mi_proyecto_solar.png
```

El nombre se convierte automáticamente a minúsculas, los espacios se convierten en `_`, se eliminan acentos y la extensión es siempre `.png`.

## 9. Generar códigos

Desde `admin.html` puedes generar, por ejemplo, 100 códigos.

Ejemplo:

```text
A7K9P2
B4M8X1
C9Q3L7
D2F8K4
```

Guárdalos en Firebase y descarga el archivo para repartirlos a los votantes.

## 10. Flujo del votante

El votante entra a `index.html`.

1. Selecciona un proyecto por cada categoría.
2. Pulsa `Enviar Votos`.
3. Introduce su código.
4. Firebase verifica que el código exista y no haya sido utilizado.
5. Se registra el voto.
6. El código queda marcado como utilizado.
7. Si intenta utilizarlo nuevamente, el sistema lo rechaza.

## 11. Resultados

El panel `admin.html` lee todos los documentos de `votos` y calcula los resultados de forma centralizada.

También permite:

- Ver total de votos.
- Ver códigos registrados.
- Ver códigos utilizados.
- Ver ganador por categoría.
- Exportar resultados a CSV.
- Reiniciar la votación.

## 12. Importante sobre el reinicio

El botón `Reiniciar Votos` elimina los documentos de `votos` y vuelve a poner los documentos de `votantes` como `used: false`.

Las categorías y proyectos no se modifican.

## 13. Importante sobre las imágenes

El sistema conserva la regla original:

```text
Título del proyecto -> nombre de archivo PNG
```

Ejemplos:

```text
Eco Seta       -> eco_seta.png
Safe Water     -> safe_water.png
Xoco Café      -> xoco_cafe.png
Real Time GPS  -> real_time_gps.png
```

Las imágenes deben estar en:

```text
img/
```

## 14. Seguridad

La antigua contraseña escrita dentro de `app.js` fue eliminada.

No coloques una contraseña administrativa dentro de JavaScript público. Firebase Authentication es quien valida las credenciales.

Tampoco es necesario bloquear F12, clic derecho o Ctrl+U. Esas medidas no protegen una aplicación web. La protección real está en las reglas de Firebase.


## Importante en la versión 2: votantes sin autenticación

Los votantes ya NO utilizan Firebase Authentication ni usuarios anónimos. Solo introducen un código de un solo uso.

1. En Authentication conserva **Email/Password** únicamente para el administrador.
2. No es necesario activar Anonymous.
3. Publica las reglas incluidas en `firestore.rules`.
4. En Firestore crea los códigos desde `admin.html`.
5. Cada código se almacena como documento en `votantes`, con `used: false`.
6. Al votar, el navegador realiza un batch que marca el código como usado y crea el voto.
7. Si dos dispositivos intentan utilizar el mismo código simultáneamente, solo una operación debe pasar las reglas; la otra será rechazada.

### Publicación de reglas

En Firebase Console:
Firestore Database → Rules

Reemplaza las reglas actuales por el contenido de `firestore.rules` y pulsa **Publish**.

> No uses reglas como `allow read, write: if true;` para esta aplicación.
