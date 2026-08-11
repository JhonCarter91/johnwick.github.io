// CONFIGURACIÓN SUPABASE 
const SUPABASE_URL = 'https://rrqjkkjqofgsqksegfbm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YXyEqb7xsRO3HoC--kV_ew_pgPzEFqX';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

//CARGAR LIBROS DESDE LA BASE DE DATOS
async function cargarCatalogoIndex() {
    // Usamos 'db' en lugar de 'supabase'
    const { data: libros, error } = await db
        .from('libros')
        .select('*')
        .order('creado_en', { ascending: false });

    if (error) {
        console.error("Error cargando libros:", error);
        return;
    }

    const contenedor = document.getElementById('scroll-libros');
    contenedor.innerHTML = '';

    libros.forEach(libro => {
        const urlImagen = libro.imagen_url ? libro.imagen_url : 'imagenes/default-book.jpg';
        
        contenedor.innerHTML += `
            <div class="card-scroll">
                <img src="${urlImagen}" alt="${libro.titulo}" class="book-img">
                <h4>${libro.titulo}</h4>
                <p>${libro.autor}</p>
                <span class="price">$${parseFloat(libro.precio).toFixed(2)}</span>
                <button class="btn-primary btn-sm">COMPRAR</button>
            </div>
        `;
    });
}

document.addEventListener('DOMContentLoaded', cargarCatalogoIndex);

//LÓGICA DEL SLIDER
const slider = document.getElementById('scroll-libros');
let isDown = false;
let startX;
let scrollLeft;

slider.addEventListener('mousedown', (e) => {
    isDown = true;
    slider.classList.add('active');
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
});

slider.addEventListener('mouseleave', () => {
    isDown = false;
    slider.classList.remove('active');
});

slider.addEventListener('mouseup', () => {
    isDown = false;
    slider.classList.remove('active');
});

slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 2; 
    slider.scrollLeft = scrollLeft - walk;
});