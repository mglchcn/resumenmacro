// ==========================================
// 1. CONFIGURACIÓN Y URLS
// ==========================================

// --- Google Sheets (Ahora solo para PIB y RIN) ---
const enlaceGoogle = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQC7Gs2MnP2gCKMnrAtyQ2GBxrC0sM6xx2IlBGJ91ubhMPn1O0FRGNoD7zp-fZFnv6vsrB_u3W2eGAp/pub?gid=1709405390&single=true&output=csv';
const urlCSV = `https://corsproxy.io/?${encodeURIComponent(enlaceGoogle)}`;

// --- INE (Proxies para Scraping) ---
const urlINE_IPC = 'https://www.ine.gob.bo/wp-integrate/grupo/ipc.php';
const urlINE_Comex = 'https://www.ine.gob.bo/wp-integrate/grupo/comex.php';

const proxyINE_IPC = `https://corsproxy.io/?${encodeURIComponent(urlINE_IPC)}`;
const proxyINE_Comex = `https://corsproxy.io/?${encodeURIComponent(urlINE_Comex)}`;


// ==========================================
// 2. CONFIGURACIONES DE GRÁFICOS
// ==========================================

const opcionesGraficoBase = {
    chart: { height: 250, toolbar: { show: false }, animations: { enabled: false } },
    dataLabels: { enabled: true },
    tooltip: { enabled: false }, 
    stroke: { width: 2 }
};

const opcionesGraficoLargo = {
    chart: { height: 300, toolbar: { show: true }, zoom: { enabled: true } },
    dataLabels: { enabled: false }, 
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
    if (valor === null || valor === undefined || String(valor).trim() === "") return 0;
    if (typeof valor === 'string') {
        valor = valor.trim().replace(',', '.');
        return parseFloat(valor);
    }
    return valor;
}


// ==========================================
// 4. CARGA DE DATOS DESDE GOOGLE SHEETS (PIB y RIN)
// ==========================================

async function cargarDatosDesdeSheets() {
    try {
        const respuesta = await fetch(urlCSV);
        if (!respuesta.ok) throw new Error(`HTTP: ${respuesta.status}`);
        
        const textoCSV = await respuesta.text();

        Papa.parse(textoCSV, {
            header: true,
            dynamicTyping: false,
            complete: function(resultados) {
                if (resultados.data.length === 0) return;

                const encabezados = Object.keys(resultados.data[0]);
                const colAnio = encabezados.find(e => e.toLowerCase().includes('a')) || encabezados[0]; 
                const colPIB = encabezados.find(e => e.toUpperCase() === 'PIB');
                const colRIN = encabezados.find(e => e.toUpperCase() === 'RIN');

                const datosLimpios = resultados.data.filter(fila => fila[colAnio] != null && String(fila[colAnio]).trim() !== "");

                const categorias = datosLimpios.map(fila => fila[colAnio]);
                const pib = colPIB ? datosLimpios.map(fila => limpiarNumero(fila[colPIB])) : [];
                const rin = colRIN ? datosLimpios.map(fila => limpiarNumero(fila[colRIN])) : [];

                const ultimoIndice = datosLimpios.length - 1;
                
                if(document.getElementById('kpi-pib') && pib.length > 0) 
                    document.getElementById('kpi-pib').textContent = pib[ultimoIndice] + '%';
                
                if(document.getElementById('kpi-rin') && rin.length > 0) 
                    document.getElementById('kpi-rin').textContent = rin[ultimoIndice];

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
            }
        });
    } catch (error) {
        console.error("Error al cargar Google Sheets:", error);
    }
}


// ==========================================
// 5. CARGA DE DATOS DESDE EL INE (IPC)
// ==========================================

async function cargarDatosIPC_DesdeINE() {
    try {
        const respuesta = await fetch(proxyINE_IPC);
        if (!respuesta.ok) throw new Error(`HTTP: ${respuesta.status}`);

        const html = await respuesta.text();
        const coincidencia = html.match(/\[\{"mensual".+?\}\]/s);

        if (coincidencia) {
            const datosINE = JSON.parse(coincidencia[0]);
            
            const meses = datosINE.map(fila => fila.mensual);
            const ipc12Meses = datosINE.map(fila => parseFloat(fila.datoa));
            const ipcMensual = datosINE.map(fila => parseFloat(fila.datoc));

            if(document.getElementById('kpi-ipc')) {
                document.getElementById('kpi-ipc').textContent = ipc12Meses[ipc12Meses.length - 1] + '%';
            }

            if(document.querySelector("#grafico-ipc")) {
                new ApexCharts(document.querySelector("#grafico-ipc"), {
                    ...opcionesGraficoLargo,
                    series: [
                        { name: 'Inflación 12 Meses', data: ipc12Meses },
                        { name: 'Inflación Mensual', data: ipcMensual }
                    ],
                    chart: { ...opcionesGraficoLargo.chart, type: 'line' },
                    colors: ['#ef4444', '#f59e0b'],
                    xaxis: { categories: meses, tickAmount: 12 }
                }).render();
            }
        }
    } catch (error) { console.error("Error IPC INE:", error); }
}


// ==========================================
// 6. CARGA DE DATOS DESDE EL INE (Balanza Comercial)
// ==========================================

async function cargarDatosBalanza_DesdeINE() {
    try {
        console.log("Conectando con el INE (Comex)...");
        const respuesta = await fetch(proxyINE_Comex);
        if (!respuesta.ok) throw new Error(`HTTP: ${respuesta.status}`);

        const html = await respuesta.text();
        const coincidencia = html.match(/\[\{"mensual".+?\}\]/s);

        if (coincidencia) {
            const datosINE = JSON.parse(coincidencia[0]);
            console.log("Datos Comex interceptados:", datosINE);
            
            // Limpiamos la "(p)" de los meses (ej: "ene-23(p)" -> "ene-23")
            const meses = datosINE.map(fila => fila.mensual.replace(/\(p\)/g, '').trim());
            
            // Extraemos los datos (y convertimos los textos en decimales)
            const saldo = datosINE.map(fila => parseFloat(fila.saldo));
            const exportaciones = datosINE.map(fila => parseFloat(fila.exportacion));
            const importaciones = datosINE.map(fila => parseFloat(fila.importacion));

            // Si llegaras a agregar un <strong id="kpi-balanza"> en tu HTML superior
            if(document.getElementById('kpi-balanza')) {
                document.getElementById('kpi-balanza').textContent = saldo[saldo.length - 1];
            }

            // Renderizar el gráfico de Balanza (Barras dinámicas rojas y azules)
            if(document.querySelector("#grafico-balanza")) {
                new ApexCharts(document.querySelector("#grafico-balanza"), {
                    ...opcionesGraficoLargo,
                    series: [{ name: 'Saldo Comercial', data: saldo }],
                    chart: { ...opcionesGraficoLargo.chart, type: 'bar' },
                    colors: [function({ value }) { return value < 0 ? '#ef4444' : '#2563eb'; }], // Rojo si es déficit, azul si es superávit
                    xaxis: { categories: meses, tickAmount: 10 } 
                }).render();
            }
        } else {
            console.error("No se halló bloque de datos JSON en comex.php");
        }
    } catch (error) { console.error("Error Comex INE:", error); }
}


// ==========================================
// 7. INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", function() {
    formatearFecha();
    
    // Ejecutamos las tres fuentes en paralelo
    cargarDatosDesdeSheets();
    cargarDatosIPC_DesdeINE();
    cargarDatosBalanza_DesdeINE();
});
