import { initializeCustomSelects } from '../src/js/features/selects/custom-select.js';
import { esc } from '../src/js/utils/dom.js';
import { IC, ICON_SIZES, iconSvg } from '../src/js/utils/icons.js';

initializeCustomSelects(document);

const iconGallery = document.querySelector('[data-icon-gallery]');
if (iconGallery) {
  iconGallery.innerHTML = Object.keys(IC)
    .map((name) => `<div class="ds-icon-item">${iconSvg(name, ICON_SIZES.standard)}<code>${esc(name)}</code></div>`)
    .join('');
}

const iconSizes = document.querySelector('[data-icon-sizes]');
if (iconSizes) {
  iconSizes.innerHTML = Object.entries(ICON_SIZES)
    .map(([name, size]) => `<span class="ds-icon-size">${iconSvg('sparkles', size)}<code>${esc(name)} · ${size}px</code></span>`)
    .join('');
}

document.querySelectorAll('[data-icon-name]').forEach((element) => {
  const size = Number(element.dataset.iconSize || ICON_SIZES.standard);
  element.innerHTML = iconSvg(element.dataset.iconName, size);
});
