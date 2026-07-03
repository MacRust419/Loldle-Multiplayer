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

    const buffer = await getImage(url);

    imageCache.set(url, buffer);

    return buffer;
}

function randomSkinCrop(size, forbidden) {

    while (true) {

        const x = Math.floor(Math.random() * (SKIN_W - size));
        const y = Math.floor(Math.random() * (SKIN_H - size));

        if (!forbidden) return { x, y };

        const cropCenterX = x + size / 2;
        const cropCenterY = y + size / 2;

        const forbiddenLeft = forbidden.x;
        const forbiddenRight = forbidden.x + forbidden.w;
        const forbiddenTop = forbidden.y;
        const forbiddenBottom = forbidden.y + forbidden.h;

        const insideForbidden =
            cropCenterX >= forbiddenLeft &&
            cropCenterX <= forbiddenRight &&
            cropCenterY >= forbiddenTop &&
            cropCenterY <= forbiddenBottom;

        if (!insideForbidden) return { x, y };
    }
}

async function createAbilityImage(
    url,
    hintLevel,
    rotation
) {

    const response = await fetch(url);

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    let image = sharp(buffer);

    if (hintLevel <= 1) {
        image = image.grayscale();
    }

    if (hintLevel === 0) {
        image = image.rotate(rotation);
    }

    return await image
        .png()
        .toBuffer();
}

function getSkinHintConfig(hintLevel) {

    const baseForbidden = {
        x: 425,
        y: 250,
        w: 850,
        h: 500
    };

    const size = BASE_SIZE + (SIZE_STEP * hintLevel);

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

    const response = await fetch(url);

    const buffer = Buffer.from(
        await response.arrayBuffer()
    );

    let image = sharp(buffer);

    const crop = randomSkinCrop(size, forbidden);

    return await image
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