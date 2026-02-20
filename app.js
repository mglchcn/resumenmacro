// Usamos corsproxy.io que es mucho más estable y rápido
const enlaceGoogle = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQC7Gs2MnP2gCKMnrAtyQ2GBxrC0sM6xx2IlBGJ91ubhMPn1O0FRGNoD7zp-fZFnv6vsrB_u3W2eGAp/pub?gid=1709405390&single=true&output=csv';
const urlCSV = `https://corsproxy.io/?${encodeURIComponent(enlaceGoogle)}`;

function formatearFecha() {
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fecha-actualizacion').textContent = 'Actualizado a: ' + new Date().toLocaleDateString('es-ES', opciones);
}

const opcionesGraficoBase = {
    chart: { height: 250, toolbar: { show: false }, animations: { enabled: false } },
    dataLabels: { enabled: true },
    tooltip: { enabled: false }, 
    stroke: { width: 2 }
};

function limpiarNumero(valor) {
    if (valor === null || valor === undefined) return 0;
    if (typeof valor === 'string') {
        valor = valor.trim().replace(',', '.');
        return parseFloat(valor);
    }
    return valor;
}

// NUEVA FUNCIÓN: Usamos Fetch moderno en lugar de la descarga directa de PapaParse
async function cargarDatosDesdeSheets() {
    try {
        console.log("Conectando con Google Sheets...");
        
        // 1. Descargamos el texto crudo usando fetch
        const respuesta = await fetch(urlCSV);
        if (!respuesta.ok) {
            throw new Error(`Error de conexión: ${respuesta.status}`);
        }
        
        const textoCSV = await respuesta.text();
        console.log("CSV descargado exitosamente. Procesando...");

        // 2. Le pasamos el texto ya descargado a PapaParse
        Papa.parse(textoCSV, {
            header: true,
            dynamicTyping: false,
            complete: function(resultados) {
                
                if (resultados.data.length === 0) {
                    console.error("El CSV está vacío.");
                    return;
                }

                const encabezados = Object.keys(resultados.data[0]);
                
                const colAnio = encabezados.find(e => e.toLowerCase().includes('a')) || encabezados[0]; 
                const colPIB = encabezados.find(e => e.toUpperCase() === 'PIB');
                const colRIN = encabezados.find(e => e.toUpperCase() === 'RIN');
                const colIPC = encabezados.find(e => e.toUpperCase() === 'IPC');
                const colBalanza = encabezados.find(e => e.toUpperCase().includes('BALANZA'));

                const datosLimpios = resultados.data.filter(fila => fila[colAnio] != null && String(fila[colAnio]).trim() !== "");

                const categorias = datosLimpios.map(fila => fila[colAnio]);
                const pib = datosLimpios.map(fila => limpiarNumero(fila[colPIB]));
                const rin = datosLimpios.map(fila => limpiarNumero(fila[colRIN]));
                const ipc = datosLimpios.map(fila => limpiarNumero(fila[colIPC]));
                const balanza = datosLimpios.map(fila => limpiarNumero(fila[colBalanza]));

                const ultimoIndice = datosLimpios.length - 1;
                document.getElementById('kpi-pib').textContent = pib[ultimoIndice] + '%';
                document.getElementById('kpi-ipc').textContent = ipc[ultimoIndice] + '%';
                document.getElementById('kpi-rin').textContent = rin[ultimoIndice];

                new ApexCharts(document.querySelector("#grafico-pib"), {
                    ...opcionesGraficoBase,
                    series: [{ name: 'PIB', data: pib }],
                    chart: { ...opcionesGraficoBase.chart, type: 'bar' },
                    colors: ['#2563eb'],
                    xaxis: { categories: categorias }
                }).render();

                new ApexCharts(document.querySelector("#grafico-rin"), {
                    ...opcionesGraficoBase,
                    series: [{ name: 'RIN', data: rin }],
                    chart: { ...opcionesGraficoBase.chart, type: 'area' },
                    colors: ['#10b981'],
                    xaxis: { categories: categorias }
                }).render();

                new ApexCharts(document.querySelector("#grafico-ipc"), {
                    ...opcionesGraficoBase,
                    series: [{ name: 'IPC', data: ipc }],
                    chart: { ...opcionesGraficoBase.chart, type: 'line' },
                    colors: ['#f59e0b'],
                    xaxis: { categories: categorias }
                }).render();

                new ApexCharts(document.querySelector("#grafico-balanza"), {
                    ...opcionesGraficoBase,
                    series: [{ name: 'Balanza Comercial', data: balanza }],
                    chart: { ...opcionesGraficoBase.chart, type: 'bar' },
                    colors: [function({ value }) { return value < 0 ? '#ef4444' : '#2563eb'; }],
                    xaxis: { categories: categorias }
                }).render();
            }
        });
    } catch (error) {
        console.error("Error al cargar los datos:", error);
        alert("Hubo un problema de conexión al intentar descargar el CSV.");
    }
}
//-----------------------------------------------------------------------------
// Opciones base para el gráfico (por si no las tienes a mano)
const opcionesGraficoLargo = {
    chart: { height: 350, toolbar: { show: true }, zoom: { enabled: true } },
    dataLabels: { enabled: false },
    stroke: { width: 2, curve: 'smooth' }
};

