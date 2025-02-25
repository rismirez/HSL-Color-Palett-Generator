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
                <button class="copy-btn" onclick="copyToClipboard('${hex}')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path></svg>
                </button>
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
    show();
}

// Nueva función para descargar la paleta como SVG con fuente monospace
function downloadPaletteAsSVG() {
    const selectedColorDiv = document.getElementById('selectedColor').querySelector('.color-box');
    const lighterColorsDiv = document.getElementById('lighterColors').querySelectorAll('.color-box');
    const darkerColorsDiv = document.getElementById('darkerColors').querySelectorAll('.color-box');

    const selectedColor = {
        hex: selectedColorDiv.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: selectedColorDiv.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    };
    const lighterColors = Array.from(lighterColorsDiv).map(div => ({
        hex: div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: div.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    }));
    const darkerColors = Array.from(darkerColorsDiv).map(div => ({
        hex: div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: div.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    }));

    const rectHeight = 100;
    const rectWidth = 200;
    const textOffset = 20;
    const totalColors = 1 + lighterColors.length + darkerColors.length;
    const svgHeight = totalColors * (rectHeight + textOffset * 2) + 20;
    const svgWidth = rectWidth + 20;

    let svgContent = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<rect x="10" y="10" width="${rectWidth}" height="${rectHeight}" fill="${selectedColor.hex}" />`;
    svgContent += `<text x="10" y="${rectHeight + textOffset}" fill="black" font-family="monospace">HEX: ${selectedColor.hex}</text>`;
    svgContent += `<text x="10" y="${rectHeight + textOffset * 2}" fill="black" font-family="monospace">HSL: ${selectedColor.hsl}</text>`;

    lighterColors.forEach((color, index) => {
        const yOffset = (index + 1) * (rectHeight + textOffset * 2) + 10;
        svgContent += `<rect x="10" y="${yOffset}" width="${rectWidth}" height="${rectHeight}" fill="${color.hex}" />`;
        svgContent += `<text x="10" y="${yOffset + rectHeight + textOffset}" fill="black" font-family="monospace">HEX: ${color.hex}</text>`;
        svgContent += `<text x="10" y="${yOffset + rectHeight + textOffset * 2}" fill="black" font-family="monospace">HSL: ${color.hsl}</text>`;
    });

    darkerColors.forEach((color, index) => {
        const yOffset = (index + lighterColors.length + 1) * (rectHeight + textOffset * 2) + 10;
        svgContent += `<rect x="10" y="${yOffset}" width="${rectWidth}" height="${rectHeight}" fill="${color.hex}" />`;
        svgContent += `<text x="10" y="${yOffset + rectHeight + textOffset}" fill="black" font-family="monospace">HEX: ${color.hex}</text>`;
        svgContent += `<text x="10" y="${yOffset + rectHeight + textOffset * 2}" fill="black" font-family="monospace">HSL: ${color.hsl}</text>`;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'color-palette.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Nueva función para descargar la paleta como TXT
function downloadPaletteAsTXT() {
    const selectedColorDiv = document.getElementById('selectedColor').querySelector('.color-box');
    const lighterColorsDiv = document.getElementById('lighterColors').querySelectorAll('.color-box');
    const darkerColorsDiv = document.getElementById('darkerColors').querySelectorAll('.color-box');

    const selectedColor = {
        hex: selectedColorDiv.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: selectedColorDiv.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    };
    const lighterColors = Array.from(lighterColorsDiv).map(div => ({
        hex: div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: div.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    }));
    const darkerColors = Array.from(darkerColorsDiv).map(div => ({
        hex: div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: div.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    }));

    let txtContent = "Color Palette\n\n";
    txtContent += "Selected Color:\n";
    txtContent += `HEX: ${selectedColor.hex}\n`;
    txtContent += `HSL: ${selectedColor.hsl}\n\n`;

    txtContent += "Lighter Colors:\n";
    lighterColors.forEach((color, index) => {
        txtContent += `Tone ${index + 1}:\n`;
        txtContent += `HEX: ${color.hex}\n`;
        txtContent += `HSL: ${color.hsl}\n`;
    });

    txtContent += "\nDarker Colors:\n";
    darkerColors.forEach((color, index) => {
        txtContent += `Tone ${index + 1}:\n`;
        txtContent += `HEX: ${color.hex}\n`;
        txtContent += `HSL: ${color.hsl}\n`;
    });

    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'color-palette.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Nueva función para descargar la paleta como JSON
function downloadPaletteAsJSON() {
    const selectedColorDiv = document.getElementById('selectedColor').querySelector('.color-box');
    const lighterColorsDiv = document.getElementById('lighterColors').querySelectorAll('.color-box');
    const darkerColorsDiv = document.getElementById('darkerColors').querySelectorAll('.color-box');

    const selectedColor = {
        hex: selectedColorDiv.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: selectedColorDiv.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    };
    const lighterColors = Array.from(lighterColorsDiv).map(div => ({
        hex: div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: div.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    }));
    const darkerColors = Array.from(darkerColorsDiv).map(div => ({
        hex: div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''),
        hsl: div.querySelector('div:nth-child(2)').textContent.replace('HSL: ', '')
    }));

    const paletteData = {
        selectedColor: selectedColor,
        lighterColors: lighterColors,
        darkerColors: darkerColors
    };

    const jsonContent = JSON.stringify(paletteData, null, 2); // Formato legible con indentación
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'color-palette.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Nueva función para descargar la paleta como CSS
function downloadPaletteAsCSS() {
    const selectedColorDiv = document.getElementById('selectedColor').querySelector('.color-box');
    const lighterColorsDiv = document.getElementById('lighterColors').querySelectorAll('.color-box');
    const darkerColorsDiv = document.getElementById('darkerColors').querySelectorAll('.color-box');

    const selectedColorHex = selectedColorDiv.querySelector('div:nth-child(3)').textContent.replace('HEX: ', '');
    const lighterColorsHex = Array.from(lighterColorsDiv).map(div => div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''));
    const darkerColorsHex = Array.from(darkerColorsDiv).map(div => div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''));

    let cssContent = `:root {\n`;
    cssContent += `  --selected-color: ${selectedColorHex};\n`;
    lighterColorsHex.forEach((hex, index) => {
        cssContent += `  --lighter-color-${index + 1}: ${hex};\n`;
    });
    darkerColorsHex.forEach((hex, index) => {
        cssContent += `  --darker-color-${index + 1}: ${hex};\n`;
    });
    cssContent += `}\n\n`;

    cssContent += `/* Ejemplos de uso */\n`;
    cssContent += `.bg-selected { background-color: var(--selected-color); }\n`;
    lighterColorsHex.forEach((_, index) => {
        cssContent += `.bg-lighter-${index + 1} { background-color: var(--lighter-color-${index + 1}); }\n`;
    });
    darkerColorsHex.forEach((_, index) => {
        cssContent += `.bg-darker-${index + 1} { background-color: var(--darker-color-${index + 1}); }\n`;
    });

    const blob = new Blob([cssContent], { type: 'text/css' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'color-palette.css';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Nueva función para descargar la paleta como SCSS
function downloadPaletteAsSCSS() {
    const selectedColorDiv = document.getElementById('selectedColor').querySelector('.color-box');
    const lighterColorsDiv = document.getElementById('lighterColors').querySelectorAll('.color-box');
    const darkerColorsDiv = document.getElementById('darkerColors').querySelectorAll('.color-box');

    const selectedColorHex = selectedColorDiv.querySelector('div:nth-child(3)').textContent.replace('HEX: ', '');
    const lighterColorsHex = Array.from(lighterColorsDiv).map(div => div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''));
    const darkerColorsHex = Array.from(darkerColorsDiv).map(div => div.querySelector('div:nth-child(3)').textContent.replace('HEX: ', ''));

    let scssContent = `$selected-color: ${selectedColorHex};\n`;
    lighterColorsHex.forEach((hex, index) => {
        scssContent += `$lighter-color-${index + 1}: ${hex};\n`;
    });
    darkerColorsHex.forEach((hex, index) => {
        scssContent += `$darker-color-${index + 1}: ${hex};\n`;
    });
    scssContent += `\n`;

    scssContent += `// Ejemplos de uso\n`;
    scssContent += `.bg-selected { background-color: $selected-color; }\n`;
    lighterColorsHex.forEach((_, index) => {
        scssContent += `.bg-lighter-${index + 1} { background-color: $lighter-color-${index + 1}; }\n`;
    });
    darkerColorsHex.forEach((_, index) => {
        scssContent += `.bg-darker-${index + 1} { background-color: $darker-color-${index + 1}; }\n`;
    });

    const blob = new Blob([scssContent], { type: 'text/scss' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'color-palette.scss';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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

// Eventos para los botones de descarga
document.getElementById('downloadSvgBtn').addEventListener('click', function () {
    downloadPaletteAsSVG();
});

document.getElementById('downloadTxtBtn').addEventListener('click', function () {
    downloadPaletteAsTXT();
});

document.getElementById('downloadJsonBtn').addEventListener('click', function () {
    downloadPaletteAsJSON();
});

// Eventos para los botones de descarga
document.getElementById('downloadCssBtn').addEventListener('click', function () {
    downloadPaletteAsCSS();
});

document.getElementById('downloadScssBtn').addEventListener('click', function () {
    downloadPaletteAsSCSS();
});