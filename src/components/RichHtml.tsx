import React, { useEffect, useRef } from 'react';
import { useCourseStore } from '../state/useCourseStore';

interface RichHtmlProps {
  html: string;
  className?: string;
}

export const RichHtml: React.FC<RichHtmlProps> = ({ html, className = '' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, toggleCheckbox, navigate } = useCourseStore();

  // Sync persisted checkbox states onto rendered DOM checkboxes
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const boxes = root.querySelectorAll<HTMLInputElement>('input.course-checkbox[data-check-id]');
    boxes.forEach((box) => {
      const id = box.getAttribute('data-check-id');
      if (!id) return;
      if (id in state.checkedBoxes) {
        box.checked = Boolean(state.checkedBoxes[id]);
      } else {
        box.checked = box.getAttribute('data-default-checked') === 'true';
      }
    });
  }, [html, state.checkedBoxes]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Handle checkbox toggles
    if (target instanceof HTMLInputElement && target.classList.contains('course-checkbox')) {
      const checkId = target.getAttribute('data-check-id');
      if (checkId) {
        toggleCheckbox(checkId, target.checked);
      }
      return;
    }

    // Handle internal hash links
    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href') || '';
      if (href.startsWith('#/')) {
        e.preventDefault();
        navigate(href);
      } else if (href.startsWith('http://') || href.startsWith('https://')) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
    }
  };

  if (!html) return null;

  return (
    <div
      ref={containerRef}
      className={`rich-prose ${className}`.trim()}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
