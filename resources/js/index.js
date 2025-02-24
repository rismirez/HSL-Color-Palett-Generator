// Evento para actualizar los colores cuando el usuario elige un color desde el input tipo color
document.getElementById('colorPicker').addEventListener('input', function () {
    let currentAmount = document.getElementById('colorAmount').value;
    updateColors(this.value, currentAmount);
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
    let colorAmount = this.value;
    document.getElementById('colorAmountText').innerText = colorAmount; // Actualiza el texto junto al slider
    let currentColor = document.getElementById('colorPicker').value;
    updateColors(currentColor, colorAmount);
});

// Función para aplicar el color ingresado en el input hexadecimal
function applyHexColor() {
    let hexValue = document.getElementById('hexInput').value;
    let currentAmount = document.getElementById('colorAmount').value;
    updateColors(hexValue, currentAmount);
    document.getElementById('colorPicker').value = hexValue; // Sincroniza el color picker con el input
}

// Función para actualizar los colores generados
function updateColors(hexColor, amount) {
    let hslColor = hexToHSL(hexColor);
    displaySelectedColor(hexColor, hslColor);
    displayColors(hslColor, hexColor, amount);
    document.getElementById('colorAmount').value = amount; // Mantiene la sincronización del slider
    document.getElementById('hexInput').value = hexColor; // Sincroniza el input hexadecimal
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
function displayColors(baseHSL, baseHex, amount) {
    let lighterColors = '';
    let darkerColors = '';

    for (let i = 10; i <= 10 * amount; i += 10) {
        let { newHSL: lighterHSL, newHex: lighterHex } = adjustLuminosity(baseHSL, i);
        let lLighter = parseFloat(lighterHSL.split(',')[2]);
        lighterColors += getColorBoxHTML(lighterHex, lighterHSL, textColorBasedOnBackground(lLighter));
    }

    for (let i = 10; i <= 10 * amount; i += 10) {
        let { newHSL: darkerHSL, newHex: darkerHex } = adjustLuminosity(baseHSL, -i);
        let lDarker = parseFloat(darkerHSL.split(',')[2]);
        darkerColors += getColorBoxHTML(darkerHex, darkerHSL, textColorBasedOnBackground(lDarker));
    }

    document.getElementById('lighterColors').innerHTML = lighterColors;
    document.getElementById('darkerColors').innerHTML = darkerColors;
}

// Genera el HTML para mostrar un color en la paleta
function getColorBoxHTML(hex, hsl, textColor) {
    return `<div class="color-box" style="background-color: ${hex}; color: ${textColor};">
                <div>HSL: ${hsl}</div>
                <div>HEX: ${hex}</div>
            </div>`;
}

// Muestra la sección de colores generados
function show() {
    document.getElementById("colors").classList.remove("hidden");
    document.getElementById("amount-selector").classList.remove("hidden");
}

// Añade automáticamente el carácter '#' al input si el usuario olvida ponerlo
function addDefaultCharacter() {
    var input = document.getElementById("hexInput");
    if (!input.value.startsWith("#")) {
        input.value = "#" + input.value;
    }
}
