import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function baseProps(props: IconProps): SVGProps<SVGSVGElement> {
  return {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props
  };
}

export function IconFolder(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M2 4.6A1.6 1.6 0 0 1 3.6 3h2.5l1.7 1.9h4.6A1.6 1.6 0 0 1 14 6.5v4.9a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 11.4z" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 5.1V8l2.1 1.4" />
    </svg>
  );
}

export function IconSave(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M8 2.2v6.1" />
      <path d="M5.4 5.7 8 8.3l2.6-2.6" />
      <path d="M2.6 9.2v3.2A1.6 1.6 0 0 0 4.2 14h7.6a1.6 1.6 0 0 0 1.6-1.6V9.2" />
    </svg>
  );
}

export function IconSaveAs(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M7.1 2.6v5.4" />
      <path d="M4.7 5.5 7.1 7.9l2.4-2.4" />
      <path d="M2.6 9.2v3.2A1.6 1.6 0 0 0 4.2 14h7.6a1.6 1.6 0 0 0 1.6-1.6V9.2" />
      <path d="M12.1 2.4v3.2" />
      <path d="M10.5 4h3.2" />
    </svg>
  );
}

export function IconShare(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M8 9.8V2.4" />
      <path d="M5.4 4.9 8 2.3l2.6 2.6" />
      <path d="M5.3 6.3H4.2A1.6 1.6 0 0 0 2.6 7.9v4.5a1.6 1.6 0 0 0 1.6 1.6h7.6a1.6 1.6 0 0 0 1.6-1.6V7.9a1.6 1.6 0 0 0-1.6-1.6h-1.1" />
    </svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M2.4 4.6h11.2" />
      <path d="M2.4 8h11.2" />
      <path d="M2.4 11.4h11.2" />
      <circle cx="6.1" cy="4.6" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="8" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="4.9" cy="11.4" r="1.55" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.4v1.7M8 12.9v1.7M1.4 8h1.7M12.9 8h1.7M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M13.6 9.3A5.6 5.6 0 1 1 6.7 2.4a4.6 4.6 0 0 0 6.9 6.9z" />
    </svg>
  );
}

export function IconDoc(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4.1 1.9h4.3L12 5.5v7.4a1.6 1.6 0 0 1-1.6 1.6H4.1a1.6 1.6 0 0 1-1.6-1.6V3.5a1.6 1.6 0 0 1 1.6-1.6z" />
      <path d="M8.4 1.9v3.6H12" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
