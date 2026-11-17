const sharp = require("sharp");

const imageCache = new Map();
const SKIN_W = 1215;
const SKIN_H = 717;
const BASE_SIZE = 200;
const SIZE_STEP = 15;
const X_SHRINK = 17;
const Y_SHRINK = 10;

async function getImage(url) {
    if (imageCache.has(url)) {
        return imageCache.get(url);
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Image request failed (${response.status}): ${url}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    imageCache.set(url, buffer);

    return buffer;
}

function randomSkinCrop(size, forbidden) {
    while (true) {
        const x = Math.floor(Math.random() * (SKIN_W - size));
        const y = Math.floor(Math.random() * (SKIN_H - size));

        if (!forbidden) return { x, y };

        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const insideForbidden =
            centerX >= forbidden.x &&
            centerX <= forbidden.x + forbidden.w &&
            centerY >= forbidden.y &&
            centerY <= forbidden.y + forbidden.h;

        if (!insideForbidden) return { x, y };
    }
}

async function createAbilityImage(url, hintLevel, rotation) {
    let image = sharp(await getImage(url));

    if (hintLevel <= 1) {
        image = image.grayscale();
    }

    if (hintLevel === 0) {
        image = image.rotate(rotation);
    }

    return image.png().toBuffer();
}

function getSkinHintConfig(hintLevel) {
    const baseForbidden = {
        x: 425,
        y: 250,
        w: 850,
        h: 500
    };

    const size = BASE_SIZE + SIZE_STEP * hintLevel;
    const xShrink = X_SHRINK * hintLevel;
    const yShrink = Y_SHRINK * hintLevel;

    return {
        size,
        forbidden: {
            x: baseForbidden.x + xShrink,
            y: baseForbidden.y + yShrink,
            w: Math.max(0, baseForbidden.w - xShrink * 2),
            h: Math.max(0, baseForbidden.h - yShrink * 2)
        }
    };
}

async function createSkinImage(url, size, forbidden) {
    const crop = randomSkinCrop(size, forbidden);

    return sharp(await getImage(url))
        .extract({
            left: crop.x,
            top: crop.y,
            width: size,
            height: size
        })
        .png()
        .toBuffer();
}

module.exports = {
    createAbilityImage,
    getSkinHintConfig,
    createSkinImage
};
