// CSD chevron mark, traced from the official department logo.
// The mark is wide (about 1.735:1); `size` is the rendered height.
export default function Logo({ size = 40, className = "" }) {
  return (
    <svg
      className={`lp-logo-mark ${className}`.trim()}
      height={size}
      width={size * 1.735}
      viewBox="0 0 1409 812"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M356 0 L549 0 L196 407 L449 695 L659 471 L528 470 L528 341 L857 0 L1053 0 L1408 406 L1053 810 L861 810 L1212 407 L959 115 L749 340 L879 342 L879 470 L551 810 L355 810 L0 405 Z" />
    </svg>
  );
}
