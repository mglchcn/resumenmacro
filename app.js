// Usamos corsproxy.io que es mucho más estable y rápido
const enlaceGoogle = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQC7Gs2MnP2gCKMnrAtyQ2GBxrC0sM6xx2IlBGJ91ubhMPn1O0FRGNoD7zp-fZFnv6vsrB_u3W2eGAp/pub?gid=1709405390&single=true&output=csv';
const urlCSV = `https://corsproxy.io/?${encodeURIComponent(enlaceGoogle)}`;

function formatearFecha() {
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fecha-actualizacion').textContent = 'Actualizado a: ' + new Date().toLocaleDateString('es-ES', opciones);
}

const opcionesGraficoBase = {
    chart: { height: 250, toolbar: { show: false }, animations: { enabled: false } },
    dataLabels: { enabled: false },
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

document.addEventListener("DOMContentLoaded", function() {
    formatearFecha();
    cargarDatosDesdeSheets();
});
