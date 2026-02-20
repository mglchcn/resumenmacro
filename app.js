// ==========================================
// 1. CONFIGURACIÓN Y URLS
// ==========================================

// --- Google Sheets (PIB, RIN, Balanza Comercial) ---
// Aquí puedes mantener los datos anuales o los que aún no jalas directo del INE
const enlaceGoogle = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQC7Gs2MnP2gCKMnrAtyQ2GBxrC0sM6xx2IlBGJ91ubhMPn1O0FRGNoD7zp-fZFnv6vsrB_u3W2eGAp/pub?gid=1709405390&single=true&output=csv';
const urlCSV = `https://corsproxy.io/?${encodeURIComponent(enlaceGoogle)}`;

// --- INE (IPC Mensual) ---
const urlINE = 'https://www.ine.gob.bo/wp-integrate/grupo/ipc.php';
const proxyINE = `https://corsproxy.io/?${encodeURIComponent(urlINE)}`;


// ==========================================
// 2. CONFIGURACIONES DE GRÁFICOS
// ==========================================

// Opciones para gráficos de barras cortos (ej. datos anuales de Sheets)
const opcionesGraficoBase = {
    chart: { height: 250, toolbar: { show: false }, animations: { enabled: false } },
    dataLabels: { enabled: true }, // Muestra los numeritos sobre las barras
    tooltip: { enabled: false }, 
    stroke: { width: 2 }
};

// Opciones para gráficos de líneas largos (ej. datos mensuales del INE)
const opcionesGraficoLargo = {
    chart: { height: 350, toolbar: { show: true }, zoom: { enabled: true } },
    dataLabels: { enabled: false }, // Apagado para no saturar la pantalla con números
    stroke: { width: 2, curve: 'smooth' }
};


// ==========================================
// 3. FUNCIONES DE UTILIDAD
// ==========================================

function formatearFecha() {
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    const elementoFecha = document.getElementById('fecha-actualizacion');
    if (elementoFecha) {
        elementoFecha.textContent = 'Actualizado a: ' + new Date().toLocaleDateString('es-ES', opciones);
    }
}

function limpiarNumero(valor) {
    if (valor === null || valor === undefined || valor === "") return 0;
    if (typeof valor === 'string') {
        valor = valor.trim().replace(',', '.');
        return parseFloat(valor);
    }
    return valor;
}


// ==========================================
// 4. CARGA DE DATOS DESDE GOOGLE SHEETS
// ==========================================

async function cargarDatosDesdeSheets() {
    try {
        console.log("Conectando con Google Sheets...");
        
        const respuesta = await fetch(urlCSV);
        if (!respuesta.ok) throw new Error(`Error HTTP: ${respuesta.status}`);
        
        const textoCSV = await respuesta.text();

        Papa.parse(textoCSV, {
            header: true,
            dynamicTyping: false,
            complete: function(resultados) {
                if (resultados.data.length === 0) {
                    console.error("El CSV de Sheets está vacío.");
                    return;
                }

                const encabezados = Object.keys(resultados.data[0]);
                
                const colAnio = encabezados.find(e => e.toLowerCase().includes('a')) || encabezados[0]; 
                const colPIB = encabezados.find(e => e.toUpperCase() === 'PIB');
                const colRIN = encabezados.find(e => e.toUpperCase() === 'RIN');
                const colBalanza = encabezados.find(e => e.toUpperCase().includes('BALANZA'));

                // Filtramos filas vacías
                const datosLimpios = resultados.data.filter(fila => fila[colAnio] != null && String(fila[colAnio]).trim() !== "");

                const categorias = datosLimpios.map(fila => fila[colAnio]);
                const pib = colPIB ? datosLimpios.map(fila => limpiarNumero(fila[colPIB])) : [];
                const rin = colRIN ? datosLimpios.map(fila => limpiarNumero(fila[colRIN])) : [];
                const balanza = colBalanza ? datosLimpios.map(fila => limpiarNumero(fila[colBalanza])) : [];

                // Actualizar KPIs superiores (asegurándonos de que los elementos HTML existan)
                const ultimoIndice = datosLimpios.length - 1;
                
                if(document.getElementById('kpi-pib') && pib.length > 0) 
                    document.getElementById('kpi-pib').textContent = pib[ultimoIndice] + '%';
                
                if(document.getElementById('kpi-rin') && rin.length > 0) 
                    document.getElementById('kpi-rin').textContent = rin[ultimoIndice];

                // Renderizar Gráficos (solo si los contenedores existen en el HTML)
                if (document.querySelector("#grafico-pib") && pib.length > 0) {
                    new ApexCharts(document.querySelector("#grafico-pib"), {
                        ...opcionesGraficoBase,
                        series: [{ name: 'PIB', data: pib }],
                        chart: { ...opcionesGraficoBase.chart, type: 'bar' },
                        colors: ['#2563eb'],
                        xaxis: { categories: categorias }
                    }).render();
                }

                if (document.querySelector("#grafico-rin") && rin.length > 0) {
                    new ApexCharts(document.querySelector("#grafico-rin"), {
                        ...opcionesGraficoBase,
                        series: [{ name: 'RIN', data: rin }],
                        chart: { ...opcionesGraficoBase.chart, type: 'area' },
                        colors: ['#10b981'],
                        xaxis: { categories: categorias }
                    }).render();
                }

                if (document.querySelector("#grafico-balanza") && balanza.length > 0) {
                    new ApexCharts(document.querySelector("#grafico-balanza"), {
                        ...opcionesGraficoBase,
                        series: [{ name: 'Balanza Comercial', data: balanza }],
                        chart: { ...opcionesGraficoBase.chart, type: 'bar' },
                        colors: [function({ value }) { return value < 0 ? '#ef4444' : '#2563eb'; }],
                        xaxis: { categories: categorias }
                    }).render();
                }
            }
        });
    } catch (error) {
        console.error("Error al cargar Google Sheets:", error);
    }
}


