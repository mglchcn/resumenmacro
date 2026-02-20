// Tu enlace original de Google Sheets
const enlaceGoogle = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQC7Gs2MnP2gCKMnrAtyQ2GBxrC0sM6xx2IlBGJ91ubhMPn1O0FRGNoD7zp-fZFnv6vsrB_u3W2eGAp/pub?gid=1709405390&single=true&output=csv';

// Pasamos el enlace a través del proxy CORS gratuito (allorigins)
const urlCSV = `https://api.allorigins.win/raw?url=${encodeURIComponent(enlaceGoogle)}`;

function formatearFecha() {
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fecha-actualizacion').textContent = 'Actualizado a: ' + new Date().toLocaleDateString('es-ES', opciones);
}

const opcionesGraficoBase = {
    chart: { 
        height: 250, 
        toolbar: { show: false },
        animations: { enabled: false } 
    },
    dataLabels: { enabled: false },
    tooltip: { enabled: false }, 
    stroke: { width: 2 }
};

// Función auxiliar para arreglar números con coma (Ej: "2,50" -> 2.50)
function limpiarNumero(valor) {
    if (valor === null || valor === undefined) return 0;
    if (typeof valor === 'string') {
        // Quita espacios en blanco y cambia comas por puntos
        valor = valor.trim().replace(',', '.');
        return parseFloat(valor);
    }
    return valor;
}

function cargarDatosDesdeSheets() {
    Papa.parse(urlCSV, {
        download: true,
        header: true,
        dynamicTyping: false, // Lo apagamos para controlar la conversión de números nosotros mismos
        complete: function(resultados) {
            console.log("Datos crudos leídos de Sheets:", resultados.data); // Para que revises en consola (F12)

            if (resultados.data.length === 0) {
                console.error("El CSV está vacío o la URL es incorrecta.");
                return;
            }

            // Detectar los encabezados reales (por si escribiste "Año", "Anio", "AÑO", etc.)
            const encabezados = Object.keys(resultados.data[0]);
            console.log("Encabezados detectados:", encabezados);

            // Buscamos cuál es la columna del año
            const colAnio = encabezados.find(e => e.toLowerCase().includes('a')) || encabezados[0]; 
            const colPIB = encabezados.find(e => e.toUpperCase() === 'PIB');
            const colRIN = encabezados.find(e => e.toUpperCase() === 'RIN');
            const colIPC = encabezados.find(e => e.toUpperCase() === 'IPC');
            const colBalanza = encabezados.find(e => e.toUpperCase().includes('BALANZA'));

            if (!colPIB || !colRIN) {
                alert("Atención: No se encontraron las columnas PIB, RIN, IPC o Balanza. Revisa los nombres en tu Excel.");
                return;
            }

            // Filtrar filas vacías
            const datosLimpios = resultados.data.filter(fila => fila[colAnio] != null && fila[colAnio] !== "");

            // Extraer y limpiar los arrays
            const categorias = datosLimpios.map(fila => fila[colAnio]);
            const pib = datosLimpios.map(fila => limpiarNumero(fila[colPIB]));
            const rin = datosLimpios.map(fila => limpiarNumero(fila[colRIN]));
            const ipc = datosLimpios.map(fila => limpiarNumero(fila[colIPC]));
            const balanza = datosLimpios.map(fila => limpiarNumero(fila[colBalanza]));

            // 1. Actualizar KPIs (último registro válido)
            const ultimoIndice = datosLimpios.length - 1;
            document.getElementById('kpi-pib').textContent = pib[ultimoIndice] + '%';
            document.getElementById('kpi-ipc').textContent = ipc[ultimoIndice] + '%';
            document.getElementById('kpi-rin').textContent = rin[ultimoIndice];

            // 2. Gráficos
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
        },
        error: function(error) {
            console.error("Error al descargar los datos de Google Sheets:", error);
            alert("No se pudieron cargar los datos. Revisa la consola para más detalles.");
        }
    });
}

// Ejecutar todo cuando el HTML haya terminado de cargar completamente
document.addEventListener("DOMContentLoaded", function() {
    formatearFecha();
    cargarDatosDesdeSheets();
});