// Evento para actualizar los colores cuando el usuario elige un color desde el input tipo color
document.getElementById('colorPicker').addEventListener('input', function () {
    let currentAmount = parseInt(document.getElementById('colorAmount').value);
    let currentStep = parseInt(document.getElementById('luminosityStep').value);
    updateColors(this.value, currentAmount, currentStep);
});

// Evento para aplicar el color introducido en el input hexadecimal al hacer clic en "Aplicar"
document.getElementById('applyHex').addEventListener('click', function () {
    applyHexColor();
});

// Evento para permitir que al presionar "Enter" en el input hexadecimal, se genere la paleta de colores
document.getElementById('hexInput').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        applyHexColor();
    }
});

// Evento para actualizar la cantidad de colores generados en la paleta
document.getElementById('colorAmount').addEventListener('input', function () {
    let colorAmount = parseInt(this.value);
    document.getElementById('colorAmountText').innerText = colorAmount;
    let currentColor = document.getElementById('colorPicker').value;
    let currentStep = parseInt(document.getElementById('luminosityStep').value);
    updateColors(currentColor, colorAmount, currentStep);
});

// Evento para actualizar el paso de luminosidad
document.getElementById('luminosityStep').addEventListener('input', function () {
    let step = parseInt(this.value);
    document.getElementById('luminosityStepText').innerText = step;
    let currentColor = document.getElementById('colorPicker').value;
    let currentAmount = parseInt(document.getElementById('colorAmount').value);
    updateColors(currentColor, currentAmount, step);
});

// Función para aplicar el color ingresado en el input hexadecimal
function applyHexColor() {
    let hexValue = document.getElementById('hexInput').value;
    let currentAmount = parseInt(document.getElementById('colorAmount').value);
    let currentStep = parseInt(document.getElementById('luminosityStep').value);
    updateColors(hexValue, currentAmount, currentStep);
    document.getElementById('colorPicker').value = hexValue;
}

// Función para actualizar los colores generados
function updateColors(hexColor, amount, step) {
    amount = parseInt(amount);
    step = parseInt(step);
    let hslColor = hexToHSL(hexColor);
    displaySelectedColor(hexColor, hslColor);
    displayColors(hslColor, hexColor, amount, step);
    document.getElementById('colorAmount').value = amount;
    document.getElementById('hexInput').value = hexColor;
}

// Convierte un color HEX a HSL
function hexToHSL(H) {
    let r = 0, g = 0, b = 0;
    if (H.length == 4) {
        r = "0x" + H[1] + H[1];
        g = "0x" + H[2] + H[2];
        b = "0x" + H[3] + H[3];
    } else if (H.length == 7) {
        r = "0x" + H[1] + H[2];
        g = "0x" + H[3] + H[4];
        b = "0x" + H[5] + H[6];
    }
    r /= 255;
    g /= 255;
    b /= 255;
    let cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin,
        h = 0,
        s = 0,
        l = (cmax + cmin) / 2;

    if (delta == 0) h = 0;
    else if (cmax == r) h = ((g - b) / delta) % 6;
    else if (cmax == g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return `hsl(${h}, ${s}%, ${l}%)`;
}

// Convierte un color HSL a HEX
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// Ajusta la luminosidad del color HSL
function adjustLuminosity(hsl, amount) {
    let parts = hsl.slice(4, -1).split(',');
    let h = parseFloat(parts[0]);
    let s = parseFloat(parts[1]);
    let l = parseFloat(parts[2]);
    l = Math.min(Math.max(l + amount, 0), 100);
    return { newHSL: `hsl(${h}, ${s}%, ${l}%)`, newHex: hslToHex(h, s, l) };
}

// Determina si el texto debe ser negro o blanco según el fondo
function textColorBasedOnBackground(l) {
    return l > 50 ? 'black' : 'white';
}

// Muestra el color seleccionado
function displaySelectedColor(hex, hsl) {
    let l = parseFloat(hsl.split(',')[2]);
    let textColor = textColorBasedOnBackground(l);
    document.getElementById('selectedColor').innerHTML = getColorBoxHTML(hex, hsl, textColor);
}

// Genera y muestra la paleta de colores claros y oscuros
function displayColors(baseHSL, baseHex, amount, step) {
    let lighterColors = '';
    let darkerColors = '';

    for (let i = 1; i <= amount; i++) {
        let luminosityAdjustment = i * step;
        let { newHSL: lighterHSL, newHex: lighterHex } = adjustLuminosity(baseHSL, luminosityAdjustment);
        let lLighter = parseFloat(lighterHSL.split(',')[2]);
        lighterColors += getColorBoxHTML(lighterHex, lighterHSL, textColorBasedOnBackground(lLighter));
    }

    for (let i = 1; i <= amount; i++) {
        let luminosityAdjustment = -i * step;
        let { newHSL: darkerHSL, newHex: darkerHex } = adjustLuminosity(baseHSL, luminosityAdjustment);
        let lDarker = parseFloat(darkerHSL.split(',')[2]);
        darkerColors += getColorBoxHTML(darkerHex, darkerHSL, textColorBasedOnBackground(lDarker));
    }

    document.getElementById('lighterColors').innerHTML = lighterColors;
    document.getElementById('darkerColors').innerHTML = darkerColors;
}

// Función para copiar el código hexadecimal al portapapeles
function copyToClipboard(text) {
    const tempInput = document.createElement("input");
    document.body.appendChild(tempInput);
    tempInput.value = text;
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    alert("Hex color copied successfully! 🎨");
    
}

// Genera el HTML para mostrar un color en la paleta
function getColorBoxHTML(hex, hsl, textColor) {
    return `<div class="color-box" style="background-color: ${hex}; color: ${textColor};">
                <button class="copy-btn" onclick="copyToClipboard('${hex}')">📋</button>
                <div>HSL: ${hsl}</div>
                <div>HEX: ${hex}</div>
            </div>`;
}

// Muestra la sección de colores generados
function show() {
    document.getElementById("colors").classList.remove("hidden");
    document.getElementById("amount-selector").classList.remove("hidden");
    document.getElementById("step-selector").classList.remove("hidden");
}

// Añade automáticamente el carácter '#' al input si el usuario olvida ponerlo
function addDefaultCharacter() {
    var input = document.getElementById("hexInput");
    if (!input.value.startsWith("#")) {
        input.value = "#" + input.value;
    }
}

// Nueva función para generar un color aleatorio
function generateRandomColor() {
    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    return randomColor;
}

// Nueva función para actualizar la paleta con un color aleatorio
function updateWithRandomColor() {
    const randomColor = generateRandomColor();
    const currentAmount = parseInt(document.getElementById('colorAmount').value);
    const currentStep = parseInt(document.getElementById('luminosityStep').value);
    updateColors(randomColor, currentAmount, currentStep);
    document.getElementById('colorPicker').value = randomColor;
    document.getElementById('hexInput').value = randomColor;
    show(); // Mostramos la paleta de colores
}

// Evento para el botón de color aleatorio
document.getElementById('randomColorBtn').addEventListener('click', function () {
    updateWithRandomColor();
});

// Evento para generar un nuevo color aleatorio al presionar la barra espaciadora mientras el botón está enfocado
document.getElementById('randomColorBtn').addEventListener('keydown', function (event) {
    if (event.key === ' ') {
        event.preventDefault();
        updateWithRandomColor();
    }
});