async function cargarDatosIPC_DesdeINE() {
    const urlINE = 'https://www.ine.gob.bo/wp-integrate/grupo/ipc.php';
    const proxyCORS = `https://corsproxy.io/?${encodeURIComponent(urlINE)}`;

    try {
        console.log("Conectando con el INE...");
        const respuesta = await fetch(proxyCORS);
        const html = await respuesta.text();

        // 1. EXTRAER EL JSON OCULTO:
        // Buscamos el texto que empiece con [{"mensual" y termine con }]
        const regex = /\[\{"mensual".+?\}\]/s;
        const coincidencia = html.match(regex);

        if (coincidencia) {
            // Convertimos ese texto crudo en un objeto JavaScript real
            const datosINE = JSON.parse(coincidencia[0]);
            console.log("¡Datos interceptados del INE con éxito!", datosINE);

            // 2. MAPEAR LOS DATOS PARA APEXCHARTS:
            const meses = datosINE.map(fila => fila.mensual);
            // El INE los manda como texto ("2.93"), los pasamos a decimales (parseFloat)
            const ipc12Meses = datosINE.map(fila => parseFloat(fila.datoa));
            const ipcMensual = datosINE.map(fila => parseFloat(fila.datoc));

            // 3. ACTUALIZAR EL DASHBOARD:
            // Actualizar KPI superior (Último mes disponible)
            const ultimoIndice = ipc12Meses.length - 1;
            document.getElementById('kpi-ipc').textContent = ipc12Meses[ultimoIndice] + '%';

            // Dibujar el Gráfico
            new ApexCharts(document.querySelector("#grafico-ipc"), {
                ...opcionesGraficoLargo,
                series: [
                    { name: 'Inflación 12 Meses', data: ipc12Meses },
                    { name: 'Inflación Mensual', data: ipcMensual }
                ],
                chart: { ...opcionesGraficoLargo.chart, type: 'line' },
                colors: ['#ef4444', '#f59e0b'],
                xaxis: { categories: meses, tickAmount: 12 } // 1 tick por año
            }).render();

        } else {
            console.error("No se pudo encontrar el bloque de datos en la página del INE. Es posible que hayan cambiado la estructura.");
        }

    } catch (error) {
        console.error("Error al hacer scraping en la página del INE:", error);
    }
}

// Ejecutar al cargar
document.addEventListener("DOMContentLoaded", function() {
    cargarDatosIPC_DesdeINE();
});

//------------------------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function() {
    formatearFecha();
    cargarDatosDesdeSheets();
});

