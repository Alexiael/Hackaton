// Coordenadas del CTRUZ en el Parque Tecnológico López Soriano
const centroOperaciones = [41.57113967401183, -0.846057908334574];

// Capacidad máxima del camión en kilogramos
const capacidadCamion = 10000;

// Inicialización del mapa centrado en el CTRUZ
const map = L.map('map').setView(centroOperaciones, 13); // Zoom nivel 13


//mapa claro: https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
//mapa colorines: https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);


// Iconos personalizados
const contenedorIcono = L.icon({
    iconUrl: 'contenedor-icon.png', // Ruta de la imagen del contenedor
    iconSize: [32, 32],            
    iconAnchor: [16, 16],          // Punto de anclaje del icono
    popupAnchor: [0, -32],         // Punto donde aparece el popup
});

const recicladoIcono = L.icon({
    iconUrl: 'reciclado-icon.png', 
    iconSize: [50, 50],            
    iconAnchor: [25, 25],          
    popupAnchor: [0, -40],         
});

// Marcador inicial para el centro de operaciones en el CTRUZ
L.marker(centroOperaciones, { icon: recicladoIcono }).addTo(map).bindPopup("Centro de Operaciones: CTRUZ").openPopup();

console.log("Mapa centrado en el CTRUZ.");

// Lista para almacenar los contenedores y rutas
let contenedores = [];
let rutas = [];
let contadorID = 1; // Contador para las IDs de los contenedores

// Función para cargar datos desde localStorage
function cargarDatos() {
    const datosContenedores = localStorage.getItem('contenedores');
    const datosRutas = localStorage.getItem('rutas');

    if (datosContenedores) {
        contenedores = JSON.parse(datosContenedores);
        contadorID = contenedores.length > 0 ? contenedores[contenedores.length - 1].id + 1 : 1;

        // Restaurar los marcadores en el mapa
        contenedores.forEach((contenedor) => {
            agregarContenedorAlMapa(contenedor);
        });

        console.log("Contenedores cargados desde localStorage:", contenedores);

        // Generar rutas si hay contenedores
        if (contenedores.length > 0) {
            rutas = generarRutasOptimizada(contenedores, capacidadCamion);
            guardarDatos(); // Guardar las rutas generadas
            visualizarRutas(rutas);
        }
    } else {
        console.log("No hay contenedores guardados en localStorage.");
    }

    if (datosRutas) {
        rutas = JSON.parse(datosRutas);
        console.log("Rutas cargadas desde localStorage:", rutas);

        if (rutas.length > 0) {
            visualizarRutas(rutas); // Visualizar rutas cargadas
        } else {
            console.log("No hay rutas para visualizar.");
        }
    }
}

// Función para guardar datos en localStorage
function guardarDatos() {
    localStorage.setItem('contenedores', JSON.stringify(contenedores));
    localStorage.setItem('rutas', JSON.stringify(rutas));
    console.log("Datos guardados en localStorage.");
}

// Cargar los datos al inicio
cargarDatos();

// Seleccionar el formulario
const form = document.getElementById('form-container');

// Manejar el envío del formulario
form.addEventListener('submit', (event) => {
    event.preventDefault(); // Evitar recargar la página

    // Obtener los valores ingresados
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);
    const nivel = parseInt(document.getElementById('nivel').value, 10);
    const capacidad = parseFloat(document.getElementById('capacidad').value);

    // Generar automáticamente el ID
    const id = contadorID++;

    // Crear un objeto para el contenedor
    const contenedor = { id, lat, lon, nivel, capacidad };
    contenedores.push(contenedor); // Guardar en la lista

    // Guardar en localStorage
    guardarDatos();

    // Agregar marcador con el icono personalizado
    agregarContenedorAlMapa(contenedor);

    console.log(`Contenedor agregado:`, contenedor);

    // Generar rutas y actualizar
    rutas = generarRutasOptimizada(contenedores, capacidadCamion);
    guardarDatos();
    visualizarRutas(rutas);

    // Resetear el formulario
    form.reset();
});

// Función para agregar contenedor al mapa con icono personalizado
function agregarContenedorAlMapa(contenedor) {
    const marker = L.marker([contenedor.lat, contenedor.lon], { icon: contenedorIcono }).addTo(map);
    marker.bindPopup(`
        <b>Contenedor ID: ${contenedor.id}</b><br>
        Nivel de llenado: ${contenedor.nivel}%<br>
        Capacidad: ${contenedor.capacidad} kg
    `).openPopup();
}

