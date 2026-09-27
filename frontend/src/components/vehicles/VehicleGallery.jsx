import { useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { mediaUrl } from '../../utils/media.js';

/**
 * Vehicle gallery.
 *
 * Keyboard-navigable thumbnails with a graceful branded placeholder when an
 * image is missing or fails to load - no broken-image icons, no layout shift.
 */
export default function VehicleGallery({ images = [], name }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState({});

  const usable = images.filter((image, index) => !failed[index]);
  const active = images[activeIndex];

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') setActiveIndex((index) => (index + 1) % images.length);
    if (event.key === 'ArrowLeft')
      setActiveIndex((index) => (index - 1 + images.length) % images.length);
  };

  return (
    <div>
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-850"
        tabIndex={0}
        role="group"
        aria-label={`${name} gallery, image ${activeIndex + 1} of ${images.length || 1}`}
        onKeyDown={onKeyDown}
      >
        {active && !failed[activeIndex] ? (
          <img
            src={mediaUrl(active.url)}
            alt={active.altText || `${name} - view ${activeIndex + 1}`}
            className="h-full w-full object-cover"
            loading={activeIndex === 0 ? 'eager' : 'lazy'}
            decoding="async"
            width="1200"
            height="750"
            onError={() => setFailed((current) => ({ ...current, [activeIndex]: true }))}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-mist-600">
            <Icon name="car" size={44} />
            <p className="text-[12.5px]">Photography coming soon</p>
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              className="icon-btn absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 bg-ink-950/70"
              onClick={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)}
              aria-label="Previous image"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <button
              type="button"
              className="icon-btn absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 bg-ink-950/70"
              onClick={() => setActiveIndex((index) => (index + 1) % images.length)}
              aria-label="Next image"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </>
        )}
      </div>

      {usable.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((image, index) => (
            <button
              key={image.url || index}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === activeIndex}
              className={`relative aspect-[4/3] overflow-hidden rounded-xl border transition ${
                index === activeIndex
                  ? 'border-lime/60'
                  : 'border-white/[0.07] hover:border-white/20'
              }`}
            >
              {failed[index] ? (
                <span className="flex h-full w-full items-center justify-center bg-ink-850 text-mist-600">
                  <Icon name="car" size={16} />
                </span>
              ) : (
                <img
                  src={mediaUrl(image.url)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width="200"
                  height="150"
                  className="h-full w-full object-cover"
                  onError={() => setFailed((current) => ({ ...current, [index]: true }))}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
