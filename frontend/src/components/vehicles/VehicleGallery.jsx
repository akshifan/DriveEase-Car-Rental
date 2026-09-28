import { useState, useEffect } from 'react';
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
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const usable = images.filter((image, index) => !failed[index]);
  const active = images[activeIndex];

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') setActiveIndex((index) => (index + 1) % images.length);
    if (event.key === 'ArrowLeft')
      setActiveIndex((index) => (index - 1 + images.length) % images.length);
  };

  useEffect(() => {
    if (lightboxIndex === null) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null);
        return;
      }

      if (event.key === 'ArrowLeft') {
        setLightboxIndex(
          (index) =>
            (index - 1 + images.length) % images.length
        );
      }

      if (event.key === 'ArrowRight') {
        setLightboxIndex(
          (index) =>
            (index + 1) % images.length
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxIndex, images.length]);

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
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-zoom-in"
            onClick={() => setLightboxIndex(activeIndex)}
            aria-label={`Open ${name} image ${activeIndex + 1} in full view`}
          >
            <img
              src={mediaUrl(active.url)}
              alt={active.altText || `${name} - view ${activeIndex + 1}`}
              className="h-full w-full object-cover"
              loading={activeIndex === 0 ? 'eager' : 'lazy'}
              decoding="async"
              width="1200"
              height="750"
              onError={() =>
                setFailed((current) => ({
                  ...current,
                  [activeIndex]: true,
                }))
              }
            />
          </button>
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
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} image viewer`}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close full view"
          >
            <Icon name="x" size={20} />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex(
                    (index) =>
                      (index - 1 + images.length) % images.length
                  );
                }}
                aria-label="Previous image"
              >
                <Icon name="chevronLeft" size={20} />
              </button>

              <button
                type="button"
                className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex(
                    (index) =>
                      (index + 1) % images.length
                  );
                }}
                aria-label="Next image"
              >
                <Icon name="chevronRight" size={20} />
              </button>
            </>
          )}

          <img
            src={mediaUrl(images[lightboxIndex].url)}
            alt={
              images[lightboxIndex].altText ||
              `${name} - view ${lightboxIndex + 1}`
            }
            className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white backdrop-blur-md">
            {lightboxIndex + 1} / {images.length}
          </p>
        </div>
      )}
    </div>
  );
}