// Función para generar rutas según criterios de prioridad
function generarRutasOptimizada(contenedores, capacidadCamion) {
    const rutasGeneradas = [];
    let camionActual = { ruta: [], cargaActual: 0, distanciaRecorrida: 0 };
    let ubicacionActual = { lat: centroOperaciones[0], lon: centroOperaciones[1] };

    const gruposPrioridad = {
        maxima: [],
        alta: [],
        media: [],
        baja: []
    };

    contenedores.forEach((contenedor) => {
        if (contenedor.nivel >= 75) {
            gruposPrioridad.maxima.push(contenedor);
        } else if (contenedor.nivel >= 51) {
            gruposPrioridad.alta.push(contenedor);
        } else if (contenedor.nivel >= 26) {
            gruposPrioridad.media.push(contenedor);
        } else {
            gruposPrioridad.baja.push(contenedor);
        }
    });

    for (const prioridad in gruposPrioridad) {
        gruposPrioridad[prioridad].sort((a, b) => b.nivel - a.nivel);
    }

    while (true) {
        const contenedor = gruposPrioridad.maxima.shift() || gruposPrioridad.alta.shift() || gruposPrioridad.media.shift() || gruposPrioridad.baja.shift();
        if (!contenedor) break;

        const pesoContenedor = (contenedor.nivel / 100) * contenedor.capacidad;
        if (camionActual.cargaActual + pesoContenedor <= capacidadCamion) {
            camionActual.ruta.push(contenedor.id);
            camionActual.cargaActual += pesoContenedor;

            const distancia = calcularDistancia(ubicacionActual, contenedor);
            camionActual.distanciaRecorrida += distancia;

            ubicacionActual = { lat: contenedor.lat, lon: contenedor.lon };
        } else {
            rutasGeneradas.push(camionActual);
            camionActual = { ruta: [], cargaActual: 0, distanciaRecorrida: 0 };
            ubicacionActual = { lat: centroOperaciones[0], lon: centroOperaciones[1] };
        }
    }

    if (camionActual.ruta.length > 0) rutasGeneradas.push(camionActual);
    console.log("Rutas generadas:", rutasGeneradas);
    return rutasGeneradas;
}

// Función para calcular la distancia entre dos puntos geográficos (Haversine)
function calcularDistancia(punto1, punto2) {
    const R = 6371;
    const radianes = (grados) => (grados * Math.PI) / 180;
    const deltaLat = radianes(punto2.lat - punto1.lat);
    const deltaLon = radianes(punto2.lon - punto1.lon);
    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(radianes(punto1.lat)) *
        Math.cos(radianes(punto2.lat)) *
        Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Función para visualizar rutas en el mapa
function visualizarRutas(rutas) {
    console.log("Visualizando rutas:", rutas);

    // Eliminar rutas anteriores del mapa
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    // Dibujar cada ruta en el mapa
    rutas.forEach((ruta, index) => {
        const puntos = [centroOperaciones];

        // Obtener las coordenadas de los contenedores en la ruta
        ruta.ruta.forEach((id) => {
            const contenedor = contenedores.find((c) => c.id == id);
            if (contenedor) {
                puntos.push([contenedor.lat, contenedor.lon]);
            }
        });

        // Agregar el punto de regreso al centro de operaciones
        puntos.push(centroOperaciones);

        if (puntos.length > 2) {
            // Color dinámico según la carga del camión
            //Falta el amarillo
            const cargaRatio = ruta.cargaActual / capacidadCamion;
            const color = cargaRatio > 0.75 ? 'red' : cargaRatio > 0.5 ? 'orange' : 'green';

            // Línea de ruta con estilo personalizado
            const polyline = L.polyline(puntos, {
                color: color,         // Color dinámico
                weight: 2 + cargaRatio * 2, // Grosor según carga
                dashArray: index % 2 === 0 ? '5, 5' : '', // guiones
                opacity: 0.8          
            }).addTo(map);

            // Tooltip al pasar el ratón, tipo hover
            polyline.on('mouseover', function () {
                polyline.bindTooltip(`
                    <b>Camión ${index + 1}</b><br>
                    Contenedores: ${ruta.ruta.join(", ")}<br>
                    Carga total: ${ruta.cargaActual.toFixed(2)} kg<br>
                    Distancia total: ${ruta.distanciaRecorrida.toFixed(2)} km
                `, {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -10],
                }).openTooltip();
            });

            polyline.on('mouseout', function () {
                polyline.unbindTooltip(); // Ocultar el tooltip al salir
            });

            // Popup al hacer clic
            polyline.bindPopup(`
                <b>Camión ${index + 1}</b><br>
                Contenedores recogidos: ${ruta.ruta.join(", ")}<br>
                Carga total: ${ruta.cargaActual.toFixed(2)} kg<br>
                Distancia total recorrida: ${ruta.distanciaRecorrida.toFixed(2)} km
            `);
        }
    });
}

