// ==========================================
// 5. CARGA DE DATOS DESDE EL INE (Scraping)
// ==========================================

async function cargarDatosIPC_DesdeINE() {
    try {
        console.log("Conectando con el INE (IPC)...");
        const respuesta = await fetch(proxyINE);
        if (!respuesta.ok) throw new Error(`Error HTTP: ${respuesta.status}`);

        const html = await respuesta.text();

        // Extraer el JSON oculto en el HTML del INE
        const regex = /\[\{"mensual".+?\}\]/s;
        const coincidencia = html.match(regex);

        if (coincidencia) {
            const datosINE = JSON.parse(coincidencia[0]);
            console.log("Datos del INE interceptados correctamente.");

            const meses = datosINE.map(fila => fila.mensual);
            const ipc12Meses = datosINE.map(fila => parseFloat(fila.datoa));
            const ipcMensual = datosINE.map(fila => parseFloat(fila.datoc));

            // Actualizar KPI superior
            const ultimoIndice = ipc12Meses.length - 1;
            if(document.getElementById('kpi-ipc')) {
                document.getElementById('kpi-ipc').textContent = ipc12Meses[ultimoIndice] + '%';
            }

            // Renderizar Gráfico
            if(document.querySelector("#grafico-ipc")) {
                new ApexCharts(document.querySelector("#grafico-ipc"), {
                    ...opcionesGraficoLargo,
                    series: [
                        { name: 'Inflación 12 Meses', data: ipc12Meses },
                        { name: 'Inflación Mensual', data: ipcMensual }
                    ],
                    chart: { ...opcionesGraficoLargo.chart, type: 'line' },
                    colors: ['#ef4444', '#f59e0b'],
                    xaxis: { categories: meses, tickAmount: 12 } // 1 marca por año aprox
                }).render();
            }

        } else {
            console.error("No se pudo encontrar el bloque de datos IPC en la página del INE.");
        }
    } catch (error) {
        console.error("Error al hacer scraping en el INE:", error);
    }
}


// ==========================================
// 6. INICIALIZACIÓN (Al cargar la página)
// ==========================================

// Usamos un solo bloque DOMContentLoaded para arrancar todo de forma ordenada
document.addEventListener("DOMContentLoaded", function() {
    formatearFecha();
    
    // Lanzamos ambas funciones simultáneamente. 
    // Si una falla o tarda, la otra sigue funcionando de forma independiente.
    cargarDatosDesdeSheets();
    cargarDatosIPC_DesdeINE();
});
