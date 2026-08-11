//CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://rrqjkkjqofgsqksegfbm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YXyEqb7xsRO3HoC--kV_ew_pgPzEFqX';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); 

let usuarioActual = null;


//AUTENTICACIÓN Y PERFIL
async function iniciarSesion() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await db.auth.signInWithPassword({ email: email, password: password });

    if (error) {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-error').innerText = "Correo o contraseña incorrectos.";
    } else {
        usuarioActual = data.user;
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'block';
        
        cargarPerfilUsuario(usuarioActual.id);
        cargarLibrosAdmin();
        inicializarChat();
    }
}

async function cargarPerfilUsuario(userId) {
    const { data, error } = await db.from('perfiles').select('*').eq('id', userId).single();
    if (data) {
        document.getElementById('user-name').innerText = data.nombre_completo;
        document.getElementById('user-avatar').src = data.avatar_url || 'https://ui-avatars.com/api/?name=' + data.nombre_completo;
    }
}

//Subir foto de perfil desde archivo
async function subirFotoPerfil(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Indicador visual de carga
    document.getElementById('user-name').innerText = "Subiendo...";

    // Crear un nombre único para la imagen
    const fileExt = file.name.split('.').pop();
    const fileName = `perfiles/${usuarioActual.id}-${Math.random()}.${fileExt}`;

    //Subir la imagen al storage de Supabase
    const { error: uploadError } = await db.storage.from('archivos').upload(fileName, file);
    
    if (uploadError) {
        alert("Error al subir imagen: " + uploadError.message);
        cargarPerfilUsuario(usuarioActual.id);
        return;
    }

    //Obtener la URL pública de la imagen que acabamos de subir
    const { data: urlData } = db.storage.from('archivos').getPublicUrl(fileName);
    const nuevaUrl = urlData.publicUrl;

    //Actualizar la tabla de perfiles con la nueva URL
    const { error: updateError } = await db.from('perfiles').update({ avatar_url: nuevaUrl }).eq('id', usuarioActual.id);

    if (updateError) {
        alert("Error al guardar en perfil: " + updateError.message);
    } else {
        document.getElementById('user-avatar').src = nuevaUrl;
    }
    
    cargarPerfilUsuario(usuarioActual.id);
}

async function cerrarSesion() {
    await db.auth.signOut();
    window.location.reload(); 
}

// GESTIÓN DE LIBROS
async function cargarLibrosAdmin() {
    const { data: libros, error } = await db.from('libros').select('*');
    const lista = document.getElementById('lista-libros-admin');
    lista.innerHTML = '';

    if (libros) {
        libros.forEach(libro => {
            lista.innerHTML += `
                <li>
                    <span><strong>${libro.titulo}</strong> - ${libro.autor} ($${libro.precio})</span>
                    <button class="btn-danger" onclick="borrarLibro('${libro.id}')">Borrar</button>
                </li>
            `;
        });
    }
}

document.getElementById('add-book-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const titulo = document.getElementById('book-title').value;
    const autor = document.getElementById('book-author').value;
    const precio = parseFloat(document.getElementById('book-price').value);
    
    // Obtener el archivo de imagen seleccionado
    const fileInput = document.getElementById('book-image');
    const file = fileInput.files[0];

    if (!file) {
        alert("Por favor selecciona una imagen para la portada.");
        return;
    }

    // Bloquear el botón mientras se sube el archivo
    const btnSubmit = document.getElementById('btn-submit-book');
    const textoOriginal = btnSubmit.innerText;
    btnSubmit.innerText = "Subiendo archivo...";
    btnSubmit.disabled = true;

    // Crear un nombre único para evitar que se sobreescriban libros distintos con el mismo nombre de foto
    const fileExt = file.name.split('.').pop();
    const fileName = `libros/${Date.now()}-${Math.random()}.${fileExt}`;

    // 1. Subir al Storage
    const { error: uploadError } = await db.storage.from('archivos').upload(fileName, file);

    if (uploadError) {
        alert("Error al subir la imagen: " + uploadError.message);
        btnSubmit.innerText = textoOriginal;
        btnSubmit.disabled = false;
        return;
    }

    // 2. Obtener URL de la imagen
    const { data: urlData } = db.storage.from('archivos').getPublicUrl(fileName);
    const imagen_url = urlData.publicUrl;

    // 3. Insertar el libro en la base de datos con su nueva URL
    const { error: insertError } = await db.from('libros').insert([{ titulo, autor, precio, imagen_url }]);

    btnSubmit.innerText = textoOriginal;
    btnSubmit.disabled = false;

    if (insertError) {
        alert("Error al agregar el libro: " + insertError.message);
    } else {
        alert("¡Libro agregado exitosamente!");
        this.reset();
        cargarLibrosAdmin();
    }
});

async function borrarLibro(id) {
    if (confirm("¿Estás seguro de eliminar este libro?")) {
        const { error } = await db.from('libros').delete().eq('id', id);
        if (error) alert("Error al eliminar: " + error.message);
        else cargarLibrosAdmin();
    }
}


//CHAT
function inicializarChat() {
    cargarMensajesViejos();
    db.channel('public:mensajes_chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_chat' }, payload => {
            mostrarMensajeEnUI(payload.new);
        }).subscribe();
}

async function cargarMensajesViejos() {
    const { data } = await db.from('mensajes_chat')
        .select(`*, perfiles(nombre_completo)`).order('creado_en', { ascending: true }).limit(50);
        
    const container = document.getElementById('chat-mensajes');
    container.innerHTML = ''; 
    if (data) data.forEach(msg => mostrarMensajeEnUI(msg, msg.perfiles?.nombre_completo));
}

document.getElementById('chat-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    
    if (input.value.trim() !== '') {
        await db.from('mensajes_chat').insert([{ perfil_id: usuarioActual.id, contenido: input.value }]);
        input.value = '';
    }
});

function mostrarMensajeEnUI(mensaje, nombre = "Usuario") {
    const container = document.getElementById('chat-mensajes');
    const esMio = mensaje.perfil_id === usuarioActual.id;
    const div = document.createElement('div');
    div.className = `mensaje ${esMio ? 'enviado' : 'recibido'}`;
    div.innerHTML = `<strong>${esMio ? 'Tú' : nombre}:</strong> ${mensaje.contenido}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight; 
}