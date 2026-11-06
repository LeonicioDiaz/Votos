El nombre asignado a cada proyecto sera el nombre de la imagen que buscara
Tener en cuenta que los proyectos que tengan espacios en blanco en sus proyectos, a la imagen se le debe colocar un \_, y que los nombres de las imagenes debe estar todo en minusculas
Todas las imagenes deben ser png, ya que el codigo asi esta creado

### Votación sin autenticación

Los participantes no necesitan cuenta Firebase. Introducen un código único generado desde el panel administrativo. Solo el administrador usa Firebase Authentication.

###Eliminar códigos viejos
Si quieres eliminar los códigos viejos para generar nuevos, hazlo desde firebase entrando a Firestore -> Datos y borra la tabla votantes

###Admin
Usuario: leoniciodg@gmail.com
Pass: 7777777

###Logos
Están ubicados en la carpeta img, para cambiarlos solo usa la imagen sin fondo y utiliza el mismo nombre

###Error con Firebase no resuelto aun
Procurar no tener la sesion de admin abierta mientras se este llevando a cabo la votación ya que no reconocera los códigos
