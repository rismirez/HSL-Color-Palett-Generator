document.getElementById('colorPicker').addEventListener('input', function () {
    updateColors(this.value);
});

document.getElementById('applyHex').addEventListener('click', function () {
    let hexValue = document.getElementById('hexInput').value;
    updateColors(hexValue);
});

function updateColors(hexColor) {
    let hslColor = hexToHSL(hexColor);
    displaySelectedColor(hexColor, hslColor);
    displayColors(hslColor, hexColor);
}

function hexToHSL(H) {
    // Convert hex to RGB first
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
    // Then to HSL
    r /= 255;
    g /= 255;
    b /= 255;
    let cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin,
        h = 0,
        s = 0,
        l = 0;

    if (delta == 0)
        h = 0;
    else if (cmax == r)
        h = ((g - b) / delta) % 6;
    else if (cmax == g)
        h = (b - r) / delta + 2;
    else
        h = (r - g) / delta + 4;

    h = Math.round(h * 60);

    if (h < 0)
        h += 360;

    l = (cmax + cmin) / 2;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return "hsl(" + h + "," + s + "%," + l + "%)";
}

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

function adjustLuminosity(hsl, amount) {
    let parts = hsl.slice(4, -1).split(',');
    let h = parseFloat(parts[0]);
    let s = parseFloat(parts[1]);
    let l = parseFloat(parts[2]);
    l = Math.min(Math.max(l + amount, 0), 100);
    let newHSL = `hsl(${h}, ${s}%, ${l}%)`;
    let newHex = hslToHex(h, s, l);
    return { newHSL, newHex };
}

function textColorBasedOnBackground(l) {
    return l > 50 ? 'black' : 'white'; // Si la luminosidad es mayor que 50, texto en negro, sino en blanco
}

function displaySelectedColor(hex, hsl) {
    let l = parseFloat(hsl.split(',')[2]);
    let textColor = textColorBasedOnBackground(l);
    document.getElementById('selectedColor').innerHTML = getColorBoxHTML(hex, hsl, textColor);
}

function displayColors(baseHSL, baseHex) {
    let lighterColors = '';
    let darkerColors = '';

    for (let i = 10; i <= 30; i += 10) {
        let { newHSL: lighterHSL, newHex: lighterHex } = adjustLuminosity(baseHSL, i);
        let lLighter = parseFloat(lighterHSL.split(',')[2]);
        lighterColors += getColorBoxHTML(lighterHex, lighterHSL, textColorBasedOnBackground(lLighter));

        let { newHSL: darkerHSL, newHex: darkerHex } = adjustLuminosity(baseHSL, -i);
        let lDarker = parseFloat(darkerHSL.split(',')[2]);
        darkerColors += getColorBoxHTML(darkerHex, darkerHSL, textColorBasedOnBackground(lDarker));
    }

    document.getElementById('lighterColors').innerHTML = lighterColors;
    document.getElementById('darkerColors').innerHTML = darkerColors;
}

function getColorBoxHTML(hex, hsl, textColor) {
    return `<div class="color-box" style="background-color: ${hex}; color: ${textColor};">
                <div class="color-box__text">HSL: ${hsl}</div>
                <div class="color-box__text">HEX: ${hex}</div>
                <div class="copy-button" onclick="copyToClipboard('${hex}')">
                    <svg xmlns="http://www.w3.org/2000/svg" height="16" fill="#FFFFFF" width="14" viewBox="0 0 448 512"><!--!Font Awesome Free 6.5.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.--><path d="M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L400 115.9V320c0 8.8-7.2 16-16 16zM192 384H384c35.3 0 64-28.7 64-64V115.9c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1H192c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H256c35.3 0 64-28.7 64-64V416H272v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16H96V128H64z"/></svg>
                </div>
            </div>`;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Color copiado al portapapeles: " + text);
    }).catch(err => {
        console.error('Error al copiar al portapapeles: ', err);
    });
}

// Enseña el container de los colores generados
function show() {
    var element = document.getElementById("colors");
    element.classList.remove("hidden")
}

// Añade el caracter # al input cuando lo pulsamos
function addDefaultCharacter() {
    var input = document.getElementById("hexInput");
    if (!input.value.startsWith("#")) {
        input.value = "#" + input.value;
    }
}